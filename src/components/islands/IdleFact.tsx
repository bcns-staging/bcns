import { useEffect, useState } from "react";

const FACTS = [
  "This card's JavaScript didn't load until your browser was idle — using client:idle.",
  "Astro calls this 'islands architecture': static HTML ocean, interactive JS islands.",
  "Each island hydrates independently — one slow island can't block the rest of the page.",
  "Without a client directive, an Astro component ships zero JavaScript at all.",
];

export default function IdleFact() {
  const [fact, setFact] = useState<string | null>(null);

  useEffect(() => {
    setFact(FACTS[Math.floor(Math.random() * FACTS.length)]);
  }, []);

  return (
    <div className="island-demo">
      <p className="island-fact">{fact ?? "Waiting for the browser to go idle..."}</p>
    </div>
  );
}
