import { config } from '../../config.js';
import { openaiEmbeddings } from '../../lib/openai-compat-client.js';
import { CHROMA, AI_MODELS, MEMORY, FALLBACK_DATA } from '../../config/constants.js';

const getChromaUrl = () => config.rag?.chromaUrl || process.env.CHROMA_URL || CHROMA.URL;
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
  || AI_MODELS.EMBEDDING;
const COLLECTION_NAME = CHROMA.MEMORY_COLLECTION;

async function generateEmbeddings(text) {
  try {
    const result = await openaiEmbeddings(text, {
      model: getEmbeddingModel(),
      baseUrl: getEmbeddingUrl(),
      apiKey: getEmbeddingApiKey(),
    });
    return result.embeddings[0];
  } catch (error) {
    console.error('[VectorMemory] Embedding generation failed:', error.message);
    return null;
  }
}

class VectorMemoryStore {
  constructor() {
    this._initialized = false;
    this._fallbackStore = new Map();
  }

  async _ensureCollection() {
    if (this._initialized) return true;

    try {
      const response = await fetch(`${getChromaUrl()}/api/v1/collections/${COLLECTION_NAME}`);
      
      if (!response.ok && response.status === 404) {
        const createResponse = await fetch(`${getChromaUrl()}/api/v1/collections`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: COLLECTION_NAME,
            metadata: { description: 'Agent conversation memories' },
          }),
        });

        if (!createResponse.ok) {
          throw new Error(`Failed to create collection: ${createResponse.status}`);
        }
      }

      this._initialized = true;
      return true;
    } catch (error) {
      console.warn('[VectorMemory] ChromaDB initialization failed:', error.message);
      return false;
    }
  }

  async add(memory) {
    const { content, sessionId, type = MEMORY.CONVERSATION_TYPE, metadata = {} } = memory;

    if (!content) {
      console.warn('[VectorMemory] Empty content, skipping');
      return null;
    }

    try {
      const isReady = await this._ensureCollection();
      if (!isReady) {
        return this._fallbackAdd(memory);
      }

      const embedding = await generateEmbeddings(content);
      if (!embedding) {
        return this._fallbackAdd(memory);
      }

      const id = `vmem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const response = await fetch(`${getChromaUrl()}/api/v1/collections/${COLLECTION_NAME}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: [id],
          embeddings: [embedding],
          documents: [content],
          metadatas: [{
            sessionId,
            type,
            timestamp: new Date().toISOString(),
            ...metadata,
          }],
        }),
      });

      if (!response.ok) {
        throw new Error(`ChromaDB add failed: ${response.status}`);
      }

      return { id, content, sessionId, type };
    } catch (error) {
      console.error('[VectorMemory] Add failed:', error.message);
      return this._fallbackAdd(memory);
    }
  }

  async search(query, options = {}) {
    const { sessionId, limit = MEMORY.VECTOR_SEARCH_LIMIT, minScore = MEMORY.VECTOR_MIN_SCORE } = options;

    if (!query) return [];

    try {
      const isReady = await this._ensureCollection();
      if (!isReady) {
        return this._fallbackSearch(query, options);
      }

      const queryEmbedding = await generateEmbeddings(query);
      if (!queryEmbedding) {
        return this._fallbackSearch(query, options);
      }

      const where = sessionId ? { sessionId } : undefined;

      const response = await fetch(`${getChromaUrl()}/api/v1/collections/${COLLECTION_NAME}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query_embeddings: [queryEmbedding],
          n_results: limit,
          where,
          include: ['documents', 'metadatas', 'distances'],
        }),
      });

      if (!response.ok) {
        throw new Error(`ChromaDB query failed: ${response.status}`);
      }

      const data = await response.json();
      
      const results = [];
      const documents = data.documents?.[0] || [];
      const metadatas = data.metadatas?.[0] || [];
      const distances = data.distances?.[0] || [];

      for (let i = 0; i < documents.length; i++) {
        const score = 1 - (distances[i] || 0);
        if (score >= minScore) {
          results.push({
            content: documents[i],
            metadata: metadatas[i] || {},
            score,
          });
        }
      }

      return results;
    } catch (error) {
      console.error('[VectorMemory] Search failed:', error.message);
      return this._fallbackSearch(query, options);
    }
  }

  async deleteBySession(sessionId) {
    try {
      const isReady = await this._ensureCollection();
      if (!isReady) {
        this._fallbackStore.delete(sessionId);
        return;
      }

      await fetch(`${getChromaUrl()}/api/v1/collections/${COLLECTION_NAME}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          where: { sessionId },
        }),
      });

      this._fallbackStore.delete(sessionId);
    } catch (error) {
      console.error('[VectorMemory] Delete failed:', error.message);
    }
  }

  async getStats() {
    try {
      const response = await fetch(`${getChromaUrl()}/api/v1/collections/${COLLECTION_NAME}`);
      if (!response.ok) {
        return { count: 0, available: false };
      }

      const data = await response.json();
      return {
        count: data.count || 0,
        available: true,
        name: COLLECTION_NAME,
      };
    } catch (error) {
      return { count: 0, available: false, error: error.message };
    }
  }

  _fallbackAdd(memory) {
    const id = `vmem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sessionMemories = this._fallbackStore.get(memory.sessionId) || [];
    sessionMemories.push({
      id,
      content: memory.content,
      type: memory.type || MEMORY.CONVERSATION_TYPE,
      timestamp: new Date().toISOString(),
      metadata: memory.metadata || {},
    });
    this._fallbackStore.set(memory.sessionId, sessionMemories);
    return { id, ...memory };
  }

  _fallbackSearch(query, options = {}) {
    const { sessionId, limit = MEMORY.VECTOR_SEARCH_LIMIT } = options;
    const queryLower = query.toLowerCase();
    const results = [];

    const sessions = sessionId ? [sessionId] : Array.from(this._fallbackStore.keys());

    for (const sid of sessions) {
      const memories = this._fallbackStore.get(sid) || [];
      for (const memory of memories) {
        if (memory.content.toLowerCase().includes(queryLower)) {
          results.push({
            content: memory.content,
            metadata: { ...memory.metadata, sessionId: sid },
            score: FALLBACK_DATA.SEARCH_SCORE,
          });
        }
      }
    }

    return results.slice(0, limit);
  }
}

let _store = null;

export function getVectorMemory() {
  if (!_store) {
    _store = new VectorMemoryStore();
  }
  return _store;
}

export function createVectorMemory() {
  return new VectorMemoryStore();
}

export default VectorMemoryStore;
