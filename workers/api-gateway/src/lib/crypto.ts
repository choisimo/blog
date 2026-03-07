/**
 * Secrets Encryption Utilities
 *
 * Uses AES-256-GCM encryption with Web Crypto API
 * Compatible with Cloudflare Workers runtime
 *
 * Security:
 * - Master key derived from SECRETS_ENCRYPTION_KEY env var (or JWT_SECRET as fallback)
 * - Each secret has unique IV (Initialization Vector)
 * - PBKDF2 key derivation with salt
 */

// Constants
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for AES-GCM
const SALT_LENGTH = 16;
const PBKDF2_ITERATIONS = 100000;

// Cache for derived keys (per request context)
let cachedKey: CryptoKey | null = null;
let cachedKeySource: string | null = null;

/**
 * Derive encryption key from master secret using PBKDF2
 */
async function deriveKey(masterSecret: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(masterSecret),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Get or create encryption key from environment
 */
async function getEncryptionKey(env: {
  SECRETS_ENCRYPTION_KEY?: string;
  JWT_SECRET: string;
}): Promise<CryptoKey> {
  // Use dedicated encryption key or fall back to JWT_SECRET
  const masterSecret = env.SECRETS_ENCRYPTION_KEY || env.JWT_SECRET;

  // Return cached key if same source
  if (cachedKey && cachedKeySource === masterSecret) {
    return cachedKey;
  }

  // Use a fixed salt derived from the master secret for consistent key derivation
  // This allows decryption with the same master secret
  const encoder = new TextEncoder();
  const saltSource = await crypto.subtle.digest('SHA-256', encoder.encode(masterSecret + ':salt'));
  const salt = new Uint8Array(saltSource).slice(0, SALT_LENGTH);

  cachedKey = await deriveKey(masterSecret, salt);
  cachedKeySource = masterSecret;

  return cachedKey;
}

/**
 * Generate a random IV for encryption
 */
function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

/**
 * Encrypt a secret value
 *
 * @param plaintext - The secret value to encrypt
 * @param env - Environment with encryption key
 * @returns Object with encrypted value and IV (both Base64 encoded)
 */
export async function encryptSecret(
  plaintext: string,
  env: { SECRETS_ENCRYPTION_KEY?: string; JWT_SECRET: string }
): Promise<{ encryptedValue: string; iv: string }> {
  const key = await getEncryptionKey(env);
  const iv = generateIV();
  const encoder = new TextEncoder();

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv: iv as unknown as BufferSource },
    key,
    encoder.encode(plaintext)
  );

  return {
    encryptedValue: arrayBufferToBase64(encryptedBuffer),
    iv: arrayBufferToBase64(iv),
  };
}

/**
 * Decrypt a secret value
 *
 * @param encryptedValue - Base64 encoded encrypted value
 * @param iv - Base64 encoded IV
 * @param env - Environment with encryption key
 * @returns Decrypted plaintext
 */
export async function decryptSecret(
  encryptedValue: string,
  iv: string,
  env: { SECRETS_ENCRYPTION_KEY?: string; JWT_SECRET: string }
): Promise<string> {
  const key = await getEncryptionKey(env);
  const ivBuffer = base64ToArrayBuffer(iv);
  const encryptedBuffer = base64ToArrayBuffer(encryptedValue);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: ivBuffer as unknown as BufferSource },
    key,
    encryptedBuffer as unknown as BufferSource
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

/**
 * Hash a value using SHA-256 (for audit logging)
 * Returns first 16 characters of hex hash
 */
export async function hashValue(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

/**
 * Validate a secret value against its hash
 */
export async function validateHash(value: string, expectedHash: string): Promise<boolean> {
  const actualHash = await hashValue(value);
  return actualHash === expectedHash;
}

/**
 * Mask a secret value for display
 */
export function maskSecret(value: string, visibleChars = 4): string {
  if (!value || value.length <= visibleChars * 2) {
    return '*'.repeat(8);
  }
  const start = value.substring(0, visibleChars);
  const end = value.substring(value.length - visibleChars);
  const masked = '*'.repeat(Math.min(value.length - visibleChars * 2, 20));
  return `${start}${masked}${end}`;
}

/**
 * Generate a secure random secret
 */
export function generateSecret(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
}

/**
 * Generate a secure API key with prefix
 */
export function generateApiKey(prefix = 'sk'): string {
  const randomPart = generateSecret(32);
  return `${prefix}-${randomPart}`;
}

// ============================================================================
// Utility Functions
// ============================================================================

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ============================================================================
// Re-encryption utilities (for key rotation)
// ============================================================================

/**
 * Re-encrypt a secret with a new key
 * Used during key rotation
 */
export async function reEncryptSecret(
  encryptedValue: string,
  iv: string,
  oldEnv: { SECRETS_ENCRYPTION_KEY?: string; JWT_SECRET: string },
  newEnv: { SECRETS_ENCRYPTION_KEY?: string; JWT_SECRET: string }
): Promise<{ encryptedValue: string; iv: string }> {
  // Decrypt with old key
  const plaintext = await decryptSecret(encryptedValue, iv, oldEnv);

  // Clear cached key to force new key derivation
  cachedKey = null;
  cachedKeySource = null;

  // Encrypt with new key
  return encryptSecret(plaintext, newEnv);
}

/**
 * Validate that decryption works (for health checks)
 */
export async function validateEncryption(
  env: { SECRETS_ENCRYPTION_KEY?: string; JWT_SECRET: string }
): Promise<boolean> {
  try {
    const testValue = 'encryption-test-' + Date.now();
    const { encryptedValue, iv } = await encryptSecret(testValue, env);
    const decrypted = await decryptSecret(encryptedValue, iv, env);
    return decrypted === testValue;
  } catch {
    return false;
  }
}
