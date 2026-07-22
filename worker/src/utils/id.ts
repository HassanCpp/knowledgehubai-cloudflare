// ─── ID Generation (Web Crypto, no Node.js deps) ──────────────────────────────

/**
 * Generates a UUID v4 using the Web Crypto API.
 * Available in all Cloudflare Worker runtimes.
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Generates a short alphanumeric ID (12 chars) for human-readable references.
 */
export function generateShortId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return btoa(String.fromCharCode(...bytes))
    .replace(/[+/=]/g, '')
    .slice(0, 12);
}
