/**
 * Terminal Gateway - JWT Authentication
 */

import type { Env, JWTPayload } from './types';

const JWT_ISSUER = 'blog-api-gateway';
const JWT_AUDIENCE = 'blog-platform';
const TERMINAL_TICKET_ISSUER = 'terminal-gateway';
const TERMINAL_TICKET_AUDIENCE = 'terminal-websocket';
const DEFAULT_TERMINAL_TICKET_TTL_SECONDS = 60;

export const TERMINAL_TICKET_COOKIE_NAME = 'terminal_ticket';

type TerminalTicketPayload = Pick<
  JWTPayload,
  'sub' | 'email' | 'role' | 'emailVerified'
> & {
  iss: string;
  aud: string;
  nbf: number;
  iat: number;
  exp: number;
  jti: string;
};

/**
 * Base64URL decode
 */
function base64UrlDecode(str: string): string {
  // Add padding if needed
  const padded = str + '==='.slice(0, (4 - (str.length % 4)) % 4);
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  return atob(base64);
}

function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function hmacSign(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
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

async function verifyHmac(
  message: string,
  signatureB64: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const signaturePadded =
    signatureB64 + '==='.slice(0, (4 - (signatureB64.length % 4)) % 4);
  const signatureBase64 = signaturePadded.replace(/-/g, '+').replace(/_/g, '/');
  const signatureBytes = Uint8Array.from(atob(signatureBase64), (c) =>
    c.charCodeAt(0)
  );

  return crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(message));
}

function getTerminalTicketTtlSeconds(env: Env): number {
  const raw = Number.parseInt(env.TERMINAL_CONNECT_TOKEN_TTL_SECONDS || '', 10);
  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_TERMINAL_TICKET_TTL_SECONDS;
  }
  return Math.min(raw, DEFAULT_TERMINAL_TICKET_TTL_SECONDS);
}

/**
 * Verify JWT token and extract payload
 * Uses simple HMAC-SHA256 verification
 */
export async function verifyToken(
  token: string | null,
  env: Env
): Promise<JWTPayload | null> {
  if (!token) {
    return null;
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('Invalid JWT format');
      return null;
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // Decode payload first to check registered claims before spending more work
    const payloadJson = base64UrlDecode(payloadB64);
    const payload = JSON.parse(payloadJson) as JWTPayload;

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp < now) {
      console.error('Token expired');
      return null;
    }
    if (typeof payload.nbf !== 'number' || payload.nbf > now) {
      console.error('Token not yet valid');
      return null;
    }
    if (payload.iss !== JWT_ISSUER) {
      console.error('Invalid token issuer');
      return null;
    }

    const hasAudience =
      typeof payload.aud === 'string'
        ? payload.aud === JWT_AUDIENCE
        : Array.isArray(payload.aud)
          ? payload.aud.includes(JWT_AUDIENCE)
          : false;
    if (!hasAudience) {
      console.error('Invalid token audience');
      return null;
    }
    if (payload.type === 'refresh') {
      console.error('Refresh token is not accepted for terminal access');
      return null;
    }
    if (payload.role !== 'admin' || payload.emailVerified !== true) {
      console.error('Terminal access requires verified admin token');
      return null;
    }
    if (!payload.sub) {
      console.error('Missing token subject');
      return null;
    }

    // Verify signature using Web Crypto API
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(env.JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Decode signature from base64url
    const signaturePadded =
      signatureB64 + '==='.slice(0, (4 - (signatureB64.length % 4)) % 4);
    const signatureBase64 = signaturePadded
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const signatureBytes = Uint8Array.from(atob(signatureBase64), (c) =>
      c.charCodeAt(0)
    );

    const data = encoder.encode(`${headerB64}.${payloadB64}`);
    const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, data);

    if (!valid) {
      console.error('Invalid signature');
      return null;
    }

    return payload;
  } catch (err) {
    console.error('Token verification failed:', err);
    return null;
  }
}

/**
 * Create a short-lived terminal ticket so the browser never writes the long-lived
 * bearer token into a cookie for the WebSocket handshake.
 */
export async function createTerminalTicket(
  user: JWTPayload,
  env: Env
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: TerminalTicketPayload = {
    sub: user.sub,
    email: user.email,
    role: 'admin',
    emailVerified: true,
    iss: TERMINAL_TICKET_ISSUER,
    aud: TERMINAL_TICKET_AUDIENCE,
    nbf: now,
    iat: now,
    exp: now + getTerminalTicketTtlSeconds(env),
    jti: crypto.randomUUID(),
  };

  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };
  const headerB64 = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(header))
  );
  const payloadB64 = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(payload))
  );
  const message = `${headerB64}.${payloadB64}`;
  const signature = await hmacSign(message, env.TERMINAL_SESSION_SECRET);
  return `${message}.${signature}`;
}

export async function verifyTerminalTicket(
  token: string | null,
  env: Env
): Promise<JWTPayload | null> {
  if (!token) {
    return null;
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    const message = `${headerB64}.${payloadB64}`;
    const valid = await verifyHmac(message, signatureB64, env.TERMINAL_SESSION_SECRET);
    if (!valid) {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(payloadB64)) as TerminalTicketPayload;
    const now = Math.floor(Date.now() / 1000);
    if (payload.iss !== TERMINAL_TICKET_ISSUER || payload.aud !== TERMINAL_TICKET_AUDIENCE) {
      return null;
    }
    if (typeof payload.nbf !== 'number' || payload.nbf > now) {
      return null;
    }
    if (typeof payload.exp !== 'number' || payload.exp < now) {
      return null;
    }
    if (payload.role !== 'admin' || payload.emailVerified !== true || !payload.sub) {
      return null;
    }

    return payload;
  } catch (err) {
    console.error('Terminal ticket verification failed:', err);
    return null;
  }
}

function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
}

function extractTerminalTicket(request: Request): string | null {
  const cookies = request.headers.get('Cookie') || '';
  const tokenCookie = cookies
    .split(';')
    .find((c) => c.trim().startsWith(`${TERMINAL_TICKET_COOKIE_NAME}=`));
  if (tokenCookie) {
    const rawValue = tokenCookie.split('=').slice(1).join('=').trim();
    if (!rawValue) {
      return null;
    }

    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }

  return null;
}

export async function authenticateTerminalRequest(
  request: Request,
  env: Env
): Promise<JWTPayload | null> {
  const headerToken = extractBearerToken(request);
  if (headerToken) {
    return verifyToken(headerToken, env);
  }

  return verifyTerminalTicket(extractTerminalTicket(request), env);
}
