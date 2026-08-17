import { useEffect, useState } from "react";
import { Colon, DigitGroup, pad2 } from "./SevenSegment";

export interface Timer {
  id: string;
  title: string;
  target_time: string;
  created_at: string;
  paused: boolean;
  paused_at: string | null;
  // Absent (not just empty) from a public, unauthenticated /api/timers
  // response until the timer actually expires -- the backend strips this
  // key entirely rather than sending it early and relying on the frontend
  // to hide it, since anyone could just read the raw response. Always
  // present for an authenticated admin request (timeradmin needs to show/
  // edit it before expiry). See mcp-fileserver's public_api.py.
  reveal_text?: string;
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
//
// clockOffsetMs corrects for skew between the browser's clock and the
// server's: target_time/paused_at are both server timestamps, so a paused
// timer's frozen remaining (target_time - paused_at) never touches the
// client clock and is always exact. A *running* timer's remaining
// (target_time - now) does mix in the browser's Date.now() though -- if the
// two clocks disagree, that shows up as a jump right at the instant a timer
// resumes (going from a skew-free frozen value to a skew-affected live one)
// even though nothing about the pause/resume math itself is wrong.
// Server-supplied clockOffsetMs (see TimerList.tsx/TimerAdmin.tsx) cancels
// that skew out so "now" here means the same instant the server means.
export function TimerCountdown({ timer, clockOffsetMs = 0 }: { timer: Timer; clockOffsetMs?: number }) {
  const [now, setNow] = useState(() => Date.now());
  // The reveal text is blurred behind a "click to reveal" prompt even once
  // the countdown hits zero -- expiry unlocks it (see public_api.py's
  // list_timers), but showing it still takes a deliberate click rather
  // than just appearing, so it reads as unwrapping a surprise. Local,
  // unpersisted state: reloading the page (or a fresh visitor) re-blurs it.
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    // Still ticks once a second even while paused, purely so the blink
    // keeps a heartbeat -- the actual remaining-time math below is frozen
    // (target_time - paused_at, both fixed) regardless of this tick.
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const serverNow = now + clockOffsetMs;
  const target = new Date(timer.target_time).getTime();
  const anchor = timer.paused && timer.paused_at ? new Date(timer.paused_at).getTime() : serverNow;
  const remaining = target - anchor;
  const expired = remaining <= 0;

  // daysHoursMinutesSeconds clamps negative remaining to 0 -- an expired
  // timer just keeps showing 00:00:00:00 rather than swapping the digits
  // out for something else, so the card's clock face never changes shape
  // between running and expired, only the footer below it does.
  const { days, hours, minutes, seconds } = daysHoursMinutesSeconds(remaining);
  // Frozen (solidly lit, not blinking) once paused or expired -- a still
  // colon reads as "stopped" the same way a still second hand does on an
  // analog clock.
  const dotsLit = timer.paused || expired ? true : Math.floor(serverNow / 1000) % 2 === 0;
  const blinking = !timer.paused && !expired;

  return (
    <div className="digital-clock timer-admin-clock">
      {timer.paused && !expired && <span className="timer-admin-paused-badge">PAUSED</span>}
      <div className="clock-row">
        <DigitGroup value={pad2(days)} />
        <Colon blinking={blinking} lit={dotsLit} />
        <DigitGroup value={pad2(hours)} />
        <Colon blinking={blinking} lit={dotsLit} />
        <DigitGroup value={pad2(minutes)} />
        <Colon blinking={blinking} lit={dotsLit} />
        <DigitGroup value={pad2(seconds)} />
      </div>
      {expired && (
        <div className="timer-reveal-footer">
          {revealed ? (
            <span className="timer-reveal-text">{timer.reveal_text || "EXPIRED"}</span>
          ) : (
            <button type="button" className="timer-reveal-button" onClick={() => setRevealed(true)}>
              Reveal Text <span aria-hidden="true">👁</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function TimerCard({ timer, clockOffsetMs }: { timer: Timer; clockOffsetMs?: number }) {
  return (
    <div className="timer-admin-item">
      <span className="timer-admin-item-title">{timer.title}</span>
      <TimerCountdown timer={timer} clockOffsetMs={clockOffsetMs} />
    </div>
  );
}
