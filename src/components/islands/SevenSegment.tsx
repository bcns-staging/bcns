// Shared seven-segment digit rendering, used by Clock.tsx and
// TimerAdmin.tsx. Not an island itself (nothing here is mounted directly
// via client:*) -- just the reusable pieces both need, so the segment-
// drawing logic lives in exactly one place.

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

export function SevenSegmentDigit({ char }: { char: string }) {
  const lit = SEGMENT_MAP[char] ?? "";
  return (
    <span className="digit">
      {ALL_SEGMENTS.map((seg) => (
        <span key={seg} className={`segment seg-${seg}${lit.includes(seg) ? " is-lit" : ""}`} />
      ))}
    </span>
  );
}

export function DigitGroup({ value }: { value: string }) {
  return (
    <span className="clock-box">
      {value.split("").map((ch, i) => (
        <SevenSegmentDigit key={i} char={ch} />
      ))}
    </span>
  );
}

export function Colon({ blinking = false, lit = true }: { blinking?: boolean; lit?: boolean }) {
  const on = !blinking || lit;
  return (
    <span className="clock-colon">
      <span className={`clock-colon-dot${on ? " is-lit" : ""}`} />
      <span className={`clock-colon-dot${on ? " is-lit" : ""}`} />
    </span>
  );
}

export function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}
