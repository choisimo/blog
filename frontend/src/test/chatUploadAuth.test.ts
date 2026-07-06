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

  it('fails closed when chat image upload returns a blank URL', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            url: '   ',
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

    await expect(
      uploadChatImage(new File(['png'], 'chat.png', { type: 'image/png' })),
    ).rejects.toMatchObject({
      code: 'PARSE_ERROR',
      message: 'Invalid chat image upload response',
    });
  });

  it('fails closed before upload when the chat image file is empty', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 500 }),
    );

    const { uploadChatImage } = await import('@/services/chat/api');

    await expect(
      uploadChatImage(new File([], 'chat.png', { type: 'image/png' })),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Invalid chat image file',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fails closed before upload when the chat image filename contains line endings', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 500 }),
    );

    const { uploadChatImage } = await import('@/services/chat/api');

    await expect(
      uploadChatImage(
        new File(['png'], 'chat.png\r\nX-Injected: yes', {
          type: 'image/png',
        }),
      ),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Invalid chat image file',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('normalizes valid chat image upload response fields', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            url: ' https://cdn.example.com/image.png ',
            key: ' ai-chat/2026/image.png ',
            size: 3,
            contentType: ' image/png ',
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

    await expect(
      uploadChatImage(new File(['png'], 'chat.png', { type: 'image/png' })),
    ).resolves.toMatchObject({
      url: 'https://cdn.example.com/image.png',
      key: 'ai-chat/2026/image.png',
      size: 3,
      contentType: 'image/png',
    });
  });

  it('fails closed when chat image upload returns an unsafe URL', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            url: 'javascript:alert(1)',
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

    await expect(
      uploadChatImage(new File(['png'], 'chat.png', { type: 'image/png' })),
    ).rejects.toMatchObject({
      code: 'PARSE_ERROR',
      message: 'Invalid chat image upload response',
    });
  });

  it('fails closed when chat image upload returns a header-breaking key', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            url: 'https://cdn.example.com/image.png',
            key: 'ai-chat/2026/image.png\r\nX-Injected: yes',
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

    await expect(
      uploadChatImage(new File(['png'], 'chat.png', { type: 'image/png' })),
    ).rejects.toMatchObject({
      code: 'PARSE_ERROR',
      message: 'Invalid chat image upload response',
    });
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

  it('does not allow chat feed request headers to override the principal bearer token', async () => {
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

    await invokeLensFeed(
      { paragraph: 'hello', postTitle: 'debug' },
      { headers: { Authorization: 'Bearer caller-token' } },
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/chat/session/session-1/lens-feed',
      expect.objectContaining({
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

  it('rejects unsafe streamed chat idempotency keys before network', async () => {
    localStorage.setItem('nodove_chat_session_id', 'session-1');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('data: {"type":"done"}\n\n', {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    const { streamChatEvents } = await import('@/services/chat/api');
    const events: unknown[] = [];

    const consume = async () => {
      for await (const event of streamChatEvents({
        text: 'hello',
        idempotencyKey: 'chat-turn-key-1\r\nInjected',
      })) {
        events.push(event);
      }
    };

    await expect(consume()).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Invalid chat idempotency key',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it('normalizes aggregate prompts before sending them', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: { text: 'summary' },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const { invokeChatAggregate } = await import('@/services/chat/api');

    await expect(
      invokeChatAggregate({ prompt: ' Summarize\r\nthese sessions ' }),
    ).resolves.toBe('summary');
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toEqual({
      prompt: 'Summarize\nthese sessions',
    });
  });
});
