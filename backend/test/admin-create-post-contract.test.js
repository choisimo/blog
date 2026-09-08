import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

import express from 'express';

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'blog-admin-create-post-'));

process.env.ADMIN_BEARER_TOKEN = 'admin-create-post-token';
process.env.APP_ENV = 'test';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
process.env.AI_DEFAULT_MODEL = process.env.AI_DEFAULT_MODEL || 'gpt-4.1-mini';
process.env.GITHUB_TOKEN = 'github-create-post-token';
process.env.GITHUB_REPO_OWNER = 'create-post-owner';
process.env.GITHUB_REPO_NAME = 'create-post-repo';
process.env.SQLITE_PATH = path.join(tempRoot, 'domain-outbox.sqlite');

const [
  { default: adminRouter },
  { getDomainOutboxRepository },
  { GITHUB_PR_STREAM },
  { hashIdempotencyPayload },
  { normalizePostSlug },
] = await Promise.all([
  import('../src/routes/admin.js'),
  import('../src/repositories/domain-outbox.repository.js'),
  import('../src/services/backend-outbox.service.js'),
  import('../src/lib/idempotency.js'),
  import('../src/lib/post-slug.js'),
]);

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/admin', adminRouter);
  app.use((err, _req, res, _next) => {
    res.status(err?.statusCode || 500).json({
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

function adminHeaders(idempotencyKey) {
  return {
    Authorization: `Bearer ${process.env.ADMIN_BEARER_TOKEN}`,
    'Content-Type': 'application/json',
    'Idempotency-Key': idempotencyKey,
  };
}

const createPostBody = {
  title: 'Retry-safe post',
  slug: 'Retry_Safe_Post',
  year: 2026,
  content: '# Original body\n',
  frontmatter: {
    category: 'Engineering',
    tags: ['idempotency'],
  },
  draft: true,
};

function createPostRequestFingerprint(body = createPostBody) {
  return hashIdempotencyPayload({
    title: String(body.title || body.slug || 'New Post'),
    slug: normalizePostSlug(body.slug || body.title || 'New Post'),
    year: String(body.year || new Date().getFullYear()),
    content: typeof body.content === 'string' ? body.content : '',
    frontmatter:
      body.frontmatter && typeof body.frontmatter === 'object' ? body.frontmatter : {},
    draft: Boolean(body.draft),
  });
}

after(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});

test('create-post slug contract preserves an explicit normalized slug', () => {
  assert.equal(normalizePostSlug('Explicit_Slug'), 'explicit-slug');
});

test('create-post slug contract falls back safely for empty input', () => {
  assert.equal(normalizePostSlug(''), 'post');
  assert.equal(normalizePostSlug('한글'), 'post');
});

test('create-post retry returns the original branch and path from the outbox payload', async () => {
  const idempotencyKey = `create-post-retry-${crypto.randomUUID()}`;
  const originalBranch = 'post/2026-retry-safe-post-original';
  const originalPath = 'frontend/public/posts/2026/original-retry-safe-post.md';
  const repository = getDomainOutboxRepository();
  const original = await repository.append({
    stream: GITHUB_PR_STREAM,
    aggregateId: 'post:2026:retry-safe-post',
    eventType: 'github.pr.create-post',
    payload: {
      branch: originalBranch,
      path: originalPath,
      markdown: '# Persisted body',
      commitMessage: 'feat(post): add original retry-safe post',
      prTitle: 'Add original retry-safe post',
      prBody: 'Persisted create-post request',
      requestFingerprint: createPostRequestFingerprint(),
    },
    idempotencyKey,
  });

  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/admin/create-post-pr`, {
      method: 'POST',
      headers: adminHeaders(idempotencyKey),
      body: JSON.stringify(createPostBody),
    });
    const payload = await response.json();

    assert.equal(response.status, 202);
    assert.deepEqual(payload, {
      ok: true,
      data: {
        status: 'pending',
        outboxId: original.id,
        branch: originalBranch,
        path: originalPath,
      },
    });
  });
});

test('create-post stores a request fingerprint and rejects a reused key with changed content', async () => {
  const idempotencyKey = `create-post-conflict-${crypto.randomUUID()}`;
  const repository = getDomainOutboxRepository();

  await withServer(async (baseUrl) => {
    const first = await fetch(`${baseUrl}/api/v1/admin/create-post-pr`, {
      method: 'POST',
      headers: adminHeaders(idempotencyKey),
      body: JSON.stringify(createPostBody),
    });
    const firstPayload = await first.json();

    assert.equal(first.status, 202);
    assert.equal(firstPayload.ok, true);

    const stored = await repository.getById(firstPayload.data.outboxId);
    assert.equal(stored.payload.requestFingerprint, createPostRequestFingerprint());

    const conflict = await fetch(`${baseUrl}/api/v1/admin/create-post-pr`, {
      method: 'POST',
      headers: adminHeaders(idempotencyKey),
      body: JSON.stringify({
        ...createPostBody,
        content: '# Changed body\n',
      }),
    });

    assert.equal(conflict.status, 409);
    assert.deepEqual(await conflict.json(), {
      ok: false,
      error: {
        code: 'IDEMPOTENCY_KEY_REUSED',
        message: 'Idempotency-Key was reused with a different create-post request payload',
      },
    });

    const matchingEvents = (await repository.listEvents({
      stream: GITHUB_PR_STREAM,
      limit: 100,
    })).filter((event) => event.idempotencyKey === idempotencyKey);
    assert.equal(matchingEvents.length, 1);
    assert.equal(matchingEvents[0].id, firstPayload.data.outboxId);
  });
});
