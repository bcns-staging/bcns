import { useEffect, useState } from "react";

// Ported from D:\digiocean\page2\static\svg_timer.js (createSevenSegmentDigit)
// -- a different implementation of the same idea as Clock.tsx: raw SVG <path>
// segments instead of CSS clip-path polygons, flat fill colors instead of a
// glow, skewX(-7) instead of -8deg. Kept faithful to the original rather
// than reconciled with Clock.tsx's version, including its lack of a
// viewBox on the <svg> (paths run slightly past the 34x60 box on purpose,
// same as the source).
const SEGMENT_PATHS: Record<string, string> = {
  a: "M5,5 H35 L30,10 H10 L5,5 Z",
  b: "M35,5 L30,10 V30 L35,35 V5 Z",
  c: "M35,35 L30,40 V60 L35,65 V35 Z",
  d: "M5,65 H35 L30,60 H10 L5,65 Z",
  e: "M5,35 L10,40 V60 L5,65 V35 Z",
  f: "M5,5 L10,10 V30 L5,35 V5 Z",
  g: "M5,35 H35 L30,40 H10 L5,35 Z",
};

const DIGIT_SEGMENTS: Record<string, string[]> = {
  "0": ["a", "b", "c", "d", "e", "f"],
  "1": ["b", "c"],
  "2": ["a", "b", "g", "e", "d"],
  "3": ["a", "b", "g", "c", "d"],
  "4": ["f", "g", "b", "c"],
  "5": ["a", "f", "g", "c", "d"],
  "6": ["a", "f", "g", "e", "c", "d"],
  "7": ["a", "b", "c"],
  "8": ["a", "b", "c", "d", "e", "f", "g"],
  "9": ["a", "b", "g", "f", "c", "d"],
};

function SvgSevenSegmentDigit({ char }: { char: string }) {
  const active = DIGIT_SEGMENTS[char] ?? [];
  return (
    <svg className="svg-clock-digit">
      <g transform="translate(4, 0) skewX(-7)">
        {Object.entries(SEGMENT_PATHS).map(([key, d]) => (
          <path key={key} d={d} className={`svg-clock-segment${active.includes(key) ? "" : " off"}`} />
        ))}
      </g>
    </svg>
  );
}

function SvgDigitBlock({ value }: { value: string }) {
  return (
    <span className="svg-clock-digit-block">
      {value.split("").map((ch, i) => (
        <SvgSevenSegmentDigit key={i} char={ch} />
      ))}
    </span>
  );
}

function SvgSeparator() {
  return (
    <span className="svg-clock-separator">
      <span className="svg-clock-dot" />
      <span className="svg-clock-dot" />
    </span>
  );
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export default function SvgClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return null;

  return (
    <div className="svg-clock-container">
      <div className="svg-clock-display">
        <SvgDigitBlock value={pad2(now.getHours())} />
        <SvgSeparator />
        <SvgDigitBlock value={pad2(now.getMinutes())} />
        <SvgSeparator />
        <SvgDigitBlock value={pad2(now.getSeconds())} />
      </div>
    </div>
  );
}
