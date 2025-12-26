/**
 * Web Search Tool - Search the web for information
 * 
 * Provides web search capabilities using various search APIs.
 * Supports DuckDuckGo, Brave Search, and custom search endpoints.
 */

// Configuration
const SEARCH_API_URL = process.env.SEARCH_API_URL || 'https://api.duckduckgo.com/';
const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY;
const SERPER_API_KEY = process.env.SERPER_API_KEY;

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
    description: 'Search the web for current information, news, documentation, or any topic. Can also fetch and summarize web pages.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform',
          enum: ['search', 'fetch_page'],
        },
        query: {
          type: 'string',
          description: 'Search query (for search action)',
        },
        url: {
          type: 'string',
          description: 'URL to fetch (for fetch_page action)',
        },
        engine: {
          type: 'string',
          description: 'Search engine to use',
          enum: ['duckduckgo', 'brave', 'serper'],
          default: 'duckduckgo',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results',
          default: 5,
        },
      },
      required: ['action'],
    },

    async execute(args) {
      const { action, query, url, engine = 'duckduckgo', limit = 5 } = args;

      console.log(`[WebSearch] Action: ${action}, Query: ${query || url}`);

      try {
        switch (action) {
          case 'search': {
            if (!query) {
              return { success: false, error: 'query is required for search' };
            }

            let results;
            switch (engine) {
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
              count: results.length,
              results,
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
