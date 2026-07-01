import { afterEach, describe, expect, it, vi } from 'vitest';

const mockAdminFetchRaw = vi.hoisted(() => vi.fn());

vi.mock('@/utils/network/apiBase', () => ({
  getApiBaseUrl: vi.fn(() => 'https://worker.example.com'),
}));

vi.mock('@/services/admin/apiClient', () => ({
  adminFetchRaw: mockAdminFetchRaw,
}));

import {
  generatePostImages,
  getAdminAiImagesHealth,
} from '@/services/session/adminImages';

describe('admin image service', () => {
  afterEach(() => {
    mockAdminFetchRaw.mockReset();
  });

  it('generates images through the shared admin API client', async () => {
    const data = {
      dir: '/images/2026/test-post/ai',
      model: 'test-image-model',
      created: 1,
      durationMs: 25,
      usage: null,
      metadata: null,
      items: [],
    };
    mockAdminFetchRaw.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await generatePostImages(
      {
        year: 2026,
        slug: 'test-post',
        prompt: 'generate a cover image',
      },
      'expired-access-token',
    );

    expect(result).toEqual(data);
    expect(mockAdminFetchRaw).toHaveBeenCalledTimes(1);

    const [url, options] = mockAdminFetchRaw.mock.calls[0];
    expect(url).toBe('https://worker.example.com/api/v1/admin/ai-images/generate');
    expect(options).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Idempotency-Key': expect.stringMatching(/^admin-ai-image:/),
        }),
      }),
    );
    expect(JSON.parse(String(options.body))).toEqual({
      year: '2026',
      slug: 'test-post',
      prompt: 'generate a cover image',
      n: 1,
      size: '1024x1024',
      quality: 'medium',
      outputFormat: 'png',
    });
  });

  it('loads AI image health through the shared admin API client', async () => {
    const data = {
      enabled: true,
      configured: true,
      baseUrlConfigured: true,
      apiKeyConfigured: true,
      model: 'test-image-model',
      maxCount: 2,
      timeoutMs: 10000,
    };
    mockAdminFetchRaw.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await getAdminAiImagesHealth('expired-access-token');

    expect(result).toEqual(data);
    expect(mockAdminFetchRaw).toHaveBeenCalledWith(
      'https://worker.example.com/api/v1/admin/ai-images/health',
    );
  });
});
