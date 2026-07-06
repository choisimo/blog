import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  normalizeNotification,
  useNotificationStore,
} from '@/stores/realtime/useNotificationStore';

describe('notification store boundaries', () => {
  beforeEach(() => {
    useNotificationStore.getState().clearAll();
  });

  afterEach(() => {
    useNotificationStore.getState().clearAll();
  });

  it('normalizes notification text, timestamp, and read state before storage', () => {
    const normalized = normalizeNotification({
      id: ' notification-1 ',
      type: 'info',
      title: ' Hello\nworld ',
      message: ' Message\tbody ',
      createdAt: '2026-07-03T00:00:00.000Z',
      read: 'yes' as unknown as boolean,
    });

    expect(normalized).toMatchObject({
      id: 'notification-1',
      type: 'info',
      title: 'Hello world',
      message: 'Message body',
      createdAt: '2026-07-03T00:00:00.000Z',
      read: false,
    });
  });

  it('drops malformed notifications before upsert persistence', () => {
    useNotificationStore.getState().upsertNotifications([
      {
        id: 'valid-1',
        type: 'success',
        title: 'Valid',
        message: 'Stored',
        createdAt: '2026-07-03T00:00:00.000Z',
        read: false,
      },
      {
        id: 'bad-1',
        type: 'unknown' as never,
        title: 'Bad',
        message: 'Dropped',
        createdAt: '2026-07-03T00:00:00.000Z',
        read: false,
      },
    ]);

    expect(useNotificationStore.getState().notifications).toEqual([
      {
        id: 'valid-1',
        type: 'success',
        title: 'Valid',
        message: 'Stored',
        createdAt: '2026-07-03T00:00:00.000Z',
        read: false,
        payload: undefined,
        sourceId: undefined,
      },
    ]);
    expect(useNotificationStore.getState().unreadCount).toBe(1);
  });

  it('does not add malformed notifications through addNotification', () => {
    const id = useNotificationStore.getState().addNotification({
      type: 'info',
      title: '',
      message: 'Missing title',
    });

    expect(id).toBe('');
    expect(useNotificationStore.getState().notifications).toEqual([]);
  });
});
