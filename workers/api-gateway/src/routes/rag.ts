/**
 * RAG Routes (Workers)
 * 
 * Cloudflare Tunnel을 통해 Backend API의 RAG 엔드포인트를 호출합니다.
 * 
 * 엔드포인트:
 * - POST /rag/search - 시맨틱 검색 (프록시)
 * - POST /rag/embed - 텍스트 임베딩 생성 (프록시)
 * - GET /rag/health - RAG 서비스 상태 확인 (프록시)
 * - GET /rag/status - 컬렉션 상태 조회 (프록시)
 * - GET /rag/collections - 컬렉션 목록 조회 (프록시)
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Env } from '../types';
import { error, forbidden } from '../lib/response';
import { requireAdmin, requireAuth } from '../middleware/auth';

type RagContext = { Bindings: Env };

const rag = new Hono<RagContext>();

/**
 * Backend RAG API로 요청을 프록시합니다.
 * 
 * IMPORTANT: BACKEND_ORIGIN을 직접 사용해야 합니다.
 * getApiBaseUrl()은 기본값이 api.nodove.com (Workers 자신)이므로
 * 무한 루프가 발생합니다 (Cloudflare error 1033).
 */
async function proxyToBackend(
  c: Context<RagContext>,
  path: string,
  method: 'GET' | 'POST' | 'DELETE' = 'POST',
  body?: BodyInit | null
) {
  const backendOrigin = c.env.BACKEND_ORIGIN;
  if (!backendOrigin) {
    return error(c, 'BACKEND_ORIGIN not configured', 500, 'CONFIG_ERROR');
  }

  // Preserve query string for GET requests (e.g. /status?collection=xxx)
  const url = new URL(c.req.url);
  const upstreamUrl = `${backendOrigin}/api/v1/rag${path}${url.search}`;

  const headers = new Headers();

  // Inject backend authentication key
  if (c.env.BACKEND_KEY) {
    headers.set('X-Backend-Key', c.env.BACKEND_KEY);
  }

  // Forward original Authorization header so backend requireAdmin can validate JWT
  const authHeader = c.req.header('Authorization');
  if (authHeader) {
    headers.set('Authorization', authHeader);
  }

  const requestInit: RequestInit = {
    method,
    headers,
  };

  if (method !== 'GET') {
    requestInit.body = body ?? (await c.req.text());
    if (typeof requestInit.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }
  }

  try {
    const response = await fetch(upstreamUrl, requestInit);
    const data = await response.json();

    if (!response.ok) {
      return error(c, (data as any).error || 'RAG request failed', response.status as ContentfulStatusCode);
    }

    return c.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'RAG proxy failed';
    console.error('RAG proxy error:', message);
    return error(c, message, 500, 'RAG_PROXY_ERROR');
  }
}

function getAuthenticatedSub(c: Context<RagContext>): string {
  const user = c.get('user' as never) as { sub?: string };
  if (!user?.sub) {
    throw new Error('Missing authenticated user');
  }
  return user.sub;
}

async function proxyPrincipalMemoryRoute(
  c: Context<RagContext>,
  path: string,
  transformBody?: (body: Record<string, unknown>, sub: string) => Record<string, unknown>
) {
  const sub = getAuthenticatedSub(c);
  const rawBody = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;

  if (
    rawBody.userId !== undefined &&
    typeof rawBody.userId === 'string' &&
    rawBody.userId !== sub
  ) {
    return forbidden(c, 'User ID mismatch');
  }

  const nextBody = transformBody ? transformBody(rawBody, sub) : { ...rawBody, userId: sub };
  return proxyToBackend(c, path, 'POST', JSON.stringify(nextBody));
}

/**
 * POST /search - 시맨틱 검색
 * 
 * Request Body:
 * {
 *   query: string,      // 검색 쿼리
 *   n_results?: number  // 반환할 결과 수 (기본 5)
 * }
 */
rag.post('/search', async (c) => {
  return proxyToBackend(c, '/search', 'POST');
});

/**
 * POST /embed - 텍스트 임베딩 생성
 * 
 * Request Body:
 * {
 *   texts: string[]  // 임베딩할 텍스트 배열
 * }
 */
rag.post('/embed', requireAdmin, async (c) => {
  return proxyToBackend(c, '/embed', 'POST');
});

/**
 * GET /health - RAG 서비스 상태 확인
 */
rag.get('/health', async (c) => {
  return proxyToBackend(c, '/health', 'GET');
});

/**
 * GET /status - 특정 컬렉션 상태 조회
 * Query: ?collection=<name>
 */
rag.get('/status', requireAdmin, async (c) => {
  return proxyToBackend(c, '/status', 'GET');
});

/**
 * GET /collections - 모든 ChromaDB 컬렉션 목록 조회
 */
rag.get('/collections', requireAdmin, async (c) => {
  return proxyToBackend(c, '/collections', 'GET');
});

rag.post('/memories/search', requireAuth, async (c) => {
  return proxyPrincipalMemoryRoute(c, '/memories/search');
});

rag.post('/memories/upsert', requireAuth, async (c) => {
  return proxyPrincipalMemoryRoute(c, '/memories/upsert');
});

rag.delete('/memories/:userId/:memoryId', requireAuth, async (c) => {
  const sub = getAuthenticatedSub(c);
  const { userId, memoryId } = c.req.param();
  if (userId !== sub) {
    return forbidden(c, 'User ID mismatch');
  }
  return proxyToBackend(
    c,
    `/memories/${encodeURIComponent(userId)}/${encodeURIComponent(memoryId)}`,
    'DELETE'
  );
});

export default rag;
