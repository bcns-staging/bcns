import { useState, type FormEvent } from "react";
import { API_BASE } from "./file-explorer/utils";
import { decryptSecret } from "./deaddrop/crypto";

type Phase = "pin-entry" | "decrypting" | "revealed" | "error";

// Purely cosmetic -- the actual PBKDF2 + AES-GCM work below takes well
// under 100ms, too fast to read as "decrypting" happening at all. This
// floors how long that phase is shown, run in parallel with the real work,
// not stacked on top of it.
const MIN_DECRYPT_ANIMATION_MS = 900;

function readLocation(): { id: string | null; key: string | null } {
  if (typeof window === "undefined") return { id: null, key: null };
  const id = new URLSearchParams(window.location.search).get("id");
  // Not URLSearchParams on the hash -- "#k=<base64url>" is deliberately the
  // only thing ever put there (see DeadDropAdmin.tsx), and base64url's own
  // alphabet (A-Za-z0-9-_) never needs URL-decoding, so a plain slice is
  // exact and avoids treating a `=` padding character as a delimiter.
  const hash = window.location.hash;
  const key = hash.startsWith("#k=") ? hash.slice(3) : null;
  return { id, key };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function DeadDropView() {
  const [{ id, key }] = useState(readLocation);
  const [phase, setPhase] = useState<Phase>(id && key ? "pin-entry" : "error");
  const [errorMessage, setErrorMessage] = useState(
    id && key ? "" : "This link is missing its id or key -- it may have been copied or forwarded incorrectly.",
  );
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  // The one and only fetch happens on the first PIN attempt (see submit()
  // below) -- the server burns the drop right then, regardless of whether
  // the PIN turns out to be right. Caching the result here is what lets a
  // *wrong* PIN be retried without needing (or being able to get) a second
  // fetch: the drop is already consumed either way.
  const [fetched, setFetched] = useState<{ ciphertext: string; iv: string } | null>(null);
  const [plaintext, setPlaintext] = useState("");
  const [copied, setCopied] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!id || !key) return;
    setPinError(null);
    setPhase("decrypting");
    const minDelay = wait(MIN_DECRYPT_ANIMATION_MS);

    try {
      let payload = fetched;
      if (!payload) {
        const resp = await fetch(`${API_BASE}/api/deaddrop/${encodeURIComponent(id)}`, { cache: "no-store" });
        const body = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          await minDelay;
          const status = body.status as string | undefined;
          setErrorMessage(
            status === "burned"
              ? "This message has already been opened and destroyed. It can only ever be read once."
              : status === "expired"
                ? "This message expired before anyone opened it, and has been destroyed."
                : "This link doesn't exist -- it may have been revoked, or never existed.",
          );
          setPhase("error");
          return;
        }
        payload = { ciphertext: body.ciphertext, iv: body.iv };
        setFetched(payload);
      }

      const text = await decryptSecret(payload.ciphertext, payload.iv, key, pin);
      await minDelay;
      setPlaintext(text);
      setPhase("revealed");
    } catch {
      await minDelay;
      // Wrong PIN (or a mangled key fragment) -- if `fetched` is now set,
      // the ciphertext is cached and this is retryable purely client-side,
      // no further contact with the server needed.
      setPinError("Incorrect PIN -- try again.");
      setPhase("pin-entry");
    }
  }

  async function copyPlaintext() {
    try {
      await navigator.clipboard.writeText(plaintext);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // no sensible fallback
    }
  }

  return (
    <div className="timer-admin-item deaddrop-view-item">
      <span className="timer-hud-corner timer-hud-corner-tl" aria-hidden="true" />
      <span className="timer-hud-corner timer-hud-corner-br" aria-hidden="true" />

      <div className="timer-hud-header">
        <span className="timer-hud-label">Sealed Transmission</span>
        <span
          className={`timer-hud-pill is-${phase === "revealed" ? "expired" : phase === "error" ? "running" : "paused"}`}
        >
          {phase === "revealed" ? "OPENED" : phase === "error" ? "UNAVAILABLE" : "SEALED"}
        </span>
      </div>

      {phase === "pin-entry" && (
        <>
          <p className="deaddrop-view-copy">
            This message can be opened once. Once revealed, it is permanently destroyed -- there is no second chance
            to read it.
          </p>
          <form className="deaddrop-view-pin-form" onSubmit={submit}>
            <input
              type="password"
              inputMode="text"
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoFocus
              required
            />
            <button type="submit" className="timer-reveal-button deaddrop-view-reveal" disabled={!pin}>
              Decrypt <span aria-hidden="true">▸</span>
            </button>
          </form>
          {pinError && <p className="deaddrop-view-error">{pinError}</p>}
        </>
      )}

      {phase === "decrypting" && (
        <div className="deaddrop-decrypting">
          <span className="deaddrop-decrypting-label">Decrypting…</span>
          <span className="deaddrop-decrypting-bar" aria-hidden="true" />
        </div>
      )}

      {phase === "error" && <p className="deaddrop-view-error">{errorMessage}</p>}

      {phase === "revealed" && (
        <>
          <button type="button" className="deaddrop-view-plaintext" onClick={copyPlaintext} title="Click to copy">
            {plaintext}
          </button>
          <p className="deaddrop-view-copied-hint">{copied ? "Copied!" : "Click the message to copy it."}</p>
          <p className="deaddrop-view-burned-notice">This message has been destroyed and cannot be viewed again.</p>
        </>
      )}
    </div>
  );
}
