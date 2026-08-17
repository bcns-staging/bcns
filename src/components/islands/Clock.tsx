import { useEffect, useState } from "react";

// Which of the 7 segments (a=top, b=top-right, c=bottom-right, d=bottom,
// e=bottom-left, f=top-left, g=middle) are lit for each digit -- the
// standard seven-segment display encoding.
const SEGMENT_MAP: Record<string, string> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abged",
  "3": "abgcd",
  "4": "fgbc",
  "5": "afgcd",
  "6": "afgecd",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
};

const ALL_SEGMENTS = ["a", "b", "c", "d", "e", "f", "g"] as const;

function SevenSegmentDigit({ char }: { char: string }) {
  const lit = SEGMENT_MAP[char] ?? "";
  return (
    <span className="digit">
      {ALL_SEGMENTS.map((seg) => (
        <span key={seg} className={`segment seg-${seg}${lit.includes(seg) ? " is-lit" : ""}`} />
      ))}
    </span>
  );
}

function DigitGroup({ value }: { value: string }) {
  return (
    <span className="clock-box">
      {value.split("").map((ch, i) => (
        <SevenSegmentDigit key={i} char={ch} />
      ))}
    </span>
  );
}

function Colon({ blinking = false, lit = true }: { blinking?: boolean; lit?: boolean }) {
  const on = !blinking || lit;
  return (
    <span className="clock-colon">
      <span className={`clock-colon-dot${on ? " is-lit" : ""}`} />
      <span className={`clock-colon-dot${on ? " is-lit" : ""}`} />
    </span>
  );
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export default function Clock() {
  // Starts null, set on mount: the server-rendered/prerendered version of
  // this page has no notion of "now" (there is no server for a static
  // site), so the first real render has to happen client-side or every
  // visitor's initial paint would show whatever time the site was last
  // built at.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return null;

  // Toggles once per second, in step with the tick that updates `now` --
  // the classic digital-clock blink, on for one second and off for the
  // next. Only the time row's colons blink; the date row's separators
  // aren't tied to seconds ticking, so they stay solidly lit.
  const secondsDotsLit = now.getSeconds() % 2 === 0;

  return (
    <div className="digital-clock">
      <div className="clock-row">
        <DigitGroup value={pad2(now.getHours())} />
        <Colon blinking lit={secondsDotsLit} />
        <DigitGroup value={pad2(now.getMinutes())} />
        <Colon blinking lit={secondsDotsLit} />
        <DigitGroup value={pad2(now.getSeconds())} />
      </div>
      <div className="clock-row clock-date-row">
        <DigitGroup value={pad2(now.getDate())} />
        <Colon />
        <DigitGroup value={pad2(now.getMonth() + 1)} />
        <Colon />
        <DigitGroup value={now.getFullYear().toString()} />
      </div>
    </div>
  );
}
