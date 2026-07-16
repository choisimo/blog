import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

const BROWSER_REQUEST_HEADERS = [
  'authorization',
  'content-type',
  'idempotency-key',
  'x-principal-sub',
  'x-device-fingerprint',
  'x-live-config-key',
  'x-break-glass-reason',
];

describe('browser CORS preflight', () => {
  it('allows every custom request header used by the production frontend', async () => {
    const response = await SELF.fetch(
      'https://example.com/api/v1/chat/session/session-123/message',
      {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://noblog.nodove.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': BROWSER_REQUEST_HEADERS.join(', '),
        },
      }
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://noblog.nodove.com'
    );

    const allowedHeaders = new Set(
      (response.headers.get('Access-Control-Allow-Headers') ?? '')
        .toLowerCase()
        .split(',')
        .map((header) => header.trim())
        .filter(Boolean)
    );

    for (const header of BROWSER_REQUEST_HEADERS) {
      expect(allowedHeaders.has(header)).toBe(true);
    }
  });
});
