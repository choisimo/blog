/**
 * Blog Operations Tool - CRUD operations for blog content
 *
 * Provides tools for creating, reading, updating, and managing blog posts,
 * memos, and other content.
 */

import { config } from "../../../config.js";
import { createLogger } from "../../../lib/logger.js";

const logger = createLogger("blog-ops");

const getApiBaseUrl = () =>
  config.services?.backendUrl ||
  process.env.INTERNAL_API_URL ||
  `http://localhost:${config.port || 5080}`;

function getPostsArray(result) {
  return Array.isArray(result?.data?.items) ? result.data.items : [];
}

function normalizeText(value) {
  return String(value || "").toLowerCase();
}

function filterPosts(items, { category, tags }) {
  return items.filter((item) => {
    if (category && item.category !== category) {
      return false;
    }
    if (Array.isArray(tags) && tags.length > 0) {
      const itemTags = Array.isArray(item.tags) ? item.tags : [];
      const itemTagSet = new Set(itemTags.map((tag) => normalizeText(tag)));
      const hasAllTags = tags.every((tag) =>
        itemTagSet.has(normalizeText(tag)),
      );
      if (!hasAllTags) {
        return false;
      }
    }
    return true;
  });
}

function rankPostsByQuery(items, query) {
  const normalizedQuery = normalizeText(query).trim();
  if (!normalizedQuery) {
    return [];
  }

  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  return items
    .map((item) => {
      const title = normalizeText(item.title);
      const description = normalizeText(
        item.description || item.excerpt || item.snippet,
      );
      const category = normalizeText(item.category);
      const tags = Array.isArray(item.tags)
        ? item.tags.map((tag) => normalizeText(tag))
        : [];

      let score = 0;
      for (const term of terms) {
        if (title.includes(term)) score += 5;
        if (description.includes(term)) score += 3;
        if (category.includes(term)) score += 2;
        if (tags.some((tag) => tag.includes(term))) score += 2;
      }

      if (score === 0) {
        return null;
      }

      return { ...item, score };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
}

async function loadPublishedPostsIndex() {
  const result = await apiRequest("/api/v1/posts");
  return getPostsArray(result);
}

async function loadPostsIndexIncludingDrafts() {
  const result = await apiRequest("/api/v1/posts?includeDrafts=true");
  return getPostsArray(result);
}

/**
 * Make authenticated API request
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${getApiBaseUrl()}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text().catch(() => "");
    throw new Error(`API request failed: ${response.status} ${error}`);
  }

  return response.json();
}

/**
 * Create Blog Operations Tool
 */
export function createBlogOpsTool() {
  return {
    name: "blog_operations",
    description:
      "Perform operations on blog content including searching posts, getting post details, creating memos, and managing content.",
    parameters: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          description: "The operation to perform",
          enum: [
            "list_posts",
            "get_post",
            "search_posts",
            "list_categories",
            "list_tags",
            "create_memo",
            "list_memos",
            "get_stats",
          ],
        },
        // For get_post
        slug: {
          type: "string",
          description: "Post slug (for get_post operation)",
        },
        // For search_posts and list_posts
        query: {
          type: "string",
          description: "Search query (for search_posts operation)",
        },
        category: {
          type: "string",
          description: "Filter by category",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Filter by tags",
        },
        limit: {
          type: "number",
          description: "Maximum number of results",
          default: 10,
        },
        offset: {
          type: "number",
          description: "Pagination offset",
          default: 0,
        },
        // For create_memo
        content: {
          type: "string",
          description: "Memo content (for create_memo operation)",
        },
        title: {
          type: "string",
          description: "Memo title (for create_memo operation)",
        },
      },
      required: ["operation"],
    },

    async execute(args) {
      const {
        operation,
        slug,
        query,
        category,
        tags,
        limit,
        offset,
        content,
        title,
      } = args;

      logger.debug({ operation }, "BlogOps execute");

      try {
        switch (operation) {
          case "list_posts": {
            const allPosts = await loadPublishedPostsIndex();
            const filteredPosts = filterPosts(allPosts, { category, tags });
            const pagedPosts = filteredPosts.slice(
              offset || 0,
              (offset || 0) + (limit || 10),
            );
            return {
              success: true,
              operation,
              count: filteredPosts.length,
              posts: pagedPosts.map((p) => ({
                title: p.title,
                slug: p.slug,
                category: p.category,
                date: p.date,
                excerpt: (p.description || p.excerpt || p.snippet || "").slice(
                  0,
                  150,
                ),
              })),
            };
          }

          case "get_post": {
            if (!slug) {
              return { success: false, error: "slug is required for get_post" };
            }
            const postsIndex = await loadPostsIndexIncludingDrafts();
            const match = postsIndex.find((post) => post.slug === slug);
            if (!match?.year) {
              return {
                success: false,
                error: `post not found for slug: ${slug}`,
              };
            }
            const result = await apiRequest(
              `/api/v1/posts/${match.year}/${slug}`,
            );
            const post = result.data?.item;
            return {
              success: true,
              operation,
              post: {
                title: post?.title,
                slug: post?.slug,
                year: post?.year,
                content: result.data?.markdown?.slice(0, 2000),
                category: post?.category,
                tags: post?.tags,
                date: post?.date,
              },
            };
          }

          case "search_posts": {
            if (!query) {
              return {
                success: false,
                error: "query is required for search_posts",
              };
            }
            const allPosts = await loadPublishedPostsIndex();
            const rankedPosts = rankPostsByQuery(allPosts, query);
            const limitedPosts = rankedPosts.slice(0, limit || 10);
            return {
              success: true,
              operation,
              query,
              count: rankedPosts.length,
              posts: limitedPosts.map((p) => ({
                title: p.title,
                slug: p.slug,
                year: p.year,
                excerpt: (p.description || p.excerpt || p.snippet || "").slice(
                  0,
                  150,
                ),
                score: p.score,
              })),
            };
          }

          case "list_categories": {
            const allPosts = await loadPublishedPostsIndex();
            const categories = [
              ...new Set(allPosts.map((post) => post.category).filter(Boolean)),
            ].sort();
            return {
              success: true,
              operation,
              categories,
            };
          }

          case "list_tags": {
            const allPosts = await loadPublishedPostsIndex();
            const tags = [
              ...new Set(
                allPosts.flatMap((post) =>
                  Array.isArray(post.tags) ? post.tags : [],
                ),
              ),
            ].sort();
            return {
              success: true,
              operation,
              tags,
            };
          }

          case "create_memo": {
            if (!content) {
              return {
                success: false,
                error: "content is required for create_memo",
              };
            }
            const result = await apiRequest("/api/v1/memos", {
              method: "POST",
              body: JSON.stringify({
                title: title || "Untitled Memo",
                content,
                type: "ai_generated",
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

          case "list_memos": {
            const params = new URLSearchParams();
            if (limit) params.append("limit", limit.toString());
            if (offset) params.append("offset", offset.toString());

            const result = await apiRequest(`/api/v1/memos?${params}`);
            return {
              success: true,
              operation,
              count: result.data?.length || 0,
              memos: (result.data || []).map((m) => ({
                id: m.id,
                title: m.title,
                excerpt: m.content?.slice(0, 100),
                createdAt: m.createdAt,
              })),
            };
          }

          case "get_stats": {
            const result = await apiRequest("/api/v1/stats");
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
        logger.error({ operation }, "BlogOps operation failed", {
          error: error.message,
        });
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
