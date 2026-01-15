/**
 * RAG Search Tool - Semantic search over blog content
 * 
 * Provides semantic search capabilities using ChromaDB and TEI embeddings.
 * Searches blog posts, memos, and other indexed content.
 */

import { config } from '../../../config.js';

const getChromaUrl = () => config.rag?.chromaUrl || process.env.CHROMA_URL || 'http://chromadb:8000';
const getTeiUrl = () => config.rag?.teiUrl || process.env.TEI_URL || 'http://embedding-server:80';
const DEFAULT_COLLECTION = 'blog_posts';
const DEFAULT_LIMIT = 5;

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
async function searchChromaDB(query, options = {}) {
  const {
    collection = DEFAULT_COLLECTION,
    limit = DEFAULT_LIMIT,
    where = {},
  } = options;

  try {
    // Generate query embedding
    const queryEmbedding = await generateEmbeddings(query);

    // Query ChromaDB
    const response = await fetch(`${getChromaUrl()}/api/v1/collections/${collection}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query_embeddings: [queryEmbedding],
        n_results: limit,
        where: Object.keys(where).length > 0 ? where : undefined,
        include: ['documents', 'metadatas', 'distances'],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ChromaDB query failed: ${response.status} ${error}`);
    }

    const data = await response.json();
    
    // Format results
    const results = [];
    const documents = data.documents?.[0] || [];
    const metadatas = data.metadatas?.[0] || [];
    const distances = data.distances?.[0] || [];

    for (let i = 0; i < documents.length; i++) {
      results.push({
        content: documents[i],
        metadata: metadatas[i] || {},
        score: 1 - (distances[i] || 0), // Convert distance to similarity score
      });
    }

    return results;
  } catch (error) {
    console.error('[RAGSearch] ChromaDB search failed:', error.message);
    throw error;
  }
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
      const { query, collection, limit, category, tags } = args;

      console.log(`[RAGSearch] Searching for: "${query}"`);

      try {
        // Build filter
        const where = {};
        if (category) {
          where.category = category;
        }
        if (tags && tags.length > 0) {
          where.tags = { $in: tags };
        }

        // Perform search
        const results = await searchChromaDB(query, {
          collection: collection || DEFAULT_COLLECTION,
          limit: limit || DEFAULT_LIMIT,
          where,
        });

        console.log(`[RAGSearch] Found ${results.length} results`);

        return {
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
  return searchChromaDB(query, options);
}

export default createRAGSearchTool;
