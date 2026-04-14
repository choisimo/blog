import type { Env, JWTPayload } from './types';

const encoder = new TextEncoder();

const ADMISSION_ISSUER = 'terminal-gateway';
const ADMISSION_AUDIENCE = 'terminal-origin';
const DEFAULT_TTL_SECONDS = 60;
const INTERNAL_AUTH_HEADER = 'x-terminal-internal-auth';
const INTERNAL_AUTH_PREFIX = 'tsv1';
const INTERNAL_AUTH_MAX_SKEW_MS = 60_000;

type AdmissionPayload = {
  sub: string;
  email?: string;
  role: 'admin';
  emailVerified: true;
  ip: string;
  uaHash: string;
  iss: string;
  aud: string;
  nbf: number;
  iat: number;
  exp: number;
  jti: string;
};

function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecodeToBytes(input: string): Uint8Array {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function hmacSign(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return base64UrlEncode(new Uint8Array(signature));
}

async function hmacVerify(
  message: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  return crypto.subtle.verify(
    'HMAC',
    key,
    base64UrlDecodeToBytes(signature),
    encoder.encode(message)
  );
}

export async function hashUserAgent(userAgent: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(userAgent.trim().toLowerCase())
  );
  return base64UrlEncode(new Uint8Array(digest));
}

export function getAdmissionTtlSeconds(env: Env): number {
  const raw = Number.parseInt(env.TERMINAL_CONNECT_TOKEN_TTL_SECONDS || '', 10);
  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_TTL_SECONDS;
  }
  return Math.min(raw, 300);
}

export async function createAdmissionToken(input: {
  env: Env;
  user: JWTPayload;
  clientIP: string;
  userAgent: string;
  requestId: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: AdmissionPayload = {
    sub: input.user.sub,
    email: input.user.email,
    role: 'admin',
    emailVerified: true,
    ip: input.clientIP,
    uaHash: await hashUserAgent(input.userAgent),
    iss: ADMISSION_ISSUER,
    aud: ADMISSION_AUDIENCE,
    nbf: now,
    iat: now,
    exp: now + getAdmissionTtlSeconds(input.env),
    jti: input.requestId,
  };

  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const message = `${headerB64}.${payloadB64}`;
  const signature = await hmacSign(message, input.env.TERMINAL_SESSION_SECRET);

  return `${message}.${signature}`;
}

export async function verifyInternalRequest(input: {
  headerValue: string | null;
  secret: string;
  method: string;
  path: string;
}): Promise<boolean> {
  if (!input.headerValue) {
    return false;
  }

  const parts = input.headerValue.split('.');
  if (parts.length !== 3 || parts[0] !== INTERNAL_AUTH_PREFIX) {
    return false;
  }

  const [, timestampRaw, signature] = parts;
  const timestamp = Number.parseInt(timestampRaw, 10);
  if (!Number.isFinite(timestamp)) {
    return false;
  }

  if (Math.abs(Date.now() - timestamp) > INTERNAL_AUTH_MAX_SKEW_MS) {
    return false;
  }

  const message = `${timestamp}.${input.method.toUpperCase()}.${input.path}`;
  return hmacVerify(message, signature, input.secret);
}

export { INTERNAL_AUTH_HEADER };
export type { AdmissionPayload };
