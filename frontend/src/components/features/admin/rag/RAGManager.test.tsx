import { render, screen } from '@testing-library/react';
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

  it('shows index status errors instead of the generic unavailable state', async () => {
    mockGetCollectionStatus.mockResolvedValue({
      ok: false,
      error: 'Index status unavailable',
    });

    render(<RAGManager />);

    expect(await screen.findByText('Index status unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Unable to fetch index status.')).not.toBeInTheDocument();
  });
});
