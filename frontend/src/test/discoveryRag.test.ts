import { beforeEach, describe, expect, it, vi } from 'vitest';

const getApiBaseUrlMock = vi.hoisted(() => vi.fn(() => 'https://api.example.test'));
const getAuthHeadersAsyncMock = vi.hoisted(() => vi.fn());

vi.mock('@/utils/network/apiBase', () => ({
  getApiBaseUrl: getApiBaseUrlMock,
}));

vi.mock('@/stores/session/useAuthStore', () => ({
  getAuthHeadersAsync: getAuthHeadersAsyncMock,
}));

vi.mock('@/services/content/postService', () => ({
  PostService: {
    searchPosts: vi.fn(),
  },
}));

vi.mock('@/services/discovery/synonyms', () => ({
  expandQueryWithSynonyms: (query: string) => [query],
  getRelatedKeywords: () => [],
}));

import { generateEmbeddings, indexDocuments, semanticSearch } from '@/services/discovery/rag';

describe('discovery rag service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    getApiBaseUrlMock.mockReturnValue('https://api.example.test');
    getAuthHeadersAsyncMock.mockResolvedValue({ Authorization: 'Bearer token' });
  });

  it('normalizes search response text, metadata, tags, and query controls', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          data: {
            query: ' rag\u0000\nquery ',
            total: 1,
            results: [
              {
                id: 'result-1',
                content: ' first\u0000\r\nsecond ',
                metadata: {
                  title: ' Title\u0000\nOne ',
                  slug: 'post-one',
                  year: '2026',
                  category: ' AI\u0000 Search ',
                  tags: [' RAG\u0000\nTag ', '\u0000'],
                },
                score: 0.8,
                snippet: ' snippet\u0000\ntext ',
              },
            ],
          },
        }),
      }),
    );

    await expect(semanticSearch(' rag\u0000\nquery ')).resolves.toEqual({
      ok: true,
      data: {
        query: 'rag query',
        total: 1,
        results: [
          expect.objectContaining({
            content: 'first \nsecond',
            metadata: expect.objectContaining({
              title: 'Title One',
              category: 'AI Search',
              tags: ['RAG Tag'],
            }),
            snippet: 'snippet \ntext',
          }),
        ],
      },
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/rag/search',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ query: 'rag query', n_results: 5 }),
      }),
    );
  });

  it('normalizes embed request texts and API error messages', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: { message: ' Bad\u0000\nmessage ' } }),
      }),
    );

    await expect(generateEmbeddings([' one\u0000\r\ntwo ', '\u0000'])).resolves.toEqual({
      ok: false,
      error: { message: 'Bad message' },
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/rag/embed',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ texts: ['one \ntwo'] }),
      }),
    );
  });

  it('normalizes indexed document content before admin indexing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          data: { indexed: 1, collection: 'posts' },
        }),
      }),
    );

    await expect(
      indexDocuments([{ id: 'doc-1', content: ' body\u0000\r\ntext ' }], 'posts'),
    ).resolves.toEqual({
      ok: true,
      data: { indexed: 1, collection: 'posts' },
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/rag/index',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          documents: [{ id: 'doc-1', content: 'body \ntext' }],
          collection: 'posts',
        }),
      }),
    );
  });
});
