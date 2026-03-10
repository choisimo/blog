/**
 * Chat Session Repository - Redis-backed with in-memory Map fallback
 *
 * Stores chat sessions (messages, metadata, notebook info, etc.)
 * Uses Redis for persistent cache when available, falls back to in-memory Map.
 *
 * Session structure:
 * {
 *   id: string,
 *   title: string,
 *   userId?: string,
 *   messages: Array<{role, content, timestamp?}>,
 *   createdAt: ISO string,
 *   updatedAt: ISO string,
 *   notebookId?: string,
 *   notebookReady?: boolean,
 *   notebookBootstrappedAt?: ISO string,
 *   notebookError?: string,
 * }
 */

import { isRedisAvailable, getRedisClient } from '../../lib/redis-client.js';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger('chat-session-repo');

// Redis key prefixes
const REDIS_SESSION_PREFIX = 'chat:session:';
const REDIS_USER_SESSIONS_PREFIX = 'chat:user:';
const REDIS_USER_SESSIONS_SUFFIX = ':sessions';
const REDIS_TTL = 604800; // 7 days in seconds

/**
 * In-memory fallback store for when Redis is unavailable
 */
class ChatSessionMemoryStore {
  constructor() {
    /** @type {Map<string, object>} */
    this.sessions = new Map();
  }

  async getChatSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    return JSON.parse(JSON.stringify(session)); // Deep copy
  }

  async setChatSession(sessionId, sessionData) {
    this.sessions.set(sessionId, JSON.parse(JSON.stringify(sessionData)));
  }

  async updateChatSession(sessionId, updates) {
    const current = this.sessions.get(sessionId);
    if (!current) return null;
    const updated = { ...current, ...updates, updatedAt: new Date().toISOString() };
    this.sessions.set(sessionId, updated);
    return updated;
  }

  async deleteChatSession(sessionId) {
    return this.sessions.delete(sessionId);
  }

  async getChatSessionsByUser(userId) {
    if (!userId) return [];
    const results = [];
    for (const session of this.sessions.values()) {
      if (session.userId === userId) {
        results.push(JSON.parse(JSON.stringify(session)));
      }
    }
    return results;
  }

  async addUserSession(userId, sessionId) {
    // No-op in memory fallback; tracking is implicit via userId check
  }

  async removeUserSession(userId, sessionId) {
    // No-op in memory fallback
  }

  clear() {
    this.sessions.clear();
  }
}

// Singleton instances
let _memoryStore = new ChatSessionMemoryStore();

/**
 * Serialize session data for Redis storage
 */
function serializeSession(session) {
  return JSON.stringify(session);
}

/**
 * Deserialize session data from Redis
 */
function deserializeSession(json) {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Get a chat session by ID
 * @param {string} sessionId - Session identifier
 * @returns {Promise<object|null>} - Session object or null if not found
 */
export async function getChatSession(sessionId) {
  if (!sessionId) return null;

  const redisAvailable = await isRedisAvailable();
  if (redisAvailable) {
    try {
      const client = await getRedisClient();
      const key = `${REDIS_SESSION_PREFIX}${sessionId}`;
      const data = await client.get(key);
      return deserializeSession(data);
    } catch (err) {
      logger.warn({}, 'Redis get failed, falling back to memory', { error: err.message });
    }
  }

  // Fallback to memory store
  return _memoryStore.getChatSession(sessionId);
}

/**
 * Set/create a chat session
 * @param {string} sessionId - Session identifier
 * @param {object} sessionData - Session object
 * @returns {Promise<void>}
 */
export async function setChatSession(sessionId, sessionData) {
  if (!sessionId || !sessionData) return;

  const normalized = {
    ...sessionData,
    id: sessionId,
    updatedAt: new Date().toISOString(),
  };

  const redisAvailable = await isRedisAvailable();
  if (redisAvailable) {
    try {
      const client = await getRedisClient();
      const key = `${REDIS_SESSION_PREFIX}${sessionId}`;
      await client.setEx(key, REDIS_TTL, serializeSession(normalized));

      // Also add to user index if userId is present
      if (normalized.userId) {
        const userKey = `${REDIS_USER_SESSIONS_PREFIX}${normalized.userId}${REDIS_USER_SESSIONS_SUFFIX}`;
        await client.sAdd(userKey, sessionId);
        await client.expire(userKey, REDIS_TTL);
      }

      return;
    } catch (err) {
      logger.warn({}, 'Redis set failed, falling back to memory', { error: err.message });
    }
  }

  // Fallback to memory store
  await _memoryStore.setChatSession(sessionId, normalized);
  if (normalized.userId) {
    await _memoryStore.addUserSession(normalized.userId, sessionId);
  }
}

/**
 * Update an existing chat session
 * @param {string} sessionId - Session identifier
 * @param {object} updates - Partial updates to merge with existing session
 * @returns {Promise<object|null>} - Updated session or null if not found
 */
export async function updateChatSession(sessionId, updates) {
  if (!sessionId || !updates) return null;

  const redisAvailable = await isRedisAvailable();
  if (redisAvailable) {
    try {
      const client = await getRedisClient();
      const key = `${REDIS_SESSION_PREFIX}${sessionId}`;
      const current = await client.get(key);

      if (!current) return null;

      const session = deserializeSession(current);
      if (!session) return null;

      const updated = {
        ...session,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      await client.setEx(key, REDIS_TTL, serializeSession(updated));

      // Update user index if userId changed
      if (updates.userId && updates.userId !== session.userId && session.userId) {
        const oldUserKey = `${REDIS_USER_SESSIONS_PREFIX}${session.userId}${REDIS_USER_SESSIONS_SUFFIX}`;
        await client.sRem(oldUserKey, sessionId);
      }
      if (updates.userId) {
        const newUserKey = `${REDIS_USER_SESSIONS_PREFIX}${updates.userId}${REDIS_USER_SESSIONS_SUFFIX}`;
        await client.sAdd(newUserKey, sessionId);
        await client.expire(newUserKey, REDIS_TTL);
      }

      return updated;
    } catch (err) {
      logger.warn({}, 'Redis update failed, falling back to memory', { error: err.message });
    }
  }

  // Fallback to memory store
  return _memoryStore.updateChatSession(sessionId, updates);
}

/**
 * Delete a chat session
 * @param {string} sessionId - Session identifier
 * @returns {Promise<boolean>} - True if session was deleted, false otherwise
 */
export async function deleteChatSession(sessionId) {
  if (!sessionId) return false;

  const redisAvailable = await isRedisAvailable();
  if (redisAvailable) {
    try {
      const client = await getRedisClient();

      // Get session to find userId for user index cleanup
      const key = `${REDIS_SESSION_PREFIX}${sessionId}`;
      const data = await client.get(key);
      const session = deserializeSession(data);

      // Delete session
      const deleted = await client.del(key);

      // Remove from user index if userId exists
      if (session?.userId) {
        const userKey = `${REDIS_USER_SESSIONS_PREFIX}${session.userId}${REDIS_USER_SESSIONS_SUFFIX}`;
        await client.sRem(userKey, sessionId);
      }

      return deleted > 0;
    } catch (err) {
      logger.warn({}, 'Redis delete failed, falling back to memory', { error: err.message });
    }
  }

  // Fallback to memory store
  const result = await _memoryStore.deleteChatSession(sessionId);
  return !!result;
}

/**
 * Get all chat sessions for a user
 * @param {string} userId - User identifier
 * @returns {Promise<Array<object>>} - Array of session objects
 */
export async function getChatSessionsByUser(userId) {
  if (!userId) return [];

  const redisAvailable = await isRedisAvailable();
  if (redisAvailable) {
    try {
      const client = await getRedisClient();
      const userKey = `${REDIS_USER_SESSIONS_PREFIX}${userId}${REDIS_USER_SESSIONS_SUFFIX}`;
      const sessionIds = await client.sMembers(userKey);

      if (!sessionIds || sessionIds.length === 0) return [];

      const sessions = [];
      for (const sessionId of sessionIds) {
        const key = `${REDIS_SESSION_PREFIX}${sessionId}`;
        const data = await client.get(key);
        const session = deserializeSession(data);
        if (session) {
          sessions.push(session);
        }
      }

      return sessions;
    } catch (err) {
      logger.warn({}, 'Redis getChatSessionsByUser failed, falling back to memory', { error: err.message });
    }
  }

  // Fallback to memory store
  return _memoryStore.getChatSessionsByUser(userId);
}

/**
 * Get the in-memory fallback store (for testing or manual management)
 * @returns {ChatSessionMemoryStore}
 */
export function getMemoryStore() {
  return _memoryStore;
}

/**
 * Clear all in-memory sessions (useful for testing)
 */
export function clearMemoryStore() {
  _memoryStore.clear();
}

export default {
  getChatSession,
  setChatSession,
  updateChatSession,
  deleteChatSession,
  getChatSessionsByUser,
  getMemoryStore,
  clearMemoryStore,
};
