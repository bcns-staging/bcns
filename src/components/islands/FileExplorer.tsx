import { useEffect, useMemo, useState } from "react";
import {
  ArchiveIcon,
  AudioIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  FileIcon,
  FolderIcon,
  GridViewIcon,
  HomeIcon,
  ImageIcon,
  ListViewIcon,
  PdfIcon,
  SearchIcon,
  SortIcon,
  VideoIcon,
} from "./file-explorer/icons";
import {
  categoryLabel,
  detectCategory,
  encodePath,
  formatDate,
  formatSize,
  getAllFolders,
  getDirectChildren,
  sortEntries,
  type FileCategory,
  type FileEntry,
  type SortDirection,
  type SortField,
} from "./file-explorer/utils";

// mcp-fileserver: a separate service/repo (github.com/bcns-staging/mcp-fileserver),
// same GCP project. Its /api/files* routes are public and read-only by design --
// see that repo's public_api.py for the server side of this.
const API_BASE = "https://mcp-fileserver-751371770492.us-central1.run.app";

function rawUrl(path: string): string {
  return `${API_BASE}/api/files/${encodePath(path)}?format=raw`;
}

function downloadUrl(path: string): string {
  return `${API_BASE}/api/files/${encodePath(path)}?format=raw&download=1`;
}

function CategoryIcon({ category, size, className }: { category: FileCategory; size?: number; className?: string }) {
  switch (category) {
    case "image":
      return <ImageIcon size={size} className={className} />;
    case "pdf":
      return <PdfIcon size={size} className={className} />;
    case "audio":
      return <AudioIcon size={size} className={className} />;
    case "video":
      return <VideoIcon size={size} className={className} />;
    case "archive":
      return <ArchiveIcon size={size} className={className} />;
    default:
      return <FileIcon size={size} className={className} />;
  }
}

// Shows a real thumbnail for images/videos (reusing the same raw-bytes URL
// the preview pane uses) instead of always falling back to the generic
// category icon -- falls back to CategoryIcon if the file doesn't actually
// decode as that media type (e.g. every current file is really text/plain
// under the hood, since write_file only ever stores text -- see utils.ts's
// detectCategory for why extension-based detection is used at all here).
function FileThumbnail({ file, size, className }: { file: FileEntry; size: number; className?: string }) {
  const category = detectCategory(file.path, file.content_type);
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };

  if (!failed && category === "image") {
    return (
      <img
        src={rawUrl(file.path)}
        alt=""
        className={`file-explorer-thumb ${className ?? ""}`}
        style={style}
        onError={() => setFailed(true)}
      />
    );
  }
  if (!failed && category === "video") {
    return (
      <video
        src={rawUrl(file.path)}
        muted
        preload="metadata"
        className={`file-explorer-thumb ${className ?? ""}`}
        style={style}
        onError={() => setFailed(true)}
      />
    );
  }
  return <CategoryIcon category={category} size={size} className={className} />;
}

function Spinner() {
  return <span className="file-explorer-spinner" role="status" aria-label="Loading" />;
}

function Breadcrumbs({ currentFolder, onNavigate }: { currentFolder: string; onNavigate: (path: string) => void }) {
  const segments = currentFolder ? currentFolder.split("/") : [];
  return (
    <nav className="file-explorer-breadcrumbs" aria-label="Folder path">
      <button type="button" onClick={() => onNavigate("")} className="file-explorer-crumb">
        <HomeIcon size={14} />
        Home
      </button>
      {segments.map((seg, i) => {
        const path = segments.slice(0, i + 1).join("/");
        return (
          <span key={path} className="file-explorer-crumb-group">
            <ChevronRightIcon size={12} className="file-explorer-crumb-sep" />
            <button type="button" onClick={() => onNavigate(path)} className="file-explorer-crumb">
              {seg}
            </button>
          </span>
        );
      })}
    </nav>
  );
}

export default function FileExplorer() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [currentFolder, setCurrentFolder] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState<FileEntry | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setListLoading(true);
    setListError(null);
    fetch(`${API_BASE}/api/files`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json() as Promise<{ files: FileEntry[] }>;
      })
      .then((data) => setFiles(data.files))
      .catch((err) => setListError(err.message))
      .finally(() => setListLoading(false));
  }, [refreshKey]);

  const directoryContents = useMemo(() => getDirectChildren(files, currentFolder), [files, currentFolder]);
  const allFolders = useMemo(() => getAllFolders(files), [files]);

  const isSearching = search.trim().length > 0;

  // Search is global (every file AND folder anywhere in the bucket, at any
  // depth), not scoped to the current folder's direct children -- results
  // show their full path (see the name-cell rendering below) since they can
  // come from anywhere in the tree, not just the folder you're standing in.
  const filteredContents = useMemo(() => {
    if (!isSearching) return directoryContents;
    const q = search.trim().toLowerCase();
    return {
      folders: allFolders.filter((f) => f.path.toLowerCase().includes(q)),
      files: files.filter((f) => f.path.toLowerCase().includes(q)),
    };
  }, [allFolders, directoryContents, files, isSearching, search]);

  const sorted = useMemo(
    () => sortEntries(filteredContents, sortField, sortDirection),
    [filteredContents, sortField, sortDirection],
  );

  // Full path while a global search is active (results can come from any
  // folder), otherwise just the name relative to the folder being browsed.
  function displayName(path: string): string {
    if (isSearching) return path;
    return path.slice(currentFolder ? currentFolder.length + 1 : 0);
  }

  function navigateTo(path: string) {
    setCurrentFolder(path);
    setSearch("");
    setSelected(null);
    setPreviewFailed(false);
  }

  function toggleSort(field: SortField) {
    if (field === sortField) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  }

  function selectFile(file: FileEntry) {
    setSelected(file);
    setPreviewText(null);
    setPreviewError(null);
    setPreviewFailed(false);
    setCopied(false);

    const category = detectCategory(file.path, file.content_type);
    if (category !== "text") return; // non-text previews render directly from rawUrl(), no fetch needed

    setPreviewLoading(true);
    fetch(`${API_BASE}/api/files/${encodePath(file.path)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json() as Promise<{ content: string }>;
      })
      .then((data) => setPreviewText(data.content))
      .catch((err) => setPreviewError(err.message))
      .finally(() => setPreviewLoading(false));
  }

  function copyPath() {
    if (!selected) return;
    navigator.clipboard
      .writeText(selected.path)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        // Clipboard access can be denied (permissions policy, insecure
        // context, etc.) -- fail quietly rather than leaving an unhandled
        // rejection; the button just doesn't show "Copied" confirmation.
      });
  }

  const selectedCategory = selected ? detectCategory(selected.path, selected.content_type) : null;
  const isEmpty = !listLoading && !listError && sorted.folders.length === 0 && sorted.files.length === 0;

  return (
    <div className={`file-explorer ${selected ? "has-preview" : ""}`}>
      <div className="file-explorer-browser">
        <div className="file-explorer-toolbar">
          <Breadcrumbs currentFolder={currentFolder} onNavigate={navigateTo} />
          <div className="file-explorer-toolbar-actions">
            <div className="file-explorer-search">
              <SearchIcon size={14} />
              <input
                type="text"
                placeholder="Search all files…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="file-explorer-view-toggle">
              <button
                type="button"
                className={viewMode === "list" ? "is-active" : ""}
                onClick={() => setViewMode("list")}
                aria-label="List view"
                title="List view"
              >
                <ListViewIcon size={16} />
              </button>
              <button
                type="button"
                className={viewMode === "grid" ? "is-active" : ""}
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
                title="Grid view"
              >
                <GridViewIcon size={16} />
              </button>
            </div>
            <button type="button" className="file-explorer-refresh" onClick={() => setRefreshKey((k) => k + 1)} disabled={listLoading}>
              Refresh
            </button>
          </div>
        </div>

        <div className="file-explorer-listing">
          {listLoading && (
            <div className="file-explorer-status">
              <Spinner /> Loading files…
            </div>
          )}
          {listError && (
            <div className="file-explorer-status file-explorer-error-block">
              Failed to load: {listError}
              <button type="button" onClick={() => setRefreshKey((k) => k + 1)}>
                Retry
              </button>
            </div>
          )}
          {isEmpty && (
            <p className="file-explorer-status">{isSearching ? "No files match your search." : "This folder is empty."}</p>
          )}

          {!listLoading && !listError && viewMode === "list" && (sorted.folders.length > 0 || sorted.files.length > 0) && (
            <table className="file-explorer-table">
              <colgroup>
                <col className="col-name" />
                <col className="col-type" />
                <col className="col-size" />
                <col className="col-modified" />
              </colgroup>
              <thead>
                <tr>
                  <SortableHeader label="Name" field="name" active={sortField} direction={sortDirection} onSort={toggleSort} />
                  <SortableHeader label="Type" field="type" active={sortField} direction={sortDirection} onSort={toggleSort} />
                  <SortableHeader label="Size" field="size" active={sortField} direction={sortDirection} onSort={toggleSort} />
                  <SortableHeader label="Modified" field="modified" active={sortField} direction={sortDirection} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {sorted.folders.map((folder) => (
                  <tr key={folder.path} onClick={() => navigateTo(folder.path)} className="file-explorer-row">
                    <td className="file-explorer-name-cell">
                      <FolderIcon size={17} />
                      <span className="file-explorer-filename">{isSearching ? folder.path : folder.name}</span>
                    </td>
                    <td>Folder</td>
                    <td>—</td>
                    <td>—</td>
                  </tr>
                ))}
                {sorted.files.map((file) => {
                  const category = detectCategory(file.path, file.content_type);
                  return (
                    <tr
                      key={file.path}
                      onClick={() => selectFile(file)}
                      className={`file-explorer-row ${selected?.path === file.path ? "is-selected" : ""}`}
                    >
                      <td className="file-explorer-name-cell">
                        <FileThumbnail file={file} size={17} />
                        <span className="file-explorer-filename">{displayName(file.path)}</span>
                      </td>
                      <td>{categoryLabel(category)}</td>
                      <td>{formatSize(file.size_bytes)}</td>
                      <td>{formatDate(file.updated)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {!listLoading && !listError && viewMode === "grid" && (sorted.folders.length > 0 || sorted.files.length > 0) && (
            <div className="file-explorer-grid">
              {sorted.folders.map((folder) => (
                <button type="button" key={folder.path} className="file-explorer-card" onClick={() => navigateTo(folder.path)}>
                  <FolderIcon size={36} />
                  <span className="file-explorer-card-name">{isSearching ? folder.path : folder.name}</span>
                </button>
              ))}
              {sorted.files.map((file) => {
                return (
                  <button
                    type="button"
                    key={file.path}
                    className={`file-explorer-card ${selected?.path === file.path ? "is-selected" : ""}`}
                    onClick={() => selectFile(file)}
                  >
                    <FileThumbnail file={file} size={36} />
                    <span className="file-explorer-card-name">{displayName(file.path)}</span>
                    <span className="file-explorer-card-size">{formatSize(file.size_bytes)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div className="file-explorer-preview">
          <div className="file-explorer-preview-header">
            <Breadcrumbs currentFolder={selected.path.split("/").slice(0, -1).join("/")} onNavigate={navigateTo} />
            <div className="file-explorer-preview-header-actions">
              <button type="button" onClick={() => setSelected(null)} title="Close preview" className="file-explorer-icon-button">
                Close
              </button>
              <button type="button" onClick={copyPath} title="Copy path" className="file-explorer-icon-button">
                <CopyIcon size={14} />
                {copied ? "Copied" : "Copy path"}
              </button>
              <a href={downloadUrl(selected.path)} download className="file-explorer-icon-button file-explorer-download">
                <DownloadIcon size={14} />
                Download
              </a>
            </div>
          </div>
          <div className="file-explorer-preview-path">{selected.path}</div>

          <div className="file-explorer-preview-body">
            {selectedCategory === "text" && previewLoading && (
              <div className="file-explorer-status">
                <Spinner /> Loading…
              </div>
            )}
            {selectedCategory === "text" && previewError && (
              <p className="file-explorer-status file-explorer-error">Failed to load: {previewError}</p>
            )}
            {selectedCategory === "text" && !previewLoading && previewText !== null && <pre>{previewText}</pre>}

            {selectedCategory === "image" && !previewFailed && (
              <img
                src={rawUrl(selected.path)}
                alt={selected.path}
                className="file-explorer-media"
                onError={() => setPreviewFailed(true)}
              />
            )}
            {selectedCategory === "pdf" && !previewFailed && (
              <iframe src={rawUrl(selected.path)} title={selected.path} className="file-explorer-media file-explorer-iframe" />
            )}
            {selectedCategory === "audio" && !previewFailed && (
              <audio controls src={rawUrl(selected.path)} className="file-explorer-media" onError={() => setPreviewFailed(true)} />
            )}
            {selectedCategory === "video" && !previewFailed && (
              <video controls src={rawUrl(selected.path)} className="file-explorer-media" onError={() => setPreviewFailed(true)} />
            )}
            {(selectedCategory === "archive" || previewFailed) && (
              <div className="file-explorer-no-preview">
                <CategoryIcon category={selectedCategory ?? "text"} size={48} />
                <p>Preview isn't available for this file.</p>
                <a href={downloadUrl(selected.path)} download className="file-explorer-icon-button file-explorer-download">
                  <DownloadIcon size={14} />
                  Download
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SortableHeader({
  label,
  field,
  active,
  direction,
  onSort,
}: {
  label: string;
  field: SortField;
  active: SortField;
  direction: SortDirection;
  onSort: (field: SortField) => void;
}) {
  const isActive = active === field;
  return (
    <th>
      <button type="button" onClick={() => onSort(field)} className={isActive ? "is-active" : ""}>
        {label}
        {isActive && <SortIcon size={12} className={direction === "desc" ? "file-explorer-sort-desc" : ""} />}
      </button>
    </th>
  );
}
