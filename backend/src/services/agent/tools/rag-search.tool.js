/**
 * RAG Search Tool - Semantic search over blog content
 * 
 * Provides semantic search capabilities using ChromaDB and OpenAI-compatible embeddings.
 * Searches blog posts, memos, and other indexed content.
 * 
 * Uses ChromaDB v2 API for compatibility with current server setup.
 */

import { config } from '../../../config.js';
import { openaiEmbeddings } from '../../ai/openai-client.service.js';
import { expandQuery, getCombinedQueries } from '../../ai/query-expander.service.js';

const getChromaUrl = () => config.rag?.chromaUrl || process.env.CHROMA_URL || 'http://chromadb:8000';
const getEmbeddingUrl = () => config.rag?.embeddingUrl
  || process.env.AI_EMBEDDING_URL
  || process.env.AI_SERVER_URL
  || 'https://api.openai.com/v1';
const getEmbeddingApiKey = () => config.rag?.embeddingApiKey
  || process.env.AI_EMBEDDING_API_KEY
  || process.env.AI_API_KEY
  || process.env.OPENAI_API_KEY;
const getEmbeddingModel = () => config.rag?.embeddingModel
  || process.env.AI_EMBED_MODEL
  || 'text-embedding-3-small';
const getDefaultCollection = () => config.rag?.chromaCollection || process.env.CHROMA_COLLECTION || 'blog-posts-all-MiniLM-L6-v2';
const DEFAULT_LIMIT = 5;
const RRF_K = 60;

// ChromaDB v2 API configuration
const CHROMA_TENANT = 'default_tenant';
const CHROMA_DATABASE = 'default_database';

// Cache for collection name -> UUID mapping
const collectionUUIDCache = new Map();

/**
 * Get ChromaDB v2 collections base URL
 */
function getChromaCollectionsBase() {
  return `${getChromaUrl()}/api/v2/tenants/${CHROMA_TENANT}/databases/${CHROMA_DATABASE}/collections`;
}

/**
 * Get collection UUID by name (ChromaDB v2 requires UUID for most operations)
 */
async function getCollectionUUID(collectionName) {
  if (collectionUUIDCache.has(collectionName)) {
    return collectionUUIDCache.get(collectionName);
  }

  const collectionsUrl = getChromaCollectionsBase();
  
  const listResp = await fetch(collectionsUrl, { method: 'GET' });
  
  if (!listResp.ok) {
    throw new Error(`Failed to list collections: ${listResp.status}`);
  }
  
  const collections = await listResp.json();
  const collection = collections.find(c => c.name === collectionName);
  
  if (collection) {
    collectionUUIDCache.set(collectionName, collection.id);
    return collection.id;
  }
  
  return null;
}

async function generateEmbeddings(text) {
  try {
    const result = await openaiEmbeddings(text, {
      model: getEmbeddingModel(),
      baseUrl: getEmbeddingUrl(),
      apiKey: getEmbeddingApiKey(),
    });
    return result.embeddings[0];
  } catch (error) {
    console.error('[RAGSearch] Embedding generation failed:', error.message);
    throw error;
  }
}

async function queryChromaV2(collectionUUID, embedding, nResults, whereFilter) {
  const collectionsBase = getChromaCollectionsBase();
  const queryUrl = `${collectionsBase}/${collectionUUID}/query`;
  
  const body = {
    query_embeddings: [embedding],
    n_results: nResults,
    include: ['documents', 'metadatas', 'distances'],
  };

  if (whereFilter && Object.keys(whereFilter).length > 0) {
    body.where = whereFilter;
  }

  const response = await fetch(queryUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ChromaDB query failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

async function searchWithExpansion(query, options = {}) {
  const {
    collection = getDefaultCollection(),
    limit = DEFAULT_LIMIT,
    where = {},
    expand = true,
  } = options;

  const collectionUUID = await getCollectionUUID(collection);
  if (!collectionUUID) {
    console.warn(`[RAGSearch] Collection not found: ${collection}`);
    return { results: [], expansion: null };
  }

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
      const data = await queryChromaV2(collectionUUID, queryEmbedding, fetchPerQuery, where);
      
      const documents = data.documents?.[0] || [];
      const metadatas = data.metadatas?.[0] || [];
      const distances = data.distances?.[0] || [];

      for (let rank = 0; rank < documents.length; rank++) {
        const docId = metadatas[rank]?.slug || metadatas[rank]?.doc_id || metadatas[rank]?.id || `doc_${rank}`;

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
          description: 'The collection to search (uses config default if not specified)',
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
          collection: collection || getDefaultCollection(),
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
