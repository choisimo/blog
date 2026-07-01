import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

process.env.ADMIN_BEARER_TOKEN = 'rag-admin-token';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
process.env.APP_ENV = 'test';
process.env.AI_DEFAULT_MODEL = process.env.AI_DEFAULT_MODEL || 'gpt-4.1-mini';
process.env.FEATURE_RAG_ENABLED = 'true';

const { default: ragRouter } = await import('../src/routes/rag.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/rag', ragRouter);
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

test('rag management endpoints require admin authorization', async () => {
  await withServer(async (baseUrl) => {
    const requests = [
      fetch(`${baseUrl}/api/v1/rag/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: ['hello'] }),
      }),
      fetch(`${baseUrl}/api/v1/rag/index`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documents: [{ id: 'doc-1', content: 'hello world' }],
        }),
      }),
      fetch(`${baseUrl}/api/v1/rag/index/doc-1`, { method: 'DELETE' }),
      fetch(`${baseUrl}/api/v1/rag/status`),
      fetch(`${baseUrl}/api/v1/rag/collections`),
    ];

    const responses = await Promise.all(requests);
    assert.deepEqual(
      responses.map((response) => response.status),
      [401, 401, 401, 401, 401],
    );
  });
});
