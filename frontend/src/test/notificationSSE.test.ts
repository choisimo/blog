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

  it('drops notification events with blank notification IDs', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { handleNotificationEvent } = await import('@/services/realtime/notificationSSE');

    handleNotificationEvent({
      notificationId: ' \n\t ',
      title: 'Blank ID',
      message: 'Should not reach the store',
    });

    expect(addNotification).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('trims string fields and drops malformed payloads before storing', async () => {
    const { handleNotificationEvent } = await import('@/services/realtime/notificationSSE');

    handleNotificationEvent({
      notificationId: ' nin-2 ',
      title: '  Trimmed title  ',
      message: '  Trimmed message  ',
      sourceId: ' source-2 ',
      payload: [] as unknown as Record<string, unknown>,
      createdAt: ' 2026-07-03T00:00:00.000Z ',
    });

    expect(addNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'nin-2',
        title: 'Trimmed title',
        message: 'Trimmed message',
        sourceId: 'source-2',
        createdAt: '2026-07-03T00:00:00.000Z',
      })
    );
    expect(addNotification.mock.calls[0]?.[0]).not.toHaveProperty('payload');
  });

  it('parses only object notification SSE payloads', async () => {
    const { parseSSEData } = await import('@/services/realtime/notificationSSE');

    expect(parseSSEData('{"notificationId":"nin-3","title":"Ready"}')).toEqual({
      notificationId: 'nin-3',
      title: 'Ready',
    });
    expect(parseSSEData('[]')).toBeNull();
    expect(parseSSEData('"message"')).toBeNull();
    expect(parseSSEData('null')).toBeNull();
    expect(parseSSEData('{bad json')).toBeNull();
  });
});
