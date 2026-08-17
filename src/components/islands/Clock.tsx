import { useEffect, useState } from "react";
import { Colon, DigitGroup, pad2 } from "./SevenSegment";

export default function Clock({ showDate = true }: { showDate?: boolean }) {
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
      {showDate && (
        <div className="clock-row clock-date-row">
          <DigitGroup value={pad2(now.getDate())} />
          <Colon />
          <DigitGroup value={pad2(now.getMonth() + 1)} />
          <Colon />
          <DigitGroup value={now.getFullYear().toString()} />
        </div>
      )}
    </div>
  );
}
