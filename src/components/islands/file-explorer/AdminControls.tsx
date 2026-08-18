import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  CopyIcon,
  CutIcon,
  DownloadIcon,
  EditIcon,
  EyeIcon,
  EyeOffIcon,
  FolderPlusIcon,
  PasteIcon,
  SelectIcon,
  TrashIcon,
  UploadIcon,
} from "./icons";
import { adminFetch, encodePath, triggerZipDownload, uploadFile } from "./utils";

// Cloudflare Turnstile: the CAPTCHA-alternative widget gating the admin
// login form. Loaded from Cloudflare's own script, not bundled -- the
// actual challenge (device check / proof-of-work) runs on their
// infrastructure via an iframe, it can't be vendored in.
declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        },
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

// Real Turnstile site key for the "7 Beacons admin login" widget
// (dash.cloudflare.com -> Turnstile). Public by design -- safe to embed
// here, unlike the matching secret key, which is configured separately,
// server-side only, via mcp-fileserver's deploy.sh (see turnstile.py in
// that repo) and must never appear in this repo.
const TURNSTILE_SITE_KEY = "0x4AAAAAAERLEgZL5u6hcYon";

let turnstileScriptPromise: Promise<void> | null = null;

// Idempotent: safe to call from multiple widget mounts over a page's
// lifetime (login form -> mfa step -> a retry all mount their own widget
// instance) without re-injecting the <script> tag or racing two loads.
function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (turnstileScriptPromise) return turnstileScriptPromise;
  turnstileScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Turnstile"));
    document.head.appendChild(script);
  });
  return turnstileScriptPromise;
}

// One-shot: mounts a fresh widget and reports its token up once solved.
// Tokens are single-use (consumed by the server's siteverify call
// regardless of whether the login attempt then succeeds or fails), so a
// NEW TurnstileWidget instance -- not a reused one -- is what a retry needs;
// see LoginPanel's turnstileAttempt below, which forces that via `key`.
function TurnstileWidget({ onToken }: { onToken: (token: string | null) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token) => onToken(token),
          "expired-callback": () => onToken(null),
          "error-callback": () => onToken(null),
        });
      })
      .catch(() => onToken(null));
    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="file-explorer-turnstile" />;
}

interface LoginPanelProps {
  onLoggedIn: () => void;
}

export function LoginPanel({ onLoggedIn }: LoginPanelProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  // Two-step form: password first: if 2FA is enabled, the server confirms
  // the password was right without creating a session and asks for a code
  // (mfaRequired below) instead of logging in outright; the same
  // email+password are then resent together with the code.
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Gates the submit button on both the password step and the mfa step --
  // "only after the check can you press login" per the design. turnstileAttempt
  // is bumped after every submit (success or fail) and used as TurnstileWidget's
  // `key`, forcing a fresh widget/token for the next attempt, since the
  // previous token was already spent against the server's siteverify call.
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileAttempt, setTurnstileAttempt] = useState(0);

  // "Forgot password?" is a separate small form, not another step of the
  // same login flow -- it doesn't need the password field at all, just an
  // email to send a reset link to.
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [forgotBusy, setForgotBusy] = useState(false);

  async function requestReset(e: FormEvent) {
    e.preventDefault();
    setForgotBusy(true);
    setForgotMessage(null);
    try {
      const resp = await adminFetch("/api/admin/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      // The server itself always returns the same generic message regardless
      // of whether the email matched an account, to avoid account
      // enumeration -- mirrored here so the UI can't leak that distinction
      // even by accident. A 429 (client hit the request cooldown) is the one
      // response worth surfacing differently, since it's a rate limit on
      // *this* request, not information about the account.
      if (resp.status === 429) {
        setForgotMessage("Too many requests. Try again in a minute.");
      } else {
        setForgotMessage("If that email is registered, a reset link has been sent.");
      }
    } catch {
      setForgotMessage("If that email is registered, a reset link has been sent.");
    } finally {
      setForgotBusy(false);
    }
  }

  async function attemptLogin(code: string) {
    const resp = await adminFetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        ...(code ? { totp_code: code } : {}),
        turnstile_token: turnstileToken,
      }),
    });
    if (resp.status === 429) {
      const retryAfter = resp.headers.get("Retry-After");
      setError(retryAfter ? `Too many attempts. Try again in ${retryAfter}s.` : "Too many attempts. Try again shortly.");
      return;
    }
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}) as { error?: string });
      if (body.error === "verification failed") {
        setError("Verification failed -- please try again.");
      } else {
        setError(mfaRequired ? "Invalid code." : "Invalid email or password.");
      }
      return;
    }
    const body = (await resp.json()) as { authenticated: boolean; mfa_required?: boolean };
    if (body.mfa_required) {
      setMfaRequired(true);
      return;
    }
    setPassword("");
    setTotpCode("");
    onLoggedIn();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await attemptLogin(mfaRequired ? totpCode : "");
    } catch {
      setError("Login request failed.");
    } finally {
      setBusy(false);
      // The token just submitted (if any) is spent either way -- force a
      // fresh widget for whatever comes next (a retry, or the mfa step).
      setTurnstileToken(null);
      setTurnstileAttempt((n) => n + 1);
    }
  }

  if (forgotMode) {
    return (
      <form className="file-explorer-admin-login" onSubmit={requestReset}>
        <input
          type="email"
          placeholder="Admin email"
          value={forgotEmail}
          onChange={(e) => setForgotEmail(e.target.value)}
          autoComplete="username"
          autoFocus
          required
        />
        <button type="submit" className="file-explorer-icon-button" disabled={forgotBusy}>
          {forgotBusy ? "Sending…" : "Send reset link"}
        </button>
        <button
          type="button"
          className="file-explorer-link-button"
          onClick={() => {
            setForgotMode(false);
            setForgotEmail("");
            setForgotMessage(null);
          }}
        >
          Back to login
        </button>
        {forgotMessage && <span className="file-explorer-admin-login-hint">{forgotMessage}</span>}
      </form>
    );
  }

  if (mfaRequired) {
    return (
      <form className="file-explorer-admin-login" onSubmit={submit}>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="6-digit code"
          value={totpCode}
          onChange={(e) => setTotpCode(e.target.value)}
          maxLength={6}
          autoFocus
          required
        />
        <TurnstileWidget key={turnstileAttempt} onToken={setTurnstileToken} />
        <button type="submit" className="file-explorer-icon-button" disabled={busy || !turnstileToken}>
          {busy ? "Verifying…" : "Verify"}
        </button>
        {error && <span className="file-explorer-error file-explorer-admin-login-error">{error}</span>}
      </form>
    );
  }

  return (
    <form className="file-explorer-admin-login" onSubmit={submit}>
      <input
        type="email"
        placeholder="Admin email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="username"
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        required
      />
      <TurnstileWidget key={turnstileAttempt} onToken={setTurnstileToken} />
      <button type="submit" className="file-explorer-icon-button" disabled={busy || !turnstileToken}>
        {busy ? "Signing in…" : "Log in"}
      </button>
      <button type="button" className="file-explorer-link-button" onClick={() => setForgotMode(true)}>
        Forgot password?
      </button>
      {error && <span className="file-explorer-error file-explorer-admin-login-error">{error}</span>}
    </form>
  );
}

interface ResetPasswordPanelProps {
  token: string;
  onCancel: () => void;
  onSuccess: () => void;
}

// Rendered instead of LoginPanel when the page loaded with a ?reset_token=
// from the emailed link (see the default export below). Not reachable any
// other way -- there's no button anywhere that leads here.
function ResetPasswordPanel({ token, onCancel, onSuccess }: ResetPasswordPanelProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  // The token is single-use and short-lived either way -- once this form is
  // left (cancelled or completed), there's no reason for it to keep sitting
  // in the address bar/browser history.
  function clearTokenFromUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete("reset_token");
    window.history.replaceState({}, "", url.toString());
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      const resp = await adminFetch("/api/admin/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: newPassword }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        setError(body.error ?? "That reset link is invalid or has expired.");
        return;
      }
      clearTokenFromUrl();
      setSuccess(true);
    } catch {
      setError("Reset request failed.");
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <div className="file-explorer-admin-login">
        <span>Password updated. You've been logged out everywhere -- log in again with your new password.</span>
        <button type="button" className="file-explorer-icon-button" onClick={onSuccess}>
          Log in
        </button>
      </div>
    );
  }

  return (
    <form className="file-explorer-admin-login" onSubmit={submit}>
      <input
        type="password"
        placeholder="New password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        autoComplete="new-password"
        autoFocus
        required
      />
      <input
        type="password"
        placeholder="Confirm new password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        autoComplete="new-password"
        required
      />
      <button type="submit" className="file-explorer-icon-button" disabled={busy}>
        {busy ? "Saving…" : "Set new password"}
      </button>
      <button
        type="button"
        className="file-explorer-link-button"
        onClick={() => {
          clearTokenFromUrl();
          onCancel();
        }}
      >
        Cancel
      </button>
      {error && <span className="file-explorer-error file-explorer-admin-login-error">{error}</span>}
    </form>
  );
}

interface AdminBarProps {
  currentFolder: string;
  onChanged: () => void;
}

// Keep in sync with mcp-fileserver's MCP_ADMIN_MAX_UPLOAD_BYTES (deploy.sh) --
// checked client-side too so an oversized file (most likely a long video)
// fails immediately with a clear message instead of after a signed-URL
// round trip, or worse, partway through a 200MB PUT.
const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;

function AdminBar({ currentFolder, onChanged }: AdminBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    // Array.from() must run BEFORE clearing e.target.value below -- a file
    // input's .files is a live FileList tied to the element, and resetting
    // .value empties it in place in some browsers. Materializing plain File
    // references first means the reset can't silently wipe out the
    // selection out from under us.
    const files = Array.from(fileList);
    e.target.value = ""; // reset so picking the same file(s) again still fires onChange

    const tooLarge = files.find((f) => f.size > MAX_UPLOAD_BYTES);
    if (tooLarge) {
      setError(`${tooLarge.name} is larger than the 250MB upload limit.`);
      return;
    }

    setUploading(true);
    setError(null);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadStatus(files.length > 1 ? `Uploading ${i + 1}/${files.length}: ${file.name}` : `Uploading ${file.name}…`);
        const path = currentFolder ? `${currentFolder}/${file.name}` : file.name;
        await uploadFile(path, file, "public", true);
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      setUploadStatus(null);
    }
  }

  async function createFolder() {
    const name = window.prompt("New folder name:");
    if (!name) return;
    const path = currentFolder ? `${currentFolder}/${name}` : name;
    const resp = await adminFetch("/api/admin/mkdir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      window.alert(body.error ?? `Couldn't create folder (${resp.status})`);
      return;
    }
    onChanged();
  }

  return (
    <div className="file-explorer-admin-bar">
      <span className="file-explorer-admin-badge">Admin mode</span>
      <button
        type="button"
        className="file-explorer-icon-button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        <UploadIcon size={14} />
        {uploadStatus ?? `Upload to ${currentFolder || "Home"}`}
      </button>
      <input ref={fileInputRef} type="file" multiple hidden onChange={handleFilesPicked} />
      <button type="button" className="file-explorer-icon-button" onClick={createFolder}>
        <FolderPlusIcon size={14} />
        New folder
      </button>
      {error && <span className="file-explorer-error">{error}</span>}
    </div>
  );
}

// 2FA management -- only reachable once already logged in (via password
// alone if 2FA isn't set up yet). Exported for AdminSettings.tsx (the
// Settings tab of /admin) -- lives here, not there, since it's genuinely
// file-explorer/admin-auth machinery, same as LoginPanel above.
export function TotpSettings() {
  const [enabled, setEnabled] = useState<boolean | null>(null); // null = status not loaded yet
  const [setupData, setSetupData] = useState<{ secret: string; otpauth_url: string } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    adminFetch("/api/admin/totp/status")
      .then((r) => r.json())
      .then((body: { enabled: boolean }) => {
        if (!cancelled) setEnabled(body.enabled);
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function startSetup() {
    setBusy(true);
    setError(null);
    try {
      const resp = await adminFetch("/api/admin/totp/setup", { method: "POST" });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        setError(body.error ?? `Couldn't start setup (${resp.status})`);
        return;
      }
      const body = (await resp.json()) as { secret: string; otpauth_url: string };
      setSetupData(body);
      // Dynamically imported, same reasoning as jszip elsewhere in this
      // file -- keeps a rarely-used dependency out of the main admin bundle.
      const { toDataURL } = await import("qrcode");
      setQrDataUrl(await toDataURL(body.otpauth_url, { margin: 1, width: 220 }));
    } catch {
      setError("Couldn't start setup.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmSetup(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const resp = await adminFetch("/api/admin/totp/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: confirmCode }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        setError(body.error ?? "Invalid code.");
        return;
      }
      setEnabled(true);
      setSetupData(null);
      setQrDataUrl(null);
      setConfirmCode("");
    } finally {
      setBusy(false);
    }
  }

  async function disable(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const resp = await adminFetch("/api/admin/totp/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: disableCode }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        setError(body.error ?? "Invalid code.");
        return;
      }
      setEnabled(false);
      setShowDisableForm(false);
      setDisableCode("");
    } finally {
      setBusy(false);
    }
  }

  if (enabled === null) return null;

  if (setupData) {
    return (
      <div className="file-explorer-totp-settings">
        {qrDataUrl && <img src={qrDataUrl} alt="Scan this QR code with your authenticator app" className="file-explorer-totp-qr" />}
        <span className="file-explorer-totp-secret">Or enter this key manually: {setupData.secret}</span>
        <form className="file-explorer-admin-login" onSubmit={confirmSetup}>
          <input
            type="text"
            inputMode="numeric"
            placeholder="6-digit code"
            value={confirmCode}
            onChange={(e) => setConfirmCode(e.target.value)}
            maxLength={6}
            autoFocus
            required
          />
          <button type="submit" className="file-explorer-icon-button" disabled={busy}>
            {busy ? "Confirming…" : "Confirm"}
          </button>
        </form>
        {error && <span className="file-explorer-error">{error}</span>}
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="file-explorer-totp-settings">
        <button type="button" className="file-explorer-icon-button" onClick={startSetup} disabled={busy}>
          {busy ? "Starting…" : "Set up 2FA"}
        </button>
        {error && <span className="file-explorer-error">{error}</span>}
      </div>
    );
  }

  return (
    <div className="file-explorer-totp-settings">
      <span className="file-explorer-admin-badge">2FA enabled</span>
      {!showDisableForm ? (
        <button type="button" className="file-explorer-icon-button" onClick={() => setShowDisableForm(true)}>
          Disable 2FA
        </button>
      ) : (
        <form className="file-explorer-admin-login" onSubmit={disable}>
          <input
            type="text"
            inputMode="numeric"
            placeholder="6-digit code"
            value={disableCode}
            onChange={(e) => setDisableCode(e.target.value)}
            maxLength={6}
            autoFocus
            required
          />
          <button type="submit" className="file-explorer-icon-button" disabled={busy}>
            {busy ? "Disabling…" : "Confirm disable"}
          </button>
          <button
            type="button"
            className="file-explorer-icon-button"
            onClick={() => {
              setShowDisableForm(false);
              setDisableCode("");
              setError(null);
            }}
          >
            Cancel
          </button>
        </form>
      )}
      {error && <span className="file-explorer-error">{error}</span>}
    </div>
  );
}

export interface AdminControlsProps {
  /** null while the initial /api/admin/session check is still in flight. */
  isAdmin: boolean | null;
  currentFolder: string;
  onAuthChange: (isAdmin: boolean) => void;
  onChanged: () => void;
}

export default function AdminControls({ isAdmin, currentFolder, onAuthChange, onChanged }: AdminControlsProps) {
  // Set once on mount, not read directly during render: window isn't
  // available during Astro's SSG prerender pass for this client:load
  // island, same reason isAdmin itself starts null and is resolved via an
  // effect in FileExplorer.tsx rather than at render time.
  const [resetToken, setResetToken] = useState<string | null>(null);
  useEffect(() => {
    setResetToken(new URLSearchParams(window.location.search).get("reset_token"));
  }, []);

  // Takes priority over both the login form and the logged-in dashboard --
  // reachable from a session-less browser (the whole point of email-based
  // recovery) and doesn't need to wait on the /api/admin/session check
  // FileExplorer.tsx runs in parallel.
  if (resetToken) {
    return (
      <ResetPasswordPanel
        token={resetToken}
        onCancel={() => setResetToken(null)}
        onSuccess={() => {
          setResetToken(null);
          // The reset just revoked every session server-side, so any cookie
          // this tab was holding is already dead -- reflect that immediately
          // instead of waiting for the next session check to notice.
          onAuthChange(false);
        }}
      />
    );
  }

  if (isAdmin === null) return null;
  if (!isAdmin) return <LoginPanel onLoggedIn={() => onAuthChange(true)} />;
  return <AdminBar currentFolder={currentFolder} onChanged={onChanged} />;
}

export interface SelectedItem {
  path: string;
  isFolder: boolean;
  /** Resolved by FileExplorer.tsx before passing down here -- for files it's
   * FileEntry.visibility; for folders it's utils.ts's folderVisibility()
   * (the folder's own placeholder marker's tag). Absent means "public",
   * same convention used everywhere else. */
  visibility: "public" | "admin-only";
}

export interface ClipboardState {
  items: { path: string; isFolder: boolean }[];
  mode: "copy" | "cut";
}

function basenameOf(path: string): string {
  return path.includes("/") ? path.slice(path.lastIndexOf("/") + 1) : path;
}

function stemOf(path: string): string {
  const name = basenameOf(path);
  const dot = name.lastIndexOf(".");
  return dot === -1 ? name : name.slice(0, dot);
}

export interface SelectionToolbarProps {
  selectionMode: boolean;
  onToggleSelectionMode: () => void;
  selectedItems: SelectedItem[];
  currentFolder: string;
  clipboard: ClipboardState | null;
  onSetClipboard: (clipboard: ClipboardState | null) => void;
  onChanged: () => void;
  onClearSelection: () => void;
}

// One persistent top bar (Select / Rename / Delete / Copy / Cut / Paste /
// Hide) instead of icon buttons scattered across every row/card -- Select
// toggles the checkbox UI in FileExplorer.tsx; the other six act on
// whatever's currently checked (Paste acts on the clipboard, into
// currentFolder), and stay disabled until there's something for them to do.
export function SelectionToolbar({
  selectionMode,
  onToggleSelectionMode,
  selectedItems,
  currentFolder,
  clipboard,
  onSetClipboard,
  onChanged,
  onClearSelection,
}: SelectionToolbarProps) {
  const [busy, setBusy] = useState(false);
  const hasSelection = selectedItems.length > 0;
  const allHidden = hasSelection && selectedItems.every((it) => it.visibility === "admin-only");
  // Folders have no single-file download endpoint (no zip/archive support),
  // so only the file entries in a selection are downloadable -- the button
  // just skips any folders mixed into the selection rather than blocking on them.
  const downloadableItems = selectedItems.filter((it) => !it.isFolder);
  const [zipping, setZipping] = useState(false);

  async function handleDownload() {
    if (downloadableItems.length === 0) return;
    setZipping(true);
    try {
      const zipName =
        downloadableItems.length === 1 ? `${stemOf(downloadableItems[0].path)}.zip` : "files.zip";
      await triggerZipDownload(
        downloadableItems.map((it) => it.path),
        zipName,
      );
    } finally {
      setZipping(false);
    }
  }

  async function handleRename() {
    if (selectedItems.length !== 1) return;
    const [item] = selectedItems;
    const currentName = basenameOf(item.path);
    const nextName = window.prompt("Rename to:", currentName);
    if (!nextName || nextName === currentName) return;
    const parent = item.path.includes("/") ? item.path.slice(0, item.path.lastIndexOf("/")) : "";
    const newPath = parent ? `${parent}/${nextName}` : nextName;

    setBusy(true);
    try {
      const resp = await adminFetch("/api/admin/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ old_path: item.path, new_path: newPath, is_folder: item.isFolder }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        window.alert(body.error ?? `Rename failed (${resp.status})`);
        return;
      }
      onClearSelection();
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!hasSelection) return;
    const label = selectedItems.length === 1 ? `"${selectedItems[0].path}"` : `${selectedItems.length} items`;
    if (!window.confirm(`Delete ${label}? This can't be undone.`)) return;

    setBusy(true);
    try {
      for (const item of selectedItems) {
        const url = item.isFolder ? `/api/admin/folders/${encodePath(item.path)}` : `/api/admin/files/${encodePath(item.path)}`;
        const resp = await adminFetch(url, { method: "DELETE" });
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          window.alert(body.error ?? `Delete failed for ${item.path} (${resp.status})`);
        }
      }
      onClearSelection();
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  function handleCopy() {
    if (!hasSelection) return;
    onSetClipboard({ items: selectedItems.map(({ path, isFolder }) => ({ path, isFolder })), mode: "copy" });
  }

  function handleCut() {
    if (!hasSelection) return;
    onSetClipboard({ items: selectedItems.map(({ path, isFolder }) => ({ path, isFolder })), mode: "cut" });
  }

  async function handlePaste() {
    if (!clipboard) return;
    setBusy(true);
    try {
      for (const item of clipboard.items) {
        const newPath = currentFolder ? `${currentFolder}/${basenameOf(item.path)}` : basenameOf(item.path);
        if (newPath === item.path) continue; // pasting back into its own location -- no-op

        const endpoint = clipboard.mode === "copy" ? "/api/admin/copy" : "/api/admin/rename";
        const resp = await adminFetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ old_path: item.path, new_path: newPath, is_folder: item.isFolder }),
        });
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          window.alert(body.error ?? `Paste failed for ${item.path} (${resp.status})`);
        }
      }
      // Cut is one-shot, like a real clipboard's cut+paste; copy stays
      // available so the same items can be pasted into more than one place.
      if (clipboard.mode === "cut") onSetClipboard(null);
      onClearSelection();
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleHide() {
    if (!hasSelection) return;
    const target = allHidden ? "public" : "admin-only";
    setBusy(true);
    try {
      for (const item of selectedItems) {
        const resp = await adminFetch("/api/admin/visibility", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: item.path, is_folder: item.isFolder, visibility: target }),
        });
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          window.alert(body.error ?? `Couldn't change visibility for ${item.path} (${resp.status})`);
        }
      }
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  const actionsDisabled = !selectionMode || busy;

  return (
    <div className="file-explorer-selection-toolbar">
      <button
        type="button"
        className={`file-explorer-icon-button ${selectionMode ? "is-active" : ""}`}
        onClick={onToggleSelectionMode}
      >
        <SelectIcon size={14} />
        {selectionMode && hasSelection ? `${selectedItems.length} selected` : "Select"}
      </button>
      <button type="button" className="file-explorer-icon-button" onClick={handleRename} disabled={actionsDisabled || selectedItems.length !== 1}>
        <EditIcon size={14} />
        Rename
      </button>
      <button type="button" className="file-explorer-icon-button" onClick={handleDelete} disabled={actionsDisabled || !hasSelection}>
        <TrashIcon size={14} />
        Delete
      </button>
      <button
        type="button"
        className="file-explorer-icon-button"
        onClick={handleDownload}
        disabled={actionsDisabled || zipping || downloadableItems.length === 0}
      >
        <DownloadIcon size={14} />
        {zipping ? "Zipping…" : downloadableItems.length > 1 ? `Download (${downloadableItems.length})` : "Download"}
      </button>
      <button type="button" className="file-explorer-icon-button" onClick={handleCopy} disabled={actionsDisabled || !hasSelection}>
        <CopyIcon size={14} />
        Copy
      </button>
      <button type="button" className="file-explorer-icon-button" onClick={handleCut} disabled={actionsDisabled || !hasSelection}>
        <CutIcon size={14} />
        Cut
      </button>
      <button type="button" className="file-explorer-icon-button" onClick={handlePaste} disabled={actionsDisabled || !clipboard}>
        <PasteIcon size={14} />
        {clipboard ? `Paste (${clipboard.items.length})` : "Paste"}
      </button>
      <button type="button" className="file-explorer-icon-button" onClick={handleToggleHide} disabled={actionsDisabled || !hasSelection}>
        {allHidden ? <EyeIcon size={14} /> : <EyeOffIcon size={14} />}
        {allHidden ? "Unhide" : "Hide"}
      </button>
    </div>
  );
}

export interface PublicSelectionToolbarProps {
  selectionMode: boolean;
  onToggleSelectionMode: () => void;
  selectedItems: { path: string; isFolder: boolean }[];
}

// The plain, unauthenticated /fm page's counterpart to SelectionToolbar --
// deliberately a separate, minimal component (not the full toolbar with a
// prop to hide most of it) so there's no mutating action anywhere in its
// code for a public visitor to reach, by construction, not just by disabled
// buttons.
//
// Security note: handleDownload below calls the exact same
// getSignedUrl()/triggerZipDownload() path the admin toolbar's Download
// button uses, with no session cookie attached for an anonymous caller
// (there isn't one to send). That's not a gap -- mcp-fileserver's
// ?format=signed-url endpoint independently re-checks each file's
// visibility server-side on every single request (stat() first, 404 for
// admin-only files, same as every other read route), regardless of what
// this page happens to have rendered or what paths are in `selectedItems`.
// A public visitor cannot get a working signed URL for an admin-only file
// this way -- and since /api/files already omits admin-only entries from
// anonymous listings entirely, there's nothing for `selectedItems` to
// reference in the first place that this UI doesn't already show.
export function PublicSelectionToolbar({ selectionMode, onToggleSelectionMode, selectedItems }: PublicSelectionToolbarProps) {
  const [zipping, setZipping] = useState(false);
  const downloadableItems = selectedItems.filter((it) => !it.isFolder);

  async function handleDownload() {
    if (downloadableItems.length === 0) return;
    setZipping(true);
    try {
      const zipName = downloadableItems.length === 1 ? `${stemOf(downloadableItems[0].path)}.zip` : "files.zip";
      await triggerZipDownload(
        downloadableItems.map((it) => it.path),
        zipName,
      );
    } finally {
      setZipping(false);
    }
  }

  return (
    <div className="file-explorer-selection-toolbar">
      <button
        type="button"
        className={`file-explorer-icon-button ${selectionMode ? "is-active" : ""}`}
        onClick={onToggleSelectionMode}
      >
        <SelectIcon size={14} />
        {selectionMode && selectedItems.length > 0 ? `${selectedItems.length} selected` : "Select"}
      </button>
      <button
        type="button"
        className="file-explorer-icon-button"
        onClick={handleDownload}
        disabled={!selectionMode || zipping || downloadableItems.length === 0}
      >
        <DownloadIcon size={14} />
        {zipping ? "Zipping…" : downloadableItems.length > 1 ? `Download (${downloadableItems.length})` : "Download"}
      </button>
    </div>
  );
}
