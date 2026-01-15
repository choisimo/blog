/**
 * RAG Routes
 * 
 * ChromaDB와 TEI 임베딩 서버에 대한 프록시 엔드포인트
 * Workers에서 터널(api.nodove.com)을 통해 호출합니다.
 * 
 * 엔드포인트:
 * - POST /api/v1/rag/search - 시맨틱 검색 (블로그 포스트)
 * - POST /api/v1/rag/embed - 텍스트 임베딩 생성
 * - GET /api/v1/rag/health - RAG 서비스 상태 확인
 * - POST /api/v1/rag/memories/upsert - 사용자 메모리 임베딩 저장
 * - POST /api/v1/rag/memories/search - 사용자 메모리 시맨틱 검색
 * - DELETE /api/v1/rag/memories/:memoryId - 메모리 임베딩 삭제
 */

import express from 'express';
import { config } from '../config.js';
import { requireFeature } from '../middleware/featureFlags.js';

const router = express.Router();

router.use(requireFeature('rag'));

// Memory collection prefix (user-specific collections)
const MEMORY_COLLECTION_PREFIX = 'user-memories-';

// Cache for collection name -> UUID mapping
const collectionUUIDCache = new Map();

/**
 * Get collection UUID by name (ChromaDB v0.5+ requires UUID for most operations)
 * @param {string} collectionName - 컬렉션 이름
 * @returns {Promise<string>} Collection UUID
 */
async function getCollectionUUID(collectionName) {
  // Check cache first
  if (collectionUUIDCache.has(collectionName)) {
    return collectionUUIDCache.get(collectionName);
  }

  const chromaBase = config.rag.chromaUrl;
  
  // List all collections and find by name
  const listResp = await fetch(`${chromaBase}/api/v1/collections`, {
    method: 'GET',
  });
  
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

/**
 * TEI 서버에서 텍스트 임베딩 생성
 * @param {string[]} texts - 임베딩할 텍스트 배열
 * @returns {Promise<number[][]>} 임베딩 벡터 배열
 */
async function getEmbeddings(texts) {
  const response = await fetch(config.rag.teiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs: texts }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TEI error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  // TEI returns either { embeddings: [...] } or direct array
  return data.embeddings || data;
}

/**
 * ChromaDB에서 시맨틱 검색
 * @param {number[]} embedding - 쿼리 임베딩
 * @param {number} nResults - 반환할 결과 수
 * @param {string} collectionName - 컬렉션 이름
 * @param {object} whereFilter - 필터 조건
 * @returns {Promise<object>} 검색 결과
 */
async function queryChroma(embedding, nResults = 5, collectionName = null, whereFilter = null) {
  const collection = collectionName || config.rag.chromaCollection;
  const chromaBase = config.rag.chromaUrl;

  // Get collection UUID (ChromaDB v0.5+ requires UUID)
  const collectionUUID = await getCollectionUUID(collection);
  if (!collectionUUID) {
    throw new Error(`Collection not found: ${collection}`);
  }

  // ChromaDB v0.5+ API: POST /api/v1/collections/{collection_uuid}/query
  const queryUrl = `${chromaBase}/api/v1/collections/${collectionUUID}/query`;
  
  const body = {
    query_embeddings: [embedding],
    n_results: nResults,
    include: ['documents', 'metadatas', 'distances'],
  };

  if (whereFilter) {
    body.where = whereFilter;
  }

  const response = await fetch(queryUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ChromaDB error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * ChromaDB 컬렉션 존재 여부 확인 및 생성
 * @param {string} collectionName - 컬렉션 이름
 * @returns {Promise<string>} Collection UUID
 */
async function ensureCollection(collectionName) {
  const chromaBase = config.rag.chromaUrl;
  
  // Check if collection exists
  let uuid = await getCollectionUUID(collectionName);
  if (uuid) {
    return uuid;
  }

  // Create collection
  const createResp = await fetch(`${chromaBase}/api/v1/collections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: collectionName,
      metadata: { 'hnsw:space': 'cosine' },
    }),
  });

  if (!createResp.ok && createResp.status !== 409) {
    const errorText = await createResp.text();
    throw new Error(`Failed to create collection: ${createResp.status} - ${errorText}`);
  }

  // Get UUID from created collection or re-fetch
  if (createResp.ok) {
    const created = await createResp.json();
    if (created.id) {
      collectionUUIDCache.set(collectionName, created.id);
      return created.id;
    }
  }

  // Re-fetch to get UUID (in case of 409 conflict)
  uuid = await getCollectionUUID(collectionName);
  if (!uuid) {
    throw new Error(`Failed to get UUID for collection: ${collectionName}`);
  }
  return uuid;
}

/**
 * ChromaDB에 문서 upsert
 * @param {string} collectionName - 컬렉션 이름
 * @param {string[]} ids - 문서 ID 배열
 * @param {number[][]} embeddings - 임베딩 배열
 * @param {string[]} documents - 문서 텍스트 배열
 * @param {object[]} metadatas - 메타데이터 배열
 */
async function upsertToChroma(collectionName, ids, embeddings, documents, metadatas) {
  const chromaBase = config.rag.chromaUrl;
  
  // Ensure collection exists and get UUID (ChromaDB v0.5+ requires UUID)
  const collectionUUID = await ensureCollection(collectionName);

  const upsertUrl = `${chromaBase}/api/v1/collections/${collectionUUID}/upsert`;
  
  const response = await fetch(upsertUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ids,
      embeddings,
      documents,
      metadatas,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ChromaDB upsert error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * ChromaDB에서 문서 삭제
 * @param {string} collectionName - 컬렉션 이름
 * @param {string[]} ids - 삭제할 문서 ID 배열
 */
async function deleteFromChroma(collectionName, ids) {
  const chromaBase = config.rag.chromaUrl;
  
  // Get collection UUID (ChromaDB v0.5+ requires UUID)
  const collectionUUID = await getCollectionUUID(collectionName);
  if (!collectionUUID) {
    throw new Error(`Collection not found: ${collectionName}`);
  }

  const deleteUrl = `${chromaBase}/api/v1/collections/${collectionUUID}/delete`;
  
  const response = await fetch(deleteUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ChromaDB delete error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * POST /search - 시맨틱 검색 (블로그 포스트)
 * 
 * Request Body:
 * {
 *   query: string,      // 검색 쿼리
 *   n_results?: number  // 반환할 결과 수 (기본 5)
 * }
 * 
 * Response:
 * {
 *   ok: true,
 *   data: {
 *     results: [{ document, metadata, distance }]
 *   }
 * }
 */
router.post('/search', async (req, res) => {
  try {
    const { query, n_results = 5 } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ ok: false, error: 'query is required' });
    }

    // 1. 쿼리 텍스트를 임베딩으로 변환
    const [embedding] = await getEmbeddings([query]);

    // 2. ChromaDB에서 유사한 문서 검색
    const chromaResult = await queryChroma(embedding, n_results);

    // 3. 결과 포맷팅
    const results = [];
    if (chromaResult.documents && chromaResult.documents[0]) {
      const docs = chromaResult.documents[0];
      const metas = chromaResult.metadatas?.[0] || [];
      const dists = chromaResult.distances?.[0] || [];

      for (let i = 0; i < docs.length; i++) {
        results.push({
          document: docs[i],
          metadata: metas[i] || {},
          distance: dists[i] || null,
        });
      }
    }

    res.json({ ok: true, data: { results } });
  } catch (err) {
    console.error('RAG search error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /embed - 텍스트 임베딩 생성
 * 
 * Request Body:
 * {
 *   texts: string[]  // 임베딩할 텍스트 배열
 * }
 * 
 * Response:
 * {
 *   ok: true,
 *   data: {
 *     embeddings: number[][]
 *   }
 * }
 */
router.post('/embed', async (req, res) => {
  try {
    const { texts } = req.body;

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({ ok: false, error: 'texts array is required' });
    }

    if (texts.length > 32) {
      return res.status(400).json({ ok: false, error: 'Maximum 32 texts per request' });
    }

    const embeddings = await getEmbeddings(texts);

    res.json({ ok: true, data: { embeddings } });
  } catch (err) {
    console.error('RAG embed error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /health - RAG 서비스 상태 확인
 */
router.get('/health', async (req, res) => {
  const status = {
    tei: { ok: false, url: config.rag.teiUrl },
    chroma: { ok: false, url: config.rag.chromaUrl },
  };

  // TEI 상태 확인
  try {
    const teiResp = await fetch(`${config.rag.teiUrl}/health`, { 
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    status.tei.ok = teiResp.ok;
  } catch (err) {
    status.tei.error = err.message;
  }

  // ChromaDB 상태 확인
  try {
    const chromaResp = await fetch(`${config.rag.chromaUrl}/api/v1/heartbeat`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    status.chroma.ok = chromaResp.ok;
  } catch (err) {
    status.chroma.error = err.message;
  }

  const allOk = status.tei.ok && status.chroma.ok;
  res.status(allOk ? 200 : 503).json({
    ok: allOk,
    services: status,
    collection: config.rag.chromaCollection,
  });
});

// ========================================
// MEMORY RAG ENDPOINTS
// ========================================

/**
 * POST /memories/upsert - 사용자 메모리 임베딩 저장
 * 
 * Request Body:
 * {
 *   userId: string,
 *   memories: [{ id, content, memoryType, category }]
 * }
 */
router.post('/memories/upsert', async (req, res) => {
  try {
    const { userId, memories } = req.body;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ ok: false, error: 'userId is required' });
    }

    if (!memories || !Array.isArray(memories) || memories.length === 0) {
      return res.status(400).json({ ok: false, error: 'memories array is required' });
    }

    if (memories.length > 20) {
      return res.status(400).json({ ok: false, error: 'Maximum 20 memories per request' });
    }

    // 1. Extract texts for embedding
    const texts = memories.map(m => m.content);
    
    // 2. Generate embeddings
    const embeddings = await getEmbeddings(texts);

    // 3. Prepare data for ChromaDB
    const ids = memories.map(m => m.id);
    const documents = texts;
    const metadatas = memories.map(m => ({
      user_id: userId,
      memory_type: m.memoryType || 'fact',
      category: m.category || '',
      created_at: new Date().toISOString(),
    }));

    // 4. Upsert to user-specific collection
    const collectionName = `${MEMORY_COLLECTION_PREFIX}${userId}`;
    await upsertToChroma(collectionName, ids, embeddings, documents, metadatas);

    res.json({ ok: true, data: { upserted: ids.length } });
  } catch (err) {
    console.error('Memory upsert error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /memories/search - 사용자 메모리 시맨틱 검색
 * 
 * Request Body:
 * {
 *   userId: string,
 *   query: string,
 *   n_results?: number,
 *   memoryType?: string,
 *   category?: string
 * }
 */
router.post('/memories/search', async (req, res) => {
  try {
    const { userId, query, n_results = 10, memoryType, category } = req.body;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ ok: false, error: 'userId is required' });
    }

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ ok: false, error: 'query is required' });
    }

    // 1. Generate query embedding
    const [embedding] = await getEmbeddings([query]);

    // 2. Build where filter
    let whereFilter = null;
    if (memoryType || category) {
      whereFilter = {};
      if (memoryType) whereFilter.memory_type = memoryType;
      if (category) whereFilter.category = category;
    }

    // 3. Search in user-specific collection
    const collectionName = `${MEMORY_COLLECTION_PREFIX}${userId}`;
    
    let chromaResult;
    try {
      chromaResult = await queryChroma(embedding, n_results, collectionName, whereFilter);
    } catch (err) {
      // Collection might not exist yet (no memories stored)
      if (err.message.includes('404') || err.message.includes('not found')) {
        return res.json({ ok: true, data: { results: [] } });
      }
      throw err;
    }

    // 4. Format results
    const results = [];
    if (chromaResult.documents && chromaResult.documents[0]) {
      const docs = chromaResult.documents[0];
      const metas = chromaResult.metadatas?.[0] || [];
      const dists = chromaResult.distances?.[0] || [];
      const ids = chromaResult.ids?.[0] || [];

      for (let i = 0; i < docs.length; i++) {
        results.push({
          id: ids[i],
          document: docs[i],
          metadata: metas[i] || {},
          distance: dists[i] || null,
          // Convert distance to similarity score (cosine distance: 0 = identical)
          similarity: dists[i] != null ? Math.max(0, 1 - dists[i]) : null,
        });
      }
    }

    res.json({ ok: true, data: { results } });
  } catch (err) {
    console.error('Memory search error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * DELETE /memories/:userId/:memoryId - 메모리 임베딩 삭제
 */
router.delete('/memories/:userId/:memoryId', async (req, res) => {
  try {
    const { userId, memoryId } = req.params;

    if (!userId || !memoryId) {
      return res.status(400).json({ ok: false, error: 'userId and memoryId are required' });
    }

    const collectionName = `${MEMORY_COLLECTION_PREFIX}${userId}`;
    
    try {
      await deleteFromChroma(collectionName, [memoryId]);
    } catch (err) {
      // Ignore if collection or document doesn't exist
      if (!err.message.includes('404') && !err.message.includes('not found')) {
        throw err;
      }
    }

    res.json({ ok: true, data: { deleted: true } });
  } catch (err) {
    console.error('Memory delete error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /memories/batch-delete - 여러 메모리 임베딩 일괄 삭제
 */
router.post('/memories/batch-delete', async (req, res) => {
  try {
    const { userId, memoryIds } = req.body;

    if (!userId || !Array.isArray(memoryIds) || memoryIds.length === 0) {
      return res.status(400).json({ ok: false, error: 'userId and memoryIds are required' });
    }

    const collectionName = `${MEMORY_COLLECTION_PREFIX}${userId}`;
    
    try {
      await deleteFromChroma(collectionName, memoryIds);
    } catch (err) {
      if (!err.message.includes('404') && !err.message.includes('not found')) {
        throw err;
      }
    }

    res.json({ ok: true, data: { deleted: memoryIds.length } });
  } catch (err) {
    console.error('Memory batch-delete error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ========================================
// INDEX MANAGEMENT ENDPOINTS
// ========================================

/**
 * POST /index - 문서 인덱싱
 * 
 * Request Body:
 * {
 *   documents: [{
 *     id: string,
 *     content: string,
 *     metadata?: object
 *   }],
 *   collection?: string  // Optional custom collection name
 * }
 */
router.post('/index', async (req, res) => {
  try {
    const { documents, collection } = req.body;

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({ ok: false, error: 'documents array is required' });
    }

    if (documents.length > 100) {
      return res.status(400).json({ ok: false, error: 'Maximum 100 documents per request' });
    }

    // Validate documents
    for (const doc of documents) {
      if (!doc.id || !doc.content) {
        return res.status(400).json({ ok: false, error: 'Each document must have id and content' });
      }
    }

    // 1. Extract texts for embedding
    const texts = documents.map(d => d.content);
    
    // 2. Generate embeddings
    const embeddings = await getEmbeddings(texts);

    // 3. Prepare data for ChromaDB
    const ids = documents.map(d => d.id);
    const metadatas = documents.map(d => ({
      ...d.metadata,
      indexed_at: new Date().toISOString(),
    }));

    // 4. Upsert to collection
    const collectionName = collection || config.rag.chromaCollection;
    await upsertToChroma(collectionName, ids, embeddings, texts, metadatas);

    res.json({ ok: true, data: { indexed: ids.length, collection: collectionName } });
  } catch (err) {
    console.error('RAG index error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * DELETE /index/:documentId - 인덱스에서 문서 삭제
 */
router.delete('/index/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { collection } = req.query;

    if (!documentId) {
      return res.status(400).json({ ok: false, error: 'documentId is required' });
    }

    const collectionName = collection || config.rag.chromaCollection;
    
    try {
      await deleteFromChroma(collectionName, [documentId]);
    } catch (err) {
      if (!err.message.includes('404') && !err.message.includes('not found')) {
        throw err;
      }
    }

    res.json({ ok: true, data: { deleted: true } });
  } catch (err) {
    console.error('RAG delete error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /status - 인덱스 상태 확인
 */
router.get('/status', async (req, res) => {
  try {
    const { collection } = req.query;
    const collectionName = collection || config.rag.chromaCollection;
    const chromaBase = config.rag.chromaUrl;

    // Get collection info using NAME (ChromaDB GET accepts name)
    const collectionResp = await fetch(`${chromaBase}/api/v1/collections/${collectionName}`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!collectionResp.ok) {
      if (collectionResp.status === 404 || collectionResp.status === 500) {
        // Collection doesn't exist
        return res.json({
          ok: true,
          data: {
            collection: collectionName,
            exists: false,
            count: 0,
          },
        });
      }
      throw new Error(`ChromaDB error: ${collectionResp.status}`);
    }

    const collectionData = await collectionResp.json();
    const collectionUUID = collectionData.id;

    // Get count using UUID (ChromaDB requires UUID for count)
    const countResp = await fetch(`${chromaBase}/api/v1/collections/${collectionUUID}/count`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    let count = 0;
    if (countResp.ok) {
      const countData = await countResp.json();
      count = countData.count || countData || 0;
    }

    res.json({
      ok: true,
      data: {
        collection: collectionName,
        exists: true,
        count,
        metadata: collectionData.metadata || {},
      },
    });
  } catch (err) {
    console.error('RAG status error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /collections - 모든 컬렉션 목록
 */
router.get('/collections', async (req, res) => {
  try {
    const chromaBase = config.rag.chromaUrl;
    
    const response = await fetch(`${chromaBase}/api/v1/collections`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`ChromaDB error: ${response.status}`);
    }

    const collections = await response.json();

    res.json({
      ok: true,
      data: {
        collections: collections.map(c => ({
          name: c.name,
          metadata: c.metadata || {},
        })),
        total: collections.length,
      },
    });
  } catch (err) {
    console.error('RAG collections error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
