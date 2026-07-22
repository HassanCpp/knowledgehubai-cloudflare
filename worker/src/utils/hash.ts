// ─── Crypto hashing utilities (Web Crypto API, no Node.js deps) ──────────────

/**
 * Generates a SHA-256 hex digest of a Uint8Array.
 */
export async function sha256Hex(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return hexFromBuffer(hashBuffer);
}

/**
 * Generates a SHA-256 hex digest of a UTF-8 string.
 */
export async function sha256String(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  return sha256Hex(data);
}

/**
 * Generates a fast MD5-like fingerprint using SHA-256 (first 16 hex chars).
 * Used for content deduplication where a short hash is sufficient.
 */
export async function shortHash(text: string): Promise<string> {
  const full = await sha256String(text);
  return full.slice(0, 32); // 128-bit
}

/**
 * Hashes a password using PBKDF2 with a random salt.
 * Returns "saltHex:hashHex" which is stored in the DB.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  const saltHex = hexFromBuffer(salt.buffer);
  const hashHex = hexFromBuffer(hashBuffer);
  return `${saltHex}:${hashHex}`;
}

/**
 * Verifies a plain-text password against a stored "saltHex:hashHex" string.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, storedHash] = stored.split(':');
  if (!saltHex || !storedHash) return false;

  const salt = bufferFromHex(saltHex);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  const hashHex = hexFromBuffer(hashBuffer);
  return hashHex === storedHash;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexFromBuffer(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function bufferFromHex(hex: string): Uint8Array {
  const pairs = hex.match(/.{2}/g) ?? [];
  return new Uint8Array(pairs.map((b) => parseInt(b, 16)));
}
