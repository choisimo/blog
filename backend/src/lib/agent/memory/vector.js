/**
 * Vector Memory - ChromaDB-backed semantic memory
 * 
 * Provides semantic search over conversation history and memories
 * using vector embeddings stored in ChromaDB.
 */

// Configuration
const CHROMA_URL = process.env.CHROMA_URL || 'http://chromadb:8000';
const TEI_URL = process.env.TEI_URL || 'http://embedding-server:80';
const COLLECTION_NAME = 'agent_memories';

/**
 * Generate embeddings using TEI server
 */
async function generateEmbeddings(text) {
  try {
    const response = await fetch(`${TEI_URL}/embed`, {
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
    console.error('[VectorMemory] Embedding generation failed:', error.message);
    return null;
  }
}

/**
 * Vector Memory Store
 */
class VectorMemoryStore {
  constructor() {
    this._initialized = false;
    this._fallbackStore = new Map();
  }

  /**
   * Initialize ChromaDB collection
   */
  async _ensureCollection() {
    if (this._initialized) return true;

    try {
      // Check if collection exists
      const response = await fetch(`${CHROMA_URL}/api/v1/collections/${COLLECTION_NAME}`);
      
      if (!response.ok && response.status === 404) {
        // Create collection
        const createResponse = await fetch(`${CHROMA_URL}/api/v1/collections`, {
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

  /**
   * Add a memory to vector store
   * @param {object} memory
   * @param {string} memory.content - Text content to embed
   * @param {string} memory.sessionId - Session identifier
   * @param {string} [memory.type] - Memory type
   * @param {object} [memory.metadata] - Additional metadata
   */
  async add(memory) {
    const { content, sessionId, type = 'conversation', metadata = {} } = memory;

    if (!content) {
      console.warn('[VectorMemory] Empty content, skipping');
      return null;
    }

    try {
      const isReady = await this._ensureCollection();
      if (!isReady) {
        return this._fallbackAdd(memory);
      }

      // Generate embedding
      const embedding = await generateEmbeddings(content);
      if (!embedding) {
        return this._fallbackAdd(memory);
      }

      const id = `vmem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Add to ChromaDB
      const response = await fetch(`${CHROMA_URL}/api/v1/collections/${COLLECTION_NAME}/add`, {
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

  /**
   * Search for similar memories
   * @param {string} query - Search query
   * @param {object} options
   * @param {string} [options.sessionId] - Filter by session
   * @param {number} [options.limit] - Max results
   * @param {number} [options.minScore] - Minimum similarity score
   */
  async search(query, options = {}) {
    const { sessionId, limit = 5, minScore = 0.5 } = options;

    if (!query) return [];

    try {
      const isReady = await this._ensureCollection();
      if (!isReady) {
        return this._fallbackSearch(query, options);
      }

      // Generate query embedding
      const queryEmbedding = await generateEmbeddings(query);
      if (!queryEmbedding) {
        return this._fallbackSearch(query, options);
      }

      // Build where filter
      const where = sessionId ? { sessionId } : undefined;

      // Query ChromaDB
      const response = await fetch(`${CHROMA_URL}/api/v1/collections/${COLLECTION_NAME}/query`, {
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
      
      // Format results
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

  /**
   * Delete memories by session
   * @param {string} sessionId
   */
  async deleteBySession(sessionId) {
    try {
      const isReady = await this._ensureCollection();
      if (!isReady) {
        this._fallbackStore.delete(sessionId);
        return;
      }

      await fetch(`${CHROMA_URL}/api/v1/collections/${COLLECTION_NAME}/delete`, {
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

  /**
   * Get collection stats
   */
  async getStats() {
    try {
      const response = await fetch(`${CHROMA_URL}/api/v1/collections/${COLLECTION_NAME}`);
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

  // ============================================================================
  // Fallback in-memory storage (when ChromaDB is unavailable)
  // ============================================================================

  _fallbackAdd(memory) {
    const id = `vmem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sessionMemories = this._fallbackStore.get(memory.sessionId) || [];
    sessionMemories.push({
      id,
      content: memory.content,
      type: memory.type || 'conversation',
      timestamp: new Date().toISOString(),
      metadata: memory.metadata || {},
    });
    this._fallbackStore.set(memory.sessionId, sessionMemories);
    return { id, ...memory };
  }

  _fallbackSearch(query, options = {}) {
    const { sessionId, limit = 5 } = options;
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
            score: 0.8, // Simple text match
          });
        }
      }
    }

    return results.slice(0, limit);
  }
}

// ============================================================================
// Singleton & Exports
// ============================================================================

let _store = null;

/**
 * Get the singleton VectorMemoryStore instance
 */
export function getVectorMemory() {
  if (!_store) {
    _store = new VectorMemoryStore();
  }
  return _store;
}

/**
 * Create a new VectorMemoryStore instance
 */
export function createVectorMemory() {
  return new VectorMemoryStore();
}

export default VectorMemoryStore;
