import { useState } from "react";

export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div className="island-demo">
      <button className="island-btn" onClick={() => setCount((c) => c + 1)}>
        Clicked {count} {count === 1 ? "time" : "times"}
      </button>
    </div>
  );
}
