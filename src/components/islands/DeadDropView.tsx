import { useState } from "react";
import { API_BASE } from "./file-explorer/utils";
import { decryptSecret } from "./deaddrop/crypto";

type Phase = "sealed" | "revealing" | "revealed" | "error";

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

export default function DeadDropView() {
  const [{ id, key }] = useState(readLocation);
  const [phase, setPhase] = useState<Phase>(id && key ? "sealed" : "error");
  const [errorMessage, setErrorMessage] = useState(
    id && key ? "" : "This link is missing its id or key -- it may have been copied or forwarded incorrectly.",
  );
  const [plaintext, setPlaintext] = useState("");
  const [copied, setCopied] = useState(false);

  async function reveal() {
    if (!id || !key) return;
    setPhase("revealing");
    try {
      const resp = await fetch(`${API_BASE}/api/deaddrop/${encodeURIComponent(id)}`, { cache: "no-store" });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
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
      // The read above already burned it server-side, win or lose from here
      // on -- a decrypt failure past this point (wrong/incomplete key) is
      // unfortunately unrecoverable, the same tradeoff every one-time-secret
      // link service makes: the alternative (only burning on successful
      // decrypt) would let an attacker retry indefinitely against a
      // captured ciphertext.
      const text = await decryptSecret(body.ciphertext, body.iv, key);
      setPlaintext(text);
      setPhase("revealed");
    } catch {
      setErrorMessage(
        "Couldn't decrypt this message -- the link's key looks incomplete. The message has already been destroyed and cannot be retried.",
      );
      setPhase("error");
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

      {phase === "sealed" && (
        <>
          <p className="deaddrop-view-copy">
            This message can be opened once. Once revealed, it is permanently destroyed -- there is no second chance
            to read it.
          </p>
          <button type="button" className="timer-reveal-button deaddrop-view-reveal" onClick={reveal}>
            Reveal Message <span aria-hidden="true">▸</span>
          </button>
        </>
      )}

      {phase === "revealing" && <p className="deaddrop-view-copy">Decrypting…</p>}

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
