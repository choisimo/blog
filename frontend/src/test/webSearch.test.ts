import { beforeEach, describe, expect, it, vi } from 'vitest';

const getApiBaseUrlMock = vi.hoisted(() => vi.fn(() => 'https://api.example.test'));

vi.mock('@/utils/network/apiBase', () => ({
  getApiBaseUrl: getApiBaseUrlMock,
}));

import { checkWebSearchHealth, searchWeb } from '@/services/discovery/webSearch';

describe('webSearch service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getApiBaseUrlMock.mockReturnValue('https://api.example.test');
  });

  it('normalizes request query and bounded options before POSTing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          query: ' safe query ',
          responseTime: 10.4,
          results: [],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await searchWeb(' safe\u0000\nquery ', {
      maxResults: 100,
      searchDepth: 'advanced',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/search/web',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          query: 'safe query',
          maxResults: 20,
          searchDepth: 'advanced',
        }),
      }),
    );
  });

  it('normalizes safe results and drops unsafe result URLs from API responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          data: {
            query: ' result\u0000 query ',
            answer: ' first\nline ',
            responseTime: 12.8,
            results: [
              {
                title: ' Safe\nTitle ',
                url: 'https://example.com/path',
                snippet: ' Safe\u0000 snippet ',
                score: 1.5,
                publishedDate: ' 2026-01-01\n ',
              },
              {
                title: 'Unsafe',
                url: 'javascript:alert(1)',
                snippet: 'Bad',
                score: 0.5,
              },
            ],
          },
        }),
      }),
    );

    await expect(searchWeb('result query')).resolves.toEqual({
      query: 'result query',
      answer: 'first line',
      responseTime: 13,
      results: [
        {
          title: 'Safe Title',
          url: 'https://example.com/path',
          snippet: 'Safe snippet',
          score: 1,
          publishedDate: '2026-01-01',
        },
      ],
    });
  });

  it('rejects empty normalized queries before calling fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(searchWeb('\u0000\n')).rejects.toThrow('Web search query is required');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns false for non-ok health responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ data: { status: 'configured' } }),
      }),
    );

    await expect(checkWebSearchHealth()).resolves.toBe(false);
  });
});
