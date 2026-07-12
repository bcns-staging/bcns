import { useEffect, useState } from "react";

export default function LiveClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="island-demo">
      <p className="island-clock">{now.toLocaleTimeString()}</p>
      <p className="island-clock-sub">{Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
    </div>
  );
}
