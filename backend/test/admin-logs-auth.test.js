import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import express from 'express';

process.env.ADMIN_BEARER_TOKEN = 'admin-logs-token';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
process.env.APP_ENV = 'test';
process.env.AI_DEFAULT_MODEL = process.env.AI_DEFAULT_MODEL || 'gpt-4.1-mini';

const { default: adminLogsRouter } = await import('../src/routes/adminLogs.js');

function createApp() {
  const app = express();
  app.use('/api/v1/admin/logs', adminLogsRouter);
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

test('logs stream rejects bearer tokens passed through the URL query string', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/v1/admin/logs/stream?token=${process.env.ADMIN_BEARER_TOKEN}`
    );

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: 'Unauthorized',
    });
  });
});

test('logs stream accepts bearer tokens from the Authorization header', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/admin/logs/stream`, {
      headers: {
        Authorization: `Bearer ${process.env.ADMIN_BEARER_TOKEN}`,
      },
    });

    try {
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'text/event-stream');

      const reader = response.body?.getReader();
      assert.ok(reader);
      const first = await reader.read();
      assert.equal(first.done, false);
      assert.match(new TextDecoder().decode(first.value), /"connected"/);
      await reader.cancel();
    } finally {
      await response.body?.cancel().catch(() => {});
    }
  });
});
