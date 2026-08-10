export interface FileEntry {
  path: string;
  size_bytes: number;
  content_type: string;
  created: string;
  updated: string;
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

function basename(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? path : path.slice(idx + 1);
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
