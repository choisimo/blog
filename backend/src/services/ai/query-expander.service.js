/**
 * Query Expander Service - LLM-based multilingual query expansion for RAG
 *
 * Expands user queries to improve semantic search matching:
 * - Translates non-English queries to English
 * - Generates related keywords and synonyms
 * - Handles technical terms and abbreviations
 *
 * Example:
 *   Input: "리눅스 커널 모듈"
 *   Output: {
 *     original: "리눅스 커널 모듈",
 *     translations: ["Linux kernel module"],
 *     keywords: ["kernel", "module", "driver", "loadable kernel module", "LKM", "insmod", "modprobe"],
 *     expandedQueries: ["Linux kernel module", "리눅스 커널 모듈", "kernel driver development"]
 *   }
 */

import { getOpenAIClient } from './openai-client.service.js';
import { config } from '../../config.js';
import { OPENAI_CLIENT, CACHE_TTL } from '../../config/constants.js';

// ============================================================================
// Configuration
// ============================================================================

const CACHE_TTL_MS = CACHE_TTL.MODEL_LIST; // 5 minutes (reuse model list cache TTL)
const MAX_CACHE_SIZE = 200;
const EXPANSION_TIMEOUT_MS = 5000; // 5 seconds timeout for LLM call
const DEFAULT_MODEL = OPENAI_CLIENT.QUERY_EXPANDER_MODEL; // Use faster model for query expansion

// Simple in-memory cache
const expansionCache = new Map();

// ============================================================================
// Logger
// ============================================================================

const logger = {
  _format(level, context, message, data = {}) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service: 'query-expander',
      ...context,
      message,
      ...data,
    });
  },
  info(ctx, msg, data) { console.log(this._format('info', ctx, msg, data)); },
  warn(ctx, msg, data) { console.warn(this._format('warn', ctx, msg, data)); },
  error(ctx, msg, data) { console.error(this._format('error', ctx, msg, data)); },
  debug(ctx, msg, data) {
    if (process.env.DEBUG_QUERY_EXPANDER === 'true') {
      console.debug(this._format('debug', ctx, msg, data));
    }
  },
};

// ============================================================================
// Language Detection
// ============================================================================

/**
 * Detect if the query contains non-ASCII characters (likely Korean, Japanese, Chinese, etc.)
 * @param {string} query
 * @returns {boolean}
 */
function containsNonAscii(query) {
  return /[^\x00-\x7F]/.test(query);
}

/**
 * Detect if the query is primarily Korean
 * @param {string} query
 * @returns {boolean}
 */
function isKorean(query) {
  const koreanChars = query.match(/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/g) || [];
  return koreanChars.length > query.length * 0.3;
}

/**
 * Detect if the query is primarily Japanese
 * @param {string} query
 * @returns {boolean}
 */
function isJapanese(query) {
  const japaneseChars = query.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g) || [];
  return japaneseChars.length > query.length * 0.3;
}

/**
 * Detect if the query is primarily Chinese
 * @param {string} query
 * @returns {boolean}
 */
function isChinese(query) {
  const chineseChars = query.match(/[\u4E00-\u9FFF]/g) || [];
  // If it's not Japanese (no hiragana/katakana) and has CJK characters, likely Chinese
  const hasJapaneseKana = /[\u3040-\u309F\u30A0-\u30FF]/.test(query);
  return chineseChars.length > query.length * 0.3 && !hasJapaneseKana;
}

/**
 * Detect the language of the query
 * @param {string} query
 * @returns {'korean' | 'japanese' | 'chinese' | 'english' | 'other'}
 */
function detectLanguage(query) {
  if (isKorean(query)) return 'korean';
  if (isJapanese(query)) return 'japanese';
  if (isChinese(query)) return 'chinese';
  if (!containsNonAscii(query)) return 'english';
  return 'other';
}

// ============================================================================
// Query Expansion
// ============================================================================

/**
 * Build the expansion prompt based on input language
 * @param {string} query
 * @param {string} language
 * @returns {object} { system, user }
 */
function buildExpansionPrompt(query, language) {
  const systemPrompt = `You are a search query expansion assistant for a technical blog. Your job is to help improve search results by:
1. Translating non-English queries to English
2. Generating related technical keywords and synonyms
3. Expanding abbreviations and technical terms

IMPORTANT: Return ONLY valid JSON, no markdown code blocks, no extra text.

JSON schema:
{
  "translations": ["English translation of the query"],
  "keywords": ["related", "technical", "keywords"],
  "expandedQueries": ["alternative search queries"]
}

Rules:
- If the query is already in English, translations should be empty array
- Keywords should include: synonyms, related concepts, common abbreviations, technical terms
- expandedQueries should be 2-4 alternative ways to search for the same topic
- Keep keywords concise (1-3 words each)
- Prioritize technical accuracy over quantity
- Maximum 10 keywords, 4 expanded queries`;

  const userPrompt = `Expand this search query for a technical blog:
Query: "${query}"
Detected language: ${language}

Return JSON only:`;

  return { system: systemPrompt, user: userPrompt };
}

/**
 * Parse the LLM response safely
 * @param {string} response
 * @returns {object | null}
 */
function parseExpansionResponse(response) {
  if (!response) return null;

  try {
    // Try direct parse
    return JSON.parse(response);
  } catch {
    // Try to extract JSON from markdown code block
    const fenceMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch?.[1]) {
      try {
        return JSON.parse(fenceMatch[1].trim());
      } catch { /* continue */ }
    }

    // Try to find JSON object in text
    const start = response.indexOf('{');
    const end = response.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(response.slice(start, end + 1));
      } catch { /* continue */ }
    }
  }

  return null;
}

/**
 * Get cache key for a query
 * @param {string} query
 * @returns {string}
 */
function getCacheKey(query) {
  return query.toLowerCase().trim();
}

function cleanCache() {
  if (expansionCache.size <= MAX_CACHE_SIZE) return;

  const now = Date.now();
  const entries = [...expansionCache.entries()];
  
  const expiredKeys = entries
    .filter(([, value]) => now - value.timestamp > CACHE_TTL_MS)
    .map(([key]) => key);
  
  expiredKeys.forEach(key => expansionCache.delete(key));

  if (expansionCache.size > MAX_CACHE_SIZE) {
    const sortedByAge = entries
      .filter(([key]) => expansionCache.has(key))
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const removeCount = Math.ceil(sortedByAge.length - MAX_CACHE_SIZE / 2);
    sortedByAge.slice(0, removeCount).forEach(([key]) => expansionCache.delete(key));
  }
}

/**
 * Expand a query using LLM
 * @param {string} query - The original search query
 * @param {object} options - { skipCache, timeout, model }
 * @returns {Promise<QueryExpansionResult>}
 *
 * @typedef {object} QueryExpansionResult
 * @property {string} original - Original query
 * @property {string} language - Detected language
 * @property {string[]} translations - English translations
 * @property {string[]} keywords - Related keywords
 * @property {string[]} expandedQueries - Alternative query formulations
 * @property {boolean} cached - Whether result was from cache
 * @property {boolean} fallback - Whether fallback was used due to LLM failure
 */
export async function expandQuery(query, options = {}) {
  const requestId = `expand-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const startTime = Date.now();

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return {
      original: query || '',
      language: 'unknown',
      translations: [],
      keywords: [],
      expandedQueries: [],
      cached: false,
      fallback: true,
    };
  }

  const normalizedQuery = query.trim();
  const cacheKey = getCacheKey(normalizedQuery);
  const language = detectLanguage(normalizedQuery);

  // Check cache first
  if (!options.skipCache) {
    const cached = expansionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      logger.debug(
        { operation: 'expand', requestId },
        'Cache hit',
        { query: normalizedQuery }
      );
      return { ...cached.data, cached: true };
    }
  }

  logger.info(
    { operation: 'expand', requestId },
    'Starting query expansion',
    { query: normalizedQuery, language }
  );

  // For simple English queries, use lightweight expansion
  if (language === 'english' && normalizedQuery.split(/\s+/).length <= 2) {
    const simpleResult = {
      original: normalizedQuery,
      language,
      translations: [],
      keywords: generateSimpleKeywords(normalizedQuery),
      expandedQueries: [],
      cached: false,
      fallback: false,
    };

    expansionCache.set(cacheKey, { data: simpleResult, timestamp: Date.now() });
    cleanCache();

    return simpleResult;
  }

  // Use LLM for complex queries
  try {
    const client = getOpenAIClient();
    const { system, user } = buildExpansionPrompt(normalizedQuery, language);

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      options.timeout || EXPANSION_TIMEOUT_MS
    );

    const response = await Promise.race([
      client.generate(user, {
        systemPrompt: system,
        model: options.model || DEFAULT_MODEL,
        temperature: 0.3,
        maxTokens: 300,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Expansion timeout')), options.timeout || EXPANSION_TIMEOUT_MS)
      ),
    ]);

    clearTimeout(timeoutId);

    const parsed = parseExpansionResponse(response);

    if (parsed) {
      const result = {
        original: normalizedQuery,
        language,
        translations: Array.isArray(parsed.translations) ? parsed.translations.slice(0, 3) : [],
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 10) : [],
        expandedQueries: Array.isArray(parsed.expandedQueries) ? parsed.expandedQueries.slice(0, 4) : [],
        cached: false,
        fallback: false,
      };

      const duration = Date.now() - startTime;
      logger.info(
        { operation: 'expand', requestId },
        'Query expansion completed',
        { duration, keywordCount: result.keywords.length }
      );

      // Cache the result
      expansionCache.set(cacheKey, { data: result, timestamp: Date.now() });
      cleanCache();

      return result;
    }

    throw new Error('Failed to parse LLM response');
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.warn(
      { operation: 'expand', requestId },
      'Query expansion failed, using fallback',
      { duration, error: error.message }
    );

    // Fallback: return original with basic expansion
    const fallbackResult = {
      original: normalizedQuery,
      language,
      translations: language !== 'english' ? [] : [],
      keywords: generateSimpleKeywords(normalizedQuery),
      expandedQueries: [],
      cached: false,
      fallback: true,
    };

    return fallbackResult;
  }
}

/**
 * Generate simple keywords from a query (fallback method)
 * @param {string} query
 * @returns {string[]}
 */
function generateSimpleKeywords(query) {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const keywords = new Set(words);

  // Add common technical variations
  for (const word of words) {
    // Add plural/singular
    if (word.endsWith('s') && word.length > 3) {
      keywords.add(word.slice(0, -1));
    } else {
      keywords.add(word + 's');
    }

    // Common tech abbreviations
    const abbrevMap = {
      kubernetes: ['k8s', 'kube'],
      javascript: ['js'],
      typescript: ['ts'],
      python: ['py'],
      linux: ['unix', 'os'],
      docker: ['container', 'containerization'],
      database: ['db'],
      application: ['app'],
    };

    if (abbrevMap[word]) {
      abbrevMap[word].forEach(abbrev => keywords.add(abbrev));
    }
  }

  return [...keywords].slice(0, 8);
}

/**
 * Combine multiple queries for RRF search
 * @param {QueryExpansionResult} expansion
 * @param {number} maxQueries - Maximum number of queries to return
 * @returns {string[]}
 */
export function getCombinedQueries(expansion, maxQueries = 5) {
  const queries = new Set();

  // Always include original
  queries.add(expansion.original);

  // Add translations
  for (const translation of expansion.translations || []) {
    if (translation && queries.size < maxQueries) {
      queries.add(translation);
    }
  }

  // Add expanded queries
  for (const expandedQuery of expansion.expandedQueries || []) {
    if (expandedQuery && queries.size < maxQueries) {
      queries.add(expandedQuery);
    }
  }

  // Add keyword combinations
  if (expansion.keywords && expansion.keywords.length > 0 && queries.size < maxQueries) {
    const keywordQuery = expansion.keywords.slice(0, 5).join(' ');
    queries.add(keywordQuery);
  }

  return [...queries].slice(0, maxQueries);
}

/**
 * Get all unique search terms from expansion
 * @param {QueryExpansionResult} expansion
 * @returns {string[]}
 */
export function getAllSearchTerms(expansion) {
  const terms = new Set();

  // Add original query words
  expansion.original.split(/\s+/).forEach(w => {
    if (w.length > 1) terms.add(w.toLowerCase());
  });

  // Add translations
  for (const translation of expansion.translations || []) {
    translation.split(/\s+/).forEach(w => {
      if (w.length > 1) terms.add(w.toLowerCase());
    });
  }

  // Add keywords
  for (const keyword of expansion.keywords || []) {
    keyword.split(/\s+/).forEach(w => {
      if (w.length > 1) terms.add(w.toLowerCase());
    });
  }

  return [...terms];
}

/**
 * Clear the expansion cache
 */
export function clearExpansionCache() {
  expansionCache.clear();
  logger.info({ operation: 'clearCache' }, 'Expansion cache cleared');
}

/**
 * Get cache stats
 * @returns {{ size: number, maxSize: number, ttlMs: number }}
 */
export function getCacheStats() {
  return {
    size: expansionCache.size,
    maxSize: MAX_CACHE_SIZE,
    ttlMs: CACHE_TTL_MS,
  };
}

export default {
  expandQuery,
  getCombinedQueries,
  getAllSearchTerms,
  clearExpansionCache,
  getCacheStats,
  detectLanguage,
};
