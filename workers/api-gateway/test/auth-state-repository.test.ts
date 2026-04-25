import type { D1Database } from '@cloudflare/workers-types';
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { execute } from '../src/lib/d1';
import {
  buildRefreshTokenExpiresAt,
  consumeTotpStepOnce,
  createRefreshTokenRecord,
  getRefreshFamilyRecord,
  getRefreshTokenRecord,
  revokeRefreshFamily,
  rotateRefreshTokenCas,
  type RefreshTokenRecord,
} from '../src/lib/auth-state-repository';

declare module 'cloudflare:test' {
  interface ProvidedEnv {
    DB: D1Database;
  }
}

function buildRefreshRecord(overrides: Partial<RefreshTokenRecord> = {}): RefreshTokenRecord {
  const now = overrides.createdAt ? new Date(overrides.createdAt) : new Date('2026-04-23T00:00:00.000Z');
  return {
    jti: overrides.jti ?? `refresh-${crypto.randomUUID()}`,
    familyId: overrides.familyId ?? `family-${crypto.randomUUID()}`,
    sub: overrides.sub ?? 'admin',
    email: overrides.email ?? 'admin@example.com',
    status: overrides.status ?? 'active',
    createdAt: now.toISOString(),
    expiresAt: overrides.expiresAt ?? buildRefreshTokenExpiresAt(now, 7 * 24 * 60 * 60),
    rotatedAt: overrides.rotatedAt,
    replacedBy: overrides.replacedBy,
    reason: overrides.reason,
  };
}

beforeEach(async () => {
  await execute(env.DB, 'DELETE FROM auth_refresh_tokens');
  await execute(env.DB, 'DELETE FROM auth_refresh_families');
  await execute(env.DB, "UPDATE auth_totp_state SET last_step = -1 WHERE id = 'global'");
});

describe('auth-state-repository', () => {
  it('rotates a refresh token exactly once with D1 CAS semantics', async () => {
    const current = buildRefreshRecord({
      jti: 'refresh-current',
      familyId: 'family-cas',
      createdAt: '2026-04-23T00:00:00.000Z',
    });
    const replacement = buildRefreshRecord({
      jti: 'refresh-next',
      familyId: current.familyId,
      createdAt: '2026-04-23T00:01:00.000Z',
    });

    await createRefreshTokenRecord(env.DB, current);

    const first = await rotateRefreshTokenCas(env.DB, {
      currentJti: current.jti,
      familyId: current.familyId,
      replacement,
      rotatedAt: '2026-04-23T00:01:00.000Z',
    });
    expect(first.ok).toBe(true);

    const replay = await rotateRefreshTokenCas(env.DB, {
      currentJti: current.jti,
      familyId: current.familyId,
      replacement: buildRefreshRecord({
        jti: 'refresh-replay',
        familyId: current.familyId,
        createdAt: '2026-04-23T00:02:00.000Z',
      }),
      rotatedAt: '2026-04-23T00:02:00.000Z',
    });
    expect(replay.ok).toBe(false);
    if (!replay.ok) {
      expect(replay.current?.status).toBe('rotated');
      expect(replay.current?.replacedBy).toBe('refresh-next');
    }

    expect(await getRefreshTokenRecord(env.DB, replacement.jti)).toMatchObject({
      jti: replacement.jti,
      status: 'active',
    });
  });

  it('blocks refresh rotation after a family has been revoked', async () => {
    const current = buildRefreshRecord({ jti: 'refresh-revoked', familyId: 'family-revoked' });
    await createRefreshTokenRecord(env.DB, current);
    await revokeRefreshFamily(env.DB, {
      familyId: current.familyId,
      reason: 'reuse-detected',
      lastJti: current.jti,
      expiresAt: current.expiresAt,
      revokedAt: '2026-04-23T00:03:00.000Z',
    });

    const rotation = await rotateRefreshTokenCas(env.DB, {
      currentJti: current.jti,
      familyId: current.familyId,
      replacement: buildRefreshRecord({ jti: 'refresh-after-revoke', familyId: current.familyId }),
      rotatedAt: '2026-04-23T00:04:00.000Z',
    });

    expect(rotation.ok).toBe(false);
    expect(await getRefreshFamilyRecord(env.DB, current.familyId)).toMatchObject({
      familyId: current.familyId,
      reason: 'reuse-detected',
    });
  });

  it('consumes a TOTP step only once and rejects older steps', async () => {
    await expect(consumeTotpStepOnce(env.DB, 123456)).resolves.toBe(true);
    await expect(consumeTotpStepOnce(env.DB, 123456)).resolves.toBe(false);
    await expect(consumeTotpStepOnce(env.DB, 123455)).resolves.toBe(false);
    await expect(consumeTotpStepOnce(env.DB, 123457)).resolves.toBe(true);
  });
});
