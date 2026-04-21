import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/network/apiBase', () => ({
  getApiBaseUrl: () => 'https://api.example.com',
}));

vi.mock('@/services/session/userContentAuth', () => ({
  getPrincipalToken: vi.fn(async () => 'principal-token'),
}));

describe('chat upload authentication', () => {
  afterEach(() => {
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
});
