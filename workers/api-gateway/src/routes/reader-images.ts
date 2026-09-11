import { Hono, type Context } from 'hono';
import type { HonoEnv } from '../types';
import { requireAuth } from '../middleware/auth';
import { success, error } from '../lib/response';
import { isOriginAllowed } from '../lib/cors';
import { attachOriginSignatureHeaders } from '../lib/origin-signature';
import { boundedLimit, digest, GUEST_IMAGE_LIMIT, IMAGE_RETENTION_MS, imageDay,
  isRegisteredImageUser, parseImageInput, privateNetworkKey } from '../lib/reader-image-policy';
import { findImageJob, imageUsage, reserveImageJob, finishImageJob, type ImageJob } from '../lib/reader-image-repository';

const router = new Hono<HonoEnv>();
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

async function principal(c: Context<HonoEnv>) {
  const claims = c.get('user');
  if (!claims?.sub || !c.env.JWT_SECRET) throw new Error('Missing verified principal');
  const member = isRegisteredImageUser(claims);
  const { day, resetAt } = imageDay();
  // Only Cloudflare's edge-injected address is trusted; never X-Forwarded-For.
  const address = c.req.header('CF-Connecting-IP');
  if (!member && !address && c.env.ENV !== 'development') throw new Error('Trusted client address missing');
  const owner = await digest(`${member ? 'account' : 'guest'}:${claims.sub}`);
  const network = member ? owner : await privateNetworkKey(c.env.JWT_SECRET, day, address || 'local-development');
  return { member, owner, network, day, resetAt,
    limit: member ? boundedLimit(c.env.MEMBER_IMAGE_DAILY_LIMIT, 20) : GUEST_IMAGE_LIMIT };
}
async function policy(c: Context<HonoEnv>, p: Awaited<ReturnType<typeof principal>>) {
  const usage = await imageUsage(c.env.DB, p.owner, p.network, p.day, p.member);
  const remaining = Math.max(0, Math.min(p.limit - usage.used,
    p.member ? p.limit : GUEST_IMAGE_LIMIT - usage.networkUsed));
  return { tier: p.member ? 'member' : 'guest', dailyLimit: p.limit,
    used: usage.used, remaining, resetAt: p.resetAt, timezone: 'Asia/Seoul',
    networkLimited: !p.member && usage.networkUsed >= GUEST_IMAGE_LIMIT,
    retentionDays: 7, enabled: c.env.FEATURE_READER_IMAGES === 'true' && Boolean(c.env.READER_IMAGES_R2 && c.env.BACKEND_ORIGIN && c.env.BACKEND_KEY) };
}
function jobResponse(c: Context<HonoEnv>, job: ImageJob) {
  if (job.state === 'complete' && job.result_json) return success(c, JSON.parse(job.result_json));
  if (job.state === 'failed') return error(c, '이미지 생성이 거절되었습니다. 내용을 바꿔 다시 요청하세요.', 422, job.error_code || 'IMAGE_REJECTED');
  return error(c, '생성 결과를 아직 확인하지 못했습니다. 다시 생성하지 않고 상태만 확인합니다.', 409,
    job.state === 'unknown' ? 'IMAGE_OUTCOME_UNKNOWN' : 'IMAGE_IN_PROGRESS');
}
router.use('*', async (c, next) => {
  c.header('Cache-Control', 'private, no-store');
  await next();
});
router.get('/generation-policy', requireAuth, async c => {
  try { return success(c, await policy(c, await principal(c))); }
  catch { return error(c, '이미지 사용량을 확인할 수 없습니다.', 503, 'IMAGE_POLICY_UNAVAILABLE'); }
});
router.get('/generations/:key', requireAuth, async c => {
  try {
    const p = await principal(c);
    const key = c.req.param('key');
    if (!key || !/^[A-Za-z0-9._:-]{8,128}$/.test(key)) return error(c, '잘못된 요청 키입니다.', 400, 'INVALID_IMAGE_KEY');
    const id = await digest(`${p.owner}:${key}`);
    const job = await findImageJob(c.env.DB, id, p.owner);
    if (!job) return error(c, '이미지를 찾을 수 없습니다.', 404, 'IMAGE_NOT_FOUND');
    if (job.created_at < Date.now() - IMAGE_RETENTION_MS) return error(c, '이미지 보관 기간이 지났습니다.', 410, 'IMAGE_EXPIRED');
    return jobResponse(c, job);
  } catch { return error(c, '이미지 상태를 확인할 수 없습니다.', 503, 'IMAGE_POLICY_UNAVAILABLE'); }
});
router.get('/generated/:id', requireAuth, async c => {
  try {
    const p = await principal(c);
    const id = c.req.param('id');
    if (!id || !/^[a-f0-9]{64}$/.test(id)) return error(c, '이미지를 찾을 수 없습니다.', 404, 'IMAGE_NOT_FOUND');
    const job = await findImageJob(c.env.DB, id, p.owner);
    if (!job || job.state !== 'complete' || job.created_at < Date.now() - IMAGE_RETENTION_MS)
      return error(c, '이미지를 찾을 수 없습니다.', 404, 'IMAGE_NOT_FOUND');
    const object = await c.env.READER_IMAGES_R2!.get(`private/reader-images/${p.owner}/${id}.png`);
    if (!object) return error(c, '이미지를 찾을 수 없습니다.', 404, 'IMAGE_NOT_FOUND');
    return new Response(object.body, { headers: { 'Content-Type': 'image/png',
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox", 'Content-Disposition': 'inline' } });
  } catch { return error(c, '이미지를 불러올 수 없습니다.', 503, 'IMAGE_STORAGE_UNAVAILABLE'); }
});
router.post('/generate', requireAuth, async c => {
  if (c.env.FEATURE_READER_IMAGES !== 'true') return error(c, '이미지 생성이 아직 활성화되지 않았습니다.', 503, 'IMAGE_DISABLED');
  if (!c.env.DB || !c.env.READER_IMAGES_R2 || !c.env.BACKEND_ORIGIN || !c.env.BACKEND_KEY ||
      (['production','staging'].includes(c.env.ENV) && !c.env.GATEWAY_SIGNING_SECRET && !c.env.BACKEND_GATEWAY_SIGNING_SECRET))
    return error(c, '이미지 생성 설정이 준비되지 않았습니다.', 503, 'IMAGE_UNAVAILABLE');
  const origin = c.req.header('Origin');
  if (origin && !await isOriginAllowed(origin, c.env)) return error(c, '허용되지 않은 요청입니다.', 403, 'FORBIDDEN_ORIGIN');
  // No cookies or client tier/userId/n/model are used for authorization or billing.
  const key = c.req.header('Idempotency-Key') || '';
  if (!key || !/^[A-Za-z0-9._:-]{8,128}$/.test(key)) return error(c, '요청 키가 필요합니다.', 400, 'INVALID_IMAGE_KEY');
  if (Number(c.req.header('Content-Length') || 0) > 16000) return error(c, '요청이 너무 큽니다.', 413, 'PAYLOAD_TOO_LARGE');
  const raw = await c.req.text();
  if (new TextEncoder().encode(raw).length > 16000) return error(c, '요청이 너무 큽니다.', 413, 'PAYLOAD_TOO_LARGE');
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return error(c, '잘못된 요청입니다.', 400, 'INVALID_IMAGE_INPUT'); }
  const input = parseImageInput(body);
  if (!input) return error(c, '이미지 요청 형식을 확인하세요.', 400, 'INVALID_IMAGE_INPUT');
  let p: Awaited<ReturnType<typeof principal>>;
  let id: string;
  const createdAt = Date.now();
  try {
    p = await principal(c);
    id = await digest(`${p.owner}:${key}`);
    const hash = await digest(JSON.stringify(input));
    const existing = await findImageJob(c.env.DB, id, p.owner);
    if (existing) {
      if (existing.input_hash !== hash) return error(c, '같은 요청 키의 내용이 변경되었습니다.', 409, 'IDEMPOTENCY_CONFLICT');
      if (existing.created_at < Date.now() - IMAGE_RETENTION_MS) return error(c, '이미지 보관 기간이 지났습니다.', 410, 'IMAGE_EXPIRED');
      return jobResponse(c, existing);
    }
    const reserved = await reserveImageJob(c.env.DB, { id, owner: p.owner, network: p.network,
      day: p.day, hash, limit: p.limit, member: p.member, now: createdAt,
      globalLimit: boundedLimit(c.env.IMAGE_GLOBAL_DAILY_LIMIT, 500, 10000) });
    if (!reserved) {
      const concurrent = await findImageJob(c.env.DB, id, p.owner);
      if (concurrent) {
        if (concurrent.input_hash !== hash) return error(c, '요청 키가 충돌했습니다.', 409, 'IDEMPOTENCY_CONFLICT');
        return jobResponse(c, concurrent);
      }
      const globalUsage = await c.env.DB.prepare("SELECT COUNT(*) AS used FROM reader_image_jobs WHERE day = ? AND state IN ('reserved','complete','unknown')")
        .bind(p.day).first<{used: number}>();
      if (Number(globalUsage?.used || 0) >= boundedLimit(c.env.IMAGE_GLOBAL_DAILY_LIMIT, 500, 10000)) {
        c.header('Retry-After', String(Math.max(1, Math.ceil((Date.parse(p.resetAt) - Date.now()) / 1000))));
        return error(c, '오늘의 서비스 이미지 생성 한도에 도달했습니다. 한국 시간 00:00 이후 다시 시도하세요.', 429, 'IMAGE_GLOBAL_LIMIT');
      }
      const quota = await policy(c, p);
      c.header('Retry-After', String(quota.remaining ? 60 : Math.max(1, Math.ceil((Date.parse(p.resetAt) - Date.now()) / 1000))));
      return c.json({ ok: false, error: { code: quota.remaining ? 'IMAGE_RATE_LIMIT' : 'IMAGE_DAILY_LIMIT',
        message: quota.remaining ? '생성 요청이 많습니다. 잠시 후 다시 시도하세요.' : '오늘의 이미지 생성 한도에 도달했습니다.' }, data: { quota } }, 429);
    }
  } catch { return error(c, '이미지 한도를 확인하지 못해 생성하지 않았습니다.', 503, 'IMAGE_POLICY_UNAVAILABLE'); }

  try {
    const path = '/api/v1/images/render-private';
    const headers = new Headers({ 'Content-Type': 'application/json', 'X-Backend-Key': c.env.BACKEND_KEY!, 'X-Request-ID': id });
    await attachOriginSignatureHeaders({ env: c.env, headers, method: 'POST', pathAndQuery: path, requestId: id });
    const response = await fetch(new URL(path, c.env.BACKEND_ORIGIN), {
      method: 'POST', headers, redirect: 'error', signal: AbortSignal.timeout(300000),
      body: JSON.stringify({ ...input, requestId: id }),
    });
    const data = await response.json() as { ok?: boolean; data?: { b64: string; width: number; height: number }; error?: { code?: string } };
    if (!response.ok || !data.ok || !data.data) {
      // Only an explicit upstream rejection proves that no image was generated.
      const rejected = data.error?.code === 'IMAGE_REJECTED' || data.error?.code === 'IMAGE_DISABLED';
      await finishImageJob(c.env.DB, id, rejected ? 'failed' : 'unknown', null, rejected ? 'IMAGE_REJECTED' : 'IMAGE_OUTCOME_UNKNOWN');
      return error(c, rejected ? '이미지 생성이 거절되었습니다. 사용량은 차감하지 않았습니다.' : '생성 결과를 확인할 수 없습니다. 중복 생성을 방지하기 위해 상태를 보관합니다.',
        rejected ? 422 : 409, rejected ? 'IMAGE_REJECTED' : 'IMAGE_OUTCOME_UNKNOWN');
    }
    if (![data.data.width, data.data.height].every(n => Number.isInteger(n) && n >= 32 && n <= 4096)) throw new Error('Invalid dimensions');
    const b64 = data.data.b64;
    if (typeof b64 !== 'string' || b64.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 4) throw new Error('Invalid image size');
    const binary = atob(b64);
    const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
    if (bytes.length > MAX_IMAGE_BYTES || !PNG_SIGNATURE.every((v, i) => bytes[i] === v)) throw new Error('Invalid PNG');
    await c.env.READER_IMAGES_R2!.put(`private/reader-images/${p.owner}/${id}.png`, bytes, {
      httpMetadata: { contentType: 'image/png', cacheControl: 'private, no-store' },
      customMetadata: { owner: p.owner, source: 'ai-generated', createdAt: String(Date.now()) },
    });
    const result = { id, url: `/api/v1/images/generated/${id}`, alt: input.alt,
      width: data.data.width, height: data.data.height, source: 'ai-generated',
      expiresAt: new Date(createdAt + IMAGE_RETENTION_MS).toISOString() };
    const completed = await finishImageJob(c.env.DB, id, 'complete', result);
    if (Number(completed.meta.changes || 0) !== 1) throw new Error('Image finalization conflict');
    return success(c, result, 201);
  } catch {
    // Unknown outcomes must not automatically retry or refund: the provider may have billed them.
    await finishImageJob(c.env.DB, id, 'unknown', null, 'IMAGE_OUTCOME_UNKNOWN').catch(() => {});
    return error(c, '생성 결과를 아직 확인할 수 없습니다. 상태 확인으로 이어가세요.', 409, 'IMAGE_OUTCOME_UNKNOWN');
  }
});
export default router;
