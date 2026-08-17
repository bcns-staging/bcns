import { useEffect, useState } from "react";
import { Colon, DigitGroup, pad2 } from "./SevenSegment";
import type { Timer } from "./TimerCard";

// Shared status bar for both timer pages (TimerAdmin.tsx / timeradmin.astro
// and TimerList.tsx / cypher.astro) -- "KEYVAULT ONLINE" + a live count of
// still-sealed (not yet expired) timers on the left, a compact live
// HH:MM:SS clock on the right. Replaces the old standalone showcase
// <Clock /> component, which had no other callers once this took over that
// role (see Clock.tsx's removal).
export function TimerHudTopBar({ timers, clockOffsetMs = 0 }: { timers: Timer[]; clockOffsetMs?: number }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return null;

  const serverNow = now.getTime() + clockOffsetMs;
  const sealedCount = timers.filter((timer) => {
    const target = new Date(timer.target_time).getTime();
    const anchor = timer.paused && timer.paused_at ? new Date(timer.paused_at).getTime() : serverNow;
    return target - anchor > 0;
  }).length;

  const secondsDotsLit = now.getSeconds() % 2 === 0;

  return (
    <div className="timer-hud-topbar">
      <div className="timer-hud-status">
        <span className="timer-hud-status-dot" aria-hidden="true" />
        <span className="timer-hud-status-label">KeyVault Online</span>
        <span className="timer-hud-status-count">{sealedCount} Sealed</span>
      </div>
      <div className="digital-clock timer-hud-clock">
        <div className="clock-row">
          <DigitGroup value={pad2(now.getHours())} />
          <Colon blinking lit={secondsDotsLit} />
          <DigitGroup value={pad2(now.getMinutes())} />
          <Colon blinking lit={secondsDotsLit} />
          <DigitGroup value={pad2(now.getSeconds())} />
        </div>
      </div>
    </div>
  );
}
