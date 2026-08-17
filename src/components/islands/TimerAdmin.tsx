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
      <div className="clock-row">
        <span className="timer-admin-expired">EXPIRED</span>
      </div>
    );
  }

  const { days, hours, minutes, seconds } = daysHoursMinutesSeconds(remaining);
  const dotsLit = Math.floor(now / 1000) % 2 === 0;

  return (
    <div className="clock-row">
      <DigitGroup value={pad2(days)} />
      <Colon blinking lit={dotsLit} />
      <DigitGroup value={pad2(hours)} />
      <Colon blinking lit={dotsLit} />
      <DigitGroup value={pad2(minutes)} />
      <Colon blinking lit={dotsLit} />
      <DigitGroup value={pad2(seconds)} />
    </div>
  );
}

function CreateTimerForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [targetTime, setTargetTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const resp = await adminFetch("/api/admin/timers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // <input type="datetime-local"> has no timezone of its own -- new
        // Date(...) interprets it in the browser's local timezone, and
        // .toISOString() converts that to an unambiguous UTC instant
        // before it's ever sent, so the stored target_time isn't tied to
        // whichever timezone happened to create it.
        body: JSON.stringify({ title, target_time: new Date(targetTime).toISOString() }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        setError(body.error ?? `Couldn't create timer (${resp.status})`);
        return;
      }
      setTitle("");
      setTargetTime("");
      onCreated();
    } catch {
      setError("Request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="timer-admin-form" onSubmit={submit}>
      <input
        type="text"
        placeholder="Timer title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={100}
        required
      />
      <input type="datetime-local" value={targetTime} onChange={(e) => setTargetTime(e.target.value)} required />
      <button type="submit" disabled={busy}>
        {busy ? "Creating…" : "Create timer"}
      </button>
      {error && <span className="timer-admin-error">{error}</span>}
    </form>
  );
}

export default function TimerAdmin() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [timers, setTimers] = useState<Timer[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  async function deleteTimer(id: string) {
    const resp = await adminFetch(`/api/admin/timers/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (resp.ok) refreshTimers();
  }

  if (isAdmin === null) return null;
  if (!isAdmin) return <LoginPanel onLoggedIn={() => setIsAdmin(true)} />;

  return (
    <div className="timer-admin">
      <CreateTimerForm onCreated={refreshTimers} />
      {loadError && <p className="timer-admin-error">{loadError}</p>}
      <div className="timer-admin-list">
        {timers.length === 0 && <p className="timer-admin-empty">No timers yet.</p>}
        {timers.map((timer) => (
          <div className="timer-admin-item" key={timer.id}>
            <div className="timer-admin-item-header">
              <h3>{timer.title}</h3>
              <button type="button" className="timer-admin-delete" onClick={() => deleteTimer(timer.id)}>
                Delete
              </button>
            </div>
            <TimerCountdown targetTime={timer.target_time} />
          </div>
        ))}
      </div>
    </div>
  );
}
