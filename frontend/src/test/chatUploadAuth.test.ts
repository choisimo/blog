import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/network/apiBase', () => ({
  getApiBaseUrl: () => 'https://api.example.com',
}));

vi.mock('@/services/session/userContentAuth', () => ({
  getPrincipalToken: vi.fn(async () => 'principal-token'),
}));

describe('chat upload authentication', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('sends the principal bearer token with chat image uploads', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            url: 'https://cdn.example.com/image.png',
            key: 'ai-chat/2026/image.png',
            size: 3,
            contentType: 'image/png',
            imageAnalysis: null,
          },
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const { uploadChatImage } = await import('@/services/chat/api');

    await uploadChatImage(new File(['png'], 'chat.png', { type: 'image/png' }));

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/images/chat-upload',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer principal-token',
        },
      })
    );
  });

  it('sends the principal bearer token when creating chat sessions', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { id: 'session-1' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { createBackendSession } = await import('@/services/chat/session');

    await expect(createBackendSession('Visitor session')).resolves.toBe(
      'session-1'
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/chat/session',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer principal-token',
        }),
      })
    );
  });

  it('sends the principal bearer token with chat feed requests', async () => {
    localStorage.setItem('nodove_chat_session_id', 'session-1');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            items: [],
            nextCursor: null,
            exhausted: true,
            source: 'snapshot',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const { invokeLensFeed } = await import('@/services/chat/api');

    await invokeLensFeed({ paragraph: 'hello', postTitle: 'debug' });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/chat/session/session-1/lens-feed',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer principal-token',
        }),
      })
    );
  });

  it('sends an Idempotency-Key with streamed chat messages', async () => {
    localStorage.setItem('nodove_chat_session_id', 'session-1');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('data: {"type":"done"}\n\n', {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    const { streamChatEvents } = await import('@/services/chat/api');
    const events: unknown[] = [];
    for await (const event of streamChatEvents({
      text: 'hello',
      idempotencyKey: 'chat-turn-key-1',
    })) {
      events.push(event);
    }

    expect(events).toEqual([{ type: 'done' }]);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/chat/session/session-1/message',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer principal-token',
          'Idempotency-Key': 'chat-turn-key-1',
        }),
      })
    );
  });
});
