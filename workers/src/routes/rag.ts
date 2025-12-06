/**
 * RAG Routes (Workers)
 * 
 * Cloudflare Tunnel을 통해 Backend API의 RAG 엔드포인트를 호출합니다.
 * 
 * 엔드포인트:
 * - POST /rag/search - 시맨틱 검색 (프록시)
 * - POST /rag/embed - 텍스트 임베딩 생성 (프록시)
 * - GET /rag/health - RAG 서비스 상태 확인 (프록시)
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Env } from '../types';
import { success, error } from '../lib/response';
import { getApiBaseUrl } from '../lib/config';

type RagContext = { Bindings: Env };

const rag = new Hono<RagContext>();

/**
 * Backend RAG API로 요청을 프록시합니다.
 */
async function proxyToBackend(
  c: Context<RagContext>,
  path: string,
  method: 'GET' | 'POST' = 'POST'
) {
  const apiBaseUrl = await getApiBaseUrl(c.env);
  const upstreamUrl = `${apiBaseUrl}/api/v1/rag${path}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const requestInit: RequestInit = {
    method,
    headers,
  };

  if (method === 'POST') {
    const body = await c.req.text();
    requestInit.body = body;
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
rag.post('/embed', async (c) => {
  return proxyToBackend(c, '/embed', 'POST');
});

/**
 * GET /health - RAG 서비스 상태 확인
 */
rag.get('/health', async (c) => {
  return proxyToBackend(c, '/health', 'GET');
});

export default rag;
