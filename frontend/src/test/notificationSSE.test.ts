import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const addNotification = vi.fn();

vi.mock('@/stores/realtime/useNotificationStore', () => ({
  addNotification,
}));

describe('notification SSE strict id handling', () => {
  beforeEach(() => {
    addNotification.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('drops notification events that do not include a stable notificationId', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { handleNotificationEvent } = await import('@/services/realtime/notificationSSE');

    handleNotificationEvent({
      title: 'Missing ID',
      message: 'Should not reach the store',
    });

    expect(addNotification).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('forwards notification events with a stable notificationId to the store', async () => {
    const { handleNotificationEvent } = await import('@/services/realtime/notificationSSE');

    handleNotificationEvent({
      notificationId: 'nin-1',
      title: 'With ID',
      message: 'Stored',
      sourceId: 'source-1',
    });

    expect(addNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'nin-1',
        title: 'With ID',
        sourceId: 'source-1',
      })
    );
  });
});
