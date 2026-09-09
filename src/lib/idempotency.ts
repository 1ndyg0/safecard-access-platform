/**
 * Idempotency keys for one-shot user actions.
 *
 * Module scope on purpose. Minting a key inside a component body — even
 * in a ref initialiser — runs during render, which React may repeat;
 * the key would then differ between attempts and the server's duplicate
 * protection would let both through. Call this from an event handler.
 */
export function newIdempotencyKey(prefix = "sc"): string {
  const webCrypto = globalThis.crypto as Crypto | undefined;
  if (webCrypto?.randomUUID) return webCrypto.randomUUID();
  if (webCrypto?.getRandomValues) {
    const bytes = webCrypto.getRandomValues(new Uint8Array(12));
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${prefix}-${hex}`;
  }
  // No crypto at all: the server still rejects a malformed or reused
  // key, so failing loudly here beats emitting a guessable one.
  throw new Error("A secure random source is required to submit this action.");
}
