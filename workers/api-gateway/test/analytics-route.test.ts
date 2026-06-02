import { env } from 'cloudflare:test';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import analytics from '../src/routes/analytics';
import type { Env } from '../src/types';

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Pick<Env, 'KV'> {}
}

function createApp() {
  const app = new Hono();
  app.route('/api/v1/analytics', analytics);
  return app;
}

describe('analytics route', () => {
  it('keeps heartbeat best-effort when the realtime visitor store is unavailable', async () => {
    const putSpy = vi.spyOn(env.KV, 'put').mockRejectedValueOnce(new Error('kv unavailable'));
    const app = createApp();

    const response = await app.request(
      'https://example.com/api/v1/analytics/heartbeat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId: 'visitor-1' }),
      },
      env
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      data: {
        visitorId: 'visitor-1',
        recorded: false,
        degraded: true,
        reason: 'heartbeat-store-unavailable',
      },
    });
    expect(putSpy).toHaveBeenCalled();
  });
});
