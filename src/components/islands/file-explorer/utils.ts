// mcp-fileserver: a separate service/repo (github.com/bcns-staging/mcp-fileserver),
// same GCP project. Its /api/files* routes are public and read-only; /api/admin/*
// requires a logged-in admin session -- see that repo's public_api.py/admin_api.py.
export const API_BASE = "https://mcp-fileserver-751371770492.us-central1.run.app";

export interface FileEntry {
  path: string;
  size_bytes: number;
  content_type: string;
  created: string;
  updated: string;
  // Only ever present when the request was made as an authenticated admin --
  // public_api.py omits this key entirely for anonymous callers, both so
  // there's nothing to accidentally branch on client-side and because a
  // non-admin-only file is always implicitly "public" anyway.
  visibility?: "public" | "admin-only";
}

export interface FolderChild {
  name: string;
  path: string; // full path from root, no trailing slash
}

export interface DirectoryContents {
  folders: FolderChild[];
  files: FileEntry[];
}

export type FileCategory = "image" | "pdf" | "audio" | "video" | "archive" | "text";

export type SortField = "name" | "size" | "modified" | "type";
export type SortDirection = "asc" | "desc";

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

export function rawUrl(path: string): string {
  return `${API_BASE}/api/files/${encodePath(path)}?format=raw`;
}

// Every download -- single file or a multi-file selection -- goes through
// this, always producing a real .zip. Two reasons, not just one:
//   1. It's what was asked for: one consistent "Download" action regardless
//      of selection size, instead of a single-file special case.
//   2. It's also the actual fix for downloads landing as an unrecognized
//      file type. A direct `<a href=cross-origin-url download>` click is
//      unreliable about which filename wins (the download attribute's
//      value vs. the server's Content-Disposition header can disagree
//      across browsers, and the download attribute itself is documented as
//      only reliably honored for same-origin/blob:/data: URLs -- mdn.io/a
//      mcp-fileserver is a different origin from this site). Fetching the
//      bytes ourselves and downloading a blob: URL sidesteps all of that:
//      blob: is always same-origin, and the filename is entirely ours to
//      set, no server header negotiation involved.
//
// jszip is dynamically imported so it's never in the initial bundle for
// anyone who never downloads anything (this whole feature is admin-only).
export async function triggerZipDownload(paths: string[], zipName: string): Promise<void> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (const path of paths) {
    const resp = await fetch(rawUrl(path), { credentials: "include" });
    if (!resp.ok) continue; // one failed file shouldn't sink the whole zip
    const blob = await resp.blob();

    let name = basename(path);
    if (usedNames.has(name)) {
      // Two selected files from different folders can share a basename --
      // dedupe the same way Windows/macOS do, "name (1).ext", "name (2).ext".
      const dot = name.lastIndexOf(".");
      const stem = dot === -1 ? name : name.slice(0, dot);
      const ext = dot === -1 ? "" : name.slice(dot);
      let n = 1;
      while (usedNames.has(name)) {
        name = `${stem} (${n})${ext}`;
        n++;
      }
    }
    usedNames.add(name);
    zip.file(name, blob);
  }

  // STORE, not the DEFLATE default -- everything passing through here
  // (images, video, pdf, existing zips) is already a compressed format, so
  // re-compressing just burns CPU/time for no size benefit, and matters
  // more now that a single file can be up to 250MB.
  const zipBlob = await zip.generateAsync({ type: "blob", compression: "STORE" });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = zipName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Direct browser-to-GCS upload via a signed URL (see mcp-fileserver's
// gcs_client.generate_upload_url) -- bypasses this app's own backend
// entirely for the actual bytes, since Cloud Run enforces a request body
// limit (~32MB) far below the 250MB this admin UI allows per file.
export async function uploadFile(
  path: string,
  file: File,
  visibility: "public" | "admin-only",
  overwrite: boolean,
): Promise<void> {
  const resp = await adminFetch("/api/admin/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path,
      content_type: file.type || "application/octet-stream",
      visibility,
      overwrite,
      size_bytes: file.size,
    }),
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.error ?? `Couldn't start upload for ${file.name} (${resp.status})`);
  }
  const { upload_url, headers } = (await resp.json()) as { upload_url: string; headers: Record<string, string> };

  // The headers returned here are exactly what generate_upload_url signed
  // into the URL -- must be sent as-is, or GCS rejects the PUT with a 403.
  const putResp = await fetch(upload_url, { method: "PUT", headers, body: file });
  if (!putResp.ok) {
    throw new Error(`Upload failed for ${file.name} (${putResp.status})`);
  }
}

// mcp-fileserver's admin session cookie is cross-site (7beacons.com vs
// ...run.app), so every admin request needs credentials: "include" to send/
// receive it, and X-Admin-Csrf on top -- a non-safelisted header that forces
// a real CORS preflight, which the server's strict origin allowlist then
// blocks for anyone but this site (see mcp-fileserver's app.py/admin_auth.py
// for the server side of this). Harmless to include on GET /api/admin/session
// too even though that route doesn't require it.
export const ADMIN_CSRF_HEADER = "X-Admin-Csrf";

export async function adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: { ...(init.headers ?? {}), [ADMIN_CSRF_HEADER]: "1" },
  });
}

/** Soft check, never throws -- an anonymous visitor and a logged-out admin
 * look identical to this call (both just get {authenticated: false}). */
export async function checkAdminSession(): Promise<boolean> {
  try {
    const resp = await adminFetch("/api/admin/session");
    if (!resp.ok) return false;
    const data = (await resp.json()) as { authenticated: boolean };
    return data.authenticated === true;
  } catch {
    return false;
  }
}

function basename(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? path : path.slice(idx + 1);
}

/** Drops folder-placeholder marker objects (mkdir creates an empty blob whose
 * name ends in "/" -- see gcs_client.create_folder_placeholder) from a flat
 * file list. Only needed for global-search results, which filter the raw
 * list by substring match directly: getDirectChildren/getAllFolders below
 * read placeholders correctly as-is (a trailing-slash path always resolves
 * to a folder name in their prefix-splitting, never gets treated as a
 * file), and in fact *need* the placeholder present to detect a brand-new,
 * still-empty folder at all -- so this must NOT be applied at ingestion,
 * only at the search call site. */
export function stripFolderPlaceholders(files: FileEntry[]): FileEntry[] {
  return files.filter((f) => !f.path.endsWith("/"));
}

/** A folder's own visibility tag, read from its placeholder marker object if
 * one exists -- the same object the "hide/unhide folder" action in
 * AdminControls.tsx tags via POST /api/admin/visibility (is_folder: true),
 * so this stays in sync with that toggle. Folders created only implicitly
 * (a file uploaded into a path that was never mkdir'd, so no placeholder
 * exists) default to "public", same convention as an untagged file. */
export function folderVisibility(files: FileEntry[], folderPath: string): "public" | "admin-only" {
  const marker = files.find((f) => f.path === `${folderPath}/`);
  return marker?.visibility === "admin-only" ? "admin-only" : "public";
}

/** Direct children (sub-folders and files) of currentFolder ("" = root/Home),
 * computed in one O(n) pass over the full flat file list -- no network call
 * per folder navigation. */
export function getDirectChildren(files: FileEntry[], currentFolder: string): DirectoryContents {
  const prefix = currentFolder ? `${currentFolder}/` : "";
  const folderNames = new Set<string>();
  const directFiles: FileEntry[] = [];

  for (const f of files) {
    if (!f.path.startsWith(prefix)) continue;
    const rest = f.path.slice(prefix.length);
    if (!rest) continue;
    const slashIdx = rest.indexOf("/");
    if (slashIdx === -1) {
      directFiles.push(f);
    } else {
      folderNames.add(rest.slice(0, slashIdx));
    }
  }

  const folders = [...folderNames]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ name, path: prefix + name }));

  return { folders, files: directFiles };
}

/** Every unique folder path implied by the flat file list, at every depth
 * (GCS has no real folders -- these are derived purely from "/" segments in
 * object paths). Used for global search, so a folder can match by name even
 * when you're not currently standing inside it. */
export function getAllFolders(files: FileEntry[]): FolderChild[] {
  const paths = new Set<string>();
  for (const f of files) {
    const segments = f.path.split("/");
    for (let i = 1; i < segments.length; i++) {
      paths.add(segments.slice(0, i).join("/"));
    }
  }
  return [...paths]
    .sort((a, b) => a.localeCompare(b))
    .map((path) => ({ name: path.slice(path.lastIndexOf("/") + 1), path }));
}

const EXTENSION_MAP: Record<string, FileCategory> = {
  png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image",
  svg: "image", bmp: "image", ico: "image", avif: "image",
  pdf: "pdf",
  mp3: "audio", wav: "audio", ogg: "audio", m4a: "audio", flac: "audio", aac: "audio",
  mp4: "video", webm: "video", mov: "video", mkv: "video", avi: "video",
  zip: "archive", tar: "archive", gz: "archive", "7z": "archive", rar: "archive",
};

/** Extension-primary, content-type-fallback category detection. Extension is
 * primary because content_type is currently unreliable -- write_file (the
 * only write path) always stamps text/plain regardless of a file's real
 * name/content, so a "photo.png" today would report text/plain even though
 * we want it to *try* to render as an image the moment real bytes exist. */
export function detectCategory(path: string, contentType?: string): FileCategory {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext && ext in EXTENSION_MAP) return EXTENSION_MAP[ext];

  if (contentType) {
    if (contentType.startsWith("image/")) return "image";
    if (contentType === "application/pdf") return "pdf";
    if (contentType.startsWith("audio/")) return "audio";
    if (contentType.startsWith("video/")) return "video";
    if (/zip|tar|7z|rar|gzip|compressed/.test(contentType)) return "archive";
  }
  return "text";
}

const CATEGORY_LABELS: Record<FileCategory, string> = {
  image: "Image",
  pdf: "PDF",
  audio: "Audio",
  video: "Video",
  archive: "Archive",
  text: "Text",
};

export function categoryLabel(category: FileCategory): string {
  return CATEGORY_LABELS[category];
}

export function sortEntries(contents: DirectoryContents, field: SortField, direction: SortDirection): DirectoryContents {
  const mul = direction === "asc" ? 1 : -1;

  const folders = [...contents.folders].sort((a, b) => mul * a.name.localeCompare(b.name));

  const files = [...contents.files].sort((a, b) => {
    switch (field) {
      case "size":
        return mul * (a.size_bytes - b.size_bytes);
      case "modified":
        return mul * a.updated.localeCompare(b.updated);
      case "type":
        return mul * detectCategory(a.path, a.content_type).localeCompare(detectCategory(b.path, b.content_type));
      case "name":
      default:
        return mul * basename(a.path).localeCompare(basename(b.path));
    }
  });

  return { folders, files };
}

export { basename };
