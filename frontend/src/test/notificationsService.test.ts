import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchUnreadNotifications,
  markNotificationReadRemote,
  normalizeNotificationPayload,
} from '@/services/realtime/notifications';

const mocks = vi.hoisted(() => ({
  getAuthHeadersAsync: vi.fn(),
}));

vi.mock('@/utils/network/apiBase', () => ({
  getApiBaseUrl: () => 'https://api.example.com',
}));

vi.mock('@/stores/session/useAuthStore', () => ({
  getAuthHeadersAsync: mocks.getAuthHeadersAsync,
}));

describe('notifications service', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthHeadersAsync.mockResolvedValue({
      Authorization: 'Bearer user-token',
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects blank notification IDs before requesting auth or network', async () => {
    await expect(markNotificationReadRemote(' \n\t ')).resolves.toBe(false);

    expect(mocks.getAuthHeadersAsync).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('trims and encodes notification IDs before marking them read', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: { read: true },
      }),
    });

    await markNotificationReadRemote(' notification-1 ');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/notifications/notification-1/read',
      {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer user-token',
          'Content-Type': 'application/json',
        },
      },
    );
  });

  it('rejects unsafe notification IDs before requesting auth or network', async () => {
    await expect(markNotificationReadRemote('notification%0a1')).resolves.toBe(false);
    await expect(markNotificationReadRemote('../notification-1')).resolves.toBe(false);
    await expect(markNotificationReadRemote('notification/1')).resolves.toBe(false);

    expect(mocks.getAuthHeadersAsync).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed when auth headers are unsafe', async () => {
    mocks.getAuthHeadersAsync.mockResolvedValue({
      Authorization: 'Bearer user-token\r\nX-Injected: yes',
    });

    await expect(markNotificationReadRemote('notification-1')).resolves.toBe(false);
    await expect(fetchUnreadNotifications()).resolves.toEqual([]);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('clamps unread limits and filters unsafe remote notification items', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          items: [
            {
              id: 'notification-1',
              userId: 'user-1',
              type: 'system',
              title: 'Safe title',
              message: 'Safe message',
              createdAt: '2026-07-03T00:00:00.000Z',
              readAt: null,
            },
            {
              id: 'notification%0a2',
              userId: 'user-1',
              type: 'system',
              title: 'Unsafe id',
              message: 'Safe message',
              createdAt: '2026-07-03T00:00:00.000Z',
              readAt: null,
            },
            {
              id: 'notification-3',
              userId: 'user-1',
              type: 'system',
              title: 'Unsafe\r\ntitle',
              message: 'Safe message',
              createdAt: '2026-07-03T00:00:00.000Z',
              readAt: null,
            },
          ],
          unreadCount: 3,
        },
      }),
    });

    await expect(fetchUnreadNotifications(500)).resolves.toEqual([
      expect.objectContaining({
        id: 'notification-1',
        title: 'Safe title',
        message: 'Safe message',
        createdAt: '2026-07-03T00:00:00.000Z',
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/notifications/unread?limit=100',
      {
        headers: {
          Authorization: 'Bearer user-token',
        },
      },
    );
  });

  it('preserves only plain object notification payloads', () => {
    expect(normalizeNotificationPayload({ taskId: 'task-1' })).toEqual({
      taskId: 'task-1',
    });
    expect(normalizeNotificationPayload([])).toBeUndefined();
    expect(normalizeNotificationPayload(null)).toBeUndefined();
    expect(normalizeNotificationPayload('payload')).toBeUndefined();
  });
});
