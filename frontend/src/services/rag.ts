/**
 * RAG (Retrieval-Augmented Generation) Service
 *
 * ChromaDB 기반 시맨틱 검색 및 임베딩 생성 서비스
 * Backend의 /api/v1/rag 엔드포인트를 호출합니다.
 */

import { getApiBaseUrl } from '@/utils/apiBase';

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
    tei: boolean;
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
 * @returns 서비스 상태 (ChromaDB, TEI 연결 상태)
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

/**
 * AI 챗봇용 컨텍스트 검색
 *
 * @param userQuery - 사용자 질문
 * @param maxTokens - 대략적인 최대 토큰 수 (문자 기준 근사치)
 * @returns 챗봇에 주입할 컨텍스트 문자열
 */
export async function getRAGContextForChat(
  userQuery: string,
  maxTokens = 2000,
  timeoutMs = 8000
): Promise<string | null> {
  // Create abort controller with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await semanticSearch(userQuery, { 
      n_results: 3,
      signal: controller.signal,
    });

    if (!response.ok || !response.data || response.data.results.length === 0) {
      return null;
    }

    const contextParts: string[] = [];
    let currentLength = 0;

    for (const result of response.data.results) {
      const entry = [
        `[${result.metadata.title || 'Untitled'}]`,
        result.content.slice(0, 800),
        `(관련도: ${(result.score * 100).toFixed(1)}%)`,
        '',
      ].join('\n');

      if (currentLength + entry.length > maxTokens * 4) break; // rough char estimate
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
    // Timeout or network error - return null to continue without RAG context
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
