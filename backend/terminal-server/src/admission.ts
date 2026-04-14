import crypto from 'crypto';

const ADMISSION_ISSUER = 'terminal-gateway';
const ADMISSION_AUDIENCE = 'terminal-origin';
const INTERNAL_AUTH_HEADER = 'x-terminal-internal-auth';
const INTERNAL_AUTH_PREFIX = 'tsv1';
const INTERNAL_AUTH_MAX_SKEW_MS = 60_000;

type AdmissionPayload = {
  sub: string;
  email?: string;
  role: string;
  emailVerified?: boolean;
  ip: string;
  uaHash: string;
  iss: string;
  aud: string;
  nbf: number;
  iat: number;
  exp: number;
  jti: string;
};

function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export function hashUserAgent(userAgent: string): string {
  return base64UrlEncode(
    crypto.createHash('sha256').update(userAgent.trim().toLowerCase()).digest()
  );
}

function verifyHmac(message: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(message).digest();
  const actual = base64UrlDecode(signature);
  if (actual.length !== expected.length) {
    crypto.timingSafeEqual(expected, expected);
    return false;
  }
  return crypto.timingSafeEqual(expected, actual);
}

export function verifyAdmissionToken(input: {
  token: string;
  secret: string;
  clientIP: string;
  userAgent: string;
}): AdmissionPayload | null {
  try {
    const parts = input.token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    const message = `${headerB64}.${payloadB64}`;
    if (!verifyHmac(message, signatureB64, input.secret)) {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8')) as AdmissionPayload;
    const now = Math.floor(Date.now() / 1000);

    if (payload.iss !== ADMISSION_ISSUER || payload.aud !== ADMISSION_AUDIENCE) {
      return null;
    }
    if (typeof payload.nbf !== 'number' || payload.nbf > now) {
      return null;
    }
    if (typeof payload.exp !== 'number' || payload.exp < now) {
      return null;
    }
    if (payload.role !== 'admin' || payload.emailVerified !== true) {
      return null;
    }
    if (!timingSafeEqualString(payload.ip, input.clientIP)) {
      return null;
    }
    const uaHash = hashUserAgent(input.userAgent);
    if (!timingSafeEqualString(payload.uaHash, uaHash)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function verifyInternalRequest(input: {
  headerValue: string | string[] | undefined;
  secret: string;
  method: string;
  path: string;
}): boolean {
  if (typeof input.headerValue !== 'string' || !input.headerValue) {
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
  return verifyHmac(message, signature, input.secret);
}

export function createInternalAuthHeader(secret: string, method: string, path: string): string {
  const timestamp = Date.now();
  const message = `${timestamp}.${method.toUpperCase()}.${path}`;
  const signature = base64UrlEncode(
    crypto.createHmac('sha256', secret).update(message).digest()
  );
  return `${INTERNAL_AUTH_PREFIX}.${timestamp}.${signature}`;
}

export { INTERNAL_AUTH_HEADER };
