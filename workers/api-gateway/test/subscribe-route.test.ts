import { env } from 'cloudflare:test';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';

import subscribe from '../src/routes/subscribe';
import type { Env } from '../src/types';

declare module 'cloudflare:test' {
  interface ProvidedEnv
    extends Pick<Env, 'DB' | 'PUBLIC_SITE_URL' | 'RESEND_API_KEY' | 'NOTIFY_FROM_EMAIL'> {}
}

function createApp() {
  const app = new Hono();
  app.route('/api/v1/subscribe', subscribe);
  return app;
}

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM subscribers').run();
});

describe('subscribe token-only unsubscribe flow', () => {
  it('keeps the subscriber token after confirmation so it can be reused for unsubscribe', async () => {
    const app = createApp();
    await env.DB.prepare(
      `INSERT INTO subscribers (email, status, confirm_token) VALUES (?, 'pending', ?)`
    )
      .bind('reader@example.com', 'confirm-token-1')
      .run();

    const response = await app.request(
      'https://example.com/api/v1/subscribe/confirm?token=confirm-token-1',
      undefined,
      env
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/?subscribe=success');

    const subscriber = await env.DB.prepare(
      `SELECT status, confirm_token FROM subscribers WHERE email = ?`
    )
      .bind('reader@example.com')
      .first<{ status: string; confirm_token: string | null }>();

    expect(subscriber?.status).toBe('confirmed');
    expect(subscriber?.confirm_token).toBe('confirm-token-1');
  });

  it('rejects email-only unsubscribe requests', async () => {
    const app = createApp();

    const response = await app.request(
      'https://example.com/api/v1/subscribe/unsubscribe?email=reader@example.com',
      undefined,
      env
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/?unsubscribe=error&reason=missing_token');
  });

  it('allows unsubscribe with the persisted subscriber token', async () => {
    const app = createApp();
    await env.DB.prepare(
      `INSERT INTO subscribers (email, status, confirm_token) VALUES (?, 'confirmed', ?)`
    )
      .bind('reader@example.com', 'confirm-token-2')
      .run();

    const response = await app.request(
      'https://example.com/api/v1/subscribe/unsubscribe?token=confirm-token-2',
      undefined,
      env
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/?unsubscribe=success');

    const subscriber = await env.DB.prepare(
      `SELECT status FROM subscribers WHERE email = ?`
    )
      .bind('reader@example.com')
      .first<{ status: string }>();

    expect(subscriber?.status).toBe('unsubscribed');
  });
});
