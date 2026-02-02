/**
 * Blog Operations Tool - CRUD operations for blog content
 * 
 * Provides tools for creating, reading, updating, and managing blog posts,
 * memos, and other content.
 */

import { config } from '../../../config.js';

const getApiBaseUrl = () => config.services?.backendUrl || process.env.INTERNAL_API_URL || `http://localhost:${config.port || 5080}`;

/**
 * Make authenticated API request
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${getApiBaseUrl()}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text().catch(() => '');
    throw new Error(`API request failed: ${response.status} ${error}`);
  }

  return response.json();
}

/**
 * Create Blog Operations Tool
 */
export function createBlogOpsTool() {
  return {
    name: 'blog_operations',
    description: 'Perform operations on blog content including searching posts, getting post details, creating memos, and managing content.',
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          description: 'The operation to perform',
          enum: [
            'list_posts',
            'get_post',
            'search_posts',
            'list_categories',
            'list_tags',
            'create_memo',
            'list_memos',
            'get_stats',
          ],
        },
        // For get_post
        slug: {
          type: 'string',
          description: 'Post slug (for get_post operation)',
        },
        // For search_posts and list_posts
        query: {
          type: 'string',
          description: 'Search query (for search_posts operation)',
        },
        category: {
          type: 'string',
          description: 'Filter by category',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by tags',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results',
          default: 10,
        },
        offset: {
          type: 'number',
          description: 'Pagination offset',
          default: 0,
        },
        // For create_memo
        content: {
          type: 'string',
          description: 'Memo content (for create_memo operation)',
        },
        title: {
          type: 'string',
          description: 'Memo title (for create_memo operation)',
        },
      },
      required: ['operation'],
    },

    async execute(args) {
      const { operation, slug, query, category, tags, limit, offset, content, title } = args;

      console.log(`[BlogOps] Executing operation: ${operation}`);

      try {
        switch (operation) {
          case 'list_posts': {
            const params = new URLSearchParams();
            if (category) params.append('category', category);
            if (tags?.length) tags.forEach(t => params.append('tag', t));
            if (limit) params.append('limit', limit.toString());
            if (offset) params.append('offset', offset.toString());

            const result = await apiRequest(`/api/v1/posts?${params}`);
            return {
              success: true,
              operation,
              count: result.data?.length || 0,
              posts: (result.data || []).map(p => ({
                title: p.title,
                slug: p.slug,
                category: p.category,
                date: p.date,
                excerpt: p.excerpt?.slice(0, 150),
              })),
            };
          }

          case 'get_post': {
            if (!slug) {
              return { success: false, error: 'slug is required for get_post' };
            }
            const result = await apiRequest(`/api/v1/posts/${slug}`);
            return {
              success: true,
              operation,
              post: {
                title: result.data?.title,
                slug: result.data?.slug,
                content: result.data?.content?.slice(0, 2000),
                category: result.data?.category,
                tags: result.data?.tags,
                date: result.data?.date,
              },
            };
          }

          case 'search_posts': {
            if (!query) {
              return { success: false, error: 'query is required for search_posts' };
            }
            const params = new URLSearchParams({ q: query });
            if (limit) params.append('limit', limit.toString());

            const result = await apiRequest(`/api/v1/posts/search?${params}`);
            return {
              success: true,
              operation,
              query,
              count: result.data?.length || 0,
              posts: (result.data || []).map(p => ({
                title: p.title,
                slug: p.slug,
                excerpt: p.excerpt?.slice(0, 150),
                score: p.score,
              })),
            };
          }

          case 'list_categories': {
            const result = await apiRequest('/api/v1/categories');
            return {
              success: true,
              operation,
              categories: result.data || [],
            };
          }

          case 'list_tags': {
            const result = await apiRequest('/api/v1/tags');
            return {
              success: true,
              operation,
              tags: result.data || [],
            };
          }

          case 'create_memo': {
            if (!content) {
              return { success: false, error: 'content is required for create_memo' };
            }
            const result = await apiRequest('/api/v1/memos', {
              method: 'POST',
              body: JSON.stringify({
                title: title || 'Untitled Memo',
                content,
                type: 'ai_generated',
              }),
            });
            return {
              success: true,
              operation,
              memo: {
                id: result.data?.id,
                title: result.data?.title,
              },
            };
          }

          case 'list_memos': {
            const params = new URLSearchParams();
            if (limit) params.append('limit', limit.toString());
            if (offset) params.append('offset', offset.toString());

            const result = await apiRequest(`/api/v1/memos?${params}`);
            return {
              success: true,
              operation,
              count: result.data?.length || 0,
              memos: (result.data || []).map(m => ({
                id: m.id,
                title: m.title,
                excerpt: m.content?.slice(0, 100),
                createdAt: m.createdAt,
              })),
            };
          }

          case 'get_stats': {
            const result = await apiRequest('/api/v1/stats');
            return {
              success: true,
              operation,
              stats: result.data,
            };
          }

          default:
            return {
              success: false,
              error: `Unknown operation: ${operation}`,
            };
        }
      } catch (error) {
        console.error(`[BlogOps] Operation failed: ${error.message}`);
        return {
          success: false,
          operation,
          error: error.message,
        };
      }
    },
  };
}

export default createBlogOpsTool;
