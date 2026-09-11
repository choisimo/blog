// Full Workers/Hono/D1 integration. Run with the existing Vitest pool; no AI calls.
import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { signJwt } from '../src/lib/jwt';
import { digest } from '../src/lib/reader-image-policy';

async function fresh() {
  const response = await SELF.fetch('https://example.com/api/v1/auth/anonymous', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toContain('no-store');
  return (await response.json() as { data: { token: string; userId: string } }).data;
}
function send(path: string, token?: string, method = 'GET', body?: object) {
  return SELF.fetch(`https://example.com/api/v1${path}`, {
    method, headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.77',
      ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe('R07-1 anonymous ownership at the public Worker boundary', () => {
  it('refuses ID-only recovery and mismatched proof', async () => {
    const a = await fresh(), b = await fresh();
    const without = await send('/auth/anonymous', undefined, 'POST', { existingId: a.userId });
    expect(without.status).toBe(401);
    expect(await without.json()).toMatchObject({ ok: false, error: { code: 'ANONYMOUS_PROOF_REQUIRED' } });
    expect((await send('/auth/anonymous', b.token, 'POST', { existingId: a.userId })).status).toBe(403);
    expect((await send('/auth/anonymous', a.token, 'POST', { existingId: a.userId })).status).toBe(200);
  });

  it('preserves the same memo on renewal without granting it to another owner', async () => {
    const a = await fresh(), b = await fresh();
    const saved = await send('/memos', a.token, 'PUT', { content: 'private R07-1 draft', expectedVersion: 0, createVersion: true });
    expect(saved.status).toBe(201);
    const renew = await send('/auth/anonymous/refresh', a.token, 'POST');
    const next = (await renew.json() as { data: { token: string; userId: string } }).data;
    expect(next.userId).toBe(a.userId);
    const mine = await send('/memos', next.token);
    expect(await mine.text()).toContain('private R07-1 draft');
    const theirs = await send('/memos', b.token);
    expect(await theirs.text()).not.toContain('private R07-1 draft');
  });

  it('revokes both read and write authorization without deleting memo data', async () => {
    const a = await fresh();
    await send('/memos', a.token, 'PUT', { content: 'retained after revoke', expectedVersion: 0 });
    const revocation = await send('/auth/anonymous/revoke', a.token, 'POST');
    expect(revocation.status).toBe(200);
    expect(await revocation.json()).toMatchObject({ data: { revoked: true, dataDeleted: false } });
    for (const [path, method] of [ ['/memos', 'GET'], ['/memos', 'PUT'], ['/images/generation-policy', 'GET'],
      ['/auth/anonymous/refresh', 'POST'], ['/auth/me', 'GET'] ]) {
      expect((await send(path, a.token, method, method === 'PUT' ? { content: 'must not write', expectedVersion: 1 } : undefined)).status).toBe(401);
    }
    const row = await env.DB.prepare('SELECT content FROM memo_content WHERE user_id = ?').bind(a.userId).first<{content: string}>();
    expect(row?.content).toBe('retained after revoke');
  });

  it('does not serve another owner private image job; renewals retain its ownership', async () => {
    const a = await fresh(), b = await fresh();
    const owner = await digest(`guest:${a.userId}`), key = 'r07-private-image-key', id = await digest(`${owner}:${key}`);
    const now = Date.now();
    await env.DB.prepare(`INSERT INTO reader_image_jobs
      (id, owner, network_key, day, input_hash, state, created_at, updated_at, result_json)
      VALUES (?, ?, ?, ?, ?, 'complete', ?, ?, ?)`)
      .bind(id, owner, 'test-network', '2026-09-10', 'test-input', now, now, JSON.stringify({ id, alt: 'private-image-marker' })).run();
    expect((await send(`/images/generations/${key}`, b.token)).status).toBe(404);
    const renew = await send('/auth/anonymous/refresh', a.token, 'POST');
    const next = (await renew.json() as {data:{token:string}}).data.token;
    const mine = await send(`/images/generations/${key}`, next);
    expect(mine.status).toBe(200);expect(await mine.text()).toContain('private-image-marker');
    await send('/auth/anonymous/revoke', next, 'POST');
    expect((await send(`/images/generations/${key}`, a.token)).status).toBe(401);
  });

  it('gives guests 20 free images without treating an AI role setting as account membership', async () => {
    const a = await fresh(); const policy = await send('/images/generation-policy', a.token);
    expect(policy.status).toBe(200);
    expect(await policy.json()).toMatchObject({ data: { tier: 'guest', dailyLimit: 20 } });
    // A renewed access token may not be used as administrator credentials.
    const admin = await send('/images/presign', a.token, 'POST', {});
    expect(admin.status).toBe(403);
    expect((await send('/user/agent-preferences', a.token)).status).toBe(403);
  });

  it('rejects expired proof rather than returning a newly minted identity', async () => {
    const a = await fresh();
    const expired = await signJwt({sub:a.userId,role:'anonymous',username:'Anonymous',tokenClass:'anonymous',type:'access'}, env, -1);
    const response = await send('/auth/anonymous/refresh', expired, 'POST');
    expect(response.status).toBe(401);
    const payload = await response.json() as { data?: unknown };
    expect(payload.data).toBeUndefined();expect(response.headers.get('Cache-Control')).toContain('no-store');
  });
});
