import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import sharp from 'sharp';

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'blog-admin-ai-images-'));
const imagesDir = path.join(tempRoot, 'images');
const sqlitePath = path.join(tempRoot, 'idempotency.sqlite');

process.env.ADMIN_BEARER_TOKEN = 'admin-ai-images-token';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
process.env.APP_ENV = 'test';
process.env.AI_DEFAULT_MODEL = process.env.AI_DEFAULT_MODEL || 'gpt-4.1-mini';
process.env.FEATURE_ADMIN_AI_IMAGE_ENABLED = 'true';
process.env.AI_IMAGE_PROXY_API_KEY = 'test-image-key';
process.env.AI_IMAGE_MODEL = 'test-image-model';
process.env.AI_IMAGE_TIMEOUT_MS = '5000';
process.env.AI_IMAGE_MAX_COUNT = '4';
process.env.CONTENT_IMAGES_DIR = imagesDir;
process.env.SQLITE_PATH = sqlitePath;

const pngBuffer = await sharp({
  create: {
    width: 8,
    height: 8,
    channels: 3,
    background: '#2563eb',
  },
})
  .png()
  .toBuffer();

let upstreamMode = 'b64';
let upstreamRequests = 0;
let upstreamAuth = null;
let upstreamPayload = null;

function createUpstreamApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.post('/v1/images/generations', (req, res) => {
    upstreamRequests += 1;
    upstreamAuth = req.headers.authorization || null;
    upstreamPayload = req.body;
    const errorMatch = /^error-(400|401)$/.exec(upstreamMode);
    if (errorMatch) {
      const status = Number(errorMatch[1]);
      res.status(status).json({
        error: {
          code: status === 400 ? 'invalid_size' : 'invalid_api_key',
          message: `Rejected prompt ${req.body.prompt}; ${req.headers.authorization}`,
        },
        request_id: `upstream-${status}`,
        debug: {
          authorization: req.headers.authorization,
          body: req.body,
        },
      });
      return;
    }
    if (upstreamMode === 'remote-url') {
      res.json({
        model: 'test-image-model',
        created: 1770000000,
        data: [{ url: 'https://example.com/generated.png' }],
      });
      return;
    }
    res.json({
      model: 'test-image-model',
      created: 1770000000,
      usage: null,
      metadata: { provider: 'test' },
      data: [{ b64_json: pngBuffer.toString('base64') }],
    });
  });
  app.get('/v1/model-names', (_req, res) => {
    res.json({ data: ['test-image-model'] });
  });
  return app;
}

async function listen(app) {
  const server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

const upstream = await listen(createUpstreamApp());
process.env.AI_IMAGE_PROXY_BASE_URL = `${upstream.baseUrl}/v1`;

const [{ default: adminAiImagesRouter }, { default: errorHandler }] = await Promise.all([
  import('../src/routes/adminAiImages.js'),
  import('../src/middleware/errorHandler.js'),
]);
const { logEmitter } = await import('../src/lib/logger.js');

function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/v1/admin/ai-images', adminAiImagesRouter);
  app.use(errorHandler);
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

after(async () => {
  upstream.server.closeAllConnections?.();
  await new Promise((resolve, reject) => {
    upstream.server.close((err) => (err ? reject(err) : resolve()));
  });
  await fs.rm(tempRoot, { recursive: true, force: true });
});

test('admin AI image route generates, normalizes, and stores image assets', async () => {
  upstreamMode = 'b64';
  upstreamRequests = 0;
  upstreamAuth = null;
  upstreamPayload = null;

  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/admin/ai-images/generate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.ADMIN_BEARER_TOKEN}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'admin-ai-image:test-success',
      },
      body: JSON.stringify({
        year: '2026',
        slug: 'kubernetes-release-checklist',
        prompt: 'Create a clean editorial image about Kubernetes release readiness.',
        n: 1,
        size: '1024x1024',
        quality: 'medium',
        outputFormat: 'png',
        alt: 'Kubernetes release checklist cover',
      }),
    });

    assert.equal(response.status, 201);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.data.model, 'test-image-model');
    assert.equal(payload.data.items.length, 1);
    assert.equal(payload.data.items[0].url.endsWith('.png'), true);
    assert.equal(payload.data.items[0].variantWebp.url.endsWith('.webp'), true);
    assert.match(payload.data.items[0].markdown, /^!\[Kubernetes release checklist cover\]\(/);
    assert.equal(upstreamAuth, 'Bearer test-image-key');
    assert.equal(upstreamRequests, 1);
    assert.equal(upstreamPayload.size, '1024x1024');
    assert.equal(upstreamPayload.quality, 'medium');

    const storedPng = path.join(imagesDir, payload.data.items[0].path);
    const storedWebp = path.join(imagesDir, payload.data.items[0].variantWebp.path);
    const [pngStat, webpStat] = await Promise.all([fs.stat(storedPng), fs.stat(storedWebp)]);
    assert.equal(pngStat.isFile(), true);
    assert.equal(webpStat.isFile(), true);
  });
});

for (const [field, value] of [
  ['size', '1792x1024'],
  ['quality', 'hd'],
]) {
  test(`admin AI image route rejects unsupported legacy ${field}`, async () => {
    upstreamMode = 'b64';
    upstreamRequests = 0;

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/admin/ai-images/generate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.ADMIN_BEARER_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          year: '2026',
          slug: `unsupported-${field}`,
          prompt: 'Create a clean editorial image for contract validation.',
          [field]: value,
        }),
      });

      assert.equal(response.status, 422);
      const payload = await response.json();
      assert.equal(payload.ok, false);
      assert.equal(payload.error.code, 'VALIDATION_ERROR');
      assert.equal(upstreamRequests, 0);
    });
  });
}

test('admin AI image route preserves safe upstream 400/401 diagnostics', async () => {
  for (const status of [400, 401]) {
    const prompt = `private image prompt ${status}`;
    const requestId = `admin-upstream-${status}`;
    const logEntries = [];
    const captureLog = (entry) => logEntries.push(entry);
    upstreamMode = `error-${status}`;
    upstreamRequests = 0;
    logEmitter.on('log', captureLog);

    try {
      await withServer(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/v1/admin/ai-images/generate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.ADMIN_BEARER_TOKEN}`,
            'Content-Type': 'application/json',
            'X-Request-ID': requestId,
          },
          body: JSON.stringify({
            year: '2026',
            slug: `upstream-${status}`,
            prompt,
            n: 1,
          }),
        });

        assert.equal(response.status, 502);
        const payload = await response.json();
        assert.equal(payload.error.code, 'BAD_GATEWAY');
        assert.equal(payload.error.details.requestId, requestId);
        assert.equal(payload.error.details.status, status);
        assert.equal(
          payload.error.details.upstreamCode,
          status === 400 ? 'invalid_size' : 'invalid_api_key',
        );
        assert.equal(payload.error.details.upstreamRequestId, `upstream-${status}`);
        assert.match(payload.error.details.upstreamMessage, /\[redacted\]/);
        assert.equal(JSON.stringify(payload).includes(prompt), false);
        assert.equal(JSON.stringify(payload).includes('test-image-key'), false);
        assert.equal(upstreamRequests, 1);
      });

      const upstreamLog = logEntries.find(
        (entry) =>
          entry.service === 'litellm-image-generation' &&
          entry.message === 'AI image proxy returned a non-2xx response' &&
          entry.requestId === requestId,
      );
      assert.ok(upstreamLog);
      assert.equal(upstreamLog.status, status);
      assert.equal(upstreamLog.upstreamRequestId, `upstream-${status}`);
      assert.equal(JSON.stringify(upstreamLog).includes(prompt), false);
      assert.equal(JSON.stringify(upstreamLog).includes('test-image-key'), false);
    } finally {
      logEmitter.off('log', captureLog);
      upstreamMode = 'b64';
    }
  }
});

test('admin AI image route rejects upstream remote image URLs', async () => {
  upstreamMode = 'remote-url';

  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/admin/ai-images/generate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.ADMIN_BEARER_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        year: '2026',
        slug: 'remote-url-test',
        prompt: 'Create a clean editorial image about remote URL rejection.',
        n: 1,
      }),
    });

    assert.equal(response.status, 502);
    const payload = await response.json();
    assert.equal(payload.ok, false);
    assert.match(payload.error.message, /remote URL/);
  });
});

test('admin AI image health does not expose the configured API key', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/admin/ai-images/health`, {
      headers: {
        Authorization: `Bearer ${process.env.ADMIN_BEARER_TOKEN}`,
      },
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.data.apiKeyConfigured, true);
    assert.equal(JSON.stringify(payload).includes('test-image-key'), false);
  });
});
