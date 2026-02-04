import { Hono } from 'hono';
import type { HonoEnv, Env } from '../types';
import { success, badRequest, serverError } from '../lib/response';

const search = new Hono<HonoEnv>();

const CONFIG_KEYS = {
  TAVILY_API_KEY: 'secret:tavily_api_key',
  TAVILY_API_KEY_LEGACY: 'tavily_api_key',
  PERPLEXITY_API_KEY: 'secret:perplexity_api_key',
  PERPLEXITY_API_KEY_LEGACY: 'perplexity_api_key',
} as const;

const TAVILY_API_URL = 'https://api.tavily.com/search';
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

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

type PerplexityResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  citations?: string[];
};

async function getTavilyApiKey(env: Env): Promise<string | null> {
  if (env.TAVILY_API_KEY) return env.TAVILY_API_KEY;
  if ((env as any).tavily_api_key) return (env as any).tavily_api_key;

  try {
    const kvValue = await env.KV.get(CONFIG_KEYS.TAVILY_API_KEY);
    if (kvValue) return kvValue;
    const legacy = await env.KV.get(CONFIG_KEYS.TAVILY_API_KEY_LEGACY);
    if (legacy) return legacy;
  } catch {}

  return null;
}

async function getPerplexityApiKey(env: Env): Promise<string | null> {
  if (env.PERPLEXITY_API_KEY) return env.PERPLEXITY_API_KEY;
  if ((env as any).perplexity_api_key) return (env as any).perplexity_api_key;

  try {
    const kvValue = await env.KV.get(CONFIG_KEYS.PERPLEXITY_API_KEY);
    if (kvValue) return kvValue;
    const legacy = await env.KV.get(CONFIG_KEYS.PERPLEXITY_API_KEY_LEGACY);
    if (legacy) return legacy;
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

async function searchWithPerplexity(
  apiKey: string,
  query: string,
  options: {
    model?: string;
    domains?: string[];
    recency?: 'day' | 'week' | 'month' | 'year';
  } = {}
): Promise<{ answer: string; citations: Array<{ title: string; url: string; snippet: string }> }> {
  const response = await fetch(PERPLEXITY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model || 'sonar',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful search assistant. Provide accurate, well-cited information.',
        },
        { role: 'user', content: query },
      ],
      return_citations: true,
      search_domain_filter: options.domains || [],
      search_recency_filter: options.recency || 'month',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Perplexity API error: ${response.status} ${errorText.slice(0, 200)}`);
  }

  const data = (await response.json()) as PerplexityResponse;
  const answer = data.choices?.[0]?.message?.content || '';
  const citations = Array.isArray(data.citations) ? data.citations : [];

  return {
    answer,
    citations: citations.map((url, i) => ({
      title: `Source ${i + 1}`,
      url,
      snippet: '',
    })),
  };
}

async function proxyToBackendWebSearch(
  env: Env,
  body: {
    query: string;
    maxResults?: number;
    searchDepth?: 'basic' | 'advanced';
  }
) {
  const backendOrigin = env.BACKEND_ORIGIN;
  if (!backendOrigin) {
    throw new Error('BACKEND_ORIGIN not configured');
  }

  const upstreamUrl = `${backendOrigin.replace(/\/$/, '')}/api/v1/search/web`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (env.BACKEND_SECRET_KEY) {
    headers['X-Backend-Key'] = env.BACKEND_SECRET_KEY;
  }

  const response = await fetch(upstreamUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (data as any)?.error || `Backend web search failed (${response.status})`;
    throw new Error(message);
  }

  return data as { ok: boolean; data?: any };
}

search.post('/web', async (c) => {
  type WebSearchBody = {
    query: string;
    maxResults?: number;
    searchDepth?: 'basic' | 'advanced';
    includeDomains?: string[];
    excludeDomains?: string[];
    provider?: 'tavily' | 'perplexity';
  };

  const body = await c.req.json<WebSearchBody>().catch(() => ({} as WebSearchBody));

  if (!body.query?.trim()) {
    return badRequest(c, 'query is required');
  }

  const tavilyApiKey = await getTavilyApiKey(c.env);
  const perplexityApiKey = await getPerplexityApiKey(c.env);
  const provider: 'tavily' | 'perplexity' =
    body.provider || (tavilyApiKey ? 'tavily' : perplexityApiKey ? 'perplexity' : 'tavily');

  try {
    if (provider === 'perplexity') {
      if (!perplexityApiKey) {
        return badRequest(c, 'PERPLEXITY_API_KEY not configured');
      }

      const started = Date.now();

      const result = await searchWithPerplexity(perplexityApiKey, body.query.trim(), {
        domains: body.includeDomains,
      });

      return success(c, {
        query: body.query.trim(),
        answer: result.answer,
        results: result.citations.map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet,
          score: 0,
          publishedDate: undefined,
        })),
        responseTime: Date.now() - started,
      });
    }

    if (!tavilyApiKey) {
      const proxied = await proxyToBackendWebSearch(c.env, {
        query: body.query.trim(),
        maxResults: Math.min(body.maxResults || 5, 10),
        searchDepth: body.searchDepth || 'basic',
      });

      if (!proxied?.ok || !proxied.data) {
        throw new Error('Invalid response from backend web search API');
      }

      return success(c, proxied.data);
    }

    const started = Date.now();
    const result = await searchWithTavily(tavilyApiKey, body.query.trim(), {
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
      responseTime: result.response_time || Date.now() - started,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Web search failed';
    console.error('Web search failed:', message);
    return serverError(c, message);
  }
});

search.get('/health', async (c) => {
  const tavilyApiKey = await getTavilyApiKey(c.env);
  const perplexityApiKey = await getPerplexityApiKey(c.env);

  return success(c, {
    status: tavilyApiKey || perplexityApiKey ? 'configured' : 'not_configured',
    providers: {
      tavily: tavilyApiKey ? 'configured' : 'not_configured',
      perplexity: perplexityApiKey ? 'configured' : 'not_configured',
    },
    timestamp: new Date().toISOString(),
  });
});

export default search;
