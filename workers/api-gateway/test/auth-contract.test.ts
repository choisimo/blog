import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { signJwt, verifyJwt } from '../src/lib/jwt';
import type { Env } from '../src/types';

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Pick<Env, 'JWT_SECRET'> {}
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
});
