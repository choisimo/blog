import assert from 'node:assert/strict';
import test from 'node:test';

import worker from '../src/index';

const env = {
  MY_BUCKET: {
    get: async () => null,
  },
  ALLOWED_ORIGINS: 'https://app.example.com',
} as unknown as {
  MY_BUCKET: R2Bucket;
  ALLOWED_ORIGINS: string;
};

test('r2-gateway root endpoint returns service metadata with CORS headers', async () => {
  const response = await worker.fetch(
    new Request('https://assets.example.com/', {
      headers: { Origin: 'https://app.example.com' },
    }),
    env
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://app.example.com');
  assert.deepEqual(await response.json(), {
    ok: true,
    service: 'r2-gateway',
  });
});

test('r2-gateway answers OPTIONS requests for public assets', async () => {
  const response = await worker.fetch(
    new Request('https://assets.example.com/assets/logo.svg', {
      method: 'OPTIONS',
      headers: { Origin: 'https://app.example.com' },
    }),
    env
  );

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://app.example.com');
  assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'GET, HEAD, OPTIONS');
});
