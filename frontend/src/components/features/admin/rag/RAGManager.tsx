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

function RAGHealthSection() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
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
        }
      }
    } catch {
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
      <span className="text-xs font-semibold text-zinc-700">RAG Service Health</span>
      <div className="flex items-center gap-4">
        {loading ? (
          <RefreshCw className="h-3 w-3 animate-spin text-zinc-400" />
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
          className="h-7 w-7 flex items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
}

function CollectionsSection() {
  const [collections, setCollections] = useState<RAGCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [collectionStats, setCollectionStats] = useState<{ count: number; exists: boolean } | null>(null);

  const fetchCollections = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getCollections();
      if (response.ok && response.data) {
        setCollections(response.data.collections);
      }
    } catch {
      setCollections([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  const handleSelectCollection = async (name: string) => {
    setSelectedCollection(name);
    try {
      const status = await getCollectionStatus(name);
      if (status.ok && status.data) {
        setCollectionStats({ count: status.data.count, exists: status.data.exists });
      }
    } catch {
      setCollectionStats(null);
    }
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <Database className="h-3.5 w-3.5 text-zinc-500" />
          <span className="text-xs font-semibold text-zinc-700">Collections</span>
        </div>
        <button
          type="button"
          onClick={fetchCollections}
          disabled={loading}
          className="h-7 w-7 flex items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="px-4 py-3">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Loading...
          </div>
        ) : collections.length === 0 ? (
          <p className="text-xs text-zinc-400">No collections found.</p>
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
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-zinc-100 text-zinc-600 border-zinc-200 hover:border-zinc-400'
                  }`}
                >
                  {col.name}
                </button>
              ))}
            </div>
            {selectedCollection && collectionStats && (
              <div className="flex items-center gap-4 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-md">
                <span className="font-mono text-xs text-zinc-600">{selectedCollection}</span>
                <span className="text-xs text-zinc-400">
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

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getCollectionStatus();
      if (response.ok && response.data) {
        setStatus({ count: response.data.count, collection: response.data.collection });
      }
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100">
        <FileText className="h-3.5 w-3.5 text-zinc-500" />
        <span className="text-xs font-semibold text-zinc-700">Index Status</span>
      </div>
      <div className="px-4 py-3">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Loading...
          </div>
        ) : status ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-px border border-zinc-100 rounded-md overflow-hidden">
              <div className="px-3 py-2 bg-zinc-50">
                <p className="text-xs text-zinc-400">Documents</p>
                <p className="text-sm font-semibold text-zinc-800">{status.count.toLocaleString()}</p>
              </div>
              <div className="px-3 py-2 bg-zinc-50">
                <p className="text-xs text-zinc-400">Collection</p>
                <p className="font-mono text-xs text-zinc-600 truncate">{status.collection}</p>
              </div>
            </div>
            <p className="text-xs text-zinc-400">
              Re-indexing via{' '}
              <span className="font-mono text-zinc-600 bg-zinc-100 px-1 py-0.5 rounded">
                scripts/rag/index_posts.py
              </span>
            </p>
          </div>
        ) : (
          <p className="text-xs text-zinc-400">Unable to fetch index status.</p>
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
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100">
        <Search className="h-3.5 w-3.5 text-zinc-500" />
        <span className="text-xs font-semibold text-zinc-700">Semantic Search Tester</span>
      </div>
      <div className="px-4 py-3 space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Enter search query..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="h-8 text-sm rounded-md border-zinc-200 flex-1"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md bg-zinc-900 hover:bg-zinc-800 text-white transition-colors disabled:opacity-50"
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
          <div className="border border-zinc-200 rounded-md overflow-hidden">
            <div className="grid grid-cols-12 px-3 py-2 bg-zinc-50 border-b border-zinc-100">
              <span className="col-span-2 text-xs text-zinc-400">Score</span>
              <span className="col-span-7 text-xs text-zinc-400">Document</span>
              <span className="col-span-3 text-xs text-zinc-400">Category</span>
            </div>
            <div className="divide-y divide-zinc-100">
              {results.map((result, idx) => (
                <div key={`${result.metadata.title ?? ''}-${idx}`} className="grid grid-cols-12 px-3 py-2.5 items-start hover:bg-zinc-50">
                  <div className="col-span-2">
                    <span
                      className={`font-mono text-xs px-1 py-0.5 rounded ${
                        result.score > 0.7
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-zinc-100 text-zinc-500'
                      }`}
                    >
                      {(result.score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="col-span-7">
                    <p className="text-xs font-medium text-zinc-800">
                      {result.metadata.title || 'Untitled'}
                    </p>
                    <p className="text-xs text-zinc-400 line-clamp-2 mt-0.5">
                      {result.content.slice(0, 150)}...
                    </p>
                  </div>
                  <span className="col-span-3 font-mono text-xs text-zinc-400 bg-zinc-100 px-1 py-0.5 rounded w-fit">
                    {result.metadata.category || '-'}
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
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
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
