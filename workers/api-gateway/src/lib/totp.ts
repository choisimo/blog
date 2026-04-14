/**
 * TOTP (Time-based One-Time Password) implementation
 * RFC 6238 — HMAC-SHA1 via Web Crypto API (no npm packages)
 */

// Base32 alphabet (RFC 4648)
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Encode bytes to base32 string
 */
function base32Encode(bytes: Uint8Array): string {
  let result = '';
  let bits = 0;
  let value = 0;

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      result += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }

  if (bits > 0) {
    result += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }

  return result;
}

/**
 * Decode base32 string to bytes
 */
function base32Decode(input: string): Uint8Array {
  const str = input.toUpperCase().replace(/=+$/, '');
  const bytes = new Uint8Array(Math.floor((str.length * 5) / 8));
  let bits = 0;
  let value = 0;
  let index = 0;

  for (const char of str) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error(`Invalid base32 character: ${char}`);
    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes[index++] = (value >>> (bits - 8)) & 0xff;
      bits -= 8;
    }
  }

  return bytes;
}

/**
 * Generate a cryptographically random 20-byte TOTP secret encoded as base32
 */
export function generateTotpSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return base32Encode(bytes);
}

/**
 * Build an otpauth:// URI for QR code generation
 */
export function buildOtpauthUri(secret: string, issuer: string, accountName: string): string {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/**
 * Compute HOTP value for a given counter (RFC 4226)
 */
async function hotp(secretBytes: Uint8Array, counter: bigint): Promise<number> {
  // Counter as 8-byte big-endian
  const counterBytes = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = Number(c & 0xffn);
    c >>= 8n;
  }

  // Import key for HMAC-SHA1
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, counterBytes);
  const hash = new Uint8Array(signature);

  // Dynamic truncation (RFC 4226 §5.4)
  const offset = hash[hash.length - 1] & 0x0f;
  const binCode =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  return binCode % 1_000_000;
}

/**
 * Verify a 6-digit TOTP code against the current time window
 * Checks window ±1 (allows for 30s clock drift)
 */
export async function verifyTotp(
  secret: string,
  code: string,
  window = 1
): Promise<boolean> {
  return (await findMatchingTotpStep(secret, code, window)) !== null;
}

export async function findMatchingTotpStep(
  secret: string,
  code: string,
  window = 1
): Promise<number | null> {
  if (!/^\d{6}$/.test(code)) return null;

  const userCode = parseInt(code, 10);
  const secretBytes = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / 30);

  for (let delta = -window; delta <= window; delta++) {
    const step = counter + delta;
    if (step < 0) continue;
    const expected = await hotp(secretBytes, BigInt(step));
    if (expected === userCode) return step;
  }

  return null;
}
