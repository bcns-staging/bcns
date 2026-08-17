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

const STATUS_LABEL = { running: "LOCKED", paused: "PAUSED", expired: "READY" } as const;

// Shared by TimerAdmin.tsx (the login-gated management view) and
// TimerList.tsx (the public, read-only /cypher listing) -- same countdown
// rendering either way, so pausing/resuming behaves identically in both
// places instead of two implementations drifting apart.
//
// clockOffsetMs corrects for skew between the browser's clock and the
// server's: target_time/paused_at/created_at are all server timestamps, so
// a paused timer's frozen remaining (target_time - paused_at) never
// touches the client clock and is always exact. A *running* timer's
// remaining (target_time - now) does mix in the browser's Date.now()
// though -- if the two clocks disagree, that shows up as a jump right at
// the instant a timer resumes (going from a skew-free frozen value to a
// skew-affected live one) even though nothing about the pause/resume math
// itself is wrong. Server-supplied clockOffsetMs (see TimerList.tsx/
// TimerAdmin.tsx) cancels that skew out so "now" here means the same
// instant the server means.
export function TimerCountdown({
  timer,
  clockOffsetMs = 0,
  title,
  onSelect,
}: {
  timer: Timer;
  clockOffsetMs?: number;
  title: string;
  // Only passed by TimerAdmin.tsx -- makes the whole card clickable to open
  // it for editing, replacing the old separate "Edit..." dropdown. Absent
  // on the public /cypher listing, where cards aren't interactive.
  onSelect?: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  // The reveal text sits behind a "click to reveal" prompt even once the
  // countdown hits zero -- expiry unlocks it (see public_api.py's
  // list_timers), but showing it still takes a deliberate click rather
  // than just appearing, so it reads as unwrapping a surprise. Local,
  // unpersisted state: reloading the page (or a fresh visitor) re-hides
  // it. A "Hide" action can also re-collapse it without a reload.
  const [revealed, setRevealed] = useState(false);
  // Briefly shows "Copied!" in place of the text after a click -- reset by
  // its own timeout, not tied to `revealed` (staying revealed is separate
  // from this transient confirmation).
  const [copied, setCopied] = useState(false);

  async function copyRevealText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard permission denied or API unavailable -- nothing sensible
      // to fall back to, so just skip the "Copied!" confirmation.
    }
  }

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
  const status = expired ? "expired" : timer.paused ? "paused" : "running";

  // Progress bar: how much of the timer's own original span (created_at ->
  // target_time) has elapsed, using the same frozen-while-paused anchor as
  // the countdown itself so the bar stops moving in lockstep with the
  // digits rather than continuing to creep forward while paused.
  const created = new Date(timer.created_at).getTime();
  const totalSpan = Math.max(target - created, 1);
  const progressPct = expired ? 100 : Math.min(100, Math.max(0, ((anchor - created) / totalSpan) * 100));

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
    <div
      className={`timer-admin-item${onSelect ? " timer-admin-item-editable" : ""}`}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
    >
      <span className="timer-hud-corner timer-hud-corner-tl" aria-hidden="true" />
      <span className="timer-hud-corner timer-hud-corner-br" aria-hidden="true" />
      <div className="timer-hud-header">
        <span className="timer-hud-label">{title}</span>
        <span className={`timer-hud-pill is-${status}`}>{STATUS_LABEL[status]}</span>
      </div>
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
              <Colon blinking={blinking} lit={dotsLit} />
              <DigitGroup value={pad2(hours)} />
            </div>
            <span className="timer-hud-unit-label">Hrs</span>
          </div>
          <div className="timer-hud-unit-col">
            <div className="timer-hud-unit-digits">
              <Colon blinking={blinking} lit={dotsLit} />
              <DigitGroup value={pad2(minutes)} />
            </div>
            <span className="timer-hud-unit-label">Min</span>
          </div>
          <div className="timer-hud-unit-col">
            <div className="timer-hud-unit-digits">
              <Colon blinking={blinking} lit={dotsLit} />
              <DigitGroup value={pad2(seconds)} />
            </div>
            <span className="timer-hud-unit-label">Sec</span>
          </div>
        </div>
      </div>
      <div className="timer-hud-progress-track">
        <div className="timer-hud-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>
      <div className="timer-reveal-footer">
        {!expired ? (
          <span className="timer-sealed-label">Sealed until zero</span>
        ) : revealed ? (
          <div className="timer-reveal-revealed">
            <button
              type="button"
              className="timer-reveal-text"
              onClick={(e) => {
                e.stopPropagation();
                copyRevealText(timer.reveal_text || "EXPIRED");
              }}
              title="Click to copy"
            >
              {copied ? "Copied!" : timer.reveal_text || "EXPIRED"}
            </button>
            <button
              type="button"
              className="timer-reveal-hide"
              onClick={(e) => {
                e.stopPropagation();
                setRevealed(false);
              }}
            >
              Hide
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="timer-reveal-button"
            onClick={(e) => {
              e.stopPropagation();
              setRevealed(true);
            }}
          >
            Reveal Key <span aria-hidden="true">▸</span>
          </button>
        )}
      </div>
    </div>
  );
}

export function TimerCard({
  timer,
  clockOffsetMs,
  onSelect,
}: {
  timer: Timer;
  clockOffsetMs?: number;
  onSelect?: () => void;
}) {
  return <TimerCountdown timer={timer} clockOffsetMs={clockOffsetMs} title={timer.title} onSelect={onSelect} />;
}
