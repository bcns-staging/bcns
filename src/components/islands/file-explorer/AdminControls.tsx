import { useRef, useState, type FormEvent } from "react";
import {
  CopyIcon,
  CutIcon,
  DownloadIcon,
  EditIcon,
  EyeIcon,
  EyeOffIcon,
  FolderPlusIcon,
  LogOutIcon,
  PasteIcon,
  SelectIcon,
  TrashIcon,
  UploadIcon,
} from "./icons";
import { adminFetch, encodePath, triggerZipDownload, uploadFile } from "./utils";

interface LoginPanelProps {
  onLoggedIn: () => void;
}

function LoginPanel({ onLoggedIn }: LoginPanelProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const resp = await adminFetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (resp.status === 429) {
        const retryAfter = resp.headers.get("Retry-After");
        setError(retryAfter ? `Too many attempts. Try again in ${retryAfter}s.` : "Too many attempts. Try again shortly.");
        return;
      }
      if (!resp.ok) {
        setError("Invalid email or password.");
        return;
      }
      setPassword("");
      onLoggedIn();
    } catch {
      setError("Login request failed.");
    } finally {
      setBusy(false);
    }
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
      <button type="submit" className="file-explorer-icon-button" disabled={busy}>
        {busy ? "Signing in…" : "Log in"}
      </button>
      {error && <span className="file-explorer-error file-explorer-admin-login-error">{error}</span>}
    </form>
  );
}

interface AdminBarProps {
  currentFolder: string;
  onChanged: () => void;
  onLoggedOut: () => void;
}

// Keep in sync with mcp-fileserver's MCP_ADMIN_MAX_UPLOAD_BYTES (deploy.sh) --
// checked client-side too so an oversized file (most likely a long video)
// fails immediately with a clear message instead of after a signed-URL
// round trip, or worse, partway through a 200MB PUT.
const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;

function AdminBar({ currentFolder, onChanged, onLoggedOut }: AdminBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function logout() {
    await adminFetch("/api/admin/logout", { method: "POST" });
    onLoggedOut();
  }

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
      <button type="button" className="file-explorer-icon-button" onClick={logout}>
        <LogOutIcon size={14} />
        Log out
      </button>
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
  if (isAdmin === null) return null;
  if (!isAdmin) return <LoginPanel onLoggedIn={() => onAuthChange(true)} />;
  return <AdminBar currentFolder={currentFolder} onChanged={onChanged} onLoggedOut={() => onAuthChange(false)} />;
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
