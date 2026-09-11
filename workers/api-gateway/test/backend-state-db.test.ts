import { afterEach, describe, expect, it, vi } from 'vitest';
import { env, createExecutionContext } from 'cloudflare:test';
import { createBackendStateDatabase, withBackendState } from '../src/lib/backend-state-db';
import worker from '../src/index';
import type { Env } from '../src/types';

const bindings = { ...env, ENV: 'production', BACKEND_ORIGIN: 'https://origin.example', BACKEND_KEY: 'test-key', GATEWAY_SIGNING_SECRET: 'test-signing-secret', STATE_STORE_BACKEND: 'origin' } as Env;
const result = (results: unknown[] = [], changes = 0) => ({ success: true, results, meta: { changes, last_row_id: 0, duration: 1 } });
afterEach(() => vi.restoreAllMocks());

describe('backend state transport', () => {
  it('keeps the Worker readiness endpoint available when origin storage cannot be reached', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Origin is not ready'));
    const response = await worker.fetch(new Request('https://example.com/_health'), bindings, createExecutionContext());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, worker: 'blog-api-gateway' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('reuses schema caches across requests and replaces the transport on secret rotation', () => {
    const first = withBackendState(bindings).DB;
    expect(withBackendState({ ...bindings }).DB).toBe(first);
    expect(withBackendState({ ...bindings, GATEWAY_SIGNING_SECRET: 'rotated-secret' }).DB).not.toBe(first);
  });
  it('sends a signed atomic batch and preserves rows, changes and bindings', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ ok: true, results: [result([], 1), result([{ id: 'job-1', used: 0 }])] }));
    const db = createBackendStateDatabase(bindings);
    const values = await db.batch([db.prepare('UPDATE jobs SET state=? WHERE id=?').bind('ready', 'job-1'), db.prepare('SELECT id, used FROM jobs WHERE id=?').bind('job-1')]);
    expect(values[0].meta.changes).toBe(1);
    expect(values[1].results).toEqual([{ id: 'job-1', used: 0 }]);
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toBe('https://origin.example/internal/state-db/query');
    expect(init?.redirect).toBe('error');
    const headers = new Headers(init?.headers);
    expect(headers.get('X-Backend-Key')).toBe('test-key');
    expect(headers.get('X-Gateway-Signature')).toMatch(/^v1:[a-f0-9]{64}$/);
    expect(JSON.parse(String(init?.body))).toEqual({ atomic: true, statements: [{ sql: 'UPDATE jobs SET state=? WHERE id=?', params: ['ready', 'job-1'] }, { sql: 'SELECT id, used FROM jobs WHERE id=?', params: ['job-1'] }] });
  });
  it('does not retry or fall back to D1 after a lost write response', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('connection lost'));
    const d1 = { prepare: vi.fn() };
    const db = withBackendState({ ...bindings, DB: d1 as unknown as D1Database }).DB;
    await expect(db.prepare('INSERT INTO jobs(id) VALUES(?)').bind('job-1').run()).rejects.toThrow('connection lost');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(d1.prepare).not.toHaveBeenCalled();
  });
  it('preserves zero and null first-column values', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({ ok: true, results: [result([{ count: 0 }])] })).mockResolvedValueOnce(Response.json({ ok: true, results: [result([])] }));
    const db = createBackendStateDatabase(bindings);
    expect(await db.prepare('SELECT count(*) AS count FROM jobs').first('count')).toBe(0);
    expect(await db.prepare('SELECT id FROM jobs').first()).toBeNull();
  });
  it('keeps the native local test database and rejects incomplete origin configuration', () => {
    expect(withBackendState({ ...bindings, STATE_STORE_BACKEND: 'd1' }).DB).toBe(env.DB);
    expect(() => withBackendState({ ...bindings, BACKEND_KEY: undefined })).toThrow('configuration');
  });
  it('preserves schema error messages without replaying mutations', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ ok: false, error: { message: 'duplicate column name: state' } }, { status: 400 }));
    await expect(createBackendStateDatabase(bindings).prepare('ALTER TABLE jobs ADD COLUMN state TEXT').run()).rejects.toThrow('duplicate column name');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
