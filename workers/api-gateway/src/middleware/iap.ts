/**
 * Cloudflare Access IAP (Identity-Aware Proxy) middleware
 *
 * Validates the `Cf-Access-Jwt-Assertion` header using Cloudflare's public JWKS.
 * This is an optional extra security layer — if CF_ACCESS_AUD is not set, the
 * middleware simply passes through without enforcement.
 *
 * See: https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/
 */

import { Context, Next } from 'hono';
import type { Env } from '../types';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { unauthorized } from '../lib/response';

// Cache the JWKS fetcher per team domain to avoid refetching on every request
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
const PUBLIC_BYPASS_PATHS = new Set([
  '/_health',
  '/health',
  '/healthz',
  '/public/config',
  '/api/v1/public/config',
]);

function getJwks(teamDomain: string): ReturnType<typeof createRemoteJWKSet> {
  const existing = jwksCache.get(teamDomain);
  if (existing) return existing;

  const jwksUrl = new URL(`${teamDomain}/cdn-cgi/access/certs`);
  const jwks = createRemoteJWKSet(jwksUrl);
  jwksCache.set(teamDomain, jwks);
  return jwks;
}

/**
 * Optional Cloudflare Access JWT validation middleware.
 *
 * If CF_ACCESS_AUD is not configured → passes through (IAP guard disabled).
 * If CF_ACCESS_AUD is set but the header is missing or invalid → returns 401.
 */
export async function validateIapJwt(c: Context, next: Next): Promise<Response | void> {
  const env = c.env as Env;
  const aud = env.CF_ACCESS_AUD;
  const teamDomain = env.CF_TEAM_DOMAIN;
  const pathname = new URL(c.req.url).pathname;

  if (c.req.method === 'OPTIONS' || PUBLIC_BYPASS_PATHS.has(pathname)) {
    await next();
    return;
  }

  // IAP is optional — skip if not configured
  if (!aud || !teamDomain) {
    await next();
    return;
  }

  const assertion = c.req.header('Cf-Access-Jwt-Assertion');
  if (!assertion) {
    return unauthorized(c, 'Missing Cloudflare Access JWT');
  }

  try {
    const jwks = getJwks(teamDomain);
    await jwtVerify(assertion, jwks, {
      audience: aud,
      issuer: teamDomain,
    });
    await next();
  } catch (err) {
    console.error('IAP validation failed:', err);
    return unauthorized(c, 'Invalid Cloudflare Access JWT');
  }
}
