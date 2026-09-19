import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import Database from 'better-sqlite3';

test('model rollout preserves credentials and embedding routes across both model schemas', async () => {
  const originalFetch = globalThis.fetch;
  const savedEnv = { ...process.env };
  try {
    Object.assign(process.env, {
      CLOUDFLARE_ACCOUNT_ID: 'fixture-account', CLOUDFLARE_API_TOKEN: 'fixture-token',
      BACKEND_ORIGIN: 'https://origin.example.test', BACKEND_KEY: 'fixture-backend',
      GATEWAY_SIGNING_SECRET: 'fixture-signing', SECRETS_ENCRYPTION_KEY: 'fixture-encryption',
    });
    const encode = value => new TextEncoder().encode(value);
    const salt = new Uint8Array(await webcrypto.subtle.digest('SHA-256', encode('fixture-encryption:salt'))).slice(0, 16);
    const material = await webcrypto.subtle.importKey('raw', encode('fixture-encryption'), 'PBKDF2', false, ['deriveKey']);
    const key = await webcrypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, material,
      { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    for (const column of ['model_identifier', 'litellm_model']) {
      const db = new Database(':memory:');
      try {
        db.exec(readFileSync(new URL('../../workers/migrations/0011_ai_model_management.sql', import.meta.url), 'utf8').replaceAll('model_identifier', column));
        db.exec(readFileSync(new URL('../../workers/migrations/0014_secrets_management.sql', import.meta.url), 'utf8'));
        db.exec(`CREATE TABLE config_variables (key TEXT,value TEXT,default_value TEXT,updated_at TEXT);
          INSERT INTO ai_providers (id,name,display_name) VALUES ('old','old','Old');
          INSERT INTO ai_models (id,provider_id,model_name,display_name,${column},max_tokens) VALUES
            ('old','old','old-model','Old','old-model',4096),('embedding','old','embedding','Embedding','embedding',0);
          INSERT INTO ai_routes (id,name,primary_model_id,fallback_model_ids) VALUES ('default','default','old','["old"]');`);
        const iv = webcrypto.getRandomValues(new Uint8Array(12));
        const encrypted = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encode('old-model'));
        db.prepare("INSERT INTO secrets (id,category_id,key_name,display_name,encrypted_value,iv) VALUES ('model','cat_ai','AI_DEFAULT_MODEL','Model',?,?)")
          .run(Buffer.from(encrypted).toString('base64'), Buffer.from(iv).toString('base64'));
        db.prepare("INSERT INTO secrets (id,category_id,key_name,display_name,encrypted_value,iv) VALUES ('key','cat_ai','AI_API_KEY','Key','unchanged-ciphertext','unchanged-iv')").run();
        const writes = [];
        globalThis.fetch = async (input, options = {}) => {
          const url = new URL(input);
          if (url.host === 'origin.example.test') {
            const body = JSON.parse(options.body);
            const results = db.transaction(() => body.statements.map(({ sql, params }) => {
              const statement = db.prepare(sql);
              return { results: statement.reader ? statement.all(...params) : (statement.run(...params), []) };
            }))();
            return Response.json({ ok: true, results });
          }
          if (url.host === 'api.nodove.com') {
            const row = db.prepare("SELECT encrypted_value,iv FROM secrets WHERE key_name='AI_DEFAULT_MODEL'").get();
            const plaintext = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(row.iv, 'base64') }, key, Buffer.from(row.encrypted_value, 'base64'));
            return Response.json({ success: true, data: { baseUrl: 'https://air.nodove.com/v1', defaultModel: new TextDecoder().decode(plaintext) } });
          }
          assert.equal(url.host, 'api.cloudflare.com');
          writes.push({ path: url.pathname, body: options.body });
          return Response.json({ success: true });
        };
        await import(`../../scripts/configure-mspark-only.mjs?schema=${column}`);
        assert.deepEqual(db.prepare('SELECT model_name FROM ai_models WHERE is_enabled=1 ORDER BY model_name').all().map(row => row.model_name), ['embedding', 'nodove-mspark-1.3c']);
        assert.deepEqual(db.prepare('SELECT primary_model_id,fallback_model_ids,context_window_fallback_ids FROM ai_routes').get(), {
          primary_model_id: 'model_mspark_13c', fallback_model_ids: '[]', context_window_fallback_ids: '[]',
        });
        assert.equal(db.prepare("SELECT encrypted_value FROM secrets WHERE key_name='AI_API_KEY'").get().encrypted_value, 'unchanged-ciphertext');
        assert.equal(writes.length, 2);
        assert.equal(JSON.parse(writes[1].body).name, 'AI_DEFAULT_MODEL');
      } finally { db.close(); }
    }
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of Object.keys(process.env)) if (!(name in savedEnv)) delete process.env[name];
    Object.assign(process.env, savedEnv);
  }
});
