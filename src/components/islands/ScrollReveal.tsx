import { useEffect, useState } from "react";

const BARS = [40, 85, 60, 95, 70];

export default function ScrollReveal() {
  const [grown, setGrown] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="island-demo island-bars" aria-label="animated bar chart">
      {BARS.map((h, i) => (
        <span
          key={i}
          className="island-bar"
          style={{ height: grown ? `${h}%` : "4%" }}
        />
      ))}
    </div>
  );
}
