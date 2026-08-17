import { useEffect, useState, type FormEvent } from "react";
import { LoginPanel } from "./file-explorer/AdminControls";
import { adminFetch, checkAdminSession } from "./file-explorer/utils";
import { TimerCard, type Timer } from "./TimerCard";

// A local <input type="datetime-local"> value ("2030-01-01T22:45") has no
// timezone of its own -- the Date constructor interprets it in the
// browser's local timezone, and .toISOString() converts that to an
// unambiguous UTC instant before it's ever sent.
function localInputToIso(localValue: string): string {
  return new Date(localValue).toISOString();
}

// The inverse, for populating the form when editing an existing timer:
// an ISO/UTC instant back into the "YYYY-MM-DDTHH:mm" shape
// <input type="datetime-local"> expects, in the browser's local timezone.
function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const offsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16);
}

interface TimerFormProps {
  editingTimer: Timer | null;
  onSaved: () => void;
  onDeleted: () => void;
  onStateChanged: () => void;
  onCancelEdit: () => void;
}

function TimerForm({ editingTimer, onSaved, onDeleted, onStateChanged, onCancelEdit }: TimerFormProps) {
  const [title, setTitle] = useState("");
  const [targetTime, setTargetTime] = useState("");
  const [revealText, setRevealText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (editingTimer) {
      setTitle(editingTimer.title);
      setTargetTime(isoToLocalInput(editingTimer.target_time));
      setRevealText(editingTimer.reveal_text ?? "");
    } else {
      setTitle("");
      setTargetTime("");
      setRevealText("");
    }
    setError(null);
  }, [editingTimer]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const path = editingTimer ? `/api/admin/timers/${encodeURIComponent(editingTimer.id)}` : "/api/admin/timers";
      const resp = await adminFetch(path, {
        method: editingTimer ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, target_time: localInputToIso(targetTime), reveal_text: revealText }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        setError(body.error ?? `Couldn't save timer (${resp.status})`);
        return;
      }
      onSaved();
    } catch {
      setError("Request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAction(action: "pause" | "resume" | "delete") {
    if (!editingTimer) return;
    setBusy(true);
    setError(null);
    try {
      const path = `/api/admin/timers/${encodeURIComponent(editingTimer.id)}${action === "delete" ? "" : `/${action}`}`;
      const resp = await adminFetch(path, { method: action === "delete" ? "DELETE" : "POST" });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        setError(body.error ?? `Couldn't ${action} timer (${resp.status})`);
        return;
      }
      if (action === "delete") onDeleted();
      // pause/resume deliberately don't close the edit view (unlike a
      // title/time save) -- staying on the same timer lets you flip
      // Pause -> Resume -> Pause again without re-picking it from the
      // dropdown each time.
      else onStateChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="timer-admin-form" onSubmit={submit}>
      <input
        type="text"
        placeholder="Timer name"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={100}
        required
      />
      <input type="datetime-local" value={targetTime} onChange={(e) => setTargetTime(e.target.value)} required />
      <textarea
        placeholder="Text to show once the timer reaches zero (optional -- defaults to &quot;EXPIRED&quot;)"
        value={revealText}
        onChange={(e) => setRevealText(e.target.value)}
        maxLength={300}
        rows={2}
      />
      <div className="timer-admin-form-actions">
        <button type="submit" disabled={busy}>
          {busy ? "Saving…" : editingTimer ? "Update timer" : "Create timer"}
        </button>
        {editingTimer && (
          <>
            <button
              type="button"
              className="timer-admin-pause"
              disabled={busy}
              onClick={() => handleAction(editingTimer.paused ? "resume" : "pause")}
            >
              {editingTimer.paused ? "Resume" : "Pause"} timer
            </button>
            <button type="button" className="timer-admin-delete" disabled={busy} onClick={() => handleAction("delete")}>
              Delete
            </button>
            <button type="button" className="timer-admin-cancel" disabled={busy} onClick={onCancelEdit}>
              Cancel
            </button>
          </>
        )}
      </div>
      {error && <span className="timer-admin-error">{error}</span>}
    </form>
  );
}

export default function TimerAdmin() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [timers, setTimers] = useState<Timer[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  // See TimerCard.tsx's TimerCountdown -- corrects for browser/server clock
  // skew so a resumed timer's live countdown doesn't jump relative to its
  // frozen paused value.
  const [clockOffsetMs, setClockOffsetMs] = useState(0);

  useEffect(() => {
    let cancelled = false;
    checkAdminSession().then((authenticated) => {
      if (!cancelled) setIsAdmin(authenticated);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshTimers() {
    try {
      // adminFetch (not plain fetch), unlike most other reads on this page
      // used to be: /api/timers now redacts reveal_text for anonymous
      // callers until a timer actually expires (see mcp-fileserver's
      // public_api.py), and the edit form needs to show/edit that value
      // before expiry -- sending the session cookie is what makes this
      // request count as an admin request server-side.
      const resp = await adminFetch("/api/timers", { cache: "no-store" });
      if (!resp.ok) throw new Error(`${resp.status}`);
      const data = (await resp.json()) as { timers: Timer[]; server_time: string };
      setTimers(data.timers);
      setClockOffsetMs(new Date(data.server_time).getTime() - Date.now());
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load timers.");
    }
  }

  useEffect(() => {
    if (isAdmin) refreshTimers();
  }, [isAdmin]);

  if (isAdmin === null) return null;
  if (!isAdmin) return <LoginPanel onLoggedIn={() => setIsAdmin(true)} />;

  const editingTimer = timers.find((t) => t.id === editingId) ?? null;

  return (
    <div className="timer-admin">
      <div className="timer-admin-toolbar">
        <button type="button" className="timer-admin-add" onClick={() => setEditingId(null)}>
          Add new timer
        </button>
        <select
          className="timer-admin-select"
          value={editingId ?? ""}
          onChange={(e) => setEditingId(e.target.value || null)}
        >
          <option value="">Edit…</option>
          {timers.map((timer) => (
            <option key={timer.id} value={timer.id}>
              {timer.title}
            </option>
          ))}
        </select>
      </div>

      <TimerForm
        editingTimer={editingTimer}
        onSaved={() => {
          setEditingId(null);
          refreshTimers();
        }}
        onDeleted={() => {
          setEditingId(null);
          refreshTimers();
        }}
        onStateChanged={refreshTimers}
        onCancelEdit={() => setEditingId(null)}
      />

      {loadError && <p className="timer-admin-error">{loadError}</p>}

      <div className="timer-admin-listing">
        <h2 className="timer-admin-listing-heading">All timers listed here</h2>
        {timers.length === 0 && <p className="timer-admin-empty">No timers yet.</p>}
        <div className="timer-admin-grid">
          {timers.map((timer) => (
            <TimerCard key={timer.id} timer={timer} clockOffsetMs={clockOffsetMs} />
          ))}
        </div>
      </div>
    </div>
  );
}
