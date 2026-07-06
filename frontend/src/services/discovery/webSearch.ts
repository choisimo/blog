import { getApiBaseUrl } from '@/utils/network/apiBase';

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  score: number;
  publishedDate?: string;
};

export type WebSearchResponse = {
  query: string;
  answer?: string;
  results: WebSearchResult[];
  responseTime: number;
};

const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/g;
const CONTROL_CHAR_TEST_PATTERN = /[\u0000-\u001F\u007F]/;
const ENCODED_CONTROL_CHAR_PATTERN = /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i;
const WHITESPACE_PATTERN = /\s+/g;
const SAFE_WEB_PROTOCOLS = new Set(['http:', 'https:']);
const DEFAULT_MAX_RESULTS = 5;
const MAX_RESULTS_LIMIT = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const normalized = value
    .replace(CONTROL_CHAR_PATTERN, ' ')
    .replace(WHITESPACE_PATTERN, ' ')
    .trim();

  return normalized || null;
}

function normalizeOptionalText(value: unknown): string | undefined {
  return normalizeText(value) ?? undefined;
}

function normalizeWebUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (
    !text ||
    CONTROL_CHAR_TEST_PATTERN.test(text) ||
    /\s/.test(text) ||
    ENCODED_CONTROL_CHAR_PATTERN.test(text)
  ) {
    return null;
  }

  try {
    const url = new URL(text);
    if (!SAFE_WEB_PROTOCOLS.has(url.protocol) || url.username || url.password) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

function normalizeScore(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
}

function normalizeResponseTime(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return Math.round(value);
}

function normalizeMaxResults(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_MAX_RESULTS;
  }

  return Math.min(MAX_RESULTS_LIMIT, Math.floor(value));
}

function parseWebSearchResult(value: unknown): WebSearchResult | null {
  if (!isRecord(value)) return null;

  const title = normalizeText(value.title);
  const url = normalizeWebUrl(value.url);
  const snippet = normalizeText(value.snippet);
  const score = normalizeScore(value.score);
  if (!title || !url || !snippet || score === null) {
    return null;
  }

  const publishedDate = normalizeOptionalText(value.publishedDate);

  return {
    title,
    url,
    snippet,
    score,
    ...(publishedDate ? { publishedDate } : {}),
  };
}

function parseWebSearchResponse(value: unknown): WebSearchResponse | null {
  if (!isRecord(value)) return null;

  const query = normalizeText(value.query);
  const responseTime = normalizeResponseTime(value.responseTime);
  if (!query || responseTime === null || !Array.isArray(value.results)) {
    return null;
  }

  const parsedResults = value.results.map(parseWebSearchResult);
  if (parsedResults.some((result) => !result)) {
    return null;
  }

  const results = parsedResults as WebSearchResult[];
  const answer = normalizeOptionalText(value.answer);

  return {
    query,
    ...(answer ? { answer } : {}),
    results,
    responseTime,
  };
}

export async function searchWeb(
  query: string,
  options: {
    maxResults?: number;
    searchDepth?: 'basic' | 'advanced';
  } = {}
): Promise<WebSearchResponse> {
  const safeQuery = normalizeText(query);
  if (!safeQuery) {
    throw new Error('Web search query is required');
  }

  const maxResults = normalizeMaxResults(options.maxResults);
  const searchDepth = options.searchDepth === 'advanced' ? 'advanced' : 'basic';
  const baseUrl = getApiBaseUrl();

  const response = await fetch(`${baseUrl}/api/v1/search/web`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: safeQuery, maxResults, searchDepth }),
  });

  if (!response.ok) {
    throw new Error(`Web search failed: ${response.status}`);
  }

  const data = await response.json();
  const parsed = isRecord(data) && data.ok === true
    ? parseWebSearchResponse(data.data)
    : null;
  if (!parsed) {
    throw new Error('Invalid response from web search API');
  }

  return parsed;
}

export async function checkWebSearchHealth(): Promise<boolean> {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/search/health`);
    if (!response.ok) return false;

    const data = await response.json() as { data?: { status: string } };
    return data?.data?.status === 'configured';
  } catch {
    return false;
  }
}
