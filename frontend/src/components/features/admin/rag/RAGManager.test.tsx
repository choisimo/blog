import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckRAGHealth = vi.hoisted(() => vi.fn());
const mockSemanticSearch = vi.hoisted(() => vi.fn());
const mockGetCollections = vi.hoisted(() => vi.fn());
const mockGetCollectionStatus = vi.hoisted(() => vi.fn());

vi.mock('@/services/discovery/rag', () => ({
  checkRAGHealth: mockCheckRAGHealth,
  semanticSearch: mockSemanticSearch,
  getCollections: mockGetCollections,
  getCollectionStatus: mockGetCollectionStatus,
}));

import { RAGManager } from './RAGManager';

describe('RAGManager', () => {
  beforeEach(() => {
    mockCheckRAGHealth.mockReset();
    mockSemanticSearch.mockReset();
    mockGetCollections.mockReset();
    mockGetCollectionStatus.mockReset();
    mockCheckRAGHealth.mockResolvedValue({
      ok: true,
      data: {
        status: 'ok',
        chromadb: true,
        embedding: true,
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    });
    mockGetCollections.mockResolvedValue({
      ok: true,
      data: {
        collections: [],
        total: 0,
      },
    });
    mockGetCollectionStatus.mockResolvedValue({
      ok: true,
      data: {
        collection: 'posts',
        exists: true,
        count: 12,
      },
    });
  });

  it('shows collection load errors without also showing the empty state', async () => {
    mockGetCollections.mockResolvedValue({
      ok: false,
      error: 'Collections service unavailable',
    });

    render(<RAGManager />);

    expect(await screen.findByText('Collections service unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No collections found.')).not.toBeInTheDocument();
  });

  it('labels RAG refresh icon controls', async () => {
    render(<RAGManager />);

    expect(
      screen.getByRole('button', { name: 'Refresh RAG health' }),
    ).toHaveAttribute('title', 'Refresh RAG health');
    expect(
      screen.getByRole('button', { name: 'Refresh RAG collections' }),
    ).toHaveAttribute('title', 'Refresh RAG collections');
    expect(await screen.findByText('Embedding')).toBeInTheDocument();
    expect(await screen.findByText('No collections found.')).toBeInTheDocument();
    expect(await screen.findByText('Documents')).toBeInTheDocument();
  });

  it('shows health load errors instead of only the unreachable fallback', async () => {
    mockCheckRAGHealth.mockResolvedValue({
      ok: false,
      error: {
        message: 'Health service unavailable',
      },
    });

    render(<RAGManager />);

    expect(await screen.findByText('Health service unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Unreachable')).not.toBeInTheDocument();
  });

  it('shows index status errors instead of the generic unavailable state', async () => {
    mockGetCollectionStatus.mockResolvedValue({
      ok: false,
      error: 'Index status unavailable',
    });

    render(<RAGManager />);

    expect(await screen.findByText('Index status unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Unable to fetch index status.')).not.toBeInTheDocument();
  });

  it('renders a fulfilled index status count through numeric formatting', async () => {
    mockGetCollectionStatus.mockResolvedValue({
      ok: true,
      data: {
        collection: 'posts',
        exists: true,
        count: 1234,
      },
    });

    render(<RAGManager />);

    expect(await screen.findByText((1234).toLocaleString())).toBeInTheDocument();
    expect(screen.getByText('posts')).toBeInTheDocument();
  });

  it('prevents Enter key duplicate semantic searches while a search is running', async () => {
    let resolveSearch: (value: unknown) => void = () => undefined;
    mockSemanticSearch.mockReturnValue(
      new Promise((resolve) => {
        resolveSearch = resolve;
      }),
    );

    render(<RAGManager />);

    const input = screen.getByPlaceholderText('Enter search query...');
    fireEvent.change(input, { target: { value: 'vector search' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockSemanticSearch).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
    });

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockSemanticSearch).toHaveBeenCalledTimes(1);

    resolveSearch({
      ok: true,
      data: {
        results: [],
      },
    });
  });

  it('filters polluted collection selectors before rendering and status calls', async () => {
    mockGetCollections.mockResolvedValue({
      ok: true,
      data: {
        collections: [{ name: 'posts%0Aevil' }, { name: 'posts' }],
        total: 2,
      },
    });

    render(<RAGManager />);

    expect(await screen.findByRole('button', { name: 'posts' })).toBeInTheDocument();
    expect(screen.queryByText('posts%0Aevil')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'posts' }));

    await waitFor(() => {
      expect(mockGetCollectionStatus).toHaveBeenCalledWith('posts');
    });
    expect(mockGetCollectionStatus).not.toHaveBeenCalledWith('posts%0Aevil');
  });

  it('normalizes polluted RAG search result display metadata', async () => {
    mockSemanticSearch.mockResolvedValue({
      ok: true,
      data: {
        results: [
          {
            content: 'Result content',
            score: 0.9,
            metadata: {
              title: 'Title%0Aevil',
              category: 'blog%0Aevil',
            },
          },
          {
            content: 'Encoded control content',
            score: 0.8,
            metadata: {
              title: 'Title%00evil',
              category: 'docs%7F',
            },
          },
        ],
      },
    });

    render(<RAGManager />);

    fireEvent.change(screen.getByPlaceholderText('Enter search query...'), {
      target: { value: 'vector search' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('Untitled')).toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument();
    expect(screen.queryByText('Title%0Aevil')).not.toBeInTheDocument();
    expect(screen.queryByText('blog%0Aevil')).not.toBeInTheDocument();
    expect(screen.queryByText('Title%00evil')).not.toBeInTheDocument();
    expect(screen.queryByText('docs%7F')).not.toBeInTheDocument();
  });
});
