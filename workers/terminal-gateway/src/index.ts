/**
 * Terminal Gateway - Main Entry Point
 *
 * Cloudflare Worker that authenticates user JWTs, issues a short-lived
 * origin-admission token, and proxies the WebSocket connection to terminal-server.
 */

import type { Env, SessionInfo } from './types';
import { verifyToken, extractToken } from './auth';
import { createTerminalAdmissionToken, hashUserAgent } from './terminal-session';
import {
  checkRateLimit,
  hasActiveSession,
  createSession,
  deleteSession,
} from './ratelimit';

function getBlockedCountries(env: Env): string[] {
  return String(env.TERMINAL_BLOCKED_COUNTRIES || '')
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
}

function sanitizeOriginUrl(url: URL, origin: string): string {
  const originUrl = new URL('/terminal', origin);
  for (const [key, value] of url.searchParams.entries()) {
    if (key === 'token') continue;
    originUrl.searchParams.set(key, value);
  }
  return originUrl.toString();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({ status: 'ok', env: env.ENV, gateway: 'terminal-gateway' }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (url.pathname !== '/terminal' && url.pathname !== '/terminal/') {
      return new Response('Not Found', { status: 404 });
    }

    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    const token = extractToken(request);
    const user = await verifyToken(token, env);
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const userId = user.sub;
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const userAgent = request.headers.get('User-Agent') || '';
    const userAgentHash = await hashUserAgent(userAgent);
    const requestId = crypto.randomUUID();

    const rateLimitResult = await checkRateLimit(clientIP, env.KV);
    if (!rateLimitResult.allowed) {
      return new Response('Too Many Requests', {
        status: 429,
        headers: {
          'Retry-After': String(rateLimitResult.resetAt - Math.floor(Date.now() / 1000)),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rateLimitResult.resetAt),
        },
      });
    }

    const blockedCountries = getBlockedCountries(env);
    const country = (request.cf?.country as string | undefined)?.toUpperCase();
    if (country && blockedCountries.includes(country)) {
      console.log(`Blocked terminal connection from country: ${country}`);
      return new Response('Forbidden', { status: 403 });
    }

    if (await hasActiveSession(userId, env.KV)) {
      return new Response('Session already active', { status: 409 });
    }

    const sessionId = crypto.randomUUID();
    const sessionInfo: SessionInfo = {
      sessionId,
      userId,
      clientIP,
      userAgentHash,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
    };
    await createSession(sessionInfo, env.KV);

    const originToken = await createTerminalAdmissionToken(env, {
      sessionId,
      userId,
      email: user.email,
      clientIP,
      userAgentHash,
    });

    const originHeaders = new Headers(request.headers);
    originHeaders.delete('Authorization');
    originHeaders.delete('Cookie');
    originHeaders.delete('Host');
    originHeaders.delete('X-Backend-Key');

    originHeaders.set('X-Terminal-Session-Token', originToken);
    originHeaders.set('X-Terminal-Session-Id', sessionId);
    originHeaders.set('X-Request-ID', requestId);
    originHeaders.set('X-Client-IP', clientIP);

    const originRequest = new Request(sanitizeOriginUrl(url, env.TERMINAL_ORIGIN), {
      method: request.method,
      headers: originHeaders,
    });

    try {
      const response = await fetch(originRequest);

      if (!response.ok || response.status >= 400) {
        await deleteSession(userId, sessionId, env.KV);
      }

      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('X-Terminal-Session-Id', sessionId);
      responseHeaders.set('X-Terminal-Request-Id', requestId);

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        webSocket: response.webSocket,
      });
    } catch (err) {
      console.error('Terminal origin fetch failed:', err);
      await deleteSession(userId, sessionId, env.KV);
      return new Response('Service Unavailable', { status: 503 });
    }
  },
};
