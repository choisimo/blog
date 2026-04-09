import type { Env, TerminalAdmissionClaims } from './types';

function toBase64Url(input: ArrayBuffer | Uint8Array | string): string {
  const bytes =
    typeof input === 'string'
      ? new TextEncoder().encode(input)
      : input instanceof Uint8Array
        ? input
        : new Uint8Array(input);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function importHmacKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

export async function hashUserAgent(userAgent: string | null | undefined): Promise<string | null> {
  if (!userAgent) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(userAgent));
  return toBase64Url(digest);
}

async function signCompactJws(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${toBase64Url(signature)}`;
}

export async function createTerminalAdmissionToken(
  env: Env,
  claims: {
    sessionId: string;
    userId: string;
    email?: string;
    clientIP: string;
    userAgentHash?: string | null;
  },
): Promise<string> {
  const ttlSeconds = Math.max(15, Number(env.TERMINAL_CONNECT_TOKEN_TTL_SECONDS || '60'));
  const now = Math.floor(Date.now() / 1000);

  const payload: TerminalAdmissionClaims = {
    iss: 'terminal-gateway',
    aud: 'terminal-server',
    scope: 'terminal.connect',
    sid: claims.sessionId,
    sub: claims.userId,
    email: claims.email,
    ip: claims.clientIP,
    ua: claims.userAgentHash || null,
    iat: now,
    nbf: now - 5,
    exp: now + ttlSeconds,
  };

  return signCompactJws(payload, env.TERMINAL_SESSION_SECRET);
}
