import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import express from 'express';

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'blog-workers-mutations-'));
const workerDir = path.join(tempRoot, 'workers', 'api-gateway');
const wranglerPath = path.join(workerDir, 'wrangler.toml');

process.env.REPO_ROOT = tempRoot;
process.env.ADMIN_BEARER_TOKEN = 'workers-mutation-token';
process.env.ADMIN_WORKER_MUTATIONS = 'true';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
process.env.APP_ENV = 'test';
process.env.AI_DEFAULT_MODEL = process.env.AI_DEFAULT_MODEL || 'gpt-4.1-mini';

const { default: workersRouter } = await import('../src/routes/workers.js');

async function writeWranglerToml() {
  await fs.mkdir(workerDir, { recursive: true });
  await fs.writeFile(
    wranglerPath,
    `name = "blog-api-gateway"
main = "src/index.js"
compatibility_date = "2026-01-01"

[vars]
BACKEND_ORIGIN = "https://old.example.com"
SAFE_FLAG = "old"

[env.production]
name = "blog-api-gateway-production"

[env.production.vars]
BACKEND_ORIGIN = "https://prod.example.com"
`,
    'utf8'
  );
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin/workers', workersRouter);
  app.use((err, _req, res, _next) => {
    res.status(err?.status || 500).json({
      ok: false,
      error: err?.message || 'Unhandled test error',
    });
  });
  return app;
}

async function withServer(callback) {
  const server = http.createServer(createApp());
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

function adminHeaders() {
  return {
    Authorization: `Bearer ${process.env.ADMIN_BEARER_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

beforeEach(async () => {
  await writeWranglerToml();
});

after(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});

test('worker vars mutation validates and escapes TOML string values', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/admin/workers/api-gateway/vars`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({
        env: 'development',
        vars: {
          BACKEND_ORIGIN: 'https://new.example.com/"quoted"\nnext',
        },
      }),
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.deepEqual(payload.data.updated, ['BACKEND_ORIGIN']);

    const content = await fs.readFile(wranglerPath, 'utf8');
    assert.match(content, /BACKEND_ORIGIN = "https:\/\/new\.example\.com\/\\"quoted\\"\\nnext"/);
    assert.match(content, /\[env\.production\.vars\]\nBACKEND_ORIGIN = "https:\/\/prod\.example\.com"/);
  });
});

test('worker vars mutation can update a previously escaped TOML value', async () => {
  await withServer(async (baseUrl) => {
    const first = await fetch(`${baseUrl}/api/v1/admin/workers/api-gateway/vars`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({
        vars: {
          BACKEND_ORIGIN: 'https://first.example.com/"quoted"',
        },
      }),
    });
    assert.equal(first.status, 200);

    const second = await fetch(`${baseUrl}/api/v1/admin/workers/api-gateway/vars`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({
        vars: {
          BACKEND_ORIGIN: 'https://second.example.com',
        },
      }),
    });

    assert.equal(second.status, 200);
    const content = await fs.readFile(wranglerPath, 'utf8');
    assert.match(content, /BACKEND_ORIGIN = "https:\/\/second\.example\.com"/);
    assert.doesNotMatch(content, /first\.example/);
  });
});

test('worker vars mutation rejects invalid variable keys before writing', async () => {
  const before = await fs.readFile(wranglerPath, 'utf8');

  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/admin/workers/api-gateway/vars`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({
        env: 'development',
        vars: {
          'BACKEND_ORIGIN;touch tmp/pwned': 'https://bad.example.com',
        },
      }),
    });

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload.ok, false);
    assert.equal(payload.error.code, 'INVALID_WORKER_VARS');
  });

  assert.equal(await fs.readFile(wranglerPath, 'utf8'), before);
});

test('worker vars mutation rejects unsupported control characters', async () => {
  const before = await fs.readFile(wranglerPath, 'utf8');

  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/admin/workers/api-gateway/vars`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({
        vars: {
          BACKEND_ORIGIN: 'https://bad.example.com\u000B',
        },
      }),
    });

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload.ok, false);
    assert.equal(payload.error.code, 'INVALID_WORKER_VARS');
  });

  assert.equal(await fs.readFile(wranglerPath, 'utf8'), before);
});

test('worker secret mutation rejects shell metacharacters in secret keys', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/admin/workers/api-gateway/secret`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({
        env: 'production',
        key: 'SAFE_KEY;echo pwned',
        value: 'secret-value',
      }),
    });

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload.ok, false);
    assert.equal(payload.error.code, 'INVALID_WORKER_SECRET');
  });
});

test('worker secret mutation returns structured 400 for an empty body', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/admin/workers/api-gateway/secret`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.ADMIN_BEARER_TOKEN}`,
      },
    });

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload.ok, false);
    assert.equal(payload.error.code, 'INVALID_WORKER_SECRET');
  });
});
