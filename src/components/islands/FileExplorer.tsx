import { useEffect, useState } from "react";

// mcp-fileserver: a separate service/repo (github.com/bcns-staging/mcp-fileserver),
// same GCP project. Its /api/files* routes are public and read-only by design --
// see that repo's public_api.py for the server side of this.
const API_BASE = "https://mcp-fileserver-751371770492.us-central1.run.app";

interface FileEntry {
  path: string;
  size_bytes: number;
  content_type: string;
  created: string;
  updated: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

export default function FileExplorer() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setListLoading(true);
    setListError(null);
    fetch(`${API_BASE}/api/files`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json() as Promise<{ files: FileEntry[] }>;
      })
      .then((data) => {
        const sorted = [...data.files].sort((a, b) => b.updated.localeCompare(a.updated));
        setFiles(sorted);
      })
      .catch((err) => setListError(err.message))
      .finally(() => setListLoading(false));
  }, [refreshKey]);

  function selectFile(path: string) {
    setSelected(path);
    setContent(null);
    setContentError(null);
    setContentLoading(true);
    fetch(`${API_BASE}/api/files/${encodePath(path)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json() as Promise<{ content: string }>;
      })
      .then((data) => setContent(data.content))
      .catch((err) => setContentError(err.message))
      .finally(() => setContentLoading(false));
  }

  return (
    <div className="file-explorer">
      <div className="file-explorer-list">
        <div className="file-explorer-list-header">
          <span>{listLoading ? "Loading…" : `${files.length} file${files.length === 1 ? "" : "s"}`}</span>
          <button
            type="button"
            className="file-explorer-refresh"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={listLoading}
          >
            Refresh
          </button>
        </div>

        {listError && <p className="file-explorer-status file-explorer-error">Failed to load: {listError}</p>}
        {!listLoading && !listError && files.length === 0 && (
          <p className="file-explorer-status">No files yet.</p>
        )}

        <ul>
          {files.map((f) => (
            <li key={f.path}>
              <button
                type="button"
                className={f.path === selected ? "is-selected" : ""}
                onClick={() => selectFile(f.path)}
              >
                <span className="file-explorer-path">{f.path}</span>
                <span className="file-explorer-meta">
                  {formatSize(f.size_bytes)} · {formatDate(f.updated)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="file-explorer-preview">
        {!selected && <p className="file-explorer-status">Select a file to preview it.</p>}
        {selected && contentLoading && <p className="file-explorer-status">Loading…</p>}
        {selected && contentError && (
          <p className="file-explorer-status file-explorer-error">Failed to load: {contentError}</p>
        )}
        {selected && !contentLoading && content !== null && (
          <>
            <div className="file-explorer-preview-header">{selected}</div>
            <pre>{content}</pre>
          </>
        )}
      </div>
    </div>
  );
}
