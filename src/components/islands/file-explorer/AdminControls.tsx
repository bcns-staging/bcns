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
import { adminFetch, encodePath, triggerDownload } from "./utils";

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

function AdminBar({ currentFolder, onChanged, onLoggedOut }: AdminBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logout() {
    await adminFetch("/api/admin/logout", { method: "POST" });
    onLoggedOut();
  }

  async function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so picking the same file again still fires onChange
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const path = currentFolder ? `${currentFolder}/${file.name}` : file.name;
      const form = new FormData();
      form.append("file", file);
      form.append("path", path);
      form.append("overwrite", "true");
      const resp = await adminFetch("/api/admin/upload", { method: "POST", body: form });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        setError(body.error ?? `Upload failed (${resp.status})`);
        return;
      }
      onChanged();
    } catch {
      setError("Upload failed.");
    } finally {
      setUploading(false);
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
        {uploading ? "Uploading…" : `Upload to ${currentFolder || "Home"}`}
      </button>
      <input ref={fileInputRef} type="file" hidden onChange={handleFilePicked} />
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

  function handleDownload() {
    for (const item of downloadableItems) {
      triggerDownload(item.path);
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
      <button type="button" className="file-explorer-icon-button" onClick={handleDownload} disabled={actionsDisabled || downloadableItems.length === 0}>
        <DownloadIcon size={14} />
        Download
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
