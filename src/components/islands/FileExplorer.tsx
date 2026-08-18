import { useEffect, useMemo, useState } from "react";
import AdminControls, {
  PublicSelectionToolbar,
  SelectionToolbar,
  type ClipboardState,
  type SelectedItem,
} from "./file-explorer/AdminControls";
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
  LockIcon,
  PdfIcon,
  SearchIcon,
  SortIcon,
  VideoIcon,
} from "./file-explorer/icons";
import {
  API_BASE,
  basename,
  categoryLabel,
  checkAdminSession,
  detectCategory,
  encodePath,
  folderSizeBytes,
  folderVisibility,
  formatDate,
  formatSize,
  getAllFolders,
  getDirectChildren,
  getSignedUrl,
  rawUrl,
  sortEntries,
  stripFolderPlaceholders,
  triggerZipDownload,
  type FileCategory,
  type FileEntry,
  type FolderChild,
  type SortDirection,
  type SortField,
} from "./file-explorer/utils";

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
function FileThumbnail({
  file,
  size = 18,
  fill = false,
  className,
}: {
  file: FileEntry;
  size?: number;
  // Gallery mode for the grid view's image/video cards: the thumbnail fills
  // its parent tile completely (parent controls the square aspect ratio via
  // CSS) instead of being a small fixed-size icon-replacement -- see the
  // file-explorer-card-media branch below.
  fill?: boolean;
  className?: string;
}) {
  const category = detectCategory(file.path, file.content_type);
  const [failed, setFailed] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const thumbClass = fill ? "file-explorer-thumb-fill" : "file-explorer-thumb";
  const style = fill ? undefined : { width: size, height: size };

  // Video thumbnails, same as the preview pane: Cloud Run doesn't support
  // the HTTP Range requests a <video> needs, even just to grab a poster
  // frame for preload="metadata" -- so this needs the same signed, direct-
  // to-GCS URL rather than rawUrl(). Not needed for images (a plain <img>
  // GET works fine without Range support).
  useEffect(() => {
    if (category !== "video") return;
    let cancelled = false;
    getSignedUrl(file.path)
      .then((url) => {
        if (!cancelled) setVideoUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [category, file.path]);

  if (!failed && category === "image") {
    return (
      <img
        src={rawUrl(file.path)}
        alt=""
        className={`${thumbClass} ${className ?? ""}`}
        style={style}
        onError={() => setFailed(true)}
      />
    );
  }
  if (!failed && category === "video" && videoUrl) {
    return (
      <video
        src={videoUrl}
        muted
        preload="metadata"
        playsInline
        className={`${thumbClass} ${className ?? ""}`}
        style={style}
        onError={() => setFailed(true)}
        // Frame 0 is very often a black/blank fade-in -- seeking to the
        // midpoint once we know the duration gives a much more
        // representative still. Fine here specifically because this video
        // is never actually played (muted, no controls, the whole tile is
        // just a click target that opens the real preview); doing the same
        // in the preview pane's player would make playback start from the
        // middle instead of the beginning, which is why it's thumbnail-only.
        onLoadedMetadata={(e) => {
          const video = e.currentTarget;
          if (Number.isFinite(video.duration) && video.duration > 0) {
            video.currentTime = video.duration / 2;
          }
        }}
      />
    );
  }
  // Fallback: failed to load, a non-media category, or (for video) the
  // signed URL just hasn't resolved yet -- still sized to look reasonable
  // centered in a square gallery tile.
  return <CategoryIcon category={category} size={fill ? 32 : size} className={className} />;
}

// Only ever rendered when the viewer is a logged-in admin -- visibility is
// omitted from the API response entirely for anyone else (see utils.ts's
// FileEntry doc comment), so there's no "admin-only" data to leak into this
// badge's absence/presence either way.
function HiddenBadge({ className }: { className?: string }) {
  return (
    <span className={`file-explorer-hidden-badge ${className ?? ""}`} title="Hidden from public visitors">
      <LockIcon size={11} />
      Hidden
    </span>
  );
}

// A gallery tile's thumbnail (a still frame, or the photo itself) doesn't
// otherwise say whether it's a video or an image -- a small corner badge
// disambiguates without needing to open the preview.
function MediaTypeBadge({ category }: { category: "image" | "video" }) {
  return (
    <span className={`file-explorer-media-type-badge ${category === "video" ? "is-video" : ""}`} aria-hidden="true">
      {category === "video" ? <VideoIcon size={12} /> : <ImageIcon size={12} />}
    </span>
  );
}

// Purely a visual reflection of selection state, not a real <input
// type="checkbox"> -- the whole row/card is already the click target that
// toggles selection (see handleFolderActivate/handleFileActivate below), and
// a plain <span> avoids interactive-content-inside-interactive-content HTML
// nesting concerns entirely.
function SelectionCheckbox({ checked }: { checked: boolean }) {
  return <span className={`file-explorer-checkbox ${checked ? "is-checked" : ""}`} aria-hidden="true" />;
}

function Spinner() {
  return <span className="file-explorer-spinner" role="status" aria-label="Loading" />;
}

// dirCount/fileCount are optional: the main toolbar's call site passes them
// (current folder's own item counts, shown in the status bar), while the
// preview pane header's call site (just a compact path indicator, not a
// status bar) omits them and gets the bare crumb trail back.
function Breadcrumbs({
  currentFolder,
  onNavigate,
  dirCount,
  fileCount,
}: {
  currentFolder: string;
  onNavigate: (path: string) => void;
  dirCount?: number;
  fileCount?: number;
}) {
  const segments = currentFolder ? currentFolder.split("/") : [];
  const crumbs = (
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

  if (dirCount === undefined || fileCount === undefined) return crumbs;

  return (
    <div className="file-explorer-breadcrumb-bar">
      <span className="file-explorer-status-dot" aria-hidden="true" />
      {crumbs}
      <span className="file-explorer-item-count">
        {dirCount} {dirCount === 1 ? "dir" : "dirs"} · {fileCount} {fileCount === 1 ? "file" : "files"}
      </span>
    </div>
  );
}

export interface FileExplorerProps {
  /** Renders the login form / upload / mkdir / delete / rename / visibility
   * controls (the File Manager tab of src/pages/admin.astro). The plain /fm
   * page omits this --
   * an already-logged-in admin still sees hidden files and the "Hidden"
   * badge there (isAdmin below is checked unconditionally), just not the
   * mutating controls, keeping /fm itself strictly browse-only. */
  adminMode?: boolean;
}

export default function FileExplorer({ adminMode = false }: FileExplorerProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // null until the initial /api/admin/session check resolves.
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    checkAdminSession().then((authenticated) => {
      if (!cancelled) setIsAdmin(authenticated);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Logging in/out changes which files the server will include in the list
  // response (visibility filtering happens server-side, keyed off the
  // session cookie on that same request) -- bump refreshKey alongside
  // isAdmin so the list is refetched, not just the badge/controls re-rendered.
  function handleAuthChange(next: boolean) {
    setIsAdmin(next);
    setRefreshKey((k) => k + 1);
  }

  // Bulk-selection state for the SelectionToolbar (Select/Rename/Delete/
  // Copy/Cut/Paste/Hide) -- replaces per-row action icons with one top bar.
  // Selection itself is scoped to whatever folder you're standing in (reset
  // on navigation, see navigateTo below); the clipboard persists across
  // navigation so Cut in one folder -> Paste in another actually works.
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<{ path: string; isFolder: boolean }[]>([]);
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null);

  function toggleSelectionMode() {
    setSelectionMode((m) => !m);
    setSelectedItems([]);
    setSelected(null);
  }

  function toggleItemSelected(path: string, isFolder: boolean) {
    setSelectedItems((items) =>
      items.some((it) => it.path === path) ? items.filter((it) => it.path !== path) : [...items, { path, isFolder }],
    );
  }

  function isItemSelected(path: string) {
    return selectedItems.some((it) => it.path === path);
  }

  const [currentFolder, setCurrentFolder] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState<FileEntry | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  // Defaults to "preview" (render the page) per the feature ask, with
  // "source" as an escape hatch back to the old code view -- reset to
  // "preview" on every new selection so a stale toggle choice from a
  // previously-viewed file doesn't carry over.
  const [htmlViewMode, setHtmlViewMode] = useState<"preview" | "source">("preview");
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  // Video/audio play from a signed GCS URL, not rawUrl() -- Cloud Run
  // doesn't support the HTTP Range requests playback/seeking needs. null
  // while the signed URL is being fetched for the currently-selected file.
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaUrlError, setMediaUrlError] = useState(false);

  useEffect(() => {
    setListLoading(true);
    setListError(null);
    // no-store: this same URL returns different files depending on the
    // caller's login state (admin-only entries included or omitted, see
    // public_api.py) -- the server already sends Cache-Control: no-store
    // for the same reason, this is belt-and-suspenders against the
    // browser's HTTP cache reusing a pre-login (or post-logout) response.
    fetch(`${API_BASE}/api/files`, { credentials: "include", cache: "no-store" })
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
      // Placeholder marker objects never surface as search "files" -- unlike
      // getDirectChildren's prefix-splitting, this is a flat substring match
      // over the raw list, so it needs the strip applied explicitly.
      files: stripFolderPlaceholders(files.filter((f) => f.path.toLowerCase().includes(q))),
    };
  }, [allFolders, directoryContents, files, isSearching, search]);

  const sorted = useMemo(
    () => sortEntries(filteredContents, sortField, sortDirection, files, isAdmin === true),
    [filteredContents, sortField, sortDirection, files, isAdmin],
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
    // Selection is scoped to "what's checked in the folder I'm looking at
    // right now" -- the clipboard (separate state) is what's meant to
    // survive a folder change, for Cut-here/Paste-there.
    setSelectedItems([]);
  }

  // While selectionMode is on, activating a row/card toggles its checkbox
  // instead of navigating/previewing -- otherwise falls through to the
  // normal browsing behavior.
  function handleFolderActivate(folder: FolderChild) {
    if (selectionMode) {
      toggleItemSelected(folder.path, true);
    } else {
      navigateTo(folder.path);
    }
  }

  function handleFileActivate(file: FileEntry) {
    if (selectionMode) {
      toggleItemSelected(file.path, false);
    } else {
      selectFile(file);
    }
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
    setMediaUrl(null);
    setMediaUrlError(false);
    setHtmlViewMode("preview");

    const category = detectCategory(file.path, file.content_type);

    if (category === "video" || category === "audio") {
      getSignedUrl(file.path)
        .then((url) => setMediaUrl(url))
        .catch(() => setMediaUrlError(true));
      return;
    }

    // image/pdf previews render directly from rawUrl(), no fetch needed.
    // html also renders straight from rawUrl() (see the sandboxed iframe
    // below), but its text is still fetched here too so the "View source"
    // toggle has something to show without a second round trip.
    if (category !== "text" && category !== "html") return;

    setPreviewLoading(true);
    // no-store: same reasoning as the /api/files list fetch above.
    fetch(`${API_BASE}/api/files/${encodePath(file.path)}`, { credentials: "include", cache: "no-store" })
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

  async function downloadSelected() {
    if (!selected) return;
    setDownloading(true);
    try {
      const name = basename(selected.path);
      const dot = name.lastIndexOf(".");
      const stem = dot === -1 ? name : name.slice(0, dot);
      await triggerZipDownload([selected.path], `${stem}.zip`);
    } finally {
      setDownloading(false);
    }
  }

  const selectedCategory = selected ? detectCategory(selected.path, selected.content_type) : null;
  const isEmpty = !listLoading && !listError && sorted.folders.length === 0 && sorted.files.length === 0;
  const showAdminControls = adminMode && isAdmin === true;
  // Selection (and its checkboxes) is available on both the admin page
  // (full SelectionToolbar) and the plain /fm page (PublicSelectionToolbar,
  // Select + Download only) -- toggled by whichever of those two renders
  // below, so this just follows selectionMode itself.
  const showCheckboxColumn = selectionMode;

  function refreshAfterAdminChange() {
    setRefreshKey((k) => k + 1);
  }

  function getFolderVisibility(path: string) {
    return folderVisibility(files, path);
  }

  const selectedItemsResolved: SelectedItem[] = useMemo(
    () =>
      selectedItems.map((it) => ({
        ...it,
        visibility: it.isFolder ? getFolderVisibility(it.path) : (files.find((f) => f.path === it.path)?.visibility ?? "public"),
      })),
    [selectedItems, files],
  );

  return (
    <div className={`file-explorer ${selected ? "has-preview" : ""}`}>
      <div className="file-explorer-browser">
        <div className="file-explorer-toolbar">
          <div className="file-explorer-toolbar-top">
            <Breadcrumbs
              currentFolder={currentFolder}
              onNavigate={navigateTo}
              dirCount={directoryContents.folders.length}
              fileCount={directoryContents.files.length}
            />
            {showAdminControls && (
              <SelectionToolbar
                selectionMode={selectionMode}
                onToggleSelectionMode={toggleSelectionMode}
                selectedItems={selectedItemsResolved}
                currentFolder={currentFolder}
                clipboard={clipboard}
                onSetClipboard={setClipboard}
                onChanged={refreshAfterAdminChange}
                onClearSelection={() => setSelectedItems([])}
              />
            )}
            {!adminMode && (
              <PublicSelectionToolbar
                selectionMode={selectionMode}
                onToggleSelectionMode={toggleSelectionMode}
                selectedItems={selectedItems}
              />
            )}
          </div>
          {adminMode && (
            <AdminControls
              isAdmin={isAdmin}
              currentFolder={currentFolder}
              onAuthChange={handleAuthChange}
              onChanged={refreshAfterAdminChange}
            />
          )}
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
            <table className={`file-explorer-table ${showCheckboxColumn ? "has-admin-col" : ""}`}>
              <colgroup>
                <col className="col-name" />
                <col className="col-type" />
                <col className="col-size" />
                <col className="col-modified" />
                {showCheckboxColumn && <col className="col-admin" />}
              </colgroup>
              <thead>
                <tr>
                  <SortableHeader label="Name" field="name" active={sortField} direction={sortDirection} onSort={toggleSort} />
                  <SortableHeader label="Type" field="type" active={sortField} direction={sortDirection} onSort={toggleSort} />
                  <SortableHeader label="Size" field="size" active={sortField} direction={sortDirection} onSort={toggleSort} />
                  <SortableHeader label="Modified" field="modified" active={sortField} direction={sortDirection} onSort={toggleSort} />
                  {showCheckboxColumn && <th></th>}
                </tr>
              </thead>
              <tbody>
                {sorted.folders.map((folder) => {
                  const visibility = getFolderVisibility(folder.path);
                  return (
                    <tr key={folder.path} onClick={() => handleFolderActivate(folder)} className="file-explorer-row">
                      <td className="file-explorer-name-cell">
                        <FolderIcon size={17} />
                        <span className="file-explorer-filename">{isSearching ? folder.path : folder.name}</span>
                        {isAdmin && visibility === "admin-only" && <HiddenBadge />}
                      </td>
                      <td className="file-explorer-type-cell file-explorer-type-dir">Dir</td>
                      <td>{formatSize(folderSizeBytes(files, folder.path, isAdmin === true))}</td>
                      <td>—</td>
                      {showCheckboxColumn && (
                        <td>
                          <SelectionCheckbox checked={isItemSelected(folder.path)} />
                        </td>
                      )}
                    </tr>
                  );
                })}
                {sorted.files.map((file) => {
                  const category = detectCategory(file.path, file.content_type);
                  return (
                    <tr
                      key={file.path}
                      onClick={() => handleFileActivate(file)}
                      className={`file-explorer-row ${selected?.path === file.path ? "is-selected" : ""}`}
                    >
                      <td className="file-explorer-name-cell">
                        <FileThumbnail file={file} size={17} />
                        <span className="file-explorer-filename">{displayName(file.path)}</span>
                        {isAdmin && file.visibility === "admin-only" && <HiddenBadge />}
                      </td>
                      <td className={`file-explorer-type-cell file-explorer-type-${category}`}>{categoryLabel(category)}</td>
                      <td>{formatSize(file.size_bytes)}</td>
                      <td>{formatDate(file.updated)}</td>
                      {showCheckboxColumn && (
                        <td>
                          <SelectionCheckbox checked={isItemSelected(file.path)} />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {!listLoading && !listError && viewMode === "grid" && (sorted.folders.length > 0 || sorted.files.length > 0) && (
            <div className="file-explorer-grid">
              {sorted.folders.map((folder) => {
                const visibility = getFolderVisibility(folder.path);
                return (
                  <button
                    type="button"
                    key={folder.path}
                    className="file-explorer-card"
                    onClick={() => handleFolderActivate(folder)}
                  >
                    {showCheckboxColumn && (
                      <span className="file-explorer-card-checkbox">
                        <SelectionCheckbox checked={isItemSelected(folder.path)} />
                      </span>
                    )}
                    <FolderIcon size={52} />
                    <span className="file-explorer-card-name">{isSearching ? folder.path : folder.name}</span>
                    <span className="file-explorer-card-size">{formatSize(folderSizeBytes(files, folder.path, isAdmin === true))}</span>
                    {isAdmin && visibility === "admin-only" && <HiddenBadge />}
                  </button>
                );
              })}
              {sorted.files.map((file) => {
                const category = detectCategory(file.path, file.content_type);
                // Images/videos get a full-bleed gallery tile (thumbnail
                // only, no filename/size caption) -- everything else keeps
                // the icon + name + size card layout.
                const isMedia = category === "image" || category === "video";
                return (
                  <button
                    type="button"
                    key={file.path}
                    title={isMedia ? displayName(file.path) : undefined}
                    className={`file-explorer-card ${isMedia ? "file-explorer-card-media" : ""} ${selected?.path === file.path ? "is-selected" : ""}`}
                    onClick={() => handleFileActivate(file)}
                  >
                    {showCheckboxColumn && (
                      <span className="file-explorer-card-checkbox">
                        <SelectionCheckbox checked={isItemSelected(file.path)} />
                      </span>
                    )}
                    {isMedia ? (
                      <>
                        <FileThumbnail file={file} fill />
                        <MediaTypeBadge category={category as "image" | "video"} />
                        {isAdmin && file.visibility === "admin-only" && (
                          <HiddenBadge className="file-explorer-hidden-badge-overlay" />
                        )}
                      </>
                    ) : (
                      <>
                        <FileThumbnail file={file} size={52} />
                        <span className="file-explorer-card-name">{displayName(file.path)}</span>
                        <span className="file-explorer-card-size">{formatSize(file.size_bytes)}</span>
                        {isAdmin && file.visibility === "admin-only" && <HiddenBadge />}
                      </>
                    )}
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
              <button
                type="button"
                onClick={downloadSelected}
                disabled={downloading}
                className="file-explorer-icon-button file-explorer-download"
              >
                <DownloadIcon size={14} />
                {downloading ? "Zipping…" : "Download"}
              </button>
            </div>
          </div>
          <div className="file-explorer-preview-path">{selected.path}</div>

          <div className="file-explorer-preview-body">
            {(selectedCategory === "text" || selectedCategory === "html") && previewLoading && (
              <div className="file-explorer-status">
                <Spinner /> Loading…
              </div>
            )}
            {(selectedCategory === "text" || selectedCategory === "html") && previewError && (
              <p className="file-explorer-status file-explorer-error">Failed to load: {previewError}</p>
            )}
            {selectedCategory === "text" && !previewLoading && previewText !== null && <pre>{previewText}</pre>}

            {selectedCategory === "html" && !previewLoading && !previewError && (
              <div className="file-explorer-html-preview">
                <div className="file-explorer-view-toggle file-explorer-html-toggle">
                  <button
                    type="button"
                    className={htmlViewMode === "preview" ? "is-active" : ""}
                    onClick={() => setHtmlViewMode("preview")}
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    className={htmlViewMode === "source" ? "is-active" : ""}
                    onClick={() => setHtmlViewMode("source")}
                  >
                    View source
                  </button>
                </div>
                {htmlViewMode === "preview" ? (
                  // Rendered from rawUrl() (mcp-fileserver's own origin), not
                  // srcDoc -- srcDoc would inherit this site's own strict CSP
                  // (script-src/style-src locked to Astro's own precomputed
                  // hashes), which would silently strip any inline <style>/
                  // <script> the previewed file has and defeat the point of
                  // a real rendered preview. mcp-fileserver sets no CSP of
                  // its own, so this renders with full fidelity instead.
                  //
                  // What makes that safe: sandbox="allow-scripts" WITHOUT
                  // allow-same-origin forces this frame into a unique opaque
                  // origin no matter what URL it loaded from. That blocks
                  // script in the previewed file from reading this site's or
                  // mcp-fileserver's cookies, and any fetch() it fires at
                  // mcp-fileserver's admin API carries an Origin: null header
                  // that its CORS allowlist rejects -- so even a malicious
                  // HTML file (this could be a saved email attachment) can't
                  // ride the admin's session to do anything. No allow-forms/
                  // allow-popups/allow-top-navigation either, so it can't
                  // phish via a fake login form or redirect the tab. Not
                  // covered: the file's own external resource loads (e.g. an
                  // email tracking pixel) still go out -- sandboxing doesn't
                  // block subresource requests, only scripted/credentialed
                  // access back into this app.
                  <iframe
                    src={rawUrl(selected.path)}
                    sandbox="allow-scripts"
                    title={selected.path}
                    className="file-explorer-media file-explorer-iframe"
                  />
                ) : (
                  <pre>{previewText}</pre>
                )}
              </div>
            )}

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
            {(selectedCategory === "video" || selectedCategory === "audio") &&
              !mediaUrl &&
              !mediaUrlError &&
              !previewFailed && (
                <div className="file-explorer-status">
                  <Spinner /> Loading…
                </div>
              )}
            {selectedCategory === "audio" && mediaUrl && !previewFailed && (
              <audio
                controls
                preload="metadata"
                src={mediaUrl}
                className="file-explorer-media"
                onError={() => setPreviewFailed(true)}
              />
            )}
            {selectedCategory === "video" && mediaUrl && !previewFailed && (
              // playsInline: don't force fullscreen on mobile just to start
              // playback. preload="metadata" (not the "auto" default): fetch
              // just enough for duration/dimensions, not the whole file up
              // front -- matters a lot more now that a video can be 250MB.
              // Everything else (seek scrubbing, volume, fullscreen,
              // picture-in-picture, playback speed) is the browser's own
              // native controls, which is why this needed a real Range-
              // capable source (mediaUrl, a signed GCS URL) to begin with --
              // rawUrl() through Cloud Run doesn't support seeking at all.
              <video
                controls
                preload="metadata"
                playsInline
                src={mediaUrl}
                className="file-explorer-media"
                onError={() => setPreviewFailed(true)}
              />
            )}
            {(selectedCategory === "archive" || previewFailed || mediaUrlError) && (
              <div className="file-explorer-no-preview">
                <CategoryIcon category={selectedCategory ?? "text"} size={48} />
                <p>Preview isn't available for this file.</p>
                <button
                  type="button"
                  onClick={downloadSelected}
                  disabled={downloading}
                  className="file-explorer-icon-button file-explorer-download"
                >
                  <DownloadIcon size={14} />
                  {downloading ? "Zipping…" : "Download"}
                </button>
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
