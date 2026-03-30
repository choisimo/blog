import { SELF } from 'cloudflare:test';
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

  it('keeps the legacy session path while recovering through the canonical endpoint', async () => {
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
    expect(legacyVerify.status).toBe(200);
    const legacyPayload = (await legacyVerify.json()) as {
      data: { sessionId: string; sessionToken: string };
    };
    expect(typeof legacyPayload.data.sessionId).toBe('string');
    expect(legacyPayload.data.sessionToken).toBe(created.data.sessionToken);

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
