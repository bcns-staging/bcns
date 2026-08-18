// Client-side AES-256-GCM, via the browser's native SubtleCrypto -- not a
// hand-rolled cipher. Two independent secrets are required to decrypt a
// drop, and mcp-fileserver never sees either one:
//
// 1. A random 256-bit "link secret", generated per drop and carried only in
//    the share link's URL *fragment* (`#k=...`), which browsers never
//    include in the request line, headers, or referrer of any HTTP
//    request.
// 2. A PIN the admin sets and relays to the recipient through a *different*
//    channel than the link itself (verbally, a separate text, etc.).
//
// The actual AES-GCM key is derived from both via PBKDF2 (pin as the
// password, the link secret as the salt) rather than PIN-gating access to a
// key that would work on its own -- a wrong PIN produces a wrong key and a
// genuine SubtleCrypto decrypt failure, not just a UI check an attacker
// holding the raw ciphertext + link secret could skip. Splitting the two
// secrets across channels means a leak of the link alone (forwarded by
// accident, caught in a proxy log, etc.) isn't enough on its own.
//
// Honest caveat: PBKDF2's iteration count adds real per-guess cost, but a
// short numeric PIN still has a small keyspace -- treat this the way you'd
// treat a real-world PIN (a meaningful second factor, not on its own
// military-grade), and prefer a longer PIN for anything highly sensitive.

const IV_BYTES = 12; // standard AES-GCM nonce size
const AES_GCM = "AES-GCM" as const;
const PBKDF2_ITERATIONS = 200_000;

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Explicit <ArrayBuffer> generic, not bare Uint8Array (which widens to
// Uint8Array<ArrayBufferLike>) -- SubtleCrypto's BufferSource overloads want
// the narrower, ArrayBuffer-backed form these callers actually construct.
function base64UrlToBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveAesKey(
  pin: string,
  linkSecret: Uint8Array<ArrayBuffer>,
  usage: "encrypt" | "decrypt",
): Promise<CryptoKey> {
  const pinKeyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: linkSecret, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    pinKeyMaterial,
    { name: AES_GCM, length: 256 },
    false,
    [usage],
  );
}

export interface EncryptedSecret {
  ciphertext: string;
  iv: string;
  /** Never sent to the server -- goes in the share link's URL fragment. */
  key: string;
}

export async function encryptSecret(plaintext: string, pin: string): Promise<EncryptedSecret> {
  const linkSecret = crypto.getRandomValues(new Uint8Array(32));
  const cryptoKey = await deriveAesKey(pin, linkSecret, "encrypt");
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuf = await crypto.subtle.encrypt({ name: AES_GCM, iv }, cryptoKey, encoded);
  return {
    ciphertext: bytesToBase64Url(new Uint8Array(cipherBuf)),
    iv: bytesToBase64Url(iv),
    key: bytesToBase64Url(linkSecret),
  };
}

/** Throws (DOMException from SubtleCrypto) if the pin, key, or iv don't
 * match the ciphertext -- e.g. a wrong PIN or a truncated key fragment.
 * Callers should treat any rejection as "couldn't decrypt", not surface the
 * raw error. */
export async function decryptSecret(ciphertext: string, iv: string, keyB64: string, pin: string): Promise<string> {
  const linkSecret = base64UrlToBytes(keyB64);
  const cryptoKey = await deriveAesKey(pin, linkSecret, "decrypt");
  const cipherBytes = base64UrlToBytes(ciphertext);
  const ivBytes = base64UrlToBytes(iv);
  const plainBuf = await crypto.subtle.decrypt({ name: AES_GCM, iv: ivBytes }, cryptoKey, cipherBytes);
  return new TextDecoder().decode(plainBuf);
}

// Upper/lower/digits/symbols -- deliberately everything, for an admin who'd
// rather not think of a PIN themselves and just wants the strongest one
// possible to relay verbatim.
const STRONG_PIN_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[]{}";

/** crypto.getRandomValues -- a real CSPRNG, not Math.random() (which isn't
 * cryptographically secure and has no business generating anything security-
 * sensitive) -- with rejection sampling, not a plain `byte % charset.length`:
 * 256 isn't a multiple of the charset size, so a naive modulo would make the
 * first few characters very slightly more likely than the rest. Discarding
 * any byte that falls in that leftover, unevenly-sized remainder before
 * taking the modulo makes every surviving character exactly equally likely,
 * so the result is genuinely uniform over the whole charset, not just
 * "look-random". At 80 characters and 51 of them, that's roughly log2(80)
 * * 51 ≈ 322 bits of entropy -- offline brute-forcing this is not a
 * realistic threat at any conceivable computing scale. */
// crypto.getRandomValues rejects any request over 65,536 bytes (a real Web
// Crypto spec limit, not just an engine quirk) -- irrelevant at the 51
// characters this is actually called with, but batching keeps the function
// correct for any length instead of quietly relying on callers never
// asking for a lot at once.
const RANDOM_BATCH_MAX = 1024;

export function generateStrongPin(length: number): string {
  const charsetSize = STRONG_PIN_CHARSET.length;
  const maxUnbiased = 256 - (256 % charsetSize);
  let result = "";
  while (result.length < length) {
    const batchSize = Math.min(length - result.length, RANDOM_BATCH_MAX);
    const batch = crypto.getRandomValues(new Uint8Array(batchSize));
    for (const byte of batch) {
      if (byte >= maxUnbiased) continue; // reroll -- would bias the low end of the charset
      result += STRONG_PIN_CHARSET[byte % charsetSize];
      if (result.length === length) break;
    }
  }
  return result;
}
