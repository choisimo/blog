import { Hono } from 'hono';
import type { HonoEnv, Env } from '../types';
import { success, badRequest, serverError } from '../lib/response';

const search = new Hono<HonoEnv>();

const CONFIG_KEYS = {
  TAVILY_API_KEY: 'secret:tavily_api_key',
} as const;

const TAVILY_API_URL = 'https://api.tavily.com/search';

type TavilySearchResult = {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
};

type TavilyResponse = {
  query: string;
  answer?: string;
  results: TavilySearchResult[];
  response_time: number;
};

async function getTavilyApiKey(env: Env): Promise<string | null> {
  try {
    const kvValue = await env.KV.get(CONFIG_KEYS.TAVILY_API_KEY);
    if (kvValue) return kvValue;
  } catch {}
  return null;
}

async function searchWithTavily(
  apiKey: string,
  query: string,
  options: {
    searchDepth?: 'basic' | 'advanced';
    maxResults?: number;
    includeAnswer?: boolean;
    includeDomains?: string[];
    excludeDomains?: string[];
  } = {}
): Promise<TavilyResponse> {
  const {
    searchDepth = 'basic',
    maxResults = 5,
    includeAnswer = true,
    includeDomains,
    excludeDomains,
  } = options;

  const body: Record<string, unknown> = {
    api_key: apiKey,
    query,
    search_depth: searchDepth,
    max_results: maxResults,
    include_answer: includeAnswer,
    include_raw_content: false,
    include_images: false,
  };

  if (includeDomains?.length) {
    body.include_domains = includeDomains;
  }
  if (excludeDomains?.length) {
    body.exclude_domains = excludeDomains;
  }

  const response = await fetch(TAVILY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Tavily API error: ${response.status} ${errorText.slice(0, 200)}`);
  }

  return response.json() as Promise<TavilyResponse>;
}

search.post('/web', async (c) => {
  type WebSearchBody = {
    query: string;
    maxResults?: number;
    searchDepth?: 'basic' | 'advanced';
    includeDomains?: string[];
    excludeDomains?: string[];
  };

  const body = await c.req.json<WebSearchBody>().catch(() => ({} as WebSearchBody));

  if (!body.query?.trim()) {
    return badRequest(c, 'query is required');
  }

  const apiKey = await getTavilyApiKey(c.env);
  if (!apiKey) {
    return serverError(c, 'Web search is not configured');
  }

  try {
    const result = await searchWithTavily(apiKey, body.query.trim(), {
      maxResults: Math.min(body.maxResults || 5, 10),
      searchDepth: body.searchDepth || 'basic',
      includeDomains: body.includeDomains,
      excludeDomains: body.excludeDomains,
    });

    return success(c, {
      query: result.query,
      answer: result.answer,
      results: result.results.map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.content.slice(0, 300),
        score: r.score,
        publishedDate: r.published_date,
      })),
      responseTime: result.response_time,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Web search failed';
    console.error('Web search failed:', message);
    return serverError(c, message);
  }
});

search.get('/health', async (c) => {
  const apiKey = await getTavilyApiKey(c.env);

  return success(c, {
    status: apiKey ? 'configured' : 'not_configured',
    provider: 'tavily',
    timestamp: new Date().toISOString(),
  });
});

export default search;
