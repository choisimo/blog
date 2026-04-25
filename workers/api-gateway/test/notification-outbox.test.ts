import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { execute, queryOne } from '../src/lib/d1';
import {
  enqueueNotificationDelivery,
  flushNotificationOutbox,
  NOTIFICATION_DELIVERY_STREAM,
} from '../src/lib/notification-outbox';
import type { Env } from '../src/types';

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Pick<Env, 'DB' | 'BACKEND_ORIGIN' | 'BACKEND_KEY'> {}
}

const payload = {
  event: 'notification' as const,
  type: 'success',
  title: '번역 준비 완료',
  message: '번역이 준비되었습니다.',
  userId: 'admin',
  sourceId: 'translation-job-1',
  payload: {
    jobId: 'translation-job-1',
    cacheUrl: 'https://example.com/cache',
  },
};

beforeEach(async () => {
  await execute(env.DB, 'DELETE FROM domain_outbox');
  env.BACKEND_ORIGIN = 'https://backend.example';
  env.BACKEND_KEY = 'backend-key';
  vi.restoreAllMocks();
});

describe('notification-outbox', () => {
  it('keeps notification events pending when backend delivery fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 503 }));

    const event = await enqueueNotificationDelivery(env, payload, {
      idempotencyKey: 'translation-notification:translation-job-1:success',
    });
    const result = await flushNotificationOutbox(env, { limit: 10 });

    expect(result.processed).toBe(0);
    expect(result.scanned).toBe(1);

    const row = await queryOne<{ status: string; retry_count: number; last_error: string | null }>(
      env.DB,
      'SELECT status, retry_count, last_error FROM domain_outbox WHERE id = ?',
      event.id
    );
    expect(row?.status).toBe('pending');
    expect(row?.retry_count).toBe(1);
    expect(row?.last_error).toContain('503');
  });

  it('marks notification events processed after successful delivery', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));

    const event = await enqueueNotificationDelivery(env, payload, {
      idempotencyKey: 'translation-notification:translation-job-1:success',
    });
    const result = await flushNotificationOutbox(env, { limit: 10 });

    expect(result.processed).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://backend.example/api/v1/notifications/outbox/internal',
      expect.objectContaining({ method: 'POST' })
    );

    const row = await queryOne<{ stream: string; status: string }>(
      env.DB,
      'SELECT stream, status FROM domain_outbox WHERE id = ?',
      event.id
    );
    expect(row).toEqual({ stream: NOTIFICATION_DELIVERY_STREAM, status: 'processed' });
  });
});
