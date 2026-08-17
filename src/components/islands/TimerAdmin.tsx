import { useEffect, useState, type FormEvent } from "react";
import { LoginPanel } from "./file-explorer/AdminControls";
import { API_BASE, adminFetch, checkAdminSession } from "./file-explorer/utils";
import { Colon, DigitGroup, pad2 } from "./SevenSegment";

interface Timer {
  id: string;
  title: string;
  target_time: string;
  created_at: string;
}

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

function TimerCountdown({ targetTime }: { targetTime: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = new Date(targetTime).getTime() - now;
  if (remaining <= 0) {
    return (
      <div className="digital-clock timer-admin-clock">
        <div className="clock-row">
          <span className="timer-admin-expired">EXPIRED</span>
        </div>
      </div>
    );
  }

  const { days, hours, minutes, seconds } = daysHoursMinutesSeconds(remaining);
  const dotsLit = Math.floor(now / 1000) % 2 === 0;

  return (
    <div className="digital-clock timer-admin-clock">
      <div className="clock-row">
        <DigitGroup value={pad2(days)} />
        <Colon blinking lit={dotsLit} />
        <DigitGroup value={pad2(hours)} />
        <Colon blinking lit={dotsLit} />
        <DigitGroup value={pad2(minutes)} />
        <Colon blinking lit={dotsLit} />
        <DigitGroup value={pad2(seconds)} />
      </div>
    </div>
  );
}

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
  onCancelEdit: () => void;
}

function TimerForm({ editingTimer, onSaved, onDeleted, onCancelEdit }: TimerFormProps) {
  const [title, setTitle] = useState("");
  const [targetTime, setTargetTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (editingTimer) {
      setTitle(editingTimer.title);
      setTargetTime(isoToLocalInput(editingTimer.target_time));
    } else {
      setTitle("");
      setTargetTime("");
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
        body: JSON.stringify({ title, target_time: localInputToIso(targetTime) }),
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

  async function handleDelete() {
    if (!editingTimer) return;
    setBusy(true);
    setError(null);
    try {
      const resp = await adminFetch(`/api/admin/timers/${encodeURIComponent(editingTimer.id)}`, { method: "DELETE" });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        setError(body.error ?? `Couldn't delete timer (${resp.status})`);
        return;
      }
      onDeleted();
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
      <div className="timer-admin-form-actions">
        <button type="submit" disabled={busy}>
          {busy ? "Saving…" : editingTimer ? "Update timer" : "Create timer"}
        </button>
        {editingTimer && (
          <>
            <button type="button" className="timer-admin-delete" disabled={busy} onClick={handleDelete}>
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
      // Public endpoint (no adminFetch needed) -- same data an anonymous
      // visitor would see, since timers have no admin-only concept.
      const resp = await fetch(`${API_BASE}/api/timers`, { cache: "no-store" });
      if (!resp.ok) throw new Error(`${resp.status}`);
      const data = (await resp.json()) as { timers: Timer[] };
      setTimers(data.timers);
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
        onCancelEdit={() => setEditingId(null)}
      />

      {loadError && <p className="timer-admin-error">{loadError}</p>}

      <div className="timer-admin-listing">
        <h2 className="timer-admin-listing-heading">All timers listed here</h2>
        {timers.length === 0 && <p className="timer-admin-empty">No timers yet.</p>}
        <div className="timer-admin-grid">
          {timers.map((timer) => (
            <div className="timer-admin-item" key={timer.id}>
              <TimerCountdown targetTime={timer.target_time} />
              <span className="timer-admin-item-title">{timer.title}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
