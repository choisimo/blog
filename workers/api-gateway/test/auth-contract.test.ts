import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import {
  REFRESH_TOKEN_EXPIRY,
  generateRefreshToken,
  signJwt,
  verifyJwt,
} from '../src/lib/jwt';
import type { Env } from '../src/types';

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Pick<Env, 'JWT_SECRET' | 'KV'> {}
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

    const familyRecord = await env.KV.get(`auth:refresh-family:${familyId}`);
    expect(familyRecord).not.toBeNull();
    expect(JSON.parse(familyRecord || '{}')).toMatchObject({
      familyId,
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
});
