/**
 * RAG Search Tool - Semantic search over blog content
 * 
 * Provides semantic search capabilities using ChromaDB and TEI embeddings.
 * Searches blog posts, memos, and other indexed content.
 */

import { config } from '../../../config.js';
import { expandQuery, getCombinedQueries } from '../../query-expander.js';

const getChromaUrl = () => config.rag?.chromaUrl || process.env.CHROMA_URL || 'http://chromadb:8000';
const getTeiUrl = () => config.rag?.teiUrl || process.env.TEI_URL || 'http://embedding-server:80';
const DEFAULT_COLLECTION = 'blog_posts';
const DEFAULT_LIMIT = 5;
const RRF_K = 60;

/**
 * Generate embeddings using TEI server
 */
async function generateEmbeddings(text) {
  try {
    const response = await fetch(`${getTeiUrl()}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: text }),
    });

    if (!response.ok) {
      throw new Error(`TEI embedding failed: ${response.status}`);
    }

    const embeddings = await response.json();
    return Array.isArray(embeddings[0]) ? embeddings[0] : embeddings;
  } catch (error) {
    console.error('[RAGSearch] Embedding generation failed:', error.message);
    throw error;
  }
}

/**
 * Search ChromaDB collection
 */
async function searchWithExpansion(query, options = {}) {
  const {
    collection = DEFAULT_COLLECTION,
    limit = DEFAULT_LIMIT,
    where = {},
    expand = true,
  } = options;

  let queriesToSearch = [query];
  let expansion = null;

  if (expand) {
    try {
      expansion = await expandQuery(query, { timeout: 3000 });
      queriesToSearch = getCombinedQueries(expansion, 3);
      console.log(`[RAGSearch] Expanded "${query}" to ${queriesToSearch.length} queries`);
    } catch (err) {
      console.warn('[RAGSearch] Query expansion failed:', err.message);
    }
  }

  const rankMap = new Map();
  const fetchPerQuery = Math.ceil(limit * 2);

  for (let qIdx = 0; qIdx < queriesToSearch.length; qIdx++) {
    const q = queriesToSearch[qIdx];
    try {
      const queryEmbedding = await generateEmbeddings(q);
      const response = await fetch(`${getChromaUrl()}/api/v1/collections/${collection}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query_embeddings: [queryEmbedding],
          n_results: fetchPerQuery,
          where: Object.keys(where).length > 0 ? where : undefined,
          include: ['documents', 'metadatas', 'distances'],
        }),
      });

      if (!response.ok) continue;

      const data = await response.json();
      const documents = data.documents?.[0] || [];
      const metadatas = data.metadatas?.[0] || [];
      const distances = data.distances?.[0] || [];

      for (let rank = 0; rank < documents.length; rank++) {
        const docId = metadatas[rank]?.slug || metadatas[rank]?.id || `doc_${rank}`;

        if (!rankMap.has(docId)) {
          rankMap.set(docId, {
            content: documents[rank],
            metadata: metadatas[rank] || {},
            distance: distances[rank] || null,
            ranks: [],
          });
        }
        rankMap.get(docId).ranks.push(rank + 1);
      }
    } catch (err) {
      console.warn(`[RAGSearch] Search failed for "${q}":`, err.message);
    }
  }

  const results = [];
  for (const [, entry] of rankMap) {
    const rrfScore = entry.ranks.reduce((sum, r) => sum + 1 / (RRF_K + r), 0);
    results.push({
      content: entry.content,
      metadata: entry.metadata,
      score: rrfScore,
    });
  }

  results.sort((a, b) => b.score - a.score);
  return { results: results.slice(0, limit), expansion };
}

async function searchChromaDB(query, options = {}) {
  return searchWithExpansion(query, options);
}

/**
 * Create RAG Search Tool
 */
export function createRAGSearchTool() {
  return {
    name: 'rag_search',
    description: 'Search blog posts and content using semantic search. Use this to find relevant articles, posts, or information from the blog.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to find relevant content',
        },
        collection: {
          type: 'string',
          description: 'The collection to search (default: blog_posts)',
          enum: ['blog_posts', 'memos', 'comments'],
          default: 'blog_posts',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 5)',
          default: 5,
        },
        category: {
          type: 'string',
          description: 'Filter by category (optional)',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by tags (optional)',
        },
      },
      required: ['query'],
    },

    async execute(args) {
      const { query, collection, limit, category, tags, expand = true } = args;

      console.log(`[RAGSearch] Searching for: "${query}" (expand: ${expand})`);

      try {
        const where = {};
        if (category) {
          where.category = category;
        }
        if (tags && tags.length > 0) {
          where.tags = { $in: tags };
        }

        const { results, expansion } = await searchWithExpansion(query, {
          collection: collection || DEFAULT_COLLECTION,
          limit: limit || DEFAULT_LIMIT,
          where,
          expand,
        });

        console.log(`[RAGSearch] Found ${results.length} results`);

        const response = {
          success: true,
          query,
          count: results.length,
          results: results.map(r => ({
            content: r.content?.slice(0, 500) + (r.content?.length > 500 ? '...' : ''),
            title: r.metadata?.title,
            slug: r.metadata?.slug,
            category: r.metadata?.category,
            tags: r.metadata?.tags,
            score: r.score?.toFixed(3),
          })),
        };

        if (expansion && !expansion.fallback) {
          response.expansion = {
            language: expansion.language,
            translations: expansion.translations,
            keywords: expansion.keywords?.slice(0, 5),
          };
        }

        return response;
      } catch (error) {
        console.error('[RAGSearch] Search failed:', error.message);
        return {
          success: false,
          error: error.message,
          query,
        };
      }
    },
  };
}

/**
 * Direct search function for use outside of agent
 */
export async function ragSearch(query, options = {}) {
  const { results } = await searchWithExpansion(query, options);
  return results;
}

export default createRAGSearchTool;
