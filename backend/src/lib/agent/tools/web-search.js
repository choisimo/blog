/**
 * Web Search Tool - Search the web for information
 * 
 * Provides web search capabilities using various search APIs.
 * Supports Perplexity, Tavily, DuckDuckGo, Brave Search, and custom search endpoints.
 */

// Configuration
const SEARCH_API_URL = process.env.SEARCH_API_URL || 'https://api.duckduckgo.com/';
const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY;
const SERPER_API_KEY = process.env.SERPER_API_KEY;
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

/**
 * Search using Perplexity API (AI-powered search with citations)
 */
async function searchPerplexity(query, options = {}) {
  if (!PERPLEXITY_API_KEY) {
    throw new Error('PERPLEXITY_API_KEY not configured');
  }

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
    },
    body: JSON.stringify({
      model: options.model || 'sonar',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful search assistant. Provide accurate, well-cited information.',
        },
        {
          role: 'user',
          content: query,
        },
      ],
      return_citations: true,
      search_domain_filter: options.domains || [],
      search_recency_filter: options.recency || 'month',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Perplexity search failed: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const citations = data.citations || [];

  return {
    answer: content,
    citations: citations.map((url, i) => ({
      title: `Source ${i + 1}`,
      url,
      snippet: '',
    })),
  };
}

/**
 * Search using Tavily API (search-optimized for AI agents)
 */
async function searchTavily(query, options = {}) {
  if (!TAVILY_API_KEY) {
    throw new Error('TAVILY_API_KEY not configured');
  }

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query,
      search_depth: options.searchDepth || 'advanced',
      include_answer: true,
      include_raw_content: options.includeRawContent || false,
      max_results: options.limit || 5,
      include_domains: options.includeDomains || [],
      exclude_domains: options.excludeDomains || [],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Tavily search failed: ${response.status} - ${error}`);
  }

  const data = await response.json();

  return {
    answer: data.answer || '',
    results: (data.results || []).map(r => ({
      title: r.title,
      snippet: r.content,
      url: r.url,
      score: r.score,
    })),
  };
}

/**
 * Search using DuckDuckGo Instant Answer API (free, no key needed)
 */
async function searchDuckDuckGo(query) {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    no_html: '1',
    skip_disambig: '1',
  });

  const response = await fetch(`${SEARCH_API_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`DuckDuckGo search failed: ${response.status}`);
  }

  const data = await response.json();
  
  const results = [];
  
  // Abstract (main answer)
  if (data.Abstract) {
    results.push({
      title: data.Heading || 'Summary',
      snippet: data.Abstract,
      url: data.AbstractURL,
      source: data.AbstractSource,
    });
  }

  // Related topics
  if (data.RelatedTopics) {
    for (const topic of data.RelatedTopics.slice(0, 5)) {
      if (topic.Text) {
        results.push({
          title: topic.Text.split(' - ')[0],
          snippet: topic.Text,
          url: topic.FirstURL,
        });
      }
    }
  }

  return results;
}

/**
 * Search using Brave Search API (requires API key)
 */
async function searchBrave(query, options = {}) {
  if (!BRAVE_API_KEY) {
    throw new Error('BRAVE_SEARCH_API_KEY not configured');
  }

  const params = new URLSearchParams({
    q: query,
    count: options.limit || 5,
  });

  const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
    headers: {
      'Accept': 'application/json',
      'X-Subscription-Token': BRAVE_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Brave search failed: ${response.status}`);
  }

  const data = await response.json();
  
  return (data.web?.results || []).map(r => ({
    title: r.title,
    snippet: r.description,
    url: r.url,
  }));
}

/**
 * Search using Serper API (Google search, requires API key)
 */
async function searchSerper(query, options = {}) {
  if (!SERPER_API_KEY) {
    throw new Error('SERPER_API_KEY not configured');
  }

  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': SERPER_API_KEY,
    },
    body: JSON.stringify({
      q: query,
      num: options.limit || 5,
    }),
  });

  if (!response.ok) {
    throw new Error(`Serper search failed: ${response.status}`);
  }

  const data = await response.json();
  
  return (data.organic || []).map(r => ({
    title: r.title,
    snippet: r.snippet,
    url: r.link,
  }));
}

/**
 * Fetch and summarize a web page
 */
async function fetchWebPage(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BlogAgent/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const html = await response.text();
    
    // Simple HTML to text conversion
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return text.slice(0, 5000);
  } catch (error) {
    return `Failed to fetch page: ${error.message}`;
  }
}

/**
 * Create Web Search Tool
 */
export function createWebSearchTool() {
  return {
    name: 'web_search',
    description: 'Search the web for current information using AI-powered search (perplexity/tavily) or traditional engines. Perplexity provides AI-synthesized answers with citations. Tavily is optimized for AI agent use cases.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform',
          enum: ['search', 'fetch_page', 'ai_search'],
        },
        query: {
          type: 'string',
          description: 'Search query (for search/ai_search action)',
        },
        url: {
          type: 'string',
          description: 'URL to fetch (for fetch_page action)',
        },
        engine: {
          type: 'string',
          description: 'Search engine: perplexity (AI search with citations), tavily (AI-optimized), duckduckgo (free), brave, serper (Google)',
          enum: ['perplexity', 'tavily', 'duckduckgo', 'brave', 'serper'],
          default: 'tavily',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (for traditional engines)',
          default: 5,
        },
        searchDepth: {
          type: 'string',
          description: 'Search depth for Tavily: basic or advanced',
          enum: ['basic', 'advanced'],
          default: 'advanced',
        },
      },
      required: ['action'],
    },

    async execute(args) {
      const { action, query, url, engine = 'tavily', limit = 5, searchDepth = 'advanced' } = args;

      console.log(`[WebSearch] Action: ${action}, Engine: ${engine}, Query: ${query || url}`);

      try {
        switch (action) {
          case 'ai_search':
          case 'search': {
            if (!query) {
              return { success: false, error: 'query is required for search' };
            }

            let results;
            let answer = null;

            switch (engine) {
              case 'perplexity': {
                const pplxResult = await searchPerplexity(query);
                answer = pplxResult.answer;
                results = pplxResult.citations;
                break;
              }
              case 'tavily': {
                const tavilyResult = await searchTavily(query, { limit, searchDepth });
                answer = tavilyResult.answer;
                results = tavilyResult.results;
                break;
              }
              case 'brave':
                results = await searchBrave(query, { limit });
                break;
              case 'serper':
                results = await searchSerper(query, { limit });
                break;
              case 'duckduckgo':
              default:
                results = await searchDuckDuckGo(query);
            }

            return {
              success: true,
              action,
              query,
              engine,
              answer,
              count: results?.length || 0,
              results: results || [],
            };
          }

          case 'fetch_page': {
            if (!url) {
              return { success: false, error: 'url is required for fetch_page' };
            }

            const content = await fetchWebPage(url);
            return {
              success: true,
              action,
              url,
              content,
            };
          }

          default:
            return {
              success: false,
              error: `Unknown action: ${action}`,
            };
        }
      } catch (error) {
        console.error(`[WebSearch] Failed: ${error.message}`);
        return {
          success: false,
          action,
          error: error.message,
        };
      }
    },
  };
}

export default createWebSearchTool;
