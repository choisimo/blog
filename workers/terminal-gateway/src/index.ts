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
 * - Secret key injection for origin authentication
 * - Geo-blocking (optional)
 */

import type { Env } from './types';
import { verifyToken, extractToken } from './auth';
import {
  checkRateLimit,
  hasActiveSession,
  createSession,
  deleteSession,
} from './ratelimit';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(
        JSON.stringify({ status: 'ok', env: env.ENV }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Only handle /terminal path
    if (url.pathname !== '/terminal' && url.pathname !== '/terminal/') {
      return new Response('Not Found', { status: 404 });
    }

    // 1. Check WebSocket upgrade request
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    // 2. Extract and verify token
    const token = extractToken(request);
    const user = await verifyToken(token, env);

    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const userId = user.sub;
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

    // 3. Rate limiting check
    const rateLimitResult = await checkRateLimit(clientIP, env.KV);
    if (!rateLimitResult.allowed) {
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

    // 4. Check for existing session (1 session per user)
    const existingSession = await hasActiveSession(userId, env.KV);
    if (existingSession) {
      return new Response('Session already active', { status: 409 });
    }

    // 5. Optional: Geo-blocking
    const country = request.cf?.country as string | undefined;
    const blockedCountries = ['CN', 'RU', 'KP']; // Example blocked countries
    if (country && blockedCountries.includes(country)) {
      console.log(`Blocked connection from country: ${country}`);
      return new Response('Forbidden', { status: 403 });
    }

    // 6. Create session
    await createSession(userId, clientIP, env.KV);

    // 7. Prepare origin request with injected headers
    const originUrl = `${env.TERMINAL_ORIGIN}/terminal`;
    const originHeaders = new Headers(request.headers);

    // Inject secret key for origin authentication
    originHeaders.set('X-Backend-Key', env.BACKEND_KEY);
    originHeaders.set('X-User-ID', userId);
    originHeaders.set('X-User-Email', user.email || '');
    originHeaders.set('X-Client-IP', clientIP);
    originHeaders.set('X-Request-ID', crypto.randomUUID());

    const originRequest = new Request(originUrl, {
      method: request.method,
      headers: originHeaders,
    });

    // 8. Proxy to origin
    try {
      const response = await fetch(originRequest);

      // If connection fails or closes, clean up session
      if (!response.ok || response.status >= 400) {
        await deleteSession(userId, env.KV);
      }

      return response;
    } catch (err) {
      console.error('Origin connection failed:', err);
      await deleteSession(userId, env.KV);
      return new Response('Bad Gateway', { status: 502 });
    }
  },
};
