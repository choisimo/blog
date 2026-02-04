/**
 * Terminal Gateway - JWT Authentication
 */

import type { Env, JWTPayload } from './types';

/**
 * Base64URL decode
 */
function base64UrlDecode(str: string): string {
  // Add padding if needed
  const padded = str + '==='.slice(0, (4 - (str.length % 4)) % 4);
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  return atob(base64);
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

    // Decode payload first to check expiration
    const payloadJson = base64UrlDecode(payloadB64);
    const payload = JSON.parse(payloadJson) as JWTPayload;

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      console.error('Token expired');
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
 * Extract token from request
 * Supports: query param, Authorization header, cookie
 */
export function extractToken(request: Request): string | null {
  const url = new URL(request.url);

  // 1. Query parameter
  const queryToken = url.searchParams.get('token');
  if (queryToken) {
    return queryToken;
  }

  // 2. Authorization header (Bearer token)
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // 3. Cookie
  const cookies = request.headers.get('Cookie') || '';
  const tokenCookie = cookies
    .split(';')
    .find((c) => c.trim().startsWith('terminal_token='));
  if (tokenCookie) {
    return tokenCookie.split('=')[1]?.trim() || null;
  }

  return null;
}
