/**
 * RAG Routes
 * 
 * ChromaDB와 OpenAI-compatible 임베딩 엔드포인트에 대한 프록시
 * Workers에서 터널(api.nodove.com)을 통해 호출합니다.
 * 
 * 엔드포인트:
 * - POST /api/v1/rag/search - 시맨틱 검색 (블로그 포스트)
 * - POST /api/v1/rag/embed - 텍스트 임베딩 생성
 * - GET /api/v1/rag/health - RAG 서비스 상태 확인
 * - POST /api/v1/rag/memories/upsert - 사용자 메모리 임베딩 저장
 * - POST /api/v1/rag/memories/search - 사용자 메모리 시맨틱 검색
 * - DELETE /api/v1/rag/memories/:memoryId - 메모리 임베딩 삭제
 * - POST /api/v1/rag/notebook/search - Open Notebook 검색
 * - POST /api/v1/rag/notebook/ask - Open Notebook RAG 질의응답
 * - GET /api/v1/rag/notebook/notebooks - Open Notebook 목록
 */

import express from 'express';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { requireFeature } from '../middleware/featureFlags.js';
import { validateBody } from '../middleware/validation.js';
import {
  ragSearchBodySchema,
  ragEmbedBodySchema,
  memoriesUpsertBodySchema,
  memoriesSearchBodySchema,
  memoriesBatchDeleteBodySchema,
  ragIndexBodySchema,
  notebookSearchBodySchema,
  notebookAskBodySchema,
} from '../middleware/schemas/rag.schema.js';
import { expandQuery, getCombinedQueries } from '../lib/query-expander.js';
import { getOpenAIEmbeddingClient, openaiEmbeddings } from '../lib/openai-compat-client.js';
import openNotebook from '../services/open-notebook.service.js';
import { createLogger } from '../lib/logger.js';
import { getDomainOutboxRepository } from '../repositories/domain-outbox.repository.js';
import { RAG_CHROMA_STREAM } from '../services/backend-outbox.service.js';

const logger = createLogger('rag');

const router = express.Router();

router.use(requireFeature('rag'));

// Memory collection prefix (user-specific collections)
const MEMORY_COLLECTION_PREFIX = 'user-memories-';

// ChromaDB v2 API configuration
const CHROMA_TENANT = 'default_tenant';
const CHROMA_DATABASE = 'default_database';

// Cache for collection name -> UUID mapping
const collectionUUIDCache = new Map();

function getIdempotencyKey(req, fallback) {
  const raw = req.headers?.['idempotency-key'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const normalized = String(value || '').trim();
  return normalized ? normalized.slice(0, 256) : fallback;
}

function stableHash(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex')
    .slice(0, 32);
}

function getMemoryCollectionName(userId) {
  return `${MEMORY_COLLECTION_PREFIX}${userId}`;
}

function toMemoryDocuments(userId, memories) {
  return memories.map((memory) => ({
    id: memory.id,
    content: memory.content,
    metadata: {
      user_id: userId,
      memory_type: memory.memoryType || 'fact',
      category: memory.category || '',
      created_at: new Date().toISOString(),
    },
  }));
}

async function enqueueRagChroma(req, { aggregateId, eventType, collection, payload, fallbackKey }) {
  return getDomainOutboxRepository().append({
    stream: RAG_CHROMA_STREAM,
    aggregateId,
    eventType,
    payload: {
      collection,
      ...payload,
    },
    idempotencyKey: getIdempotencyKey(req, fallbackKey),
  });
}

/**
 * Get ChromaDB v2 collections base URL
 * @returns {string} Base URL for collections API
 */
function getChromaCollectionsBase() {
  return `${config.rag.chromaUrl}/api/v2/tenants/${CHROMA_TENANT}/databases/${CHROMA_DATABASE}/collections`;
}

/**
 * Get collection UUID by name (ChromaDB v2 requires UUID for most operations)
 * @param {string} collectionName - 컬렉션 이름
 * @returns {Promise<string>} Collection UUID
 */
async function getCollectionUUID(collectionName) {
  // Check cache first
  if (collectionUUIDCache.has(collectionName)) {
    return collectionUUIDCache.get(collectionName);
  }

  const collectionsUrl = getChromaCollectionsBase();
  
  // List all collections and find by name
  const listResp = await fetch(collectionsUrl, {
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
 * OpenAI-compatible 임베딩 엔드포인트에서 텍스트 임베딩 생성
 * @param {string[]} texts - 임베딩할 텍스트 배열
 * @returns {Promise<number[][]>} 임베딩 벡터 배열
 */
async function getEmbeddings(texts) {
  const result = await openaiEmbeddings(texts, {
    model: config.rag.embeddingModel,
    baseUrl: config.rag.embeddingUrl,
    apiKey: config.rag.embeddingApiKey,
  });

  return result.embeddings;
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
  const collectionsBase = getChromaCollectionsBase();

  const collectionUUID = await getCollectionUUID(collection);
  if (!collectionUUID) {
    const maybeLegacy = typeof collection === 'string' && collection.includes('__')
      ? collection.replace(/__/g, '-')
      : typeof collection === 'string'
        ? collection.replace(/-/g, '__')
        : null;

    if (maybeLegacy && maybeLegacy !== collection) {
      const fallbackUUID = await getCollectionUUID(maybeLegacy);
      if (fallbackUUID) {
        const queryUrl = `${collectionsBase}/${fallbackUUID}/query`;

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
    }

    throw new Error(`Collection not found: ${collection}`);
  }

  const queryUrl = `${collectionsBase}/${collectionUUID}/query`;
  
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
  const collectionsBase = getChromaCollectionsBase();
  
  let uuid = await getCollectionUUID(collectionName);
  if (uuid) {
    return uuid;
  }

  const createResp = await fetch(collectionsBase, {
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

  if (createResp.ok) {
    const created = await createResp.json();
    if (created.id) {
      collectionUUIDCache.set(collectionName, created.id);
      return created.id;
    }
  }

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
  const collectionsBase = getChromaCollectionsBase();
  
  const collectionUUID = await ensureCollection(collectionName);

  const upsertUrl = `${collectionsBase}/${collectionUUID}/upsert`;
  
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
  const collectionsBase = getChromaCollectionsBase();
  
  const collectionUUID = await getCollectionUUID(collectionName);
  if (!collectionUUID) {
    throw new Error(`Collection not found: ${collectionName}`);
  }

  const deleteUrl = `${collectionsBase}/${collectionUUID}/delete`;
  
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

async function upsertMemoriesToChroma(userId, memories) {
  const texts = memories.map(m => m.content);
  const embeddings = await getEmbeddings(texts);
  const ids = memories.map(m => m.id);
  const documents = texts;
  const metadatas = memories.map(m => ({
    user_id: userId,
    memory_type: m.memoryType || 'fact',
    category: m.category || '',
    created_at: new Date().toISOString(),
  }));
  const collectionName = getMemoryCollectionName(userId);
  await upsertToChroma(collectionName, ids, embeddings, documents, metadatas);
  return { upserted: ids.length };
}

async function deleteMemoriesFromChroma(userId, memoryIds) {
  const collectionName = getMemoryCollectionName(userId);
  try {
    await deleteFromChroma(collectionName, memoryIds);
  } catch (err) {
    if (!err.message.includes('404') && !err.message.includes('not found')) {
      throw err;
    }
  }
  return { deleted: memoryIds.length };
}

/**
 * POST /search - 시맨틱 검색 (블로그 포스트)
 * 
 * Request Body:
 * {
 *   query: string,           // 검색 쿼리
 *   n_results?: number,      // 반환할 결과 수 (기본 5)
 *   expand?: boolean,        // 쿼리 확장 사용 여부 (기본 true)
 *   expandedOnly?: boolean   // 확장 정보만 반환 (디버깅용)
 * }
 * 
 * Response:
 * {
 *   ok: true,
 *   data: {
 *     results: [{ document, metadata, distance, score }],
 *     expansion?: { translations, keywords, expandedQueries }
 *   }
 * }
 */
router.post('/search', validateBody(ragSearchBodySchema), async (req, res) => {
  try {
    const { query, n_results = 5, expand = true, expandedOnly = false } = req.body;

    let expansion = null;
    let queriesToSearch = [query];

    if (expand) {
      try {
        expansion = await expandQuery(query, { timeout: 4000 });
        queriesToSearch = getCombinedQueries(expansion, 4);
      } catch (expandErr) {
        logger.warn({}, 'Query expansion failed, using original query', { error: expandErr.message });
      }
    }

    if (expandedOnly) {
      return res.json({
        ok: true,
        data: {
          expansion: expansion || { original: query, translations: [], keywords: [], expandedQueries: [] },
          queriesToSearch,
        },
      });
    }

    const RRF_K = 60;
    const rankMap = new Map();
    const fetchPerQuery = Math.ceil(n_results * 2);

    const searchPromises = queriesToSearch.map(async (q, queryIndex) => {
      try {
        const [embedding] = await getEmbeddings([q]);
        const chromaResult = await queryChroma(embedding, fetchPerQuery);
        return { queryIndex, chromaResult };
      } catch (err) {
        logger.warn({ query: q }, 'Search failed for query', { error: err.message });
        return { queryIndex, chromaResult: null };
      }
    });

    const searchResults = await Promise.all(searchPromises);

    for (const { queryIndex, chromaResult } of searchResults) {
      if (!chromaResult?.documents?.[0]) continue;

      const docs = chromaResult.documents[0];
      const metas = chromaResult.metadatas?.[0] || [];
      const dists = chromaResult.distances?.[0] || [];

      for (let rank = 0; rank < docs.length; rank++) {
        const docId = metas[rank]?.slug || metas[rank]?.id || `doc_${rank}`;
        
        if (!rankMap.has(docId)) {
          rankMap.set(docId, {
            document: docs[rank],
            metadata: metas[rank] || {},
            distance: dists[rank] || null,
            ranks: [],
          });
        }
        
        rankMap.get(docId).ranks.push(rank + 1);
      }
    }

    const fusedResults = [];
    for (const [docId, entry] of rankMap) {
      const rrfScore = entry.ranks.reduce((sum, r) => sum + 1 / (RRF_K + r), 0);
      fusedResults.push({
        document: entry.document,
        metadata: entry.metadata,
        distance: entry.distance,
        score: rrfScore,
      });
    }

    fusedResults.sort((a, b) => b.score - a.score);
    const finalResults = fusedResults.slice(0, n_results);

    const responseData = { results: finalResults };
    if (expansion && !expansion.fallback) {
      responseData.expansion = {
        language: expansion.language,
        translations: expansion.translations,
        keywords: expansion.keywords,
        expandedQueries: expansion.expandedQueries,
      };
    }

    res.json({ ok: true, data: responseData });
  } catch (err) {
    logger.error({}, 'RAG search error', { error: err.message });
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
router.post('/embed', validateBody(ragEmbedBodySchema), async (req, res) => {
  try {
    const { texts } = req.body;

    const embeddings = await getEmbeddings(texts);

    res.json({ ok: true, data: { embeddings } });
  } catch (err) {
    logger.error({}, 'RAG embed error', { error: err.message });
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /health - RAG 서비스 상태 확인
 */
router.get('/health', async (req, res) => {
  const status = {
    embedding: { ok: false, url: config.rag.embeddingUrl },
    chroma: { ok: false, url: config.rag.chromaUrl },
    openNotebook: { ok: false, enabled: openNotebook.isEnabled() },
  };

  try {
    const embeddingClient = getOpenAIEmbeddingClient({
      baseUrl: config.rag.embeddingUrl,
      apiKey: config.rag.embeddingApiKey,
    });
    const embeddingHealth = await embeddingClient.health();
    status.embedding.ok = embeddingHealth.ok;
    if (!embeddingHealth.ok) {
      status.embedding.error = embeddingHealth.error || 'Embedding endpoint unavailable';
    }
  } catch (err) {
    status.embedding.error = err.message;
  }

  try {
    const chromaResp = await fetch(`${config.rag.chromaUrl}/api/v2/heartbeat`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    status.chroma.ok = chromaResp.ok;
  } catch (err) {
    status.chroma.error = err.message;
  }

  if (openNotebook.isEnabled()) {
    try {
      const notebookHealth = await openNotebook.healthCheck();
      status.openNotebook.ok = notebookHealth.ok;
      if (!notebookHealth.ok) {
        status.openNotebook.error = notebookHealth.error;
      }
    } catch (err) {
      status.openNotebook.error = err.message;
    }
  }

  const coreOk = status.embedding.ok && status.chroma.ok;
  const allOk = coreOk && (!openNotebook.isEnabled() || status.openNotebook.ok);
  res.status(coreOk ? 200 : 503).json({
    ok: allOk,
    services: {
      embedding: status.embedding,
      chroma: status.chroma,
      openNotebook: status.openNotebook,
    },
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
router.post('/memories/upsert/internal', validateBody(memoriesUpsertBodySchema), async (req, res) => {
  try {
    const { userId, memories } = req.body;
    const result = await upsertMemoriesToChroma(userId, memories);
    res.json({ ok: true, data: result });
  } catch (err) {
    logger.error({}, 'Memory upsert error', { error: err.message });
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/memories/upsert', validateBody(memoriesUpsertBodySchema), async (req, res) => {
  try {
    const { userId, memories } = req.body;
    const collectionName = getMemoryCollectionName(userId);
    const documents = toMemoryDocuments(userId, memories);
    const outbox = await enqueueRagChroma(req, {
      aggregateId: `memory:${userId}`,
      eventType: 'rag.chroma.index',
      collection: collectionName,
      payload: { documents },
      fallbackKey: `rag.memory.upsert:${userId}:${stableHash({ memories })}`,
    });

    res.status(202).json({
      ok: true,
      data: {
        status: 'pending',
        outboxId: outbox.id,
        upserted: memories.length,
        collection: collectionName,
      },
    });
  } catch (err) {
    logger.error({}, 'Memory upsert enqueue error', { error: err.message });
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
router.post('/memories/search', validateBody(memoriesSearchBodySchema), async (req, res) => {
  try {
    const { userId, query, n_results = 10, memoryType, category } = req.body;

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
    logger.error({}, 'Memory search error', { error: err.message });
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * DELETE /memories/:userId/:memoryId - 메모리 임베딩 삭제
 */
router.delete('/memories/:userId/:memoryId/internal', async (req, res) => {
  try {
    const { userId, memoryId } = req.params;

    if (!userId || !memoryId) {
      return res.status(400).json({ ok: false, error: 'userId and memoryId are required' });
    }

    await deleteMemoriesFromChroma(userId, [memoryId]);

    res.json({ ok: true, data: { deleted: true } });
  } catch (err) {
    logger.error({}, 'Memory delete error', { error: err.message });
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.delete('/memories/:userId/:memoryId', async (req, res) => {
  try {
    const { userId, memoryId } = req.params;

    if (!userId || !memoryId) {
      return res.status(400).json({ ok: false, error: 'userId and memoryId are required' });
    }

    const collectionName = getMemoryCollectionName(userId);
    const outbox = await enqueueRagChroma(req, {
      aggregateId: `memory:${userId}:${memoryId}`,
      eventType: 'rag.chroma.delete',
      collection: collectionName,
      payload: { ids: [memoryId] },
      fallbackKey: `rag.memory.delete:${userId}:${memoryId}`,
    });

    res.status(202).json({
      ok: true,
      data: {
        status: 'pending',
        outboxId: outbox.id,
        deleted: true,
      },
    });
  } catch (err) {
    logger.error({}, 'Memory delete enqueue error', { error: err.message });
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /memories/batch-delete - 여러 메모리 임베딩 일괄 삭제
 */
router.post('/memories/batch-delete/internal', validateBody(memoriesBatchDeleteBodySchema), async (req, res) => {
  try {
    const { userId, memoryIds } = req.body;
    await deleteMemoriesFromChroma(userId, memoryIds);
    res.json({ ok: true, data: { deleted: memoryIds.length } });
  } catch (err) {
    logger.error({}, 'Memory batch-delete error', { error: err.message });
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/memories/batch-delete', validateBody(memoriesBatchDeleteBodySchema), async (req, res) => {
  try {
    const { userId, memoryIds } = req.body;
    const collectionName = getMemoryCollectionName(userId);
    const outbox = await enqueueRagChroma(req, {
      aggregateId: `memory:${userId}:batch-delete`,
      eventType: 'rag.chroma.delete',
      collection: collectionName,
      payload: { ids: memoryIds },
      fallbackKey: `rag.memory.batch-delete:${userId}:${stableHash({ memoryIds })}`,
    });

    res.status(202).json({
      ok: true,
      data: {
        status: 'pending',
        outboxId: outbox.id,
        deleted: memoryIds.length,
      },
    });
  } catch (err) {
    logger.error({}, 'Memory batch-delete enqueue error', { error: err.message });
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
router.post('/index', validateBody(ragIndexBodySchema), async (req, res) => {
  try {
    const { documents, collection } = req.body;
    const collectionName = collection || config.rag.chromaCollection;
    const outbox = await getDomainOutboxRepository().append({
      stream: RAG_CHROMA_STREAM,
      aggregateId: `index:${collectionName}`,
      eventType: 'rag.chroma.index',
      payload: {
        collection: collectionName,
        documents,
      },
      idempotencyKey: getIdempotencyKey(
        req,
        `rag.chroma.index:${collectionName}:${documents.map((document) => document.id).join(',')}`,
      ),
    });

    res.status(202).json({
      ok: true,
      data: {
        status: 'pending',
        outboxId: outbox.id,
        indexed: documents.length,
        collection: collectionName,
      },
    });
  } catch (err) {
    logger.error({}, 'RAG index error', { error: err.message });
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
    const outbox = await getDomainOutboxRepository().append({
      stream: RAG_CHROMA_STREAM,
      aggregateId: `index:${collectionName}:${documentId}`,
      eventType: 'rag.chroma.delete',
      payload: {
        collection: collectionName,
        ids: [documentId],
      },
      idempotencyKey: getIdempotencyKey(req, `rag.chroma.delete:${collectionName}:${documentId}`),
    });

    res.status(202).json({
      ok: true,
      data: {
        status: 'pending',
        outboxId: outbox.id,
        deleted: true,
      },
    });
  } catch (err) {
    logger.error({}, 'RAG delete error', { error: err.message });
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
    const collectionsBase = getChromaCollectionsBase();

    const collectionsResp = await fetch(collectionsBase, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!collectionsResp.ok) {
      throw new Error(`ChromaDB error: ${collectionsResp.status}`);
    }

    const collections = await collectionsResp.json();
    const collectionData = collections.find(c => c.name === collectionName);

    if (!collectionData) {
      return res.json({
        ok: true,
        data: {
          collection: collectionName,
          exists: false,
          count: 0,
        },
      });
    }

    const collectionUUID = collectionData.id;
    const countResp = await fetch(`${collectionsBase}/${collectionUUID}/count`, {
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
    logger.error({}, 'RAG status error', { error: err.message });
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /collections - 모든 컬렉션 목록
 */
router.get('/collections', async (req, res) => {
  try {
    const collectionsBase = getChromaCollectionsBase();
    
    const response = await fetch(collectionsBase, {
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
    logger.error({}, 'RAG collections error', { error: err.message });
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/notebook/search', validateBody(notebookSearchBodySchema), async (req, res) => {
  if (!openNotebook.isEnabled()) {
    return res.status(503).json({ ok: false, error: 'Open Notebook is not enabled' });
  }

  try {
    const { query, limit = 5, notebookId } = req.body;

    const results = await openNotebook.search(query, { limit, notebookId });

    res.json({ ok: true, data: { results } });
  } catch (err) {
    logger.error({}, 'Open Notebook search error', { error: err.message });
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/notebook/ask', validateBody(notebookAskBodySchema), async (req, res) => {
  if (!openNotebook.isEnabled()) {
    return res.status(503).json({ ok: false, error: 'Open Notebook is not enabled' });
  }

  try {
    const { query, notebookId, includeContext = true } = req.body;

    const result = await openNotebook.ask(query, { notebookId, includeContext });

    res.json({ ok: true, data: result });
  } catch (err) {
    logger.error({}, 'Open Notebook ask error', { error: err.message });
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/notebook/notebooks', async (req, res) => {
  if (!openNotebook.isEnabled()) {
    return res.status(503).json({ ok: false, error: 'Open Notebook is not enabled' });
  }

  try {
    const notebooks = await openNotebook.listNotebooks();

    res.json({ ok: true, data: { notebooks } });
  } catch (err) {
    logger.error({}, 'Open Notebook list error', { error: err.message });
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/notebook/health', async (req, res) => {
  if (!openNotebook.isEnabled()) {
    return res.json({ 
      ok: false, 
      enabled: false,
      error: 'Open Notebook is not enabled' 
    });
  }

  try {
    const health = await openNotebook.healthCheck();

    res.json({ 
      ok: health.ok, 
      enabled: true,
      ...health 
    });
  } catch (err) {
    res.json({ ok: false, enabled: true, error: err.message });
  }
});

export default router;
