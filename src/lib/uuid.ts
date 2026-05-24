/**
 * Polyfill for crypto.randomUUID().
 *
 * crypto.randomUUID() is only available in Secure Contexts (HTTPS or localhost).
 * When the app is served over plain HTTP on a LAN IP (e.g. 192.168.x.x) the
 * native call throws. This helper falls back to crypto.getRandomValues() which
 * is available in every modern browser regardless of the transport security.
 */
export function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  // Fallback: RFC-4122 v4 UUID via getRandomValues
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // Set version (4) and variant (10xx) bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
