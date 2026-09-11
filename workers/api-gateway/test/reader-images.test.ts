import { env, fetchMock } from 'cloudflare:test';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signJwt } from '../src/lib/jwt';
import { DEFAULT_FREE_IMAGE_LIMIT, digest, imageDay, privateNetworkKey } from '../src/lib/reader-image-policy';
import { findImageJob, imageUsage, reserveImageJob } from '../src/lib/reader-image-repository';
import readerImages from '../src/routes/reader-images';
import type { Env, HonoEnv } from '../src/types';

const input = { prompt: 'Illustrate a distributed message queue', alt: 'Message queue',
  size: '1536x1024', style: 'diagram', purpose: 'chat' };
const key = 'reader-image-test-key';
const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
let bindings: Env;
let token: string;
let owner: string;
let app: Hono<HonoEnv>;
const address = '192.0.2.20';

beforeEach(async () => {
  bindings = { ...env, ENV: 'development', FEATURE_READER_IMAGES: 'true',
    MEMBER_IMAGE_DAILY_LIMIT: undefined, READER_IMAGES_R2: env.R2 } as Env;
  token = await signJwt({ sub: 'image-guest', role: 'user', username: 'Guest', type: 'access' }, bindings);
  owner = await digest('guest:image-guest');
  app = new Hono<HonoEnv>();
  app.route('/api/v1/images', readerImages);
});
afterEach(() => {
  vi.restoreAllMocks();
  fetchMock.deactivate();
  fetchMock.enableNetConnect();
});

function send(path: string, body?: unknown, auth = token, requestKey = key) {
  return app.request(`https://example.com/api/v1/images${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': address,
      'Idempotency-Key': requestKey, ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }, bindings);
}
function upstreamImage() {
  return Response.json({ ok: true, data: { b64: btoa(String.fromCharCode(...bytes)), width: 1536, height: 1024 } });
}

describe('reader image generation and private rendering', () => {
  it('renders through the real Workers fetch implementation', async () => {
    fetchMock.activate();
    fetchMock.disableNetConnect();
    fetchMock.get(bindings.BACKEND_ORIGIN!).intercept({ path: '/api/v1/images/render-private', method: 'POST' })
      .reply(200, await upstreamImage().text());
    expect((await send('/generate', input)).status).toBe(201);
    expect(await (await send('/generation-policy')).json()).toMatchObject({ data: { used: 1, remaining: 19 } });
    fetchMock.assertNoPendingInterceptors();
  });

  it('does not forward a signed image request on redirect or replay an uncertain result', async () => {
    fetchMock.activate();
    fetchMock.disableNetConnect();
    fetchMock.get(bindings.BACKEND_ORIGIN!).intercept({ path: '/api/v1/images/render-private', method: 'POST' })
      .reply(307, await upstreamImage().text(), { headers: { location: 'https://redirect.example/image' } });
    let forwarded = 0;
    fetchMock.get('https://redirect.example').intercept({ path: '/image', method: 'POST' }).reply(() => {
      forwarded++;
      return { statusCode: 200, data: '{}' };
    });
    expect(await (await send('/generate', input)).json()).toMatchObject({ error: { code: 'IMAGE_OUTCOME_UNKNOWN' } });
    expect(await (await send('/generate', input)).json()).toMatchObject({ error: { code: 'IMAGE_OUTCOME_UNKNOWN' } });
    expect(forwarded).toBe(0);
    expect(await (await send('/generation-policy')).json()).toMatchObject({ data: { used: 1, remaining: 19 } });
  });
  it('defaults both guest and member to 20 images and reports matching enabled state', async () => {
    expect(DEFAULT_FREE_IMAGE_LIMIT).toBe(20);
    expect(await (await send('/generation-policy')).json()).toMatchObject({ data: {
      tier: 'guest', dailyLimit: 20, remaining: 20, enabled: true,
    } });
    const member = await signJwt({ sub: 'image-member', role: 'user', username: 'Member', type: 'access', emailVerified: true }, bindings);
    expect(await (await send('/generation-policy', undefined, member)).json()).toMatchObject({ data: {
      tier: 'member', dailyLimit: 20, remaining: 20,
    } });
    bindings.ENV = 'production';
    bindings.GATEWAY_SIGNING_SECRET = undefined;
    bindings.BACKEND_GATEWAY_SIGNING_SECRET = undefined;
    expect(await (await send('/generation-policy')).json()).toMatchObject({ data: { enabled: false } });
    expect((await send('/generate', input)).status).toBe(503);
  });

  it('persists returned PNG bytes and renders only to the owning principal; replay spends once', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => upstreamImage());
    expect((await send('/generate', input)).status).toBe(201);
    const id = await digest(`${owner}:${key}`);
    const result = { id, url: `/api/v1/images/generated/${id}`, source: 'ai-generated', alt: input.alt };
    expect(await (await send(`/generations/${key}`)).json()).toMatchObject({ data: result });
    expect(await (await send('/generate', input)).json()).toMatchObject({ data: result });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [, init] = fetch.mock.calls[0];
    expect(new Headers(init?.headers).get('X-Backend-Key')).toBe(bindings.BACKEND_KEY);
    expect(JSON.parse(String(init?.body))).toMatchObject({ ...input, requestId: id });
    const image = await send(`/generated/${id}`);
    expect(image.headers.get('Cache-Control')).toBe('private, no-store');
    expect(image.headers.get('Content-Type')).toBe('image/png');
    expect(new Uint8Array(await image.arrayBuffer())).toEqual(bytes);
    expect(await (await send('/generation-policy')).json()).toMatchObject({ data: { used: 1, remaining: 19 } });
    const other = await signJwt({ sub: 'image-other', role: 'user', username: 'Other', type: 'access' }, bindings);
    expect((await send(`/generated/${id}`, undefined, other)).status).toBe(404);
    expect((await send(`/generations/${key}`, undefined, other)).status).toBe(404);
    expect((await send(`/generated/${id}`, undefined, '')).status).toBe(401);
    expect((await send('/generate', { ...input, prompt: 'A different illustration request' })).status).toBe(409);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each(['IMAGE_REJECTED', 'IMAGE_DISABLED', 'IMAGE_PROVIDER_UNAVAILABLE', 'IMAGE_PROVIDER_RATE_LIMIT'])(
    'refunds a proven %s failure, preserving immutable request replay', async code => {
      const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ ok: false, error: { code } }, { status: 503 }));
      await send('/generate', input);
      const expectedCode = code === 'IMAGE_DISABLED' ? 'IMAGE_PROVIDER_UNAVAILABLE' : code;
      expect(await (await send(`/generations/${key}`)).json()).toMatchObject({ error: { code: expectedCode } });
      expect(await (await send('/generation-policy')).json()).toMatchObject({ data: { used: 0, remaining: 20 } });
      await send('/generate', input);
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it('keeps unknown outcomes counted and never redispatches the same request', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('connection lost'));
    expect((await send('/generate', input)).status).toBe(409);
    expect(await (await send(`/generations/${key}`)).json()).toMatchObject({ error: { code: 'IMAGE_OUTCOME_UNKNOWN' } });
    await send('/generate', input);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await (await send('/generation-policy')).json()).toMatchObject({ data: { used: 1, remaining: 19 } });
  });

  it('exposes in-progress state to a second request without starting another provider call', async () => {
    let finish!: (response: Response) => void;
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>(resolve => { finish = resolve; }));
    const first = send('/generate', input);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(await (await send('/generate', input)).json()).toMatchObject({ error: { code: 'IMAGE_IN_PROGRESS' } });
    expect(await (await send(`/generations/${key}`)).json()).toMatchObject({ error: { code: 'IMAGE_IN_PROGRESS' } });
    finish(upstreamImage());
    expect((await first).status).toBe(201);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((await send(`/generations/${key}`)).status).toBe(200);
  });

  it('does not report success or refund generated work when private storage fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => upstreamImage());
    vi.spyOn(bindings.READER_IMAGES_R2!, 'put').mockRejectedValue(new Error('storage unavailable'));
    expect(await (await send('/generate', input)).json()).toMatchObject({ error: { code: 'IMAGE_OUTCOME_UNKNOWN' } });
    const id = await digest(`${owner}:${key}`);
    expect((await findImageJob(env.DB, id, owner))?.state).toBe('unknown');
    expect((await send(`/generated/${id}`)).status).toBe(404);
    expect(await (await send('/generation-policy')).json()).toMatchObject({ data: { used: 1, remaining: 19 } });
  });

  it('rejects non-PNG output without reporting success or creating an object', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ ok: true, data: { b64: btoa('<svg/>'), width: 64, height: 64 } }));
    expect((await send('/generate', input)).status).toBe(409);
    const id = await digest(`${owner}:${key}`);
    expect(await bindings.READER_IMAGES_R2!.get(`private/reader-images/${owner}/${id}.png`)).toBeNull();
    expect((await findImageJob(env.DB, id, owner))?.state).toBe('unknown');
  });

  it('enforces 20 across guest identity rotation and simultaneous final-slot reservations', async () => {
    const { day } = imageDay();
    const network = await privateNetworkKey(bindings.JWT_SECRET, day, address);
    const base = { network, day, hash: 'image-input', limit: DEFAULT_FREE_IMAGE_LIMIT, globalLimit: 500, member: false };
    for (let i = 0; i < 19; i++) {
      expect(await reserveImageJob(env.DB, { ...base, id: `quota-${i}`, owner: `rotated-${i}`, now: Date.now() - (21 - i) * 61000 })).toBe(true);
    }
    const final = await Promise.all(Array.from({ length: 8 }, (_, i) => reserveImageJob(env.DB, {
      ...base, id: `parallel-${i}`, owner, now: Date.now(),
    })));
    expect(final.filter(Boolean)).toHaveLength(1);
    expect(await imageUsage(env.DB, owner, network, day, false)).toEqual({ used: 1, networkUsed: 20 });
    expect(await (await send('/generation-policy')).json()).toMatchObject({ data: { remaining: 0, networkLimited: true } });
    const fetch = vi.spyOn(globalThis, 'fetch');
    expect(await (await send('/generate', input)).json()).toMatchObject({ error: { code: 'IMAGE_DAILY_LIMIT' } });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('enforces 20 for an account and retains the independent burst cap', async () => {
    const { day } = imageDay();
    const base = { network: 'member-network', owner: 'member-owner', day, hash: 'input',
      limit: DEFAULT_FREE_IMAGE_LIMIT, globalLimit: 500, member: true };
    for (let i = 0; i < 20; i++) {
      expect(await reserveImageJob(env.DB, { ...base, id: `member-${i}`, now: Date.now() - (21 - i) * 61000 })).toBe(true);
    }
    expect(await reserveImageJob(env.DB, { ...base, id: 'member-over', now: Date.now() })).toBe(false);
    const burst = { ...base, owner: 'burst-owner', network: 'burst-owner' };
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => reserveImageJob(env.DB, { ...burst, id: `burst-${i}`, now: Date.now() })));
    expect(results.filter(Boolean)).toHaveLength(5);
  });
});
