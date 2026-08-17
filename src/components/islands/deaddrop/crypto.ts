// Client-side AES-256-GCM, via the browser's native SubtleCrypto -- not a
// hand-rolled cipher. The key is generated fresh per drop and never sent to
// mcp-fileserver: it travels only in the share link's URL *fragment*
// (`#k=...`), which browsers never include in the request line, headers, or
// referrer of any HTTP request. The server (see mcp-fileserver's
// public_api.py/admin_api.py) only ever stores/returns ciphertext, so a
// compromise of that service or its storage bucket alone cannot expose a
// drop's plaintext -- only someone holding the *exact* share link can.

const IV_BYTES = 12; // standard AES-GCM nonce size
const AES_GCM = "AES-GCM" as const;

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

export interface EncryptedSecret {
  ciphertext: string;
  iv: string;
  /** Never sent to the server -- goes in the share link's URL fragment. */
  key: string;
}

export async function encryptSecret(plaintext: string): Promise<EncryptedSecret> {
  const cryptoKey = await crypto.subtle.generateKey({ name: AES_GCM, length: 256 }, true, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuf = await crypto.subtle.encrypt({ name: AES_GCM, iv }, cryptoKey, encoded);
  const rawKey = await crypto.subtle.exportKey("raw", cryptoKey);
  return {
    ciphertext: bytesToBase64Url(new Uint8Array(cipherBuf)),
    iv: bytesToBase64Url(iv),
    key: bytesToBase64Url(new Uint8Array(rawKey)),
  };
}

/** Throws (DOMException from SubtleCrypto) if the key/iv don't match the
 * ciphertext -- e.g. a truncated or mistyped key fragment. Callers should
 * treat any rejection as "couldn't decrypt", not surface the raw error. */
export async function decryptSecret(ciphertext: string, iv: string, keyB64: string): Promise<string> {
  const rawKey = base64UrlToBytes(keyB64);
  const cryptoKey = await crypto.subtle.importKey("raw", rawKey, { name: AES_GCM }, false, ["decrypt"]);
  const cipherBytes = base64UrlToBytes(ciphertext);
  const ivBytes = base64UrlToBytes(iv);
  const plainBuf = await crypto.subtle.decrypt({ name: AES_GCM, iv: ivBytes }, cryptoKey, cipherBytes);
  return new TextDecoder().decode(plainBuf);
}
