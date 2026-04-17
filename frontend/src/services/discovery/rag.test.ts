import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetAuthHeadersAsync, mockSearchPosts } = vi.hoisted(() => ({
  mockGetAuthHeadersAsync: vi.fn(),
  mockSearchPosts: vi.fn(),
}));

vi.mock('@/utils/network/apiBase', () => ({
  getApiBaseUrl: () => 'https://api.example.com',
}));

vi.mock('@/stores/session/useAuthStore', () => ({
  getAuthHeadersAsync: mockGetAuthHeadersAsync,
}));

vi.mock('@/services/content/postService', () => ({
  PostService: {
    searchPosts: mockSearchPosts,
  },
}));

vi.mock('./synonyms', () => ({
  expandQueryWithSynonyms: (query: string) => [query],
  getRelatedKeywords: () => [],
}));

vi.mock('@/config/defaults', () => ({
  RAG_DEFAULTS: {
    CONTEXT_MAX_TOKENS: 4096,
    CONTEXT_TIMEOUT_MS: 5000,
  },
}));

import { deleteFromIndex, getCollections, indexDocuments } from './rag';

describe('admin rag API helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchPosts.mockResolvedValue([]);
  });

  it('fails fast when admin auth headers are unavailable', async () => {
    mockGetAuthHeadersAsync.mockResolvedValue({ 'Content-Type': 'application/json' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await getCollections();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, error: 'Not authenticated. Please log in again.' });
  });

  it('injects authorization for document indexing requests', async () => {
    mockGetAuthHeadersAsync.mockResolvedValue({
      'Content-Type': 'application/json',
      Authorization: 'Bearer admin-token',
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { indexed: 1, collection: 'posts' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await indexDocuments([{ id: 'doc-1', content: 'hello world' }], 'posts');

    expect(fetchSpy).toHaveBeenCalledWith('https://api.example.com/api/v1/rag/index', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-token',
      },
      body: JSON.stringify({
        documents: [{ id: 'doc-1', content: 'hello world' }],
        collection: 'posts',
      }),
    });
    expect(result).toEqual({ ok: true, data: { indexed: 1, collection: 'posts' } });
  });

  it('injects authorization for index delete requests', async () => {
    mockGetAuthHeadersAsync.mockResolvedValue({
      'Content-Type': 'application/json',
      Authorization: 'Bearer admin-token',
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { deleted: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await deleteFromIndex('doc-1', 'posts');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/rag/index/doc-1?collection=posts',
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-token',
        },
      }
    );
    expect(result).toEqual({ ok: true });
  });
});
