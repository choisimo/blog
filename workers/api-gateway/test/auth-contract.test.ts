import { env, SELF } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  REFRESH_TOKEN_EXPIRY,
  generateRefreshToken,
  signJwt,
  verifyJwt,
} from '../src/lib/jwt';
import type { Env } from '../src/types';

declare module 'cloudflare:test' {
  interface ProvidedEnv
    extends Pick<
      Env,
      | 'DB'
      | 'JWT_SECRET'
      | 'KV'
      | 'ADMIN_ALLOWED_EMAILS'
      | 'GITHUB_CLIENT_ID'
      | 'GITHUB_CLIENT_SECRET'
      | 'OAUTH_REDIRECT_BASE_URL'
    > {}
}

beforeEach(async () => {
  env.ADMIN_ALLOWED_EMAILS = 'admin@example.com';
  env.GITHUB_CLIENT_ID = 'github-client-id';
  env.GITHUB_CLIENT_SECRET = 'github-client-secret';
  env.OAUTH_REDIRECT_BASE_URL = 'https://blog.example';
  await env.DB.prepare('DELETE FROM oauth_handoffs').run();
  await env.DB.prepare('DELETE FROM auth_refresh_tokens').run();
  await env.DB.prepare('DELETE FROM auth_refresh_families').run();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await env.DB.prepare('DELETE FROM oauth_handoffs').run();
  await env.DB.prepare('DELETE FROM auth_refresh_tokens').run();
  await env.DB.prepare('DELETE FROM auth_refresh_families').run();
});

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(body), { ...init, headers });
}

describe('auth contract', () => {
  it('issues canonical anonymous tokens with tokenClass', async () => {
    const response = await SELF.fetch('https://example.com/api/v1/auth/anonymous', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      ok: boolean;
      data: { token: string; userId: string; tokenType: string; isAnonymous: boolean };
    };

    expect(payload.ok).toBe(true);
    expect(payload.data.tokenType).toBe('Bearer');
    expect(payload.data.isAnonymous).toBe(true);

    const claims = await verifyJwt(payload.data.token, env);
    expect(claims.sub).toBe(payload.data.userId);
    expect(claims.role).toBe('anonymous');
    expect(claims.type).toBe('access');
    expect(claims.tokenClass).toBe('anonymous');
  });

  it('rejects legacy anonymous tokens without tokenClass on refresh', async () => {
    const legacyToken = await signJwt(
      {
        sub: `anon-${crypto.randomUUID()}`,
        role: 'anonymous',
        username: 'Anonymous',
        type: 'access',
      },
      env,
      30 * 24 * 3600
    );

    const response = await SELF.fetch('https://example.com/api/v1/auth/anonymous/refresh', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${legacyToken}`,
      },
    });

    expect(response.status).toBe(400);
    const payload = (await response.json()) as {
      ok: boolean;
      error: { code: string; message: string };
    };
    expect(payload.ok).toBe(false);
    expect(payload.error.message).toBe('Not an anonymous token');
  });

  it('revokes the full refresh token family when a rotated token is reused', async () => {
    const familyId = `family-${crypto.randomUUID()}`;
    const refreshTokenId = `refresh-${crypto.randomUUID()}`;
    const refreshToken = await generateRefreshToken(
      {
        sub: 'admin',
        role: 'admin',
        username: 'admin',
        email: 'admin@example.com',
        emailVerified: true,
        familyId,
      },
      env,
      refreshTokenId
    );

    await env.KV.put(
      `auth:refresh:${refreshTokenId}`,
      JSON.stringify({
        jti: refreshTokenId,
        familyId,
        sub: 'admin',
        email: 'admin@example.com',
        status: 'active',
        createdAt: new Date().toISOString(),
      }),
      { expirationTtl: REFRESH_TOKEN_EXPIRY }
    );

    const firstRefresh = await SELF.fetch('https://example.com/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    expect(firstRefresh.status).toBe(200);
    const firstPayload = (await firstRefresh.json()) as {
      ok: boolean;
      data: { refreshToken: string };
    };
    expect(firstPayload.ok).toBe(true);

    const reusedRefresh = await SELF.fetch('https://example.com/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    expect(reusedRefresh.status).toBe(401);
    const reusedPayload = (await reusedRefresh.json()) as {
      ok: boolean;
      error: { message: string };
    };
    expect(reusedPayload.ok).toBe(false);
    expect(reusedPayload.error.message).toBe('Refresh token reuse detected');

    const familyRecord = await env.DB
      .prepare('SELECT family_id, reason FROM auth_refresh_families WHERE family_id = ?')
      .bind(familyId)
      .first<{ family_id: string; reason: string }>();
    expect(familyRecord).toEqual({
      family_id: familyId,
      reason: 'reuse-detected',
    });

    const rotatedRefresh = await SELF.fetch('https://example.com/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: firstPayload.data.refreshToken }),
    });

    expect(rotatedRefresh.status).toBe(401);
    const rotatedPayload = (await rotatedRefresh.json()) as {
      ok: boolean;
      error: { message: string };
    };
    expect(rotatedPayload.ok).toBe(false);
    expect(rotatedPayload.error.message).toBe('Refresh token revoked or expired');
  });

  it('redirects OAuth callbacks with a one-time handoff instead of raw JWT fragments', async () => {
    const state = `oauth-state-${crypto.randomUUID()}`;
    await env.KV.put(
      `auth:oauth:state:${state}`,
      JSON.stringify({
        state,
        provider: 'github',
        createdAt: new Date().toISOString(),
        codeVerifier: 'pkce-verifier',
      }),
      { expirationTtl: 300 }
    );

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (url === 'https://github.com/login/oauth/access_token') {
        return jsonResponse({ access_token: 'github-oauth-token' });
      }
      if (url === 'https://api.github.com/user/emails') {
        return jsonResponse([
          {
            email: 'admin@example.com',
            primary: true,
            verified: true,
          },
        ]);
      }

      throw new Error(`Unexpected fetch in auth test: ${url}`);
    });

    const response = await SELF.fetch(
      `https://example.com/api/v1/auth/oauth/github/callback?code=test-code&state=${state}`,
      {
        redirect: 'manual',
      }
    );

    expect(response.status).toBe(302);

    const location = response.headers.get('Location');
    expect(location).toBeTruthy();

    const redirectUrl = new URL(location || '');
    const fragment = new URLSearchParams(redirectUrl.hash.slice(1));
    const handoff = fragment.get('handoff');

    expect(redirectUrl.origin).toBe('https://blog.example');
    expect(redirectUrl.pathname).toBe('/admin/auth/callback');
    expect(handoff).toMatch(/^oauth-handoff-/);
    expect(fragment.get('token')).toBeNull();
    expect(fragment.get('refreshToken')).toBeNull();
    expect(await env.KV.get(`auth:oauth:state:${state}`)).toBeNull();

    const handoffRow = await env.DB
      .prepare('SELECT provider, email FROM oauth_handoffs WHERE id = ?')
      .bind(handoff)
      .first<{ provider: string; email: string }>();
    expect(handoffRow).toEqual({
      provider: 'github',
      email: 'admin@example.com',
    });
  });

  it('consumes OAuth handoffs once and invalidates them afterwards', async () => {
    const state = `oauth-state-${crypto.randomUUID()}`;
    await env.KV.put(
      `auth:oauth:state:${state}`,
      JSON.stringify({
        state,
        provider: 'github',
        createdAt: new Date().toISOString(),
        codeVerifier: 'pkce-verifier',
      }),
      { expirationTtl: 300 }
    );

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (url === 'https://github.com/login/oauth/access_token') {
        return jsonResponse({ access_token: 'github-oauth-token' });
      }
      if (url === 'https://api.github.com/user/emails') {
        return jsonResponse([
          {
            email: 'admin@example.com',
            primary: true,
            verified: true,
          },
        ]);
      }

      throw new Error(`Unexpected fetch in auth test: ${url}`);
    });

    const callback = await SELF.fetch(
      `https://example.com/api/v1/auth/oauth/github/callback?code=test-code&state=${state}`,
      {
        redirect: 'manual',
      }
    );
    const location = new URL(callback.headers.get('Location') || '');
    const handoff = new URLSearchParams(location.hash.slice(1)).get('handoff');
    expect(handoff).toBeTruthy();

    const consume = await SELF.fetch('https://example.com/api/v1/auth/oauth/handoff/consume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handoff }),
    });

    expect(consume.status).toBe(200);
    const payload = (await consume.json()) as {
      ok: boolean;
      data: {
        accessToken: string;
        refreshToken: string;
        user: {
          username: string;
          email: string;
          role: string;
          emailVerified: boolean;
          authMethod: string;
        };
      };
    };
    expect(payload.ok).toBe(true);
    expect(payload.data.user).toMatchObject({
      username: 'admin',
      email: 'admin@example.com',
      role: 'admin',
      emailVerified: true,
    });

    const accessClaims = await verifyJwt(payload.data.accessToken, env);
    const refreshClaims = await verifyJwt(payload.data.refreshToken, env);
    expect(accessClaims.email).toBe('admin@example.com');
    expect(refreshClaims.type).toBe('refresh');
    expect(refreshClaims.email).toBe('admin@example.com');

    const replay = await SELF.fetch('https://example.com/api/v1/auth/oauth/handoff/consume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handoff }),
    });
    expect(replay.status).toBe(401);

    const replayPayload = (await replay.json()) as {
      ok: boolean;
      error: { message: string };
    };
    expect(replayPayload.ok).toBe(false);
    expect(replayPayload.error.message).toBe('Invalid or expired OAuth handoff');

    const handoffRow = await env.DB
      .prepare('SELECT id FROM oauth_handoffs WHERE id = ?')
      .bind(handoff)
      .first();
    expect(handoffRow).toBeNull();
  });
});
