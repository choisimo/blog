import { beforeEach, describe, expect, it, vi } from 'vitest';

const adminFetchRawMock = vi.hoisted(() => vi.fn());
const getApiBaseUrlMock = vi.hoisted(() => vi.fn(() => 'https://api.example.test'));

vi.mock('@/services/admin/apiClient', () => ({
  adminFetchRaw: adminFetchRawMock,
}));

vi.mock('@/utils/network/apiBase', () => ({
  getApiBaseUrl: getApiBaseUrlMock,
}));

import { generatePostImages, getAdminAiImagesHealth } from '@/services/session/adminImages';

function validImageData(overrides: Record<string, unknown> = {}) {
  return {
    dir: '/images/posts/2026/demo',
    model: 'image-model',
    created: 1,
    durationMs: 25,
    usage: null,
    metadata: null,
    items: [
      {
        filename: 'cover.png',
        path: '/images/posts/2026/demo/cover.png',
        url: '/images/posts/2026/demo/cover.png',
        variantWebp: null,
        alt: 'Cover image',
        markdown: '![Cover image](/images/posts/2026/demo/cover.png)',
        source: 'ai-generated',
        width: 1024,
        height: 1024,
        sizeBytes: 100,
      },
    ],
    ...overrides,
  };
}

describe('adminImages service', () => {
  beforeEach(() => {
    adminFetchRawMock.mockReset();
    getApiBaseUrlMock.mockReturnValue('https://api.example.test');
  });

  it('normalizes generate-image payload text and bounded options before POSTing', async () => {
    adminFetchRawMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: validImageData() }),
    });

    await expect(
      generatePostImages({
        year: '2026',
        slug: 'demo-post',
        prompt: ' Draw\u0000\r\ncover ',
        alt: ' Hero\u0000\nImage ',
        n: 99,
        quality: 'high',
        size: '1024x1536',
      }),
    ).resolves.toMatchObject({ dir: '/images/posts/2026/demo' });

    expect(adminFetchRawMock).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/admin/ai-images/generate',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          year: '2026',
          slug: 'demo-post',
          prompt: 'Draw \ncover',
          n: 4,
          size: '1024x1536',
          quality: 'high',
          outputFormat: 'png',
          alt: 'Hero Image',
        }),
      }),
    );
  });

  it('normalizes a rejected generation request without changing its request contract', async () => {
    adminFetchRawMock.mockRejectedValue(new Error(' Gateway\u0000\r\n unavailable '));

    await expect(
      generatePostImages({ year: '2026', slug: 'demo-post', prompt: 'Draw cover' }),
    ).rejects.toMatchObject({ message: 'Gateway unavailable' });

    expect(adminFetchRawMock).toHaveBeenCalledTimes(1);
    expect(adminFetchRawMock).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/admin/ai-images/generate',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': expect.stringMatching(/^admin-ai-image:.+$/),
        },
        body: JSON.stringify({
          year: '2026',
          slug: 'demo-post',
          prompt: 'Draw cover',
          n: 1,
          size: '1024x1024',
          quality: 'medium',
          outputFormat: 'png',
        }),
      },
    );
  });

  it.each([
    ['legacy size', { size: '1792x1024' }],
    ['legacy quality', { quality: 'hd' }],
  ])('rejects unsupported %s before calling the API', async (_label, override) => {
    await expect(
      generatePostImages({
        year: '2026',
        slug: 'demo-post',
        prompt: 'Draw cover',
        ...override,
      } as Parameters<typeof generatePostImages>[0]),
    ).rejects.toThrow(/Invalid AI image (size|quality)/);

    expect(adminFetchRawMock).not.toHaveBeenCalled();
  });

  it.each([
    ['a non-Error object', { message: 'network unavailable' }],
    ['an empty Error message', new Error('')],
    ['a control-only Error message', new Error('\u0000\n\t')],
    ['an oversized Error message', new Error('x'.repeat(1001))],
  ])('uses the generation fallback for %s', async (_label, rejection) => {
    adminFetchRawMock.mockRejectedValue(rejection);

    await expect(
      generatePostImages({ year: '2026', slug: 'demo-post', prompt: 'Draw cover' }),
    ).rejects.toMatchObject({ message: 'Failed to generate image' });
  });

  it('rejects generated image responses containing unsafe control characters', async () => {
    adminFetchRawMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: validImageData({
          items: [
            {
              filename: 'cover.png',
              path: '/images/posts/2026/demo/cover.png',
              url: '/images/posts/2026/demo/cover.png',
              variantWebp: null,
              alt: 'Bad\u0000Alt',
              markdown: '![Bad Alt](/images/posts/2026/demo/cover.png)',
              source: 'ai-generated',
            },
          ],
        }),
      }),
    });

    await expect(
      generatePostImages({ year: '2026', slug: 'demo-post', prompt: 'Draw cover' }),
    ).rejects.toThrow('AI image generation returned an invalid response');

    adminFetchRawMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: validImageData({
          items: [
            {
              filename: 'cover.png',
              path: '/images/posts/2026/demo/cover.png',
              url: '/images/posts/2026/demo/cover.png',
              variantWebp: null,
              alt: 'x\u0000',
              markdown: '![Bad Alt](/images/posts/2026/demo/cover.png)',
              source: 'ai-generated',
            },
          ],
        }),
      }),
    });

    await expect(
      generatePostImages({ year: '2026', slug: 'demo-post', prompt: 'Draw cover' }),
    ).rejects.toThrow('AI image generation returned an invalid response');
  });

  it('sanitizes API error messages before throwing', async () => {
    adminFetchRawMock.mockResolvedValue({
      ok: false,
      json: async () => ({
        ok: false,
        error: { message: ' Bad\u0000\nmessage ' },
      }),
    });

    await expect(
      generatePostImages({ year: '2026', slug: 'demo-post', prompt: 'Draw cover' }),
    ).rejects.toThrow('Bad message');

    adminFetchRawMock.mockResolvedValue({
      ok: false,
      json: async () => ({
        ok: false,
        error: { code: ' RATE\u0000\nLIMIT ' },
      }),
    });

    await expect(
      generatePostImages({ year: '2026', slug: 'demo-post', prompt: 'Draw cover' }),
    ).rejects.toThrow('RATE LIMIT');
  });

  it('rejects invalid health payload text containing control characters', async () => {
    adminFetchRawMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          enabled: true,
          configured: true,
          baseUrlConfigured: true,
          apiKeyConfigured: true,
          model: 'bad\u0000model',
          maxCount: 4,
          timeoutMs: 1000,
        },
      }),
    });

    await expect(getAdminAiImagesHealth()).rejects.toThrow(
      'AI image health returned an invalid response',
    );
  });
});
