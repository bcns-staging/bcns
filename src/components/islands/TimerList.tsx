import { useEffect, useState } from "react";
import { API_BASE } from "./file-explorer/utils";
import { TimerCard, type Timer } from "./TimerCard";
import { TimerHudTopBar } from "./TimerHudTopBar";

// Public, read-only mirror of whatever's managed in /timeradmin -- no
// login, same /api/timers endpoint the admin page's own listing reads
// from. Polls every 5s (independent of each card's own 1s countdown tick)
// so a timer created/edited/paused/deleted in timeradmin shows up here
// without needing a page reload.
const REFRESH_INTERVAL_MS = 5000;

export default function TimerList() {
  const [timers, setTimers] = useState<Timer[] | null>(null);
  // How far the browser's clock is from the server's (serverTime -
  // Date.now() at fetch time) -- see TimerCard.tsx's TimerCountdown for why
  // a live (non-paused) countdown needs this to avoid jumping the instant a
  // timer resumes.
  const [clockOffsetMs, setClockOffsetMs] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const resp = await fetch(`${API_BASE}/api/timers`, { cache: "no-store" });
        if (!resp.ok) return;
        const data = (await resp.json()) as { timers: Timer[]; server_time: string };
        if (!cancelled) {
          setTimers(data.timers);
          setClockOffsetMs(new Date(data.server_time).getTime() - Date.now());
        }
      } catch {
        // Silently keep whatever was last successfully loaded -- a
        // transient network hiccup shouldn't blank out a page someone's
        // just watching a countdown on.
      }
    }

    load();
    const id = setInterval(load, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!timers || timers.length === 0) return null;

  return (
    <div className="timer-list-public-wrap">
      <TimerHudTopBar timers={timers} clockOffsetMs={clockOffsetMs} />
      <div className="timer-admin-listing">
        <div className="timer-admin-grid">
          {timers.map((timer) => (
            <TimerCard key={timer.id} timer={timer} clockOffsetMs={clockOffsetMs} />
          ))}
        </div>
      </div>
    </div>
  );
}
