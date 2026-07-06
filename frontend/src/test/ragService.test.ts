import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  checkRAGHealth,
  generateEmbeddings,
  semanticSearch,
} from '@/services/discovery/rag';

const mocks = vi.hoisted(() => ({
  getAuthHeadersAsync: vi.fn(),
}));

vi.mock('@/utils/network/apiBase', () => ({
  getApiBaseUrl: () => 'https://api.example.com/',
}));

vi.mock('@/stores/session/useAuthStore', () => ({
  getAuthHeadersAsync: mocks.getAuthHeadersAsync,
}));

describe('RAG service', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthHeadersAsync.mockResolvedValue({
      Authorization: 'Bearer admin-token',
      'Content-Type': 'application/json',
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes validated semantic search backend rows', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          results: [
            {
              id: 'chunk-1',
              document: 'retrieved paragraph',
              metadata: { title: 'RAG post', tags: ['ai'] },
              distance: 0.25,
              snippet: 'retrieved',
              ignored: 'preserved',
            },
          ],
        },
      }),
    });

    await expect(semanticSearch('retrieval')).resolves.toEqual({
      ok: true,
      data: {
        query: 'retrieval',
        total: 1,
        results: [
          {
            id: 'chunk-1',
            content: 'retrieved paragraph',
            document: 'retrieved paragraph',
            metadata: { title: 'RAG post', tags: ['ai'] },
            score: 0.75,
            distance: 0.25,
            snippet: 'retrieved',
            ignored: 'preserved',
          },
        ],
      },
    });
  });

  it('rejects malformed semantic search result rows', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          query: 'retrieval',
          total: 1,
          results: [
            {
              id: 'chunk-1',
              document: 'retrieved paragraph',
              metadata: { title: 'RAG post' },
              distance: '0.25',
            },
          ],
        },
      }),
    });

    await expect(semanticSearch('retrieval')).resolves.toEqual({
      ok: false,
      error: {
        message: 'Invalid response from RAG search API',
        code: 'PARSE_ERROR',
      },
    });

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          query: 'retrieval',
          total: 1,
          results: [
            {
              id: 'chunk%09tab',
              document: 'retrieved paragraph',
              metadata: { title: 'RAG post' },
              distance: 0.25,
            },
          ],
        },
      }),
    });

    await expect(semanticSearch('retrieval')).resolves.toEqual({
      ok: false,
      error: {
        message: 'Invalid response from RAG search API',
        code: 'PARSE_ERROR',
      },
    });
  });

  it('returns validated embedding responses', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          embeddings: [
            [0.1, 0.2],
            [0.3, 0.4],
          ],
          model: 'text-embedding-3-small',
          ignored: 'value',
        },
      }),
    });

    await expect(generateEmbeddings(['one', 'two'])).resolves.toEqual({
      ok: true,
      data: {
        embeddings: [
          [0.1, 0.2],
          [0.3, 0.4],
        ],
        model: 'text-embedding-3-small',
      },
    });
  });

  it('rejects malformed embedding vectors', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          embeddings: [[0.1, Number.POSITIVE_INFINITY]],
          model: 'text-embedding-3-small',
        },
      }),
    });

    await expect(generateEmbeddings(['one'])).resolves.toEqual({
      ok: false,
      error: {
        message: 'Invalid response from RAG embed API',
        code: 'PARSE_ERROR',
      },
    });
  });

  it('returns validated RAG health responses', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          status: 'ok',
          chromadb: true,
          embedding: true,
          timestamp: '2026-07-03T00:00:00.000Z',
          ignored: 'value',
        },
      }),
    });

    await expect(checkRAGHealth()).resolves.toEqual({
      ok: true,
      data: {
        status: 'ok',
        chromadb: true,
        embedding: true,
        timestamp: '2026-07-03T00:00:00.000Z',
      },
    });
  });

  it('rejects malformed RAG health responses', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          status: 'degraded',
          chromadb: true,
          embedding: true,
          timestamp: '2026-07-03T00:00:00.000Z',
        },
      }),
    });

    await expect(checkRAGHealth()).resolves.toEqual({
      ok: false,
      error: {
        message: 'Invalid response from RAG health API',
        code: 'PARSE_ERROR',
      },
    });
  });
});
