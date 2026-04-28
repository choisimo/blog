import type { Env } from '../types';

const SIGNATURE_VERSION = 'v1';

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacSha256(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return toHex(signature);
}

function gatewaySigningSecret(env: Env): string | null {
  const secret = env.GATEWAY_SIGNING_SECRET || env.BACKEND_GATEWAY_SIGNING_SECRET;
  return typeof secret === 'string' && secret.trim() ? secret.trim() : null;
}

function buildPayload(input: {
  method: string;
  pathAndQuery: string;
  timestamp: string;
  requestId: string;
}): string {
  return [
    SIGNATURE_VERSION,
    input.timestamp,
    input.method.toUpperCase(),
    input.pathAndQuery,
    input.requestId,
  ].join('\n');
}

export function stripOriginSignatureHeaders(headers: Headers): void {
  headers.delete('X-Gateway-Signature-Version');
  headers.delete('X-Gateway-Timestamp');
  headers.delete('X-Gateway-Request-ID');
  headers.delete('X-Gateway-Signature');
  headers.delete('X-Origin-Verified-By');
  headers.delete('X-AI-Model-Source');
  headers.delete('X-AI-Vision-Model-Source');
}

export async function attachOriginSignatureHeaders(input: {
  env: Env;
  headers: Headers;
  method: string;
  pathAndQuery: string;
  requestId?: string;
  now?: Date;
}): Promise<string | null> {
  const secret = gatewaySigningSecret(input.env);
  if (!secret) return null;

  const requestId = input.requestId || crypto.randomUUID();
  const timestamp = Math.floor((input.now || new Date()).getTime() / 1000).toString();
  const signature = `${SIGNATURE_VERSION}:${await hmacSha256(
    secret,
    buildPayload({
      method: input.method,
      pathAndQuery: input.pathAndQuery,
      requestId,
      timestamp,
    })
  )}`;

  input.headers.set('X-Gateway-Signature-Version', SIGNATURE_VERSION);
  input.headers.set('X-Gateway-Timestamp', timestamp);
  input.headers.set('X-Gateway-Request-ID', requestId);
  input.headers.set('X-Gateway-Signature', signature);
  input.headers.set('X-Origin-Verified-By', 'api-gateway');
  return requestId;
}
