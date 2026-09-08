import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import {
  RefreshCw,
  Search,
  Database,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import {
  checkRAGHealth,
  semanticSearch,
  getCollections,
  getCollectionStatus,
  type RAGSearchResult,
  type RAGCollection,
} from '@/services/discovery/rag';

interface HealthStatus {
  embedding: { ok: boolean; error?: string };
  chroma: { ok: boolean; error?: string };
}

const RAG_SELECTOR_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function decodeSelector(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function normalizeRAGSelector(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const decoded = decodeSelector(trimmed);
  if (!decoded) return null;

  if ([trimmed, decoded].some((candidate) => /[\r\n\\/]/.test(candidate))) {
    return null;
  }

  return RAG_SELECTOR_PATTERN.test(trimmed) ? trimmed : null;
}

function normalizeDisplayText(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const decoded = decodeSelector(value);
  if (!decoded || /[\u0000-\u001F\u007F]/.test(decoded)) return fallback;
  const cleaned = value
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

function normalizeCollection(collection: RAGCollection): RAGCollection | null {
  const name = normalizeRAGSelector(collection.name);
  if (!name) return null;
  return { ...collection, name };
}

function isRAGCollection(collection: RAGCollection | null): collection is RAGCollection {
  return collection !== null;
}

function RAGHealthSection() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await checkRAGHealth();
      if (response.ok && response.data) {
        setHealth({
          embedding: { ok: response.data.embedding },
          chroma: { ok: response.data.chromadb },
        });
      } else {
        const raw = response as unknown as { services?: { embedding: { ok: boolean }; chroma: { ok: boolean } } };
        if (raw.services) {
          setHealth({
            embedding: raw.services.embedding,
            chroma: raw.services.chroma,
          });
        } else {
          setHealth(null);
          setError(response.error?.message || 'Failed to fetch RAG health');
        }
      }
    } catch (err) {
      setHealth(null);
      setError(err instanceof Error ? err.message : 'Failed to fetch RAG health');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-ui-line">
      <span className="text-xs font-semibold text-ui-text">RAG Service Health</span>
      <div className="flex items-center gap-4">
        {loading ? (
          <RefreshCw className="h-3 w-3 animate-spin text-ui-muted" />
        ) : health ? (
          <>
            <span className="flex items-center gap-1 text-xs">
              {health.embedding.ok ? (
                <CheckCircle className="h-3 w-3 text-emerald-600" />
              ) : (
                <XCircle className="h-3 w-3 text-red-600" />
              )}
              <span className={health.embedding.ok ? 'text-emerald-600' : 'text-red-600'}>
                Embedding
              </span>
            </span>
            <span className="flex items-center gap-1 text-xs">
              {health.chroma.ok ? (
                <CheckCircle className="h-3 w-3 text-emerald-600" />
              ) : (
                <XCircle className="h-3 w-3 text-red-600" />
              )}
              <span className={health.chroma.ok ? 'text-emerald-600' : 'text-red-600'}>
                ChromaDB
              </span>
            </span>
          </>
        ) : error ? (
          <span className="flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="h-3 w-3" />
            {error}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="h-3 w-3" />
            Unreachable
          </span>
        )}
        <button
          type="button"
          onClick={fetchHealth}
          disabled={loading}
          aria-label="Refresh RAG health"
          title="Refresh RAG health"
          className="h-7 w-7 flex items-center justify-center rounded-md border border-ui-line text-ui-muted hover:text-ui-text hover:bg-ui-soft transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3 w-3 ${loading ? 'animate-spin' : ''}  `}
            aria-hidden="true"
          />
        </button>
      </div>
    </div>
  );
}

function CollectionsSection() {
  const [collections, setCollections] = useState<RAGCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [collectionStats, setCollectionStats] = useState<{ count: number; exists: boolean } | null>(null);

  const fetchCollections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getCollections();
      if (response.ok && response.data) {
        setCollections(response.data.collections.map(normalizeCollection).filter(isRAGCollection));
      } else {
        setCollections([]);
        setError(response.error || 'Failed to fetch collections');
      }
    } catch (err) {
      setCollections([]);
      setError(err instanceof Error ? err.message : 'Failed to fetch collections');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  const handleSelectCollection = async (name: string) => {
    const collectionName = normalizeRAGSelector(name);
    if (!collectionName) return;
    setSelectedCollection(collectionName);
    try {
      const status = await getCollectionStatus(collectionName);
      if (status.ok && status.data) {
        setCollectionStats({ count: status.data.count, exists: status.data.exists });
      }
    } catch {
      setCollectionStats(null);
    }
  };

  return (
    <div className="bg-ui-surface border border-ui-line rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-ui-line">
        <div className="flex items-center gap-2">
          <Database className="h-3.5 w-3.5 text-ui-muted" />
          <span className="text-xs font-semibold text-ui-text">Collections</span>
        </div>
        <button
          type="button"
          onClick={fetchCollections}
          disabled={loading}
          aria-label="Refresh RAG collections"
          title="Refresh RAG collections"
          className="h-7 w-7 flex items-center justify-center rounded-md border border-ui-line text-ui-muted hover:text-ui-text hover:bg-ui-soft transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3 w-3 ${loading ? 'animate-spin' : ''}  `}
            aria-hidden="true"
          />
        </button>
      </div>
      <div className="px-4 py-3">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-ui-muted">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Loading...
          </div>
        ) : error ? (
          <p className="text-xs text-red-600">{error}</p>
        ) : collections.length === 0 ? (
          <p className="text-xs text-ui-muted">No collections found.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {collections.map((col) => (
                <button
                  type="button"
                  key={col.name}
                  onClick={() => handleSelectCollection(col.name)}
                  className={`font-mono text-xs px-2 py-0.5 rounded border transition-colors ${
                    selectedCollection === col.name
                      ? "bg-ui-text text-white border-ui-line"
                      : "bg-ui-soft text-ui-muted border-ui-line hover:border-ui-line"
                  }  `}
                >
                  {col.name}
                </button>
              ))}
            </div>
            {selectedCollection && collectionStats && (
              <div className="flex items-center gap-4 px-3 py-2 bg-ui-soft border border-ui-line rounded-md">
                <span className="font-mono text-xs text-ui-muted">{selectedCollection}</span>
                <span className="text-xs text-ui-muted">
                  {collectionStats.count.toLocaleString()} documents
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function IndexStatusSection() {
  const [status, setStatus] = useState<{ count: number; collection: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getCollectionStatus();
      if (response.ok && response.data) {
        setStatus({
          count: response.data.count,
          collection: response.data.collection,
        });
      } else {
        setStatus(null);
        setError(response.error || 'Failed to fetch index status');
      }
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : 'Failed to fetch index status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return (
    <div className="bg-ui-surface border border-ui-line rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-ui-line">
        <FileText className="h-3.5 w-3.5 text-ui-muted" />
        <span className="text-xs font-semibold text-ui-text">Index Status</span>
      </div>
      <div className="px-4 py-3">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-ui-muted">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Loading...
          </div>
        ) : error ? (
          <p className="text-xs text-red-600">{error}</p>
        ) : status ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-px border border-ui-line rounded-md overflow-hidden">
              <div className="px-3 py-2 bg-ui-soft">
                <p className="text-xs text-ui-muted">Documents</p>
                <p className="text-sm font-semibold text-ui-text">{status.count.toLocaleString()}</p>
              </div>
              <div className="px-3 py-2 bg-ui-soft">
                <p className="text-xs text-ui-muted">Collection</p>
                <p className="font-mono text-xs text-ui-muted truncate">{status.collection}</p>
              </div>
            </div>
            <p className="text-xs text-ui-muted">
              Re-indexing via{' '}
              <span className="font-mono text-ui-muted bg-ui-soft px-1 py-0.5 rounded">
                scripts/rag/index_posts.py
              </span>
            </p>
          </div>
        ) : (
          <p className="text-xs text-ui-muted">Unable to fetch index status.</p>
        )}
      </div>
    </div>
  );
}

function SearchTesterSection() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RAGSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (loading) return;
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await semanticSearch(query, { n_results: 5 });
      if (response.ok && response.data) {
        setResults(response.data.results);
      } else {
        setError(response.error?.message || 'Search failed');
        setResults([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-ui-surface border border-ui-line rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-ui-line">
        <Search className="h-3.5 w-3.5 text-ui-muted" />
        <span className="text-xs font-semibold text-ui-text">Semantic Search Tester</span>
      </div>
      <div className="px-4 py-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Input
            aria-label="RAG 검색어"
            placeholder="Enter search query..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSearch();
            }}
            className="ui-input h-8 text-sm rounded-md border-ui-line min-w-0 flex-[1_1_200px]"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md bg-ui-text hover:bg-ui-text text-white transition-colors disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              <Search className="h-3 w-3" />
            )}
            Search
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-600">{error}</p>
        )}

        {results.length > 0 && (
          <div className="border border-ui-line rounded-md overflow-hidden">
            <div className="grid grid-cols-12 px-3 py-2 bg-ui-soft border-b border-ui-line">
              <span className="col-span-2 text-xs text-ui-muted">Score</span>
              <span className="col-span-7 text-xs text-ui-muted">Document</span>
              <span className="col-span-3 text-xs text-ui-muted">Category</span>
            </div>
            <div className="divide-y divide-zinc-100">
              {results.map((result, idx) => (
                <div key={`${result.metadata.title ?? ''}-${idx}`} className="grid grid-cols-12 px-3 py-2.5 items-start hover:bg-ui-soft">
                  <div className="col-span-2">
                    <span
                      className={`font-mono text-xs px-1 py-0.5 rounded ${
                        result.score > 0.7
                          ? 'bg-emerald-50 text-emerald-700'
                          : "bg-ui-soft text-ui-muted"
                      }  `}
                    >
                      {(result.score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="col-span-7">
                    <p className="text-xs font-medium text-ui-text">
                      {normalizeDisplayText(result.metadata.title, 'Untitled')}
                    </p>
                    <p className="text-xs text-ui-muted line-clamp-2 mt-0.5">
                      {result.content.slice(0, 150)}...
                    </p>
                  </div>
                  <span className="col-span-3 font-mono text-xs text-ui-muted bg-ui-soft px-1 py-0.5 rounded w-fit">
                    {normalizeRAGSelector(result.metadata.category) || '-'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function RAGManager() {
  return (
    <div className={["ui-admin-section ui-admin-ragmanager", ("bg-ui-surface border border-ui-line rounded-lg overflow-hidden")].filter(Boolean).join(' ')}>
      <RAGHealthSection />
      <div className="p-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <CollectionsSection />
          <IndexStatusSection />
        </div>
        <SearchTesterSection />
      </div>
    </div>
  );
}
