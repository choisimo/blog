import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import express from 'express';

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'blog-admin-config-'));
const backendDir = path.join(tempRoot, 'backend');
const backendEnvPath = path.join(backendDir, '.env');

process.env.REPO_ROOT = tempRoot;
process.env.ADMIN_BEARER_TOKEN = 'admin-config-token';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
process.env.APP_ENV = 'test';
process.env.AI_DEFAULT_MODEL = process.env.AI_DEFAULT_MODEL || 'gpt-4.1-mini';

const { default: configRouter } = await import('../src/routes/config.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin/config', configRouter);
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
  await fs.rm(backendDir, { recursive: true, force: true });
  await fs.mkdir(backendDir, { recursive: true });
});

after(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});

test('save-env serializes newline values without injecting extra env keys', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/admin/config/save-env`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({
        target: 'backend',
        variables: {
          SITE_BASE_URL: 'https://safe.example\nJWT_SECRET=hijack',
        },
      }),
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.ok, true);

    const content = await fs.readFile(backendEnvPath, 'utf8');
    assert.match(
      content,
      /^SITE_BASE_URL="https:\/\/safe\.example\\nJWT_SECRET=hijack"$/m
    );
    assert.doesNotMatch(content, /^JWT_SECRET=hijack$/m);
  });
});

test('save-env preserves valid falsy numeric values', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/admin/config/save-env`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({
        target: 'backend',
        variables: {
          PORT: 0,
          TRUST_PROXY: 0,
        },
      }),
    });

    assert.equal(response.status, 200);
    const content = await fs.readFile(backendEnvPath, 'utf8');
    assert.match(content, /^PORT=0$/m);
    assert.match(content, /^TRUST_PROXY=0$/m);
  });
});

test('save-env returns structured 400 for an empty body', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/admin/config/save-env`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.ADMIN_BEARER_TOKEN}`,
      },
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: 'variables object required',
    });
  });
});

test('save-env rejects unknown targets instead of falling back to backend env', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/admin/config/save-env`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({
        target: 'elsewhere',
        variables: {
          SITE_BASE_URL: 'https://safe.example',
        },
      }),
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: 'target must be backend or root',
    });
  });
});
