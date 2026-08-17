import { useEffect, useState } from "react";
import type { Timer } from "./TimerCard";

// Shared status bar for both timer pages (TimerAdmin.tsx / timeradmin.astro
// and TimerList.tsx / cypher.astro) -- "KEYVAULT ONLINE" + a live count of
// still-sealed (not yet expired) timers.
export function TimerHudTopBar({ timers, clockOffsetMs = 0 }: { timers: Timer[]; clockOffsetMs?: number }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (now === null) return null;

  const serverNow = now + clockOffsetMs;
  const sealedCount = timers.filter((timer) => {
    const target = new Date(timer.target_time).getTime();
    const anchor = timer.paused && timer.paused_at ? new Date(timer.paused_at).getTime() : serverNow;
    return target - anchor > 0;
  }).length;

  return (
    <div className="timer-hud-topbar">
      <div className="timer-hud-status">
        <span className="timer-hud-status-dot" aria-hidden="true" />
        <span className="timer-hud-status-label">KeyVault Online</span>
        <span className="timer-hud-status-count">{sealedCount} Sealed</span>
      </div>
    </div>
  );
}
