import type { JwtPayload } from '../types';

export const GUEST_IMAGE_LIMIT = 5;
export const IMAGE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const IMAGE_COUNTED_STATES = "'reserved','complete','unknown'";

// Anonymous JWTs are issued to every visitor: token presence is NOT membership.
export function isRegisteredImageUser(claims: JwtPayload | null | undefined): boolean {
  return Boolean(claims?.sub && claims.type !== 'refresh' &&
    ['user', 'member', 'admin'].includes(claims.role) && claims.emailVerified === true);
}
export function imageDay(now = Date.now()) {
  const shifted = new Date(now + 9 * 60 * 60 * 1000);
  const day = shifted.toISOString().slice(0, 10);
  const resetAt = Date.parse(`${day}T00:00:00+09:00`) + 24 * 60 * 60 * 1000;
  return { day, resetAt: new Date(resetAt).toISOString() };
}
export function boundedLimit(raw: string | undefined, fallback: number, max = 500): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 && n <= max ? n : fallback;
}
export async function digest(value: string): Promise<string> {
  const result = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(result), b => b.toString(16).padStart(2, '0')).join('');
}
export async function privateNetworkKey(secret: string, day: string, address: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const result = await crypto.subtle.sign('HMAC', key,
    new TextEncoder().encode(`reader-images:${day}:${address}`));
  return Array.from(new Uint8Array(result), b => b.toString(16).padStart(2, '0')).join('');
}
export type ReaderImageInput = {
  prompt: string; alt: string; size: '1024x1024' | '1536x1024' | '1024x1536';
  style: 'editorial' | 'diagram' | 'photographic'; purpose: 'chat' | 'debate';
};
export function parseImageInput(body: unknown): ReaderImageInput | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  const allowed = ['prompt', 'alt', 'size', 'style', 'purpose'];
  if (Object.keys(b).some(k => !allowed.includes(k))) return null;
  if (typeof b.prompt !== 'string' || b.prompt.trim().length < 8 || b.prompt.length > 3000) return null;
  if (b.alt !== undefined && (typeof b.alt !== 'string' || b.alt.length > 180)) return null;
  if (b.size !== undefined && !['1024x1024','1536x1024','1024x1536'].includes(String(b.size))) return null;
  if (b.style !== undefined && !['editorial','diagram','photographic'].includes(String(b.style))) return null;
  if (b.purpose !== undefined && !['chat','debate'].includes(String(b.purpose))) return null;
  const clean = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
  if (clean(b.prompt).length < 8) return null;
  return { prompt: clean(b.prompt), alt: clean(String(b.alt || 'AI 생성 참고 이미지')),
    size: (b.size || '1536x1024') as ReaderImageInput['size'],
    style: (b.style || 'editorial') as ReaderImageInput['style'],
    purpose: (b.purpose || 'chat') as ReaderImageInput['purpose'] };
}

// The origin renderer may only be reached by the quota-reserving handler.
// Normalize spelling variants before the generic edge-to-origin proxy can sign them.
export function isPrivateReaderRenderPath(pathname: string): boolean {
  let path = pathname;
  try { for (let i = 0; i < 2; i++) path = decodeURIComponent(path); }
  catch { return true; }
  return /(?:^|\/)images\/+render-private(?:\/|$)/i.test(path);
}
