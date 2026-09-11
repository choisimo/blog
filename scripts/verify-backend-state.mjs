import { createHmac, randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
const { BACKEND_ORIGIN: origin, BACKEND_KEY: key, GATEWAY_SIGNING_SECRET: secret } = process.env;
if (!origin || !key || !secret || new URL(origin).protocol !== 'https:') throw new Error('Signed HTTPS backend state configuration is required');
async function call(path, body) {
  const method = body ? 'POST' : 'GET', timestamp = String(Math.floor(Date.now() / 1000)), id = randomUUID();
  const signature = createHmac('sha256', secret.trim()).update(['v1', timestamp, method, path, id].join('\n')).digest('hex');
  const response = await fetch(new URL(path, origin), {
    method, redirect: 'error', signal: AbortSignal.timeout(20_000),
    headers: { 'Content-Type': 'application/json', 'X-Backend-Key': key,
      'X-Gateway-Signature-Version': 'v1', 'X-Gateway-Timestamp': timestamp,
      'X-Gateway-Request-ID': id, 'X-Gateway-Signature': `v1:${signature}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.ok !== true) throw new Error(`Backend state verification failed: HTTP ${response.status}`);
  return result;
}
const health = await call('/internal/state-db/health');
if (health.store !== 'kubernetes-sqlite') throw new Error('Unexpected state storage backend');
const result = await call('/internal/state-db/query', { atomic: true, statements: [
  { sql: 'SELECT name FROM d1_migrations', params: [] },
  { sql: 'SELECT id, state FROM reader_image_jobs LIMIT 0', params: [] },
  { sql: 'SELECT id, status, source_version FROM translation_jobs LIMIT 0', params: [] },
] });
const applied = new Set(result.results[0].results.map(row => row.name));
const expected = readdirSync(new URL('../workers/migrations', import.meta.url)).filter(name => name.endsWith('.sql'));
if (expected.some(name => !applied.has(name))) throw new Error('Backend state migrations are incomplete');
console.log(`Kubernetes state schema verified: ${health.tableCount} tables, ${expected.length} migrations`);
