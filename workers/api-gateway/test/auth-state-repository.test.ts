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

const TEST_EPOCH = new Date(Date.now() + 60_000);

function testIso(minutesFromEpoch: number): string {
  return new Date(TEST_EPOCH.getTime() + minutesFromEpoch * 60_000).toISOString();
}

function buildRefreshRecord(overrides: Partial<RefreshTokenRecord> = {}): RefreshTokenRecord {
  const now = overrides.createdAt ? new Date(overrides.createdAt) : TEST_EPOCH;
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
      createdAt: testIso(0),
    });
    const replacement = buildRefreshRecord({
      jti: 'refresh-next',
      familyId: current.familyId,
      createdAt: testIso(1),
    });

    await createRefreshTokenRecord(env.DB, current);

    const first = await rotateRefreshTokenCas(env.DB, {
      currentJti: current.jti,
      familyId: current.familyId,
      replacement,
      rotatedAt: testIso(1),
    });
    expect(first.ok).toBe(true);

    const replay = await rotateRefreshTokenCas(env.DB, {
      currentJti: current.jti,
      familyId: current.familyId,
      replacement: buildRefreshRecord({
        jti: 'refresh-replay',
        familyId: current.familyId,
        createdAt: testIso(2),
      }),
      rotatedAt: testIso(2),
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
      revokedAt: testIso(3),
    });

    const rotation = await rotateRefreshTokenCas(env.DB, {
      currentJti: current.jti,
      familyId: current.familyId,
      replacement: buildRefreshRecord({ jti: 'refresh-after-revoke', familyId: current.familyId }),
      rotatedAt: testIso(4),
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
