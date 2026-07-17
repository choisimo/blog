import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'blog-generated-image-r2-'));
const imagesDir = path.join(tempRoot, 'images');

process.env.APP_ENV = 'production';
process.env.AI_DEFAULT_MODEL = 'gpt-5.3-codex-spark';
process.env.BACKEND_KEY = 'remote-storage-backend-key';
process.env.WORKER_API_URL = 'https://api.example';
process.env.ASSETS_BASE_URL = 'https://assets.example';
process.env.CONTENT_IMAGES_DIR = imagesDir;

const originalFetch = globalThis.fetch;
const uploads = [];

globalThis.fetch = async (input, init) => {
  const url = String(input);
  const body = JSON.parse(String(init?.body || '{}'));
  uploads.push({ url, init, body });

  return new Response(
    JSON.stringify({
      ok: true,
      data: {
        key: body.key,
        url: `https://assets.example/${body.key}`,
        size: Buffer.from(body.data, 'base64').length,
        contentType: body.contentType,
      },
    }),
    {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    },
  );
};

const [{ config }, { GeneratedImageStorageService }] = await Promise.all([
  import('../src/config.js'),
  import('../src/services/ai-image/generated-image-storage.service.js'),
]);

after(async () => {
  globalThis.fetch = originalFetch;
  await fs.rm(tempRoot, { recursive: true, force: true });
});

test('production generated images are persisted through the internal Worker R2 route', async () => {
  uploads.length = 0;
  const png = await sharp({
    create: {
      width: 12,
      height: 8,
      channels: 3,
      background: '#2563eb',
    },
  })
    .png()
    .toBuffer();

  const service = new GeneratedImageStorageService();
  const stored = await service.saveImages({
    year: '2026',
    slug: 'release-checklist',
    subdir: 'ai',
    images: [{ buffer: png }],
    alt: 'Release checklist cover',
    requestId: 'image-request-123',
  });

  assert.equal(uploads.length, 2);
  assert.equal(uploads[0].url, 'https://api.example/api/v1/internal/images/generated');
  assert.equal(uploads[0].init.method, 'POST');
  assert.equal(uploads[0].init.headers['X-Backend-Key'], 'remote-storage-backend-key');
  assert.equal(uploads[0].init.headers['X-Request-ID'], 'image-request-123');
  assert.equal(uploads[0].body.contentType, 'image/png');
  assert.equal(uploads[1].body.contentType, 'image/webp');
  assert.match(
    uploads[0].body.key,
    /^images\/2026\/release-checklist\/ai\/generated-\d{14}-01-[a-f0-9]{10}-[a-f0-9]{8}\.png$/,
  );
  assert.match(uploads[1].body.key, /-w12\.webp$/);

  assert.equal(stored.dir, 'https://assets.example/images/2026/release-checklist/ai/');
  assert.equal(stored.items.length, 1);
  assert.equal(stored.items[0].url, `https://assets.example/${uploads[0].body.key}`);
  assert.equal(stored.items[0].variantWebp.url, `https://assets.example/${uploads[1].body.key}`);
  assert.match(stored.items[0].markdown, /^!\[Release checklist cover\]\(https:\/\/assets\.example\//);
  await assert.rejects(fs.access(imagesDir), { code: 'ENOENT' });
});

test('production storage fails closed when the public asset origin is missing', async () => {
  const previous = config.assetsBaseUrl;
  config.assetsBaseUrl = undefined;

  try {
    const service = new GeneratedImageStorageService();
    await assert.rejects(
      service.saveImages({
        year: '2026',
        slug: 'release-checklist',
        images: [],
        requestId: 'image-request-missing-config',
      }),
      (error) => {
        assert.equal(error.code, 'BAD_GATEWAY');
        assert.equal(error.message, 'Generated image storage is not configured');
        assert.equal(error.details.assetsBaseUrl, false);
        return true;
      },
    );
  } finally {
    config.assetsBaseUrl = previous;
  }
});
