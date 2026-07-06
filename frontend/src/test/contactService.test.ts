import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/network/apiBase', () => ({
  getApiBaseUrl: vi.fn(() => 'https://api.example.com'),
}));

import { sendContactMessage } from '@/services/engagement/contact';

describe('contact service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('rejects invalid contact payloads before network', async () => {
    vi.stubEnv('VITE_EMAILJS_SERVICE_ID', '');
    vi.stubEnv('VITE_EMAILJS_TEMPLATE_ID', '');
    vi.stubEnv('VITE_EMAILJS_PUBLIC_KEY', '');
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    await expect(
      sendContactMessage({
        name: 'Ada\u0000Lovelace',
        email: 'ada@example.com',
        subject: 'Hello',
        message: 'Can we talk?',
      }),
    ).rejects.toThrow('Invalid contact name.');

    await expect(
      sendContactMessage({
        name: 'Ada',
        email: 'not-an-email',
        subject: 'Hello',
        message: 'Can we talk?',
      }),
    ).rejects.toThrow('Invalid contact email.');

    await expect(
      sendContactMessage({
        name: 'Ada',
        email: 'ada@example.com',
        subject: 'Hello\r\nBcc: audit@example.com',
        message: 'Can we talk?',
      }),
    ).rejects.toThrow('Invalid contact subject.');

    await expect(
      sendContactMessage({
        name: 'Ada',
        email: 'ada@example.com',
        subject: 'Hello',
        message: ' \n\t ',
      }),
    ).rejects.toThrow('Invalid contact message.');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normalizes contact payloads before sending to the API fallback', async () => {
    vi.stubEnv('VITE_EMAILJS_SERVICE_ID', '');
    vi.stubEnv('VITE_EMAILJS_TEMPLATE_ID', '');
    vi.stubEnv('VITE_EMAILJS_PUBLIC_KEY', '');

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));

    await expect(
      sendContactMessage({
        name: ' Ada ',
        email: ' ada@example.com ',
        subject: ' Hello ',
        message: ' First line\r\nSecond\u0000line ',
      }),
    ).resolves.toEqual({ provider: 'api' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/contact',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'Ada',
          email: 'ada@example.com',
          subject: 'Hello',
          message: 'First line\nSecond line',
        }),
      }),
    );
  });

  it('surfaces plain-text API error responses', async () => {
    vi.stubEnv('VITE_EMAILJS_SERVICE_ID', '');
    vi.stubEnv('VITE_EMAILJS_TEMPLATE_ID', '');
    vi.stubEnv('VITE_EMAILJS_PUBLIC_KEY', '');

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Contact rate limit exceeded', { status: 429 }),
    );

    await expect(
      sendContactMessage({
        name: 'Ada',
        email: 'ada@example.com',
        subject: 'Hello',
        message: 'Can we talk?',
      }),
    ).rejects.toThrow('Contact rate limit exceeded');
  });

  it('sanitizes structured API error messages before throwing', async () => {
    vi.stubEnv('VITE_EMAILJS_SERVICE_ID', '');
    vi.stubEnv('VITE_EMAILJS_TEMPLATE_ID', '');
    vi.stubEnv('VITE_EMAILJS_PUBLIC_KEY', '');

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            message: ' Rate\u0000\nlimit exceeded ',
          },
        }),
        { status: 429 },
      ),
    );

    await expect(
      sendContactMessage({
        name: 'Ada',
        email: 'ada@example.com',
        subject: 'Hello',
        message: 'Can we talk?',
      }),
    ).rejects.toThrow('Rate limit exceeded');
  });
});
