import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import sharp from 'sharp';

process.env.APP_ENV = 'test';
process.env.BACKEND_KEY = 'reader-image-test-key';
process.env.FEATURE_READER_IMAGES = 'true';
process.env.JWT_EXPIRES_IN ||= '15m';
process.env.AI_DEFAULT_MODEL ||= 'gpt-4.1-mini';

let mode = 'jpeg';
let calls = [];
const jpeg = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#2563eb' } }).jpeg().toBuffer();
const upstreamApp = express();
upstreamApp.use(express.json());
upstreamApp.post('/v1/images/generations', (req, res) => {
  calls.push({ body: req.body, headers: req.headers });
  if (typeof mode === 'number') return res.status(mode).json({ error: { code: 'test_rejection' } });
  if (mode === 'invalid') return res.json({ data: [{ b64_json: Buffer.from('not an image').toString('base64') }] });
  if (mode === 'url') return res.json({ data: [{ url: 'https://example.invalid/untrusted.png' }] });
  return res.json({ data: [{ b64_json: jpeg.toString('base64') }] });
});
async function listen(app) {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}
const upstream = await listen(upstreamApp);
const { config } = await import('../src/config.js');
const { default: router } = await import('../src/routes/readerImageRender.js');
const app = express();
app.use(express.json());
app.use('/api/v1/images', router);
const origin = await listen(app);
const input = { prompt: 'A diagram of a reader learning from an article', alt: 'Reader',
  size: '1536x1024', style: 'diagram', purpose: 'chat', requestId: 'a'.repeat(64) };
function render(body = input, auth = 'reader-image-test-key') {
  return fetch(`${origin.url}/api/v1/images/render-private`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { 'X-Backend-Key': auth } : {}) },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  mode = 'jpeg'; calls = [];
  process.env.FEATURE_READER_IMAGES = 'true';
  config.backendKey = 'reader-image-test-key';
  config.features.adminAiImageEnabled = false;
  Object.assign(config.ai.image, { proxyBaseUrl: `${upstream.url}/v1`, proxyApiKey: 'test-provider-key', model: 'fixture-image-model', timeoutMs: 5000 });
});
after(async () => {
  for (const { server } of [origin, upstream]) {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('renders actual provider raster bytes into PNG independently of the admin feature flag', async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.ok, true);
  assert.equal(result.data.width, 64);
  assert.equal(result.data.height, 48);
  const metadata = await sharp(Buffer.from(result.data.b64, 'base64')).metadata();
  assert.equal(metadata.format, 'png');
  assert.equal(metadata.width, 64);
  assert.equal(metadata.height, 48);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.n, 1);
  assert.equal(calls[0].body.model, 'fixture-image-model');
  assert.equal(calls[0].body.response_format, 'b64_json');
  assert.equal(calls[0].body.output_format, 'png');
  assert.ok(calls[0].body.prompt.includes(input.prompt));
  assert.equal(calls[0].headers['idempotency-key'], input.requestId);
  assert.equal(calls[0].headers['x-request-id'], input.requestId);
  assert.equal(calls[0].headers.authorization, 'Bearer test-provider-key');
});

test('rejects missing backend authorization and client-controlled image count without dispatch', async () => {
  assert.equal((await render(input, '')).status, 401);
  assert.equal((await render({ ...input, n: 20 })).status, 400);
  assert.equal(calls.length, 0);
});

test('reports a refundable configuration failure before invoking the provider', async () => {
  config.ai.image.proxyApiKey = undefined;
  const response = await render();
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, error: { code: 'IMAGE_PROVIDER_UNAVAILABLE' } });
  assert.equal(calls.length, 0);
});

test('disabled generation returns an explicit pre-dispatch failure', async () => {
  process.env.FEATURE_READER_IMAGES = 'false';
  const response = await render();
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, error: { code: 'IMAGE_DISABLED' } });
  assert.equal(calls.length, 0);
});

for (const [status, code] of [[400, 'IMAGE_REJECTED'], [401, 'IMAGE_PROVIDER_UNAVAILABLE'],
  [403, 'IMAGE_PROVIDER_UNAVAILABLE'], [404, 'IMAGE_PROVIDER_UNAVAILABLE'], [422, 'IMAGE_REJECTED'],
  [429, 'IMAGE_PROVIDER_RATE_LIMIT'], [500, 'IMAGE_OUTCOME_UNKNOWN']]) {
  test(`classifies provider HTTP ${status} for correct quota accounting`, async () => {
    mode = status;
    const response = await render();
    assert.equal(response.ok, false);
    assert.deepEqual(await response.json(), { ok: false, error: { code } });
    assert.equal(calls.length, 1);
  });
}

for (const invalidMode of ['invalid', 'url']) {
  test(`never reports success for ${invalidMode} provider output`, async () => {
    mode = invalidMode;
    const response = await render();
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { ok: false, error: { code: 'IMAGE_OUTCOME_UNKNOWN' } });
    assert.equal(calls.length, 1);
  });
}
