/**
 * Terminal Gateway - Main Entry Point
 *
 * Cloudflare Worker that acts as a security gateway for WebSocket connections
 * to the Docker terminal origin server.
 *
 * Features:
 * - JWT authentication
 * - Rate limiting (IP-based)
 * - Single session per user
 * - Short-lived terminal ticket cookie for browser WebSocket bootstrap
 * - HMAC admission token injection for terminal-server
 * - Geo-blocking (optional)
 */

import type { Env, SessionInfo } from './types';
import {
  authenticateTerminalRequest,
  createTerminalTicket,
  TERMINAL_TICKET_COOKIE_NAME,
  verifyToken,
} from './auth';
import { createAdmissionToken, getAdmissionTtlSeconds, hashUserAgent } from './admission';
import { checkRateLimit, createSession, deleteSession, hasActiveSession } from './ratelimit';

const LEGACY_SESSION_COOKIE_NAME = 'terminal_token';
const DEFAULT_ALLOWED_ORIGINS = [
  'https://noblog.nodove.com',
  'https://blog.nodove.com',
  'https://nodove.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:8081',
  'http://localhost:8081',
];

function parseAllowedOrigins(raw: string | undefined): string[] {
  return String(raw || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function getAllowedOrigins(env: Env): string[] {
  const configured = parseAllowedOrigins(env.ALLOWED_ORIGINS);
  return configured.length > 0 ? configured : DEFAULT_ALLOWED_ORIGINS;
}

function isOriginAllowed(origin: string | null, env: Env): origin is string {
  if (!origin) {
    return false;
  }

  return getAllowedOrigins(env).includes(origin);
}

function applySessionCorsHeaders(headers: Headers, origin: string): void {
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Cache-Control', 'no-store');
  headers.set('Vary', 'Origin');
}

function buildSessionCookie(
  request: Request,
  cookieName: string,
  token: string,
  maxAgeSeconds: number
): string {
  const requestUrl = new URL(request.url);
  const parts = [
    `${cookieName}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
    'HttpOnly',
    'SameSite=Strict',
  ];

  if (requestUrl.protocol === 'https:') {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return null;
  }

  return authHeader.replace(/^Bearer\s+/i, '').trim() || null;
}

function clearSessionCookies(headers: Headers, request: Request): void {
  headers.append(
    'Set-Cookie',
    buildSessionCookie(request, TERMINAL_TICKET_COOKIE_NAME, '', 0)
  );
  headers.append(
    'Set-Cookie',
    buildSessionCookie(request, LEGACY_SESSION_COOKIE_NAME, '', 0)
  );
}

async function handleSessionRequest(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  if (!isOriginAllowed(origin, env)) {
    return new Response('Forbidden', { status: 403 });
  }

  const headers = new Headers();
  applySessionCorsHeaders(headers, origin);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (request.method === 'DELETE') {
    clearSessionCookies(headers, request);
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== 'POST') {
    headers.set('Allow', 'POST, DELETE, OPTIONS');
    return new Response('Method Not Allowed', { status: 405, headers });
  }

  const token = extractBearerToken(request);
  const user = await verifyToken(token, env);
  if (!user || !token) {
    return new Response('Unauthorized', { status: 401, headers });
  }

  const ticket = await createTerminalTicket(user, env);
  clearSessionCookies(headers, request);
  headers.append(
    'Set-Cookie',
    buildSessionCookie(
      request,
      TERMINAL_TICKET_COOKIE_NAME,
      ticket,
      getAdmissionTtlSeconds(env)
    )
  );
  return new Response(null, { status: 204, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', env: env.ENV }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname === '/session') {
      return handleSessionRequest(request, env);
    }

    if (url.pathname !== '/terminal' && url.pathname !== '/terminal/') {
      return new Response('Not Found', { status: 404 });
    }

    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    const user = await authenticateTerminalRequest(request, env);
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const userId = user.sub;
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const userAgent = request.headers.get('User-Agent') || '';

    const rateLimitResult = await checkRateLimit(clientIP, env.KV);
    if (!rateLimitResult.allowed) {
      if (rateLimitResult.reason === 'kv_unavailable') {
        return new Response('Service Unavailable', {
          status: 503,
          headers: {
            'Retry-After': '60',
          },
        });
      }

      return new Response('Too Many Requests', {
        status: 429,
        headers: {
          'Retry-After': String(
            rateLimitResult.resetAt - Math.floor(Date.now() / 1000)
          ),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rateLimitResult.resetAt),
        },
      });
    }

    const country = request.cf?.country as string | undefined;
    const blockedCountries = (env.TERMINAL_BLOCKED_COUNTRIES || 'CN,RU,KP')
      .split(',')
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean);
    if (country && blockedCountries.includes(country)) {
      console.log(`Blocked connection from country: ${country}`);
      return new Response('Forbidden', { status: 403 });
    }

    if (await hasActiveSession(userId, env.KV)) {
      return new Response('Session already active', { status: 409 });
    }

    const requestId = crypto.randomUUID();
    const sessionInfo: SessionInfo = {
      sessionId: requestId,
      userId,
      clientIP,
      userAgentHash: await hashUserAgent(userAgent),
      connectedAt: Date.now(),
      lastActivity: Date.now(),
    };
    await createSession(sessionInfo, env.KV);

    const originUrl = `${env.TERMINAL_ORIGIN}/terminal`;
    const originHeaders = new Headers(request.headers);
    const admissionToken = await createAdmissionToken({
      env,
      user,
      clientIP,
      userAgent,
      requestId,
    });

    originHeaders.delete('Authorization');
    originHeaders.delete('Cookie');
    originHeaders.delete('Host');
    originHeaders.delete('X-Backend-Key');
    originHeaders.set('X-Terminal-Admission', admissionToken);
    originHeaders.set('X-Client-IP', clientIP);
    originHeaders.set('X-Client-User-Agent', userAgent);
    originHeaders.set('X-Request-ID', requestId);

    const originRequest = new Request(originUrl, {
      method: request.method,
      headers: originHeaders,
    });

    try {
      const response = await fetch(originRequest);

      if (!response.ok || response.status >= 400) {
        await deleteSession(userId, requestId, env.KV).catch((err) => {
          console.warn('Failed to delete rejected terminal session:', err);
        });
      }

      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('X-Terminal-Session-Id', requestId);
      responseHeaders.set('X-Terminal-Request-Id', requestId);

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        webSocket: response.webSocket,
      });
    } catch (err) {
      console.error('Origin connection failed:', err);
      await deleteSession(userId, requestId, env.KV).catch((closeErr) => {
        console.warn('Failed to delete failed terminal session:', closeErr);
      });
      return new Response('Bad Gateway', { status: 502 });
    }
  },
};
