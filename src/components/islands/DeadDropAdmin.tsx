import { useEffect, useState, type FormEvent } from "react";
import { LoginPanel } from "./file-explorer/AdminControls";
import { adminFetch, checkAdminSession } from "./file-explorer/utils";
import { Colon, DigitGroup, pad2 } from "./SevenSegment";
import { encryptSecret } from "./deaddrop/crypto";

export interface DeadDrop {
  id: string;
  label: string;
  created_at: string;
  expires_at: string;
  viewed_at: string | null;
}

const EXPIRY_OPTIONS = [
  { label: "1 hour", hours: 1 },
  { label: "6 hours", hours: 6 },
  { label: "24 hours", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "7 days", hours: 168 },
  { label: "14 days", hours: 336 },
];

function daysHoursMinutesSeconds(msRemaining: number) {
  const clamped = Math.max(0, msRemaining);
  const totalSeconds = Math.floor(clamped / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function DeadDropCard({ drop, onRevoke }: { drop: DeadDrop; onRevoke: () => void }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const expiresAt = new Date(drop.expires_at).getTime();
  const remaining = expiresAt - now;
  const expired = !drop.viewed_at && remaining <= 0;
  const status = drop.viewed_at ? "opened" : expired ? "expired" : "sealed";
  const statusLabel = drop.viewed_at ? "OPENED" : expired ? "EXPIRED" : "SEALED";
  const { days, hours, minutes, seconds } = daysHoursMinutesSeconds(remaining);
  const dotsLit = Math.floor(now / 1000) % 2 === 0;

  return (
    <div className="timer-admin-item">
      <span className="timer-hud-corner timer-hud-corner-tl" aria-hidden="true" />
      <span className="timer-hud-corner timer-hud-corner-br" aria-hidden="true" />
      <div className="timer-hud-header">
        <span className="timer-hud-label">{drop.label || "Untitled drop"}</span>
        <span className={`timer-hud-pill is-${status === "opened" ? "expired" : status === "expired" ? "running" : "paused"}`}>
          {statusLabel}
        </span>
      </div>

      {status === "sealed" ? (
        <div className="digital-clock timer-admin-clock">
          <div className="clock-row">
            <div className="timer-hud-unit-col">
              <div className="timer-hud-unit-digits">
                <DigitGroup value={pad2(days)} />
              </div>
              <span className="timer-hud-unit-label">Days</span>
            </div>
            <div className="timer-hud-unit-col">
              <div className="timer-hud-unit-digits">
                <Colon blinking lit={dotsLit} />
                <DigitGroup value={pad2(hours)} />
              </div>
              <span className="timer-hud-unit-label">Hrs</span>
            </div>
            <div className="timer-hud-unit-col">
              <div className="timer-hud-unit-digits">
                <Colon blinking lit={dotsLit} />
                <DigitGroup value={pad2(minutes)} />
              </div>
              <span className="timer-hud-unit-label">Min</span>
            </div>
            <div className="timer-hud-unit-col">
              <div className="timer-hud-unit-digits">
                <Colon blinking lit={dotsLit} />
                <DigitGroup value={pad2(seconds)} />
              </div>
              <span className="timer-hud-unit-label">Sec</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="timer-sealed-label">
          {status === "opened" ? `Opened ${relativeTime(drop.viewed_at as string)}` : "Never opened -- self-destructed unread"}
        </div>
      )}

      <button type="button" className="timer-reveal-hide deaddrop-revoke" onClick={onRevoke}>
        {status === "sealed" ? "Revoke" : "Remove"}
      </button>
    </div>
  );
}

function CreateForm({ onCreated, onClose }: { onCreated: (link: string) => void; onClose: () => void }) {
  const [secret, setSecret] = useState("");
  const [label, setLabel] = useState("");
  const [expiresHours, setExpiresHours] = useState(24);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { ciphertext, iv, key } = await encryptSecret(secret);
      const resp = await adminFetch("/api/admin/deaddrop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ciphertext, iv, label, expires_in_hours: expiresHours }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        setError(body.error ?? `Couldn't create drop (${resp.status})`);
        return;
      }
      const { id } = (await resp.json()) as { id: string };
      // The key exists only right here, right now -- it was never sent to
      // the server (see deaddrop/crypto.ts) and this component's state is
      // about to be torn down. This is the one and only chance to hand it
      // to the admin.
      const link = `${window.location.origin}/deaddrop/view/?id=${encodeURIComponent(id)}#k=${key}`;
      onCreated(link);
    } catch {
      setError("Request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="timer-admin-form-panel">
      <div className="timer-admin-form-panel-header">
        <span className="timer-admin-form-panel-title">New Drop</span>
        <button type="button" className="timer-admin-form-close" onClick={onClose} aria-label="Close">
          &times;
        </button>
      </div>
      <form className="timer-admin-form" onSubmit={submit}>
        <textarea
          placeholder="The secret -- encrypted in your browser before it ever leaves it"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          maxLength={20000}
          rows={5}
          required
          autoFocus
        />
        <input
          type="text"
          placeholder="Label (optional, admin-only -- never sent to the recipient)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={100}
        />
        <select value={expiresHours} onChange={(e) => setExpiresHours(Number(e.target.value))}>
          {EXPIRY_OPTIONS.map((opt) => (
            <option key={opt.hours} value={opt.hours}>
              Expires in {opt.label}
            </option>
          ))}
        </select>
        <div className="timer-admin-form-actions">
          <button type="submit" disabled={busy || !secret.trim()}>
            {busy ? "Sealing…" : "Seal drop"}
          </button>
        </div>
        {error && <span className="timer-admin-error">{error}</span>}
      </form>
    </div>
  );
}

function CreatedPanel({ link, onDone }: { link: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // no sensible fallback -- the link stays selectable text below
    }
  }

  return (
    <div className="deaddrop-created-panel">
      <p className="deaddrop-created-title">Drop sealed</p>
      <p className="deaddrop-created-warning">
        This link contains the only copy of the decryption key. It is not stored anywhere -- copy it now, because it
        cannot be shown again.
      </p>
      <div className="deaddrop-created-link-row">
        <code className="deaddrop-created-link">{link}</code>
        <button type="button" className="timer-reveal-button" onClick={copy}>
          {copied ? "Copied!" : "Copy Link"}
        </button>
      </div>
      <button type="button" className="timer-admin-cancel deaddrop-created-done" onClick={onDone}>
        Done
      </button>
    </div>
  );
}

export default function DeadDropAdmin() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [drops, setDrops] = useState<DeadDrop[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [justCreatedLink, setJustCreatedLink] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    checkAdminSession().then((authenticated) => {
      if (!cancelled) setIsAdmin(authenticated);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshDrops() {
    try {
      const resp = await adminFetch("/api/admin/deaddrop", { cache: "no-store" });
      if (!resp.ok) throw new Error(`${resp.status}`);
      const data = (await resp.json()) as { drops: DeadDrop[] };
      setDrops(data.drops);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load drops.");
    }
  }

  useEffect(() => {
    if (isAdmin) refreshDrops();
  }, [isAdmin]);

  async function revoke(id: string) {
    await adminFetch(`/api/admin/deaddrop/${encodeURIComponent(id)}`, { method: "DELETE" });
    refreshDrops();
  }

  if (isAdmin === null) return null;
  if (!isAdmin) {
    return (
      <div className="timer-admin-login-wrap">
        <LoginPanel onLoggedIn={() => setIsAdmin(true)} />
      </div>
    );
  }

  return (
    <div className="timer-admin">
      <div className="timer-hud-topbar">
        <div className="timer-hud-status">
          <span className="timer-hud-status-dot" aria-hidden="true" />
          <span className="timer-hud-status-label">Dead Drop</span>
          <span className="timer-hud-status-count">
            {drops.filter((d) => !d.viewed_at && new Date(d.expires_at).getTime() > Date.now()).length} Sealed
          </span>
        </div>
      </div>

      {loadError && <p className="timer-admin-error">{loadError}</p>}

      <div className="timer-admin-listing">
        {drops.length === 0 && !formOpen && <p className="timer-admin-empty">No drops yet.</p>}
        <div className="timer-admin-grid">
          {drops.map((drop) => (
            <DeadDropCard key={drop.id} drop={drop} onRevoke={() => revoke(drop.id)} />
          ))}
        </div>
      </div>

      {justCreatedLink ? (
        <CreatedPanel
          link={justCreatedLink}
          onDone={() => {
            setJustCreatedLink(null);
            refreshDrops();
          }}
        />
      ) : formOpen ? (
        <CreateForm
          onCreated={(link) => {
            setFormOpen(false);
            setJustCreatedLink(link);
          }}
          onClose={() => setFormOpen(false)}
        />
      ) : (
        <button type="button" className="timer-admin-add" onClick={() => setFormOpen(true)}>
          + New drop
        </button>
      )}
    </div>
  );
}
