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

import {
  deleteFromIndex,
  getCollectionStatus,
  getCollections,
  indexDocuments,
  semanticSearch,
} from './rag';

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

  it('normalizes non-2xx collection backend errors at the service boundary', async () => {
    mockGetAuthHeadersAsync.mockResolvedValue({
      'Content-Type': 'application/json',
      Authorization: 'Bearer admin-token',
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: 'Collections unavailable\r\nRetry later' } }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const result = await getCollections();

    expect(fetchSpy).toHaveBeenCalledWith('https://api.example.com/api/v1/rag/collections', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-token',
      },
    });
    expect(result).toEqual({ ok: false, error: 'Collections unavailable Retry later' });
  });

  it('preserves a valid empty collection success envelope', async () => {
    mockGetAuthHeadersAsync.mockResolvedValue({
      'Content-Type': 'application/json',
      Authorization: 'Bearer admin-token',
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { collections: [], total: 0 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(getCollections()).resolves.toEqual({
      ok: true,
      data: { collections: [], total: 0 },
    });
  });

  it.each([
    {
      name: 'missing collection array',
      payload: { ok: true, data: { total: 0 } },
    },
    {
      name: 'non-object collection row',
      payload: { ok: true, data: { collections: [null], total: 1 } },
    },
    {
      name: 'collection row without a string name',
      payload: { ok: true, data: { collections: [{}], total: 1 } },
    },
    {
      name: 'non-numeric total',
      payload: { ok: true, data: { collections: [], total: '0' } },
    },
  ])('rejects a malformed 2xx success envelope with $name', async ({ payload }) => {
    mockGetAuthHeadersAsync.mockResolvedValue({
      'Content-Type': 'application/json',
      Authorization: 'Bearer admin-token',
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(getCollections()).resolves.toEqual({
      ok: false,
      error: 'Invalid response from RAG collections API',
    });
  });

  it.each([
    {
      name: 'admin header acquisition',
      arrange: () => {
        mockGetAuthHeadersAsync.mockRejectedValue(
          new Error('Header acquisition failed\r\nwith unsafe detail'),
        );
      },
      expected: 'Header acquisition failed with unsafe detail',
    },
    {
      name: 'native fetch',
      arrange: () => {
        mockGetAuthHeadersAsync.mockResolvedValue({
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-token',
        });
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(
          new Error('Collection request failed\r\nwith unsafe detail'),
        );
      },
      expected: 'Collection request failed with unsafe detail',
    },
    {
      name: 'JSON parsing',
      arrange: () => {
        mockGetAuthHeadersAsync.mockResolvedValue({
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-token',
        });
        const response = new Response('{}', { status: 200 });
        vi.spyOn(response, 'json').mockRejectedValue(
          new Error('Collection JSON invalid\r\nwith unsafe detail'),
        );
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
      },
      expected: 'Collection JSON invalid with unsafe detail',
    },
  ])('normalizes $name rejection messages', async ({ arrange, expected }) => {
    arrange();

    await expect(getCollections()).resolves.toEqual({ ok: false, error: expected });
  });

  it('preserves authenticated default and selected collection status requests', async () => {
    mockGetAuthHeadersAsync.mockResolvedValue({
      'Content-Type': 'application/json',
      Authorization: 'Bearer admin-token',
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            collection: 'posts',
            exists: true,
            count: 1234,
            metadata: { source: 'chroma' },
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const expected = {
      ok: true,
      data: {
        collection: 'posts',
        exists: true,
        count: 1234,
        metadata: { source: 'chroma' },
      },
    };

    await expect(getCollectionStatus()).resolves.toEqual(expected);
    await expect(getCollectionStatus(' posts ')).resolves.toEqual(expected);
    expect(fetchSpy).toHaveBeenNthCalledWith(1, 'https://api.example.com/api/v1/rag/status', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-token',
      },
    });
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      'https://api.example.com/api/v1/rag/status?collection=posts',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-token',
        },
      },
    );
  });

  it.each([
    {
      name: 'non-2xx backend',
      status: 503,
      payload: { error: { message: 'Status unavailable\r\nRetry later' } },
      expected: 'Status unavailable Retry later',
    },
    {
      name: '2xx application',
      status: 200,
      payload: { ok: false, error: { message: 'Status denied\r\nRetry login' } },
      expected: 'Status denied Retry login',
    },
  ])('normalizes $name status errors', async ({ status, payload, expected }) => {
    mockGetAuthHeadersAsync.mockResolvedValue({
      'Content-Type': 'application/json',
      Authorization: 'Bearer admin-token',
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(getCollectionStatus()).resolves.toEqual({ ok: false, error: expected });
  });

  it.each([
    {
      name: 'admin header acquisition',
      arrange: () => {
        mockGetAuthHeadersAsync.mockRejectedValue(
          new Error('Status header acquisition failed\r\nwith unsafe detail'),
        );
      },
      expected: 'Status header acquisition failed with unsafe detail',
    },
    {
      name: 'native fetch',
      arrange: () => {
        mockGetAuthHeadersAsync.mockResolvedValue({
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-token',
        });
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(
          new Error('Status request failed\r\nwith unsafe detail'),
        );
      },
      expected: 'Status request failed with unsafe detail',
    },
    {
      name: 'JSON parsing',
      arrange: () => {
        mockGetAuthHeadersAsync.mockResolvedValue({
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-token',
        });
        const response = new Response('{}', { status: 200 });
        vi.spyOn(response, 'json').mockRejectedValue(
          new Error('Status JSON invalid\r\nwith unsafe detail'),
        );
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
      },
      expected: 'Status JSON invalid with unsafe detail',
    },
  ])('normalizes status $name rejection messages', async ({ arrange, expected }) => {
    arrange();

    await expect(getCollectionStatus()).resolves.toEqual({ ok: false, error: expected });
  });

  it.each([
    {
      name: 'missing count',
      payload: { ok: true, data: { collection: 'posts', exists: true } },
    },
    {
      name: 'non-numeric count',
      payload: { ok: true, data: { collection: 'posts', exists: true, count: '12' } },
    },
    {
      name: 'invalid collection',
      payload: { ok: true, data: { collection: 'posts%0Aevil', exists: true, count: 12 } },
    },
    {
      name: 'non-string collection',
      payload: { ok: true, data: { collection: 123, exists: true, count: 12 } },
    },
    {
      name: 'non-boolean existence flag',
      payload: { ok: true, data: { collection: 'posts', exists: 'yes', count: 12 } },
    },
  ])('rejects a malformed status success envelope with $name', async ({ payload }) => {
    mockGetAuthHeadersAsync.mockResolvedValue({
      'Content-Type': 'application/json',
      Authorization: 'Bearer admin-token',
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(getCollectionStatus()).resolves.toEqual({
      ok: false,
      error: 'Invalid response from RAG status API',
    });
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

  it('rejects polluted collection selectors before status requests', async () => {
    mockGetAuthHeadersAsync.mockResolvedValue({
      'Content-Type': 'application/json',
      Authorization: 'Bearer admin-token',
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await getCollectionStatus('posts%0Aevil');

    expect(result).toEqual({
      ok: false,
      error: 'Invalid RAG collection selector',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockGetAuthHeadersAsync).not.toHaveBeenCalled();
  });

  it('rejects polluted document selectors before index delete requests', async () => {
    mockGetAuthHeadersAsync.mockResolvedValue({
      'Content-Type': 'application/json',
      Authorization: 'Bearer admin-token',
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await deleteFromIndex('doc-1%0Aevil', 'posts');

    expect(result).toEqual({
      ok: false,
      error: 'Invalid RAG document selector',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockGetAuthHeadersAsync).not.toHaveBeenCalled();
  });

  it('normalizes index document ids and collection selectors while preserving content', async () => {
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

    await indexDocuments(
      [{ id: ' doc-1 ', content: 'hello\nworld' }],
      ' posts ',
    );

    expect(fetchSpy).toHaveBeenCalledWith('https://api.example.com/api/v1/rag/index', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-token',
      },
      body: JSON.stringify({
        documents: [{ id: 'doc-1', content: 'hello\nworld' }],
        collection: 'posts',
      }),
    });
  });

  it('clamps semantic search result counts before requests', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: { results: [], query: 'rag', total: 0 },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await semanticSearch('rag', { n_results: 500 });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/rag/search',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ query: 'rag', n_results: 50 }),
      }),
    );
  });
});
