import { useState } from "react";

export default function MobileOnlyMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="island-demo">
      <button className="island-btn" onClick={() => setOpen((o) => !o)}>
        {open ? "Close menu" : "Open menu"}
      </button>
      {open && (
        <ul className="island-menu">
          <li>Narrow-viewport only</li>
          <li>Hydrated via client:media</li>
          <li>Zero JS above 600px wide</li>
        </ul>
      )}
    </div>
  );
}
