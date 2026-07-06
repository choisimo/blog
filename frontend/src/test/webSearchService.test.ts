import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { searchWeb } from '@/services/discovery/webSearch';

vi.mock('@/utils/network/apiBase', () => ({
  getApiBaseUrl: () => 'https://api.example.com',
}));

describe('web search service', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns only validated web search response fields', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          query: 'typescript',
          answer: 'Use runtime guards.',
          responseTime: 42,
          ignored: 'value',
          results: [
            {
              title: 'Runtime guards',
              url: 'https://example.com/runtime',
              snippet: 'Validate API payloads.',
              score: 0.98,
              publishedDate: '2026-07-03',
              ignored: 'value',
            },
          ],
        },
      }),
    });

    await expect(searchWeb('typescript')).resolves.toEqual({
      query: 'typescript',
      answer: 'Use runtime guards.',
      responseTime: 42,
      results: [
        {
          title: 'Runtime guards',
          url: 'https://example.com/runtime',
          snippet: 'Validate API payloads.',
          score: 0.98,
          publishedDate: '2026-07-03',
        },
      ],
    });
  });

  it('rejects malformed web search result rows', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          query: 'typescript',
          responseTime: 42,
          results: [
            {
              title: 'Runtime guards',
              url: 'https://example.com/runtime',
              snippet: 'Validate API payloads.',
              score: '0.98',
            },
          ],
        },
      }),
    });

    await expect(searchWeb('typescript')).rejects.toThrow(
      'Invalid response from web search API',
    );
  });

  it('rejects unsafe web search result URLs', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          query: 'typescript',
          responseTime: 42,
          results: [
            {
              title: 'Runtime guards',
              url: 'https://example.com/%09runtime',
              snippet: 'Validate API payloads.',
              score: 0.98,
            },
          ],
        },
      }),
    });

    await expect(searchWeb('typescript')).rejects.toThrow(
      'Invalid response from web search API',
    );

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          query: 'typescript',
          responseTime: 42,
          results: [
            {
              title: 'Runtime guards',
              url: 'https://user:pass@example.com/runtime',
              snippet: 'Validate API payloads.',
              score: 0.98,
            },
          ],
        },
      }),
    });

    await expect(searchWeb('typescript')).rejects.toThrow(
      'Invalid response from web search API',
    );
  });

  it('rejects malformed top-level web search data', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          query: 'typescript',
          responseTime: Number.NaN,
          results: [],
        },
      }),
    });

    await expect(searchWeb('typescript')).rejects.toThrow(
      'Invalid response from web search API',
    );
  });
});
