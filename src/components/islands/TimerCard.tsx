import { useEffect, useState } from "react";
import { Colon, DigitGroup, pad2 } from "./SevenSegment";

export interface Timer {
  id: string;
  title: string;
  target_time: string;
  created_at: string;
  paused: boolean;
  paused_at: string | null;
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

// Shared by TimerAdmin.tsx (the login-gated management view) and
// TimerList.tsx (the public, read-only /cypher listing) -- same countdown
// rendering either way, so pausing/resuming behaves identically in both
// places instead of two implementations drifting apart.
export function TimerCountdown({ timer }: { timer: Timer }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // Still ticks once a second even while paused, purely so the blink
    // keeps a heartbeat -- the actual remaining-time math below is frozen
    // (target_time - paused_at, both fixed) regardless of this tick.
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const target = new Date(timer.target_time).getTime();
  const anchor = timer.paused && timer.paused_at ? new Date(timer.paused_at).getTime() : now;
  const remaining = target - anchor;

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
  // Frozen (solidly lit, not blinking) while paused -- a still colon reads
  // as "stopped" the same way a still second hand does on an analog clock.
  const dotsLit = timer.paused ? true : Math.floor(now / 1000) % 2 === 0;
  const blinking = !timer.paused;

  return (
    <div className="digital-clock timer-admin-clock">
      {timer.paused && <span className="timer-admin-paused-badge">PAUSED</span>}
      <div className="clock-row">
        <DigitGroup value={pad2(days)} />
        <Colon blinking={blinking} lit={dotsLit} />
        <DigitGroup value={pad2(hours)} />
        <Colon blinking={blinking} lit={dotsLit} />
        <DigitGroup value={pad2(minutes)} />
        <Colon blinking={blinking} lit={dotsLit} />
        <DigitGroup value={pad2(seconds)} />
      </div>
    </div>
  );
}

export function TimerCard({ timer }: { timer: Timer }) {
  return (
    <div className="timer-admin-item">
      <TimerCountdown timer={timer} />
      <span className="timer-admin-item-title">{timer.title}</span>
    </div>
  );
}
