import { createHmac, randomUUID, webcrypto } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

// Run through the existing deployment workflow; never print credential values.
const MODEL = 'nodove-mspark-1.3c';
const WORKER = 'blog-api-gateway';
const KV_NAMESPACE = '3d45140577d94404bc5f4bf000b07488';
const required = ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN', 'BACKEND_ORIGIN',
  'BACKEND_KEY', 'GATEWAY_SIGNING_SECRET', 'SECRETS_ENCRYPTION_KEY'];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing deployment setting: ${name}`);
}
const origin = new URL(process.env.BACKEND_ORIGIN);
if (origin.protocol !== 'https:') throw new Error('HTTPS origin required');

async function jsonRequest(url, options, label) {
  const response = await fetch(url, {
    ...options, redirect: 'error', signal: AbortSignal.timeout(30_000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || result.success === false || result.ok === false) {
    throw new Error(`${label} failed: HTTP ${response.status}`);
  }
  return result;
}

async function query(statements) {
  const path = '/internal/state-db/query';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const id = randomUUID();
  const signature = createHmac('sha256', process.env.GATEWAY_SIGNING_SECRET.trim())
    .update(['v1', timestamp, 'POST', path, id].join('\n')).digest('hex');
  return jsonRequest(new URL(path, origin), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', 'X-Backend-Key': process.env.BACKEND_KEY,
      'X-Gateway-Signature-Version': 'v1', 'X-Gateway-Timestamp': timestamp,
      'X-Gateway-Request-ID': id, 'X-Gateway-Signature': `v1:${signature}`,
    },
    body: JSON.stringify({ atomic: true, statements }),
  }, 'Origin model configuration');
}

async function cloudflare(path, method, body, raw = false) {
  return jsonRequest(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      'Content-Type': raw ? 'text/plain' : 'application/json',
    },
    ...(body === undefined ? {} : { body: raw ? body : JSON.stringify(body) }),
  }, 'Worker model configuration');
}

async function effectiveConfig() {
  return jsonRequest('https://api.nodove.com/api/v1/internal/ai-config', {
    headers: { 'X-Backend-Key': process.env.BACKEND_KEY },
  }, 'Effective AI configuration');
}

// Match workers/api-gateway/src/lib/crypto.ts exactly. This is a non-secret
// model value in the existing encrypted configuration row, not a key rotation.
const encoder = new TextEncoder();
const master = process.env.SECRETS_ENCRYPTION_KEY;
const salt = new Uint8Array(await webcrypto.subtle.digest('SHA-256', encoder.encode(`${master}:salt`))).slice(0, 16);
const material = await webcrypto.subtle.importKey('raw', encoder.encode(master), 'PBKDF2', false, ['deriveKey']);
const key = await webcrypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
  material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
const existing = await query([{ sql: "SELECT encrypted_value, iv FROM secrets WHERE key_name = 'AI_DEFAULT_MODEL'", params: [] }]);
const row = existing.results?.[0]?.results?.[0];
if (!row?.encrypted_value || !row.iv) throw new Error('Expected existing encrypted model configuration');
// Prove the deployment encryption key can read the existing row before writing.
const oldValue = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(row.iv, 'base64') }, key, Buffer.from(row.encrypted_value, 'base64'));
const before = await effectiveConfig();
if (new TextDecoder().decode(oldValue) !== before.data?.defaultModel) throw new Error('Stored model differs from effective configuration; investigate before writing');
const apiBase = new URL(before.data.baseUrl);
if (apiBase.protocol !== 'https:' || apiBase.host !== 'air.nodove.com') throw new Error('Unexpected AI server');
const columns = await query([{ sql: "SELECT name FROM pragma_table_info('ai_models')", params: [] }]);
const names = new Set(columns.results?.[0]?.results?.map(item => item.name));
const identifier = names.has('model_identifier') ? 'model_identifier' : names.has('litellm_model') ? 'litellm_model' : null;
if (!identifier) throw new Error('Unknown model registry schema');
const iv = webcrypto.getRandomValues(new Uint8Array(12));
const encrypted = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(MODEL));

await query([
  { sql: "UPDATE secrets SET encrypted_value = ?, iv = ?, default_value = ?, updated_at = CURRENT_TIMESTAMP, updated_by = 'mspark-only-rollout' WHERE key_name = 'AI_DEFAULT_MODEL'",
    params: [Buffer.from(encrypted).toString('base64'), Buffer.from(iv).toString('base64'), MODEL] },
  { sql: "UPDATE config_variables SET value = ?, default_value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'AI_SERVE_DEFAULT_MODEL'", params: [MODEL, MODEL] },
  { sql: "INSERT INTO ai_providers (id,name,display_name,api_base_url,api_key_env,is_enabled) VALUES ('prov_mspark_gateway','mspark-gateway','MSpark Gateway',?,'AI_API_KEY',1) ON CONFLICT(id) DO UPDATE SET api_base_url=excluded.api_base_url,api_key_env=excluded.api_key_env,is_enabled=1,updated_at=CURRENT_TIMESTAMP", params: [apiBase.href] },
  { sql: "UPDATE ai_models SET is_enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE max_tokens IS NULL OR max_tokens != 0", params: [] },
  { sql: `INSERT INTO ai_models (id,provider_id,model_name,display_name,${identifier},is_enabled,priority,supports_streaming) VALUES ('model_mspark_13c','prov_mspark_gateway',?,'MSpark 1.3 Contributor',?,1,100,1) ON CONFLICT(id) DO UPDATE SET provider_id=excluded.provider_id,model_name=excluded.model_name,${identifier}=excluded.${identifier},is_enabled=1,updated_at=CURRENT_TIMESTAMP`, params: [MODEL, MODEL] },
  { sql: "UPDATE ai_routes SET primary_model_id = 'model_mspark_13c', fallback_model_ids = '[]', context_window_fallback_ids = '[]', updated_at = CURRENT_TIMESTAMP", params: [] },
]);
console.log('Origin default model and all text model routes set to mspark.');
await cloudflare(`storage/kv/namespaces/${KV_NAMESPACE}/values/config:ai_default_model`, 'PUT', MODEL, true);
// This updates the binding and starts a fresh Worker deployment, clearing the
// old decrypted model cache without redeploying application source.
await cloudflare(`workers/scripts/${WORKER}/secrets`, 'PUT', { name: 'AI_DEFAULT_MODEL', text: MODEL, type: 'secret_text' });
let after = await effectiveConfig();
const deadline = Date.now() + 6 * 60_000;
while (after.data?.defaultModel !== MODEL && Date.now() < deadline) {
  // Worker deployments and decrypted configuration caches converge separately.
  // Poll only reads: never replay the state writes to wait for propagation.
  console.log('Waiting for the effective Worker model to converge.');
  await delay(10_000);
  after = await effectiveConfig();
}
if (after.data?.defaultModel !== MODEL) throw new Error('Effective model has not converged to mspark; verify before retrying writes');
console.log(JSON.stringify({ effectiveModel: after.data.defaultModel, apiHost: new URL(after.data.baseUrl).host }));
