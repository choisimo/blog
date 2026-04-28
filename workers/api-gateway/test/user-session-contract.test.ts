import { SELF, env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

function buildFingerprint(visitorId: string) {
  return {
    visitorId,
    advancedVisitorId: visitorId,
    canvasHash: `${visitorId}-canvas`,
    webglHash: `${visitorId}-webgl`,
    audioHash: `${visitorId}-audio`,
    screenResolution: '1440x900x24',
    osVersion: 'test-os',
    fpjsBlocked: false,
    components: {
      canvasHash: `${visitorId}-canvas`,
      webglHash: `${visitorId}-webgl`,
      audioHash: `${visitorId}-audio`,
    },
  };
}

describe('user session contract', () => {
  it('supports the canonical verify endpoint with Authorization bearer token', async () => {
    const visitorId = `visitor-${crypto.randomUUID()}`;
    const createResponse = await SELF.fetch('https://example.com/api/v1/user/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fingerprint: buildFingerprint(visitorId),
        userAgent: 'vitest',
      }),
    });

    expect(createResponse.status).toBe(200);
    const created = (await createResponse.json()) as {
      ok: boolean;
      data: { sessionToken: string; fingerprintId: string };
    };

    const verifyResponse = await SELF.fetch(
      'https://example.com/api/v1/user/session/verify',
      {
        headers: {
          Authorization: `Bearer ${created.data.sessionToken}`,
        },
      }
    );

    expect(verifyResponse.status).toBe(200);
    const verified = (await verifyResponse.json()) as {
      ok: boolean;
      data: {
        sessionToken: string;
        fingerprintId: string;
        expiresAt: string;
      };
    };

    expect(verified.ok).toBe(true);
    expect(verified.data.sessionToken).toBe(created.data.sessionToken);
    expect(verified.data.fingerprintId).toBe(created.data.fingerprintId);
    expect(typeof verified.data.expiresAt).toBe('string');
  });

  it('dedupes session creation by Idempotency-Key', async () => {
    const visitorId = `visitor-${crypto.randomUUID()}`;
    const idempotencyKey = `session-${crypto.randomUUID()}`;
    const body = {
      fingerprint: buildFingerprint(visitorId),
      userAgent: 'vitest',
    };

    const first = await SELF.fetch('https://example.com/api/v1/user/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(body),
    });
    const replay = await SELF.fetch('https://example.com/api/v1/user/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(body),
    });

    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(replay.headers.get('Idempotency-Replayed')).toBe('true');
    expect(await replay.json()).toEqual(await first.clone().json());

    const conflict = await SELF.fetch('https://example.com/api/v1/user/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        fingerprint: buildFingerprint(`${visitorId}-different`),
        userAgent: 'vitest',
      }),
    });
    expect(conflict.status).toBe(409);
  });

  it('rejects URL bearer-token routes and recovers only through the canonical endpoint', async () => {
    const visitorId = `visitor-${crypto.randomUUID()}`;
    const createResponse = await SELF.fetch('https://example.com/api/v1/user/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fingerprint: buildFingerprint(visitorId),
        userAgent: 'vitest',
      }),
    });
    const created = (await createResponse.json()) as {
      data: { sessionToken: string; fingerprintId: string };
    };

    const legacyVerify = await SELF.fetch(
      `https://example.com/api/v1/user/session/${created.data.sessionToken}`
    );
    expect(legacyVerify.status).toBe(410);

    const legacyRecover = await SELF.fetch(
      `https://example.com/api/v1/user/session/${created.data.sessionToken}/recover`,
      { method: 'POST' }
    );
    expect(legacyRecover.status).toBe(410);

    const recoverResponse = await SELF.fetch(
      'https://example.com/api/v1/user/session/recover',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${created.data.sessionToken}`,
        },
      }
    );

    expect(recoverResponse.status).toBe(200);
    const recovered = (await recoverResponse.json()) as {
      ok: boolean;
      data: { sessionToken: string; fingerprintId: string };
    };

    expect(recovered.ok).toBe(true);
    expect(recovered.data.sessionToken).not.toBe(created.data.sessionToken);
    expect(recovered.data.fingerprintId).toBe(created.data.fingerprintId);

    const replayRecover = await SELF.fetch(
      'https://example.com/api/v1/user/session/recover',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${created.data.sessionToken}`,
        },
      }
    );
    expect(replayRecover.status).toBe(404);

    const sessionCounts = await env.DB.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active
      FROM user_sessions
      WHERE fingerprint_id = ?
    `)
      .bind(created.data.fingerprintId)
      .first<{ total: number; active: number }>();
    expect(Number(sessionCounts?.total || 0)).toBe(2);
    expect(Number(sessionCounts?.active || 0)).toBe(1);

    const oldVerify = await SELF.fetch(
      'https://example.com/api/v1/user/session/verify',
      {
        headers: {
          Authorization: `Bearer ${created.data.sessionToken}`,
        },
      }
    );
    expect(oldVerify.status).toBe(404);

    const newVerify = await SELF.fetch(
      'https://example.com/api/v1/user/session/verify',
      {
        headers: {
          Authorization: `Bearer ${recovered.data.sessionToken}`,
        },
      }
    );
    expect(newVerify.status).toBe(200);
  });
});
