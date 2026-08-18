import { useState } from "react";
import { API_BASE } from "./file-explorer/utils";

interface DecodedShare {
  path: string;
  filename: string;
  expiresAt: number; // epoch seconds, from the token's own "exp" claim
}

// JWTs are signed, not encrypted -- the payload segment is just base64url
// JSON, readable by anyone holding the token without the signing secret.
// This decodes it purely for display (filename, expiry) so this page can
// show something useful without a round trip. It does NOT verify the
// signature -- that's mcp-fileserver's job (see share_links.py), which
// happens independently when the Open/Download link below is actually
// followed. That split is deliberate: it's the whole point of the "signed,
// not encrypted" property this page exists to demonstrate.
function decodeToken(token: string): DecodedShare | null {
  try {
    const payloadB64 = token.split(".")[1];
    if (!payloadB64) return null;
    const normalized = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const json = JSON.parse(atob(padded));
    if (typeof json.path !== "string" || typeof json.exp !== "number") return null;
    const filename = json.path.includes("/") ? json.path.slice(json.path.lastIndexOf("/") + 1) : json.path;
    return { path: json.path, filename, expiresAt: json.exp };
  } catch {
    return null;
  }
}

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("token");
}

export default function ShareView() {
  const [token] = useState(readToken);
  const [decoded] = useState(() => (token ? decodeToken(token) : null));

  if (!token || !decoded) {
    return (
      <div className="timer-admin-item share-view-item">
        <span className="timer-hud-corner timer-hud-corner-tl" aria-hidden="true" />
        <span className="timer-hud-corner timer-hud-corner-br" aria-hidden="true" />
        <div className="timer-hud-header">
          <span className="timer-hud-label">Shared File</span>
          <span className="timer-hud-pill is-running">UNAVAILABLE</span>
        </div>
        <p className="share-view-error">
          This link is missing or malformed -- it may have been copied or forwarded incorrectly.
        </p>
      </div>
    );
  }

  const expiresAtMs = decoded.expiresAt * 1000;
  const isExpired = expiresAtMs < Date.now();
  const openUrl = `${API_BASE}/api/share/${encodeURIComponent(token)}`;
  const downloadUrl = `${openUrl}?download=1`;

  return (
    <div className="timer-admin-item share-view-item">
      <span className="timer-hud-corner timer-hud-corner-tl" aria-hidden="true" />
      <span className="timer-hud-corner timer-hud-corner-br" aria-hidden="true" />

      <div className="timer-hud-header">
        <span className="timer-hud-label">Shared File</span>
        <span className={`timer-hud-pill is-${isExpired ? "running" : "paused"}`}>{isExpired ? "EXPIRED" : "LIVE"}</span>
      </div>

      <p className="share-view-filename">{decoded.filename}</p>
      <p className="share-view-copy">
        {isExpired
          ? "This link's expiry has passed -- the server will refuse it even if you click through."
          : `Expires ${new Date(expiresAtMs).toLocaleString()}.`}
      </p>

      <div className="share-view-actions">
        <a className="timer-reveal-button share-view-action" href={openUrl} rel="noopener">
          Open <span aria-hidden="true">▸</span>
        </a>
        <a className="timer-reveal-button share-view-action" href={downloadUrl} rel="noopener">
          Download <span aria-hidden="true">▾</span>
        </a>
      </div>

      <p className="share-view-hint">
        This page read the filename and expiry straight out of the link, without contacting the server. The server
        independently verifies the link's signature when you open it above -- which is why the two checks can
        disagree (e.g. if the file was deleted or hidden since this link was made).
      </p>
    </div>
  );
}
