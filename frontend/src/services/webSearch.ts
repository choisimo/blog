import { getApiBaseUrl } from '@/utils/apiBase';

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

export async function searchWeb(
  query: string,
  options: {
    maxResults?: number;
    searchDepth?: 'basic' | 'advanced';
  } = {}
): Promise<WebSearchResponse> {
  const { maxResults = 5, searchDepth = 'basic' } = options;
  const baseUrl = getApiBaseUrl();

  const response = await fetch(`${baseUrl}/api/v1/search/web`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, maxResults, searchDepth }),
  });

  if (!response.ok) {
    throw new Error(`Web search failed: ${response.status}`);
  }

  const data = await response.json() as { ok: boolean; data?: WebSearchResponse };
  if (!data.ok || !data.data) {
    throw new Error('Invalid response from web search API');
  }

  return data.data;
}

export async function checkWebSearchHealth(): Promise<boolean> {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/search/health`);
    const data = await response.json() as { data?: { status: string } };
    return data?.data?.status === 'configured';
  } catch {
    return false;
  }
}
