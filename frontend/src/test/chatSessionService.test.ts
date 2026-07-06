import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  bearerAuth: vi.fn((token: string) => ({ Authorization: `Bearer ${token}` })),
}));

vi.mock('@/services/session/userContentAuth', () => ({
  getPrincipalToken: vi.fn(async () => 'principal-token'),
}));

vi.mock('@/services/chat/config', () => ({
  buildChatHeaders: vi.fn(() => ({ 'Content-Type': 'application/json' })),
  buildChatUrl: vi.fn((path: string) => `https://api.example.com/api/v1/chat${path}`),
}));

import {
  createBackendSession,
  getSessionMessagesKey,
  getStoredSessionId,
  loadSessionMessages,
  loadSessionsIndex,
  SESSION_ID_KEY,
  SESSIONS_INDEX_KEY,
  storeSessionMessages,
  storeSessionId,
  storeSessionsIndex,
  updateSessionInIndex,
} from '@/services/chat/session';

describe('chat session service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('fails closed when backend session creation returns a blank id', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            id: '   ',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(createBackendSession('Visitor session')).rejects.toThrow(
      'Invalid session response',
    );
  });

  it('trims valid backend session ids before returning them', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            id: ' session-1 ',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(createBackendSession('Visitor session')).resolves.toBe(
      'session-1',
    );
  });

  it('normalizes backend session titles before creating sessions', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            id: 'session-1',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(createBackendSession(' Visitor session ')).resolves.toBe(
      'session-1',
    );

    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toEqual({
      title: 'Visitor session',
    });
  });

  it('rejects invalid backend session titles before network', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(createBackendSession('Visitor\r\nsession')).rejects.toThrow(
      'Invalid chat session title',
    );

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fails closed when backend session creation returns a header-breaking id', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            id: 'session-1\r\nX-Injected: yes',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(createBackendSession('Visitor session')).rejects.toThrow(
      'Invalid session response',
    );
  });

  it('normalizes chat session ids before storing and restoring them', () => {
    storeSessionId('  session-1  ');

    expect(localStorage.getItem(SESSION_ID_KEY)).toBe('session-1');
    expect(getStoredSessionId()).toBe('session-1');
  });

  it('clears polluted stored chat session ids before returning them', () => {
    localStorage.setItem(SESSION_ID_KEY, 'session-1\r\nX-Injected: yes');

    expect(getStoredSessionId()).toBeNull();
    expect(localStorage.getItem(SESSION_ID_KEY)).toBeNull();
  });

  it('rejects unsafe chat session selectors before storing them', () => {
    storeSessionId('session/1');

    expect(getStoredSessionId()).toBeNull();
    expect(localStorage.getItem(SESSION_ID_KEY)).toBeNull();

    storeSessionId('session%0a1');

    expect(getStoredSessionId()).toBeNull();
    expect(localStorage.getItem(SESSION_ID_KEY)).toBeNull();
  });

  it('does not create localStorage message keys for unsafe session ids', () => {
    expect(() => getSessionMessagesKey('session/1')).toThrow(
      'Invalid chat session id',
    );

    storeSessionMessages('session/1', [{ role: 'user', content: 'hello' }]);
    expect(loadSessionMessages('session/1')).toEqual([]);
    expect(localStorage.length).toBe(0);
  });

  it('filters polluted session index entries loaded from storage', () => {
    localStorage.setItem(
      SESSIONS_INDEX_KEY,
      JSON.stringify([
        {
          id: ' session-1 ',
          title: ' Valid session ',
          summary: ' Summary ',
          createdAt: ' 2026-07-03T00:00:00.000Z ',
          updatedAt: ' 2026-07-03T00:00:00.000Z ',
          messageCount: 2,
          mode: 'general',
        },
        {
          id: 'session-2\r\nX-Injected: yes',
          title: 'Polluted session',
          summary: '',
          createdAt: '',
          updatedAt: '',
          messageCount: 1,
          mode: 'article',
        },
        {
          id: 'session-3',
          title: 'Polluted\r\ntitle',
          summary: 'Summary',
          createdAt: '2026-07-03T00:00:00.000Z',
          updatedAt: '2026-07-03T00:00:00.000Z',
          messageCount: 1,
          mode: 'general',
        },
      ]),
    );

    expect(loadSessionsIndex()).toEqual([
      {
        id: 'session-1',
        title: 'Valid session',
        summary: 'Summary',
        createdAt: '2026-07-03T00:00:00.000Z',
        updatedAt: '2026-07-03T00:00:00.000Z',
        messageCount: 2,
        mode: 'general',
      },
      {
        id: 'session-3',
        title: 'Untitled session',
        summary: 'Summary',
        createdAt: '2026-07-03T00:00:00.000Z',
        updatedAt: '2026-07-03T00:00:00.000Z',
        messageCount: 1,
        mode: 'general',
      },
    ]);
  });

  it('normalizes session index entries before storing them', () => {
    storeSessionsIndex([
      {
        id: ' session-1 ',
        title: ' Session title ',
        summary: ' Session summary ',
        createdAt: ' created ',
        updatedAt: ' updated ',
        messageCount: -1,
        mode: 'article',
      },
    ]);

    expect(JSON.parse(localStorage.getItem(SESSIONS_INDEX_KEY) ?? '[]')).toEqual([
      {
        id: 'session-1',
        title: 'Session title',
        summary: 'Session summary',
        createdAt: 'created',
        updatedAt: 'updated',
        messageCount: 0,
        mode: 'article',
      },
    ]);
  });

  it('does not add invalid session metadata to the index', () => {
    storeSessionsIndex([]);

    const sessions = updateSessionInIndex({
      id: 'bad-session\r\nX-Injected: yes',
      title: 'Bad session',
      summary: '',
      createdAt: '',
      updatedAt: '',
      messageCount: 0,
      mode: 'general',
    });

    expect(sessions).toEqual([]);
    expect(loadSessionsIndex()).toEqual([]);
  });
});
