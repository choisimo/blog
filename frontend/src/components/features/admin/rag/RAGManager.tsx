/**
 * RAG (Retrieval-Augmented Generation) Manager
 * 
 * ChromaDB 컬렉션 관리, 시맨틱 검색 테스트, 문서 인덱싱 UI
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  RefreshCw,
  Search,
  Database,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Trash2,
} from 'lucide-react';
import {
  checkRAGHealth,
  semanticSearch,
  getCollections,
  getCollectionStatus,
  type RAGSearchResult,
  type RAGCollection,
} from '@/services/rag';

// ============================================================================
// Health Status Component
// ============================================================================

interface HealthStatus {
  tei: { ok: boolean; error?: string };
  chroma: { ok: boolean; error?: string };
}

function RAGHealthStatus() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const response = await checkRAGHealth();
      if (response.ok && response.data) {
        setHealth({
          tei: { ok: response.data.tei },
          chroma: { ok: response.data.chromadb },
        });
      } else {
        // Parse from the raw response format
        const raw = response as any;
        if (raw.services) {
          setHealth(raw.services);
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

  const StatusIcon = ({ ok }: { ok: boolean }) =>
    ok ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">RAG 서비스 상태</CardTitle>
            <CardDescription>TEI 임베딩 서버 및 ChromaDB 연결 상태</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchHealth} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && !health ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            상태 확인 중...
          </div>
        ) : health ? (
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <StatusIcon ok={health.tei.ok} />
              <span className="text-sm">TEI (Embedding)</span>
            </div>
            <div className="flex items-center gap-2">
              <StatusIcon ok={health.chroma.ok} />
              <span className="text-sm">ChromaDB</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-red-500">
            <AlertCircle className="h-4 w-4" />
            연결 실패
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Collections List Component
// ============================================================================

function CollectionsList() {
  const [collections, setCollections] = useState<RAGCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [collectionStats, setCollectionStats] = useState<{
    count: number;
    exists: boolean;
  } | null>(null);

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
        setCollectionStats({
          count: status.data.count,
          exists: status.data.exists,
        });
      }
    } catch {
      setCollectionStats(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4" />
              컬렉션 목록
            </CardTitle>
            <CardDescription>ChromaDB에 저장된 벡터 컬렉션</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchCollections} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            로딩 중...
          </div>
        ) : collections.length === 0 ? (
          <p className="text-sm text-muted-foreground">컬렉션이 없습니다.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {collections.map((col) => (
                <Badge
                  key={col.name}
                  variant={selectedCollection === col.name ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => handleSelectCollection(col.name)}
                >
                  {col.name}
                </Badge>
              ))}
            </div>
            {selectedCollection && collectionStats && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p>
                  <strong>{selectedCollection}</strong>
                </p>
                <p className="text-muted-foreground">
                  문서 수: {collectionStats.count.toLocaleString()}개
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Semantic Search Tester Component
// ============================================================================

function SearchTester() {
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Search className="h-4 w-4" />
          시맨틱 검색 테스트
        </CardTitle>
        <CardDescription>
          RAG 검색 정확도를 테스트합니다. 쿼리를 입력하고 유사한 문서를 검색해보세요.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="검색 쿼리 입력... (예: LLM 추론 최적화 방법)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button onClick={handleSearch} disabled={loading || !query.trim()}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        {results.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">유사도</TableHead>
                  <TableHead>제목</TableHead>
                  <TableHead className="w-24">카테고리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Badge
                        variant={result.score > 0.7 ? 'default' : 'secondary'}
                      >
                        {(result.score * 100).toFixed(0)}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {result.metadata.title || 'Untitled'}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {result.content.slice(0, 150)}...
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {result.metadata.category || '-'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Index Management Component
// ============================================================================

function IndexManager() {
  const [status, setStatus] = useState<{ count: number; collection: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getCollectionStatus();
      if (response.ok && response.data) {
        setStatus({
          count: response.data.count,
          collection: response.data.collection,
        });
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          인덱스 상태
        </CardTitle>
        <CardDescription>
          블로그 포스트 인덱스 현황. 전체 재인덱싱은 GitHub Actions를 통해 수행됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            로딩 중...
          </div>
        ) : status ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold">{status.count.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">인덱싱된 문서</p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-mono break-all">{status.collection}</p>
                <p className="text-xs text-muted-foreground">컬렉션 이름</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              * 블로그 글 인덱싱은 <code className="bg-muted px-1">scripts/rag/index_posts.py</code>를 통해 수행됩니다.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">상태를 불러올 수 없습니다.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main RAG Manager Component
// ============================================================================

export function RAGManager() {
  return (
    <div className="space-y-6">
      {/* Health Status */}
      <RAGHealthStatus />

      {/* Two column layout for collections and index */}
      <div className="grid gap-6 md:grid-cols-2">
        <CollectionsList />
        <IndexManager />
      </div>

      {/* Search Tester - Full width */}
      <SearchTester />
    </div>
  );
}
