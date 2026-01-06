/**
 * Hybrid RAG Search Service
 * 
 * Combines semantic (vector) search with keyword (BM25-style) search
 * using Reciprocal Rank Fusion (RRF) for optimal results.
 * 
 * Features:
 * - Always-on semantic search (no keyword trigger required)
 * - Keyword + Semantic hybrid search with RRF fusion
 * - D1 logging for search analytics and weight optimization
 * - Intent caching for faster repeated queries
 */

import { config } from '../config.js';
import { query, queryOne, execute, isD1Configured } from './d1.js';
import crypto from 'crypto';

// ============================================================================
// Configuration Constants
// ============================================================================

const DEFAULT_RRF_K = 60;  // Standard RRF constant
const DEFAULT_SEMANTIC_WEIGHT = 0.6;
const DEFAULT_KEYWORD_WEIGHT = 0.4;
const MIN_SEMANTIC_SCORE = 0.3;  // Minimum similarity threshold
const MAX_RESULTS = 10;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate hash for query (for deduplication and caching)
 */
function hashQuery(query) {
  return crypto.createHash('sha256').update(query.toLowerCase().trim()).digest('hex').slice(0, 16);
}

/**
 * Generate UUID for session
 */
function generateSessionId() {
  return `rag_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Normalize query for intent matching
 */
function normalizeQuery(query) {
  return query
    .toLowerCase()
    .replace(/[^\w\s가-힣]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract keywords from query for BM25-style matching
 */
function extractKeywords(query) {
  const stopwords = new Set([
    // English
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'about',
    'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'under', 'again', 'further', 'then', 'once', 'here',
    'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more',
    'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
    'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or',
    'because', 'as', 'until', 'while', 'this', 'that', 'these', 'those',
    'what', 'which', 'who', 'whom', 'i', 'me', 'my', 'myself', 'we', 'our',
    'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they',
    // Korean
    '은', '는', '이', '가', '을', '를', '의', '에', '에서', '로', '으로',
    '와', '과', '도', '만', '까지', '부터', '보다', '처럼', '같이',
    '하다', '되다', '있다', '없다', '이다', '아니다',
    '그', '저', '이', '그것', '저것', '이것',
    '뭐', '무엇', '어떤', '어디', '언제', '왜', '어떻게',
    '좀', '너무', '매우', '정말', '아주', '많이',
    '해', '해줘', '해주세요', '알려', '알려줘', '보여', '보여줘',
    '추천', '추천해', '찾아', '찾아줘', '검색', '검색해',
  ]);
  
  const normalized = normalizeQuery(query);
  const words = normalized.split(' ');
  
  return words.filter(word => 
    word.length >= 2 && !stopwords.has(word)
  );
}

/**
 * Simple BM25-style keyword scoring
 */
function calculateKeywordScore(keywords, document, metadata = {}) {
  if (!keywords.length) return 0;
  
  const text = [
    metadata.title || '',
    metadata.category || '',
    metadata.tags || '',
    document || '',
  ].join(' ').toLowerCase();
  
  let score = 0;
  const titleBoost = 3.0;  // Title matches are more important
  const categoryBoost = 2.0;
  const tagBoost = 2.5;
  
  for (const keyword of keywords) {
    // Title match
    if ((metadata.title || '').toLowerCase().includes(keyword)) {
      score += titleBoost;
    }
    // Category match
    if ((metadata.category || '').toLowerCase().includes(keyword)) {
      score += categoryBoost;
    }
    // Tag match
    if ((metadata.tags || '').toLowerCase().includes(keyword)) {
      score += tagBoost;
    }
    // Content match (basic frequency)
    const regex = new RegExp(keyword, 'gi');
    const matches = text.match(regex);
    if (matches) {
      // Log-scaled frequency (diminishing returns)
      score += Math.log2(1 + matches.length);
    }
  }
  
  // Normalize by keyword count
  return score / keywords.length;
}

/**
 * Reciprocal Rank Fusion (RRF) algorithm
 * Combines multiple ranked lists into a single ranking
 * 
 * RRF Score = sum(1 / (k + rank_i)) for each ranking system
 */
function computeRRF(semanticRank, keywordRank, semanticWeight, keywordWeight, k = DEFAULT_RRF_K) {
  let score = 0;
  
  if (semanticRank !== null && semanticRank !== undefined) {
    score += semanticWeight * (1 / (k + semanticRank));
  }
  
  if (keywordRank !== null && keywordRank !== undefined) {
    score += keywordWeight * (1 / (k + keywordRank));
  }
  
  return score;
}

// ============================================================================
// TEI Embedding Service
// ============================================================================

/**
 * Get embeddings from TEI server
 */
async function getEmbeddings(texts) {
  const response = await fetch(config.rag.teiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs: texts }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TEI error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.embeddings || data;
}

// ============================================================================
// ChromaDB Service
// ============================================================================

// Collection UUID cache
const collectionUUIDCache = new Map();

/**
 * Get collection UUID by name
 */
async function getCollectionUUID(collectionName) {
  if (collectionUUIDCache.has(collectionName)) {
    return collectionUUIDCache.get(collectionName);
  }

  const chromaBase = config.rag.chromaUrl;
  const listResp = await fetch(`${chromaBase}/api/v1/collections`, {
    method: 'GET',
    signal: AbortSignal.timeout(5000),
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
 * Query ChromaDB for semantic search
 */
async function queryChroma(embedding, nResults = 10, collectionName = null) {
  const collection = collectionName || config.rag.chromaCollection;
  const chromaBase = config.rag.chromaUrl;

  const collectionUUID = await getCollectionUUID(collection);
  if (!collectionUUID) {
    throw new Error(`Collection not found: ${collection}`);
  }

  const queryUrl = `${chromaBase}/api/v1/collections/${collectionUUID}/query`;
  
  const response = await fetch(queryUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query_embeddings: [embedding],
      n_results: nResults,
      include: ['documents', 'metadatas', 'distances'],
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ChromaDB error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// ============================================================================
// D1 Logging Functions
// ============================================================================

/**
 * Log search session to D1
 */
async function logSearchSession(sessionData) {
  if (!isD1Configured()) return null;
  
  try {
    await execute(
      `INSERT INTO rag_search_sessions 
       (id, user_id, session_type, query_text, query_embedding_hash,
        semantic_weight, keyword_weight, rrf_k,
        total_results, semantic_results_count, keyword_results_count,
        semantic_latency_ms, keyword_latency_ms, total_latency_ms,
        status, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      sessionData.id,
      sessionData.userId || null,
      sessionData.sessionType || 'chat',
      sessionData.queryText,
      sessionData.queryHash,
      sessionData.semanticWeight,
      sessionData.keywordWeight,
      sessionData.rrfK,
      sessionData.totalResults,
      sessionData.semanticResultsCount,
      sessionData.keywordResultsCount,
      sessionData.semanticLatencyMs,
      sessionData.keywordLatencyMs,
      sessionData.totalLatencyMs,
      sessionData.status,
      sessionData.errorMessage || null
    );
    return sessionData.id;
  } catch (err) {
    console.warn('Failed to log search session:', err.message);
    return null;
  }
}

/**
 * Log individual search results to D1
 */
async function logSearchResults(sessionId, results) {
  if (!isD1Configured() || !results.length) return;
  
  try {
    for (const result of results) {
      await execute(
        `INSERT INTO rag_search_results 
         (session_id, document_id, document_type,
          semantic_rank, semantic_score, keyword_rank, keyword_score,
          rrf_score, final_rank, title, category, tags, snippet)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        sessionId,
        result.documentId,
        result.documentType || 'post',
        result.semanticRank,
        result.semanticScore,
        result.keywordRank,
        result.keywordScore,
        result.rrfScore,
        result.finalRank,
        result.title || null,
        result.category || null,
        result.tags ? JSON.stringify(result.tags) : null,
        result.snippet || null
      );
    }
  } catch (err) {
    console.warn('Failed to log search results:', err.message);
  }
}

/**
 * Get cached intent weights for similar queries
 */
async function getCachedIntentWeights(queryHash) {
  if (!isD1Configured()) return null;
  
  try {
    const cached = await queryOne(
      `SELECT optimal_semantic_weight, optimal_keyword_weight, optimal_rrf_k,
              intent_type, intent_confidence
       FROM rag_query_intents
       WHERE query_hash = ?`,
      queryHash
    );
    
    if (cached) {
      // Update hit count
      await execute(
        `UPDATE rag_query_intents 
         SET hit_count = hit_count + 1, last_used_at = datetime('now')
         WHERE query_hash = ?`,
        queryHash
      );
    }
    
    return cached;
  } catch (err) {
    console.warn('Failed to get cached intent:', err.message);
    return null;
  }
}

// ============================================================================
// Main Hybrid Search Function
// ============================================================================

/**
 * Perform hybrid search combining semantic and keyword search with RRF
 * 
 * @param {string} queryText - The search query
 * @param {Object} options - Search options
 * @returns {Promise<Object>} Search results with metadata
 */
export async function hybridSearch(queryText, options = {}) {
  const startTime = Date.now();
  const sessionId = generateSessionId();
  const queryHash = hashQuery(queryText);
  
  const {
    nResults = MAX_RESULTS,
    userId = null,
    sessionType = 'chat',
    semanticWeight: inputSemanticWeight,
    keywordWeight: inputKeywordWeight,
    rrfK = DEFAULT_RRF_K,
    collection = null,
    minScore = MIN_SEMANTIC_SCORE,
  } = options;
  
  // Try to get optimized weights from cache
  let semanticWeight = inputSemanticWeight ?? DEFAULT_SEMANTIC_WEIGHT;
  let keywordWeight = inputKeywordWeight ?? DEFAULT_KEYWORD_WEIGHT;
  
  const cachedIntent = await getCachedIntentWeights(queryHash);
  if (cachedIntent && cachedIntent.optimal_semantic_weight !== null) {
    semanticWeight = cachedIntent.optimal_semantic_weight;
    keywordWeight = cachedIntent.optimal_keyword_weight;
  }
  
  // Normalize weights
  const totalWeight = semanticWeight + keywordWeight;
  semanticWeight = semanticWeight / totalWeight;
  keywordWeight = keywordWeight / totalWeight;
  
  // Extract keywords for BM25-style matching
  const keywords = extractKeywords(queryText);
  
  // Results tracking
  let semanticResults = [];
  let semanticLatencyMs = 0;
  let keywordLatencyMs = 0;
  let status = 'success';
  let errorMessage = null;
  
  // =========================================================================
  // 1. Semantic Search (always runs)
  // =========================================================================
  try {
    const semanticStart = Date.now();
    
    // Get query embedding
    const [embedding] = await getEmbeddings([queryText]);
    
    // Query ChromaDB
    const chromaResult = await queryChroma(embedding, nResults * 2, collection);
    
    semanticLatencyMs = Date.now() - semanticStart;
    
    // Parse results
    if (chromaResult.documents && chromaResult.documents[0]) {
      const docs = chromaResult.documents[0];
      const metas = chromaResult.metadatas?.[0] || [];
      const dists = chromaResult.distances?.[0] || [];
      
      for (let i = 0; i < docs.length; i++) {
        const similarity = dists[i] != null ? Math.max(0, 1 - dists[i]) : 0;
        
        // Filter by minimum score
        if (similarity >= minScore) {
          semanticResults.push({
            documentId: metas[i]?.slug || metas[i]?.id || `doc_${i}`,
            document: docs[i],
            metadata: metas[i] || {},
            semanticScore: similarity,
            semanticRank: i + 1,
          });
        }
      }
    }
  } catch (err) {
    console.error('Semantic search error:', err.message);
    status = 'partial';
    errorMessage = `Semantic: ${err.message}`;
  }
  
  // =========================================================================
  // 2. Keyword Scoring (runs on semantic results for efficiency)
  // =========================================================================
  const keywordStart = Date.now();
  
  // Calculate keyword scores for semantic results
  const resultsWithKeywords = semanticResults.map(result => ({
    ...result,
    keywordScore: calculateKeywordScore(keywords, result.document, result.metadata),
  }));
  
  // Sort by keyword score to get keyword ranking
  const keywordSorted = [...resultsWithKeywords].sort((a, b) => b.keywordScore - a.keywordScore);
  
  // Assign keyword ranks
  keywordSorted.forEach((result, index) => {
    const original = resultsWithKeywords.find(r => r.documentId === result.documentId);
    if (original) {
      original.keywordRank = index + 1;
    }
  });
  
  keywordLatencyMs = Date.now() - keywordStart;
  
  // =========================================================================
  // 3. RRF Fusion
  // =========================================================================
  const fusedResults = resultsWithKeywords.map(result => ({
    ...result,
    rrfScore: computeRRF(
      result.semanticRank,
      result.keywordRank,
      semanticWeight,
      keywordWeight,
      rrfK
    ),
  }));
  
  // Sort by RRF score (descending)
  fusedResults.sort((a, b) => b.rrfScore - a.rrfScore);
  
  // Assign final ranks and limit results
  const finalResults = fusedResults.slice(0, nResults).map((result, index) => ({
    documentId: result.documentId,
    document: result.document,
    metadata: result.metadata,
    semanticRank: result.semanticRank,
    semanticScore: result.semanticScore,
    keywordRank: result.keywordRank,
    keywordScore: result.keywordScore,
    rrfScore: result.rrfScore,
    finalRank: index + 1,
    // Convenience fields
    title: result.metadata?.title,
    category: result.metadata?.category,
    tags: result.metadata?.tags,
    snippet: result.document?.substring(0, 300),
  }));
  
  const totalLatencyMs = Date.now() - startTime;
  
  // =========================================================================
  // 4. Log to D1 (async, non-blocking)
  // =========================================================================
  const sessionData = {
    id: sessionId,
    userId,
    sessionType,
    queryText,
    queryHash,
    semanticWeight,
    keywordWeight,
    rrfK,
    totalResults: finalResults.length,
    semanticResultsCount: semanticResults.length,
    keywordResultsCount: keywords.length > 0 ? semanticResults.length : 0,
    semanticLatencyMs,
    keywordLatencyMs,
    totalLatencyMs,
    status,
    errorMessage,
  };
  
  // Non-blocking logging
  logSearchSession(sessionData).catch(() => {});
  if (finalResults.length > 0) {
    logSearchResults(sessionId, finalResults).catch(() => {});
  }
  
  // =========================================================================
  // 5. Return Results
  // =========================================================================
  return {
    results: finalResults.map(r => ({
      document: r.document,
      metadata: r.metadata,
      distance: 1 - r.semanticScore,  // Convert back to distance for compatibility
      similarity: r.semanticScore,
      rrfScore: r.rrfScore,
      finalRank: r.finalRank,
      scoring: {
        semantic: { rank: r.semanticRank, score: r.semanticScore },
        keyword: { rank: r.keywordRank, score: r.keywordScore },
      },
    })),
    metadata: {
      sessionId,
      query: queryText,
      totalResults: finalResults.length,
      weights: { semantic: semanticWeight, keyword: keywordWeight },
      rrfK,
      latency: {
        semantic: semanticLatencyMs,
        keyword: keywordLatencyMs,
        total: totalLatencyMs,
      },
      status,
      cachedIntent: cachedIntent?.intent_type || null,
    },
  };
}

/**
 * Simple semantic-only search (for backward compatibility)
 */
export async function semanticSearch(queryText, nResults = 5) {
  try {
    const [embedding] = await getEmbeddings([queryText]);
    const chromaResult = await queryChroma(embedding, nResults);
    
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
          similarity: dists[i] != null ? Math.max(0, 1 - dists[i]) : null,
        });
      }
    }
    
    return { results, error: null };
  } catch (err) {
    return { results: [], error: err.message };
  }
}

/**
 * Record user feedback for search result
 */
export async function recordSearchFeedback(sessionId, resultId, feedbackType, feedbackValue, options = {}) {
  if (!isD1Configured()) return false;
  
  try {
    await execute(
      `INSERT INTO rag_search_feedback 
       (session_id, result_id, user_id, feedback_type, feedback_value,
        position_clicked, time_to_click_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      sessionId,
      resultId || null,
      options.userId || null,
      feedbackType,
      feedbackValue,
      options.positionClicked || null,
      options.timeToClickMs || null
    );
    
    return true;
  } catch (err) {
    console.warn('Failed to record feedback:', err.message);
    return false;
  }
}

export default {
  hybridSearch,
  semanticSearch,
  recordSearchFeedback,
  extractKeywords,
  computeRRF,
};
