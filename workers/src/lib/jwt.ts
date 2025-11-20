import type { Env, JwtPayload } from '../types';

// Simple HS256 JWT implementation for Cloudflare Workers
// Using Web Crypto API (available in Workers runtime)

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
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

export async function signJwt(payload: Omit<JwtPayload, 'iat' | 'exp'>, env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + 12 * 3600, // 12 hours
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(fullPayload)));

  const message = `${headerB64}.${payloadB64}`;
  const signature = await hmacSign(message, env.JWT_SECRET);

  return `${message}.${signature}`;
}

export async function verifyJwt(token: string, env: Env): Promise<JwtPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');

  const [headerB64, payloadB64, signatureB64] = parts;
  const message = `${headerB64}.${payloadB64}`;

  // Verify signature
  const expectedSignature = await hmacSign(message, env.JWT_SECRET);
  if (signatureB64 !== expectedSignature) {
    throw new Error('Invalid signature');
  }

  // Decode payload
  const payloadJson = decoder.decode(base64UrlDecode(payloadB64!));
  const payload = JSON.parse(payloadJson) as JwtPayload;

  // Check expiration
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return payload;
}
