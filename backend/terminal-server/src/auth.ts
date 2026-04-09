import crypto from 'node:crypto';

export interface TerminalAdmissionClaims {
  iss: 'terminal-gateway';
  aud: 'terminal-server';
  scope: 'terminal.connect';
  sid: string;
  sub: string;
  email?: string;
  ip: string;
  ua?: string | null;
  iat: number;
  nbf: number;
  exp: number;
}

function fromBase64Url(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

function toBase64Url(input: Buffer | string) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function hashUserAgent(userAgent?: string | null): string | null {
  if (!userAgent) return null;
  return toBase64Url(crypto.createHash('sha256').update(userAgent).digest());
}

export function verifyTerminalAdmissionToken(
  token: string,
  secret: string,
  expected: {
    clientIP?: string | null;
    userAgent?: string | null;
  } = {},
): { ok: true; claims: TerminalAdmissionClaims } | { ok: false; error: string } {
  if (!token) {
    return { ok: false, error: 'missing token' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { ok: false, error: 'invalid token format' };
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = toBase64Url(
    crypto.createHmac('sha256', secret).update(signingInput).digest(),
  );

  if (expectedSignature !== encodedSignature) {
    return { ok: false, error: 'invalid signature' };
  }

  let payload: TerminalAdmissionClaims;
  try {
    payload = JSON.parse(fromBase64Url(encodedPayload).toString('utf8')) as TerminalAdmissionClaims;
  } catch {
    return { ok: false, error: 'invalid payload' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.iss !== 'terminal-gateway') return { ok: false, error: 'invalid issuer' };
  if (payload.aud !== 'terminal-server') return { ok: false, error: 'invalid audience' };
  if (payload.scope !== 'terminal.connect') return { ok: false, error: 'invalid scope' };
  if (payload.nbf && payload.nbf > now + 5) return { ok: false, error: 'token not active' };
  if (payload.exp && payload.exp < now) return { ok: false, error: 'token expired' };

  if (expected.clientIP && payload.ip && expected.clientIP !== payload.ip) {
    return { ok: false, error: 'client ip mismatch' };
  }

  const expectedUaHash = hashUserAgent(expected.userAgent);
  if (payload.ua && expectedUaHash && payload.ua !== expectedUaHash) {
    return { ok: false, error: 'user-agent mismatch' };
  }

  return { ok: true, claims: payload };
}
