/**
 * RAG (Retrieval-Augmented Generation) Service
 *
 * Hybrid search combining semantic (ChromaDB) and keyword (manifest) search
 * using Reciprocal Rank Fusion (RRF) for optimal results.
 */

import { getApiBaseUrl } from '@/utils/apiBase';
import { PostService } from './postService';
import { expandQueryWithSynonyms, getRelatedKeywords } from './synonyms';
import { RAG_DEFAULTS } from '@/config/defaults';

// ============================================================================
// Types
// ============================================================================

export interface RAGSearchResult {
  id: string;
  content: string;
  document?: string; // Backend returns 'document' field
  metadata: {
    title?: string;
    slug?: string;
    year?: string;
    category?: string;
    tags?: string[];
    [key: string]: unknown;
  };
  score: number;
  distance?: number; // Backend returns 'distance' field
  snippet?: string;
}

export interface RAGSearchResponse {
  ok: boolean;
  data?: {
    results: RAGSearchResult[];
    query: string;
    total: number;
  };
  error?: { message: string; code?: string };
}

export interface RAGEmbedResponse {
  ok: boolean;
  data?: {
    embeddings: number[][];
    model: string;
  };
  error?: { message: string; code?: string };
}

export interface RAGHealthResponse {
  ok: boolean;
  data?: {
    status: 'ok' | 'error';
    chromadb: boolean;
    embedding: boolean;
    timestamp: string;
  };
  error?: { message: string; code?: string };
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * 시맨틱 검색 수행
 *
 * @param query - 검색 쿼리
 * @param options - 검색 옵션
 * @returns 검색 결과 (유사도 점수 포함)
 *
 * @example
 * const results = await semanticSearch('LLM 추론 최적화', { n_results: 10 });
 * results.data?.results.forEach(r => console.log(r.metadata.title, r.score));
 */
export async function semanticSearch(
  query: string,
  options: {
    n_results?: number;
    filter?: Record<string, unknown>;
    signal?: AbortSignal;
  } = {}
): Promise<RAGSearchResponse> {
  const { n_results = 5, filter, signal } = options;
  const base = getApiBaseUrl();
  const url = `${base.replace(/\/$/, '')}/api/v1/rag/search`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, n_results, filter }),
      signal,
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        ok: false,
        error: data.error || { message: `HTTP ${res.status}` },
      };
    }

    // Normalize backend response format
    // Backend returns: { ok, data: { results: [{ document, metadata, distance }] } }
    // Frontend expects: { ok, data: { results: [{ content, metadata, score }] } }
    if (data.ok && data.data?.results) {
      data.data.results = data.data.results.map((r: any) => ({
        ...r,
        content: r.content || r.document || '',
        score: r.score ?? (r.distance != null ? Math.max(0, 1 - r.distance) : 0),
      }));
    }

    return data as RAGSearchResponse;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: { message: 'Search cancelled', code: 'ABORTED' } };
    }
    const message = err instanceof Error ? err.message : 'Search failed';
    return { ok: false, error: { message, code: 'NETWORK_ERROR' } };
  }
}

/**
 * 텍스트 임베딩 생성
 *
 * @param texts - 임베딩할 텍스트 배열
 * @param signal - AbortSignal
 * @returns 임베딩 벡터 배열
 *
 * @example
 * const embeddings = await generateEmbeddings(['Hello world', '안녕하세요']);
 */
export async function generateEmbeddings(
  texts: string[],
  signal?: AbortSignal
): Promise<RAGEmbedResponse> {
  const base = getApiBaseUrl();
  const url = `${base.replace(/\/$/, '')}/api/v1/rag/embed`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts }),
      signal,
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        ok: false,
        error: data.error || { message: `HTTP ${res.status}` },
      };
    }

    return data as RAGEmbedResponse;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: { message: 'Embed cancelled', code: 'ABORTED' } };
    }
    const message = err instanceof Error ? err.message : 'Embed failed';
    return { ok: false, error: { message, code: 'NETWORK_ERROR' } };
  }
}

/**
 * RAG 서비스 상태 확인
 *
 * @returns 서비스 상태 (ChromaDB, Embedding 연결 상태)
 */
export async function checkRAGHealth(): Promise<RAGHealthResponse> {
  const base = getApiBaseUrl();
  const url = `${base.replace(/\/$/, '')}/api/v1/rag/health`;

  try {
    const res = await fetch(url, { method: 'GET' });
    const data = await res.json();

    if (!res.ok) {
      return {
        ok: false,
        error: data.error || { message: `HTTP ${res.status}` },
      };
    }

    return data as RAGHealthResponse;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Health check failed';
    return { ok: false, error: { message, code: 'NETWORK_ERROR' } };
  }
}

// ============================================================================
// Hybrid Search with RRF (Reciprocal Rank Fusion)
// ============================================================================

const RRF_K = 60;

function computeRRFScore(ranks: number[]): number {
  return ranks.reduce((sum, rank) => sum + 1 / (RRF_K + rank), 0);
}

export interface HybridSearchResult extends RAGSearchResult {
  rrfScore: number;
  sources: ('semantic' | 'keyword' | 'expanded')[];
}

export interface EnhancedHybridSearchOptions {
  n_results?: number;
  signal?: AbortSignal;
  enableQueryExpansion?: boolean;
  maxExpandedQueries?: number;
}

export async function hybridSearch(
  query: string,
  options: EnhancedHybridSearchOptions = {}
): Promise<{ ok: boolean; data?: { results: HybridSearchResult[] }; error?: { message: string } }> {
  const { 
    n_results = 5, 
    signal, 
    enableQueryExpansion = true,
    maxExpandedQueries = 3 
  } = options;
  const fetchCount = Math.max(n_results * 2, 10);

  const rankMap = new Map<string, { 
    semanticRank?: number; 
    keywordRank?: number; 
    expandedRank?: number;
    result: RAGSearchResult 
  }>();

  const [semanticResult, keywordPosts] = await Promise.all([
    semanticSearch(query, { n_results: fetchCount, signal }).catch(() => ({ ok: false as const, data: undefined })),
    PostService.searchPosts(query).catch(() => [] as Awaited<ReturnType<typeof PostService.searchPosts>>),
  ]);

  if (semanticResult.ok && semanticResult.data?.results) {
    semanticResult.data.results.forEach((r, idx) => {
      const key = r.metadata.slug || r.id;
      const existing = rankMap.get(key);
      if (existing) {
        existing.semanticRank = idx + 1;
      } else {
        rankMap.set(key, { semanticRank: idx + 1, result: r });
      }
    });
  }

  keywordPosts.forEach((post, idx) => {
    const key = post.slug;
    const existing = rankMap.get(key);
    if (existing) {
      existing.keywordRank = idx + 1;
    } else {
      rankMap.set(key, {
        keywordRank: idx + 1,
        result: {
          id: post.id,
          content: post.excerpt || post.description || '',
          metadata: {
            title: post.title,
            slug: post.slug,
            year: post.year,
            category: post.category,
            tags: post.tags,
          },
          score: 0,
        },
      });
    }
  });

  if (enableQueryExpansion && rankMap.size < n_results) {
    const expandedQueries = expandQueryWithSynonyms(query).slice(1, maxExpandedQueries + 1);
    
    if (expandedQueries.length > 0) {
      const expandedSearches = await Promise.all(
        expandedQueries.map(eq => 
          semanticSearch(eq, { n_results: 5, signal }).catch(() => ({ ok: false as const, data: undefined }))
        )
      );
      
      let expandedRankOffset = 0;
      for (const expandedResult of expandedSearches) {
        if (expandedResult.ok && expandedResult.data?.results) {
          expandedResult.data.results.forEach((r, idx) => {
            const key = r.metadata.slug || r.id;
            if (!rankMap.has(key)) {
              rankMap.set(key, { 
                expandedRank: expandedRankOffset + idx + 1, 
                result: r 
              });
            }
          });
        }
        expandedRankOffset += 5;
      }
    }
  }

  if (enableQueryExpansion && rankMap.size < n_results) {
    const relatedKeywords = getRelatedKeywords(query).slice(0, 5);
    
    for (const keyword of relatedKeywords) {
      if (rankMap.size >= n_results * 2) break;
      
      const keywordResults = await PostService.searchPosts(keyword).catch(() => []);
      keywordResults.slice(0, 3).forEach((post, idx) => {
        const key = post.slug;
        if (!rankMap.has(key)) {
          rankMap.set(key, {
            expandedRank: 100 + idx,
            result: {
              id: post.id,
              content: post.excerpt || post.description || '',
              metadata: {
                title: post.title,
                slug: post.slug,
                year: post.year,
                category: post.category,
                tags: post.tags,
              },
              score: 0,
            },
          });
        }
      });
    }
  }

  const fused: HybridSearchResult[] = [];
  for (const [, entry] of rankMap) {
    const ranks: number[] = [];
    const sources: ('semantic' | 'keyword' | 'expanded')[] = [];
    if (entry.semanticRank !== undefined) {
      ranks.push(entry.semanticRank);
      sources.push('semantic');
    }
    if (entry.keywordRank !== undefined) {
      ranks.push(entry.keywordRank);
      sources.push('keyword');
    }
    if (entry.expandedRank !== undefined) {
      ranks.push(entry.expandedRank);
      sources.push('expanded');
    }
    const rrfScore = computeRRFScore(ranks);
    fused.push({
      ...entry.result,
      rrfScore,
      sources,
      score: rrfScore,
    });
  }

  fused.sort((a, b) => b.rrfScore - a.rrfScore);

  return {
    ok: true,
    data: { results: fused.slice(0, n_results) },
  };
}

// ============================================================================
// Hooks Helper
// ============================================================================

/**
 * 관련 포스트 검색 (현재 글 기반)
 *
 * @param currentPost - 현재 포스트 정보
 * @param limit - 반환할 개수
 * @returns 관련 포스트 목록
 */
export async function findRelatedPosts(
  currentPost: { title: string; content?: string; slug: string },
  limit = 5
): Promise<RAGSearchResult[]> {
  // 제목과 내용 일부를 쿼리로 사용
  const query = currentPost.content
    ? `${currentPost.title}\n\n${currentPost.content.slice(0, 500)}`
    : currentPost.title;

  const response = await semanticSearch(query, {
    n_results: limit + 1, // 자기 자신 제외를 위해 +1
  });

  if (!response.ok || !response.data) {
    return [];
  }

  // 현재 글 제외
  return response.data.results.filter(
    (r) => r.metadata.slug !== currentPost.slug
  ).slice(0, limit);
}

export async function getRAGContextForChat(
  userQuery: string,
  maxTokens = RAG_DEFAULTS.CONTEXT_MAX_TOKENS,
  timeoutMs = RAG_DEFAULTS.CONTEXT_TIMEOUT_MS
): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await hybridSearch(userQuery, { 
      n_results: 5,
      signal: controller.signal,
      enableQueryExpansion: true,
      maxExpandedQueries: 2,
    });

    if (!response.ok || !response.data || response.data.results.length === 0) {
      return null;
    }

    const contextParts: string[] = [];
    let currentLength = 0;

    for (const result of response.data.results) {
      const sourceLabel = result.sources.includes('semantic') && result.sources.includes('keyword') 
        ? '시맨틱+키워드' 
        : result.sources.includes('expanded')
        ? '확장검색'
        : result.sources[0] || 'unknown';
      
      const entry = [
        `[${result.metadata.title || 'Untitled'}]`,
        result.content.slice(0, 800),
        `(검색: ${sourceLabel}, 관련도: ${(result.rrfScore * 100).toFixed(1)}%)`,
        '',
      ].join('\n');

      if (currentLength + entry.length > maxTokens * 4) break;
      contextParts.push(entry);
      currentLength += entry.length;
    }

    if (contextParts.length === 0) return null;

    return [
      '[블로그 관련 문서]',
      '다음은 질문과 관련된 블로그 글입니다. 답변 시 참고하세요:',
      '',
      ...contextParts,
    ].join('\n');
  } catch (err) {
    if (import.meta.env?.DEV) {
      console.warn('[RAG] Context fetch failed or timed out:', err);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================================
// Admin RAG Management Functions
// ============================================================================

export interface RAGCollection {
  name: string;
  metadata: Record<string, unknown>;
}

export interface RAGCollectionStatus {
  collection: string;
  exists: boolean;
  count: number;
  metadata?: Record<string, unknown>;
}

export interface RAGCollectionsResponse {
  ok: boolean;
  data?: {
    collections: RAGCollection[];
    total: number;
  };
  error?: string;
}

export interface RAGStatusResponse {
  ok: boolean;
  data?: RAGCollectionStatus;
  error?: string;
}

export interface RAGIndexDocument {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface RAGIndexResponse {
  ok: boolean;
  data?: {
    indexed: number;
    collection: string;
  };
  error?: string;
}

/**
 * 모든 ChromaDB 컬렉션 목록 조회
 */
export async function getCollections(): Promise<RAGCollectionsResponse> {
  const base = getApiBaseUrl();
  const url = `${base.replace(/\/$/, '')}/api/v1/rag/collections`;

  try {
    const res = await fetch(url, { method: 'GET' });
    const data = await res.json();

    if (!res.ok) {
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }

    return data as RAGCollectionsResponse;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch collections';
    return { ok: false, error: message };
  }
}

/**
 * 특정 컬렉션 상태 조회
 */
export async function getCollectionStatus(collection?: string): Promise<RAGStatusResponse> {
  const base = getApiBaseUrl();
  const url = collection
    ? `${base.replace(/\/$/, '')}/api/v1/rag/status?collection=${encodeURIComponent(collection)}`
    : `${base.replace(/\/$/, '')}/api/v1/rag/status`;

  try {
    const res = await fetch(url, { method: 'GET' });
    const data = await res.json();

    if (!res.ok) {
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }

    return data as RAGStatusResponse;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch status';
    return { ok: false, error: message };
  }
}

/**
 * 문서 인덱싱
 */
export async function indexDocuments(
  documents: RAGIndexDocument[],
  collection?: string
): Promise<RAGIndexResponse> {
  const base = getApiBaseUrl();
  const url = `${base.replace(/\/$/, '')}/api/v1/rag/index`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documents, collection }),
    });

    const data = await res.json();

    if (!res.ok) {
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }

    return data as RAGIndexResponse;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to index documents';
    return { ok: false, error: message };
  }
}

/**
 * 인덱스에서 문서 삭제
 */
export async function deleteFromIndex(
  documentId: string,
  collection?: string
): Promise<{ ok: boolean; error?: string }> {
  const base = getApiBaseUrl();
  const url = collection
    ? `${base.replace(/\/$/, '')}/api/v1/rag/index/${encodeURIComponent(documentId)}?collection=${encodeURIComponent(collection)}`
    : `${base.replace(/\/$/, '')}/api/v1/rag/index/${encodeURIComponent(documentId)}`;

  try {
    const res = await fetch(url, { method: 'DELETE' });
    const data = await res.json();

    if (!res.ok) {
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete from index';
    return { ok: false, error: message };
  }
}
