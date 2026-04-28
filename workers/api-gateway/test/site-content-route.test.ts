import { env } from 'cloudflare:test';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';

import { signJwt } from '../src/lib/jwt';
import siteContent from '../src/routes/site-content';
import type { Env } from '../src/types';

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Pick<Env, 'DB' | 'JWT_SECRET'> {}
}

function createApp() {
  const app = new Hono();
  app.route('/api/v1/site-content', siteContent);
  return app;
}

async function createAdminToken(): Promise<string> {
  return signJwt(
    {
      sub: 'admin-1',
      role: 'admin',
      username: 'admin',
      email: 'admin@example.com',
      emailVerified: true,
      type: 'access',
    },
    env
  );
}

beforeEach(async () => {
  await env.DB.prepare(`DELETE FROM site_content_blocks WHERE key = ?`).bind('home_ai_cta').run();
});

describe('site content route', () => {
  it('returns the default public block when no row exists', async () => {
    const app = createApp();

    const response = await app.request(
      'https://example.com/api/v1/site-content/home_ai_cta',
      { method: 'GET' },
      env
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      ok: boolean;
      data: { block: { key: string; markdown: string; ctaHref: string | null } };
    };

    expect(payload.ok).toBe(true);
    expect(payload.data.block).toMatchObject({
      key: 'home_ai_cta',
      ctaHref: '/?ai=chat',
    });
    expect(payload.data.block.markdown).toContain('AI Chat & Writing Assistant');
  });

  it('requires admin authentication for saving content blocks', async () => {
    const app = createApp();

    const response = await app.request(
      'https://example.com/api/v1/site-content/admin/home_ai_cta',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          markdown: '### Updated',
          ctaLabel: 'Open',
          ctaHref: '/ai',
        }),
      },
      env
    );

    expect(response.status).toBe(401);
  });

  it('allows admins to save markdown CTA content for the public home page', async () => {
    const app = createApp();
    const token = await createAdminToken();

    const saveResponse = await app.request(
      'https://example.com/api/v1/site-content/admin/home_ai_cta',
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          markdown: '### Custom CTA\n\n관리자가 추가한 **내용**입니다.',
          ctaLabel: '열기',
          ctaHref: '/ai',
          enabled: true,
        }),
      },
      env
    );

    expect(saveResponse.status).toBe(200);
    const savePayload = (await saveResponse.json()) as {
      data: { block: { markdown: string; ctaLabel: string | null; ctaHref: string | null } };
    };
    expect(savePayload.data.block).toMatchObject({
      markdown: '### Custom CTA\n\n관리자가 추가한 **내용**입니다.',
      ctaLabel: '열기',
      ctaHref: '/ai',
    });

    const publicResponse = await app.request(
      'https://example.com/api/v1/site-content/home_ai_cta',
      { method: 'GET' },
      env
    );
    const publicPayload = (await publicResponse.json()) as {
      data: { block: { markdown: string; ctaLabel: string | null; ctaHref: string | null } };
    };

    expect(publicPayload.data.block).toMatchObject({
      markdown: '### Custom CTA\n\n관리자가 추가한 **내용**입니다.',
      ctaLabel: '열기',
      ctaHref: '/ai',
    });
  });

  it('rejects unsafe CTA hrefs', async () => {
    const app = createApp();
    const token = await createAdminToken();

    const response = await app.request(
      'https://example.com/api/v1/site-content/admin/home_ai_cta',
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          markdown: '### Updated',
          ctaLabel: 'Open',
          ctaHref: '//evil.example.com',
        }),
      },
      env
    );

    expect(response.status).toBe(400);
  });
});
