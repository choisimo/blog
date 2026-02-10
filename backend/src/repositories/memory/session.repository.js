/**
 * Session Memory Repository - In-memory session storage
 * 
 * Provides fast, ephemeral storage for conversation history within a session.
 * Data is lost on server restart. For persistent storage, use persistent.repository.js.
 */

import { SESSION } from '../../config/constants.js';

const MAX_HISTORY_LENGTH = SESSION.MAX_HISTORY;
const SESSION_TTL = SESSION.TTL;
const CLEANUP_INTERVAL = SESSION.CLEANUP_INTERVAL;

/**
 * Session Memory Store
 */
class SessionMemoryStore {
  constructor() {
    /** @type {Map<string, {messages: Array, metadata: object, lastAccess: number}>} */
    this.sessions = new Map();
    
    this._cleanupInterval = setInterval(() => this._cleanup(), CLEANUP_INTERVAL);
  }

  /**
   * Get conversation history for a session
   * @param {string} sessionId
   * @param {number} [limit] - Maximum messages to return
   * @returns {Promise<Array>}
   */
  async getHistory(sessionId, limit) {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    session.lastAccess = Date.now();
    const messages = session.messages;

    if (limit && messages.length > limit) {
      return messages.slice(-limit);
    }
    return [...messages];
  }

  /**
   * Add messages to session history
   * @param {string} sessionId
   * @param {Array} messages
   */
  async addMessages(sessionId, messages) {
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      session = {
        messages: [],
        metadata: { createdAt: new Date().toISOString() },
        lastAccess: Date.now(),
      };
      this.sessions.set(sessionId, session);
    }

    session.messages.push(...messages);
    session.lastAccess = Date.now();

    // Trim if exceeds max length
    if (session.messages.length > MAX_HISTORY_LENGTH) {
      session.messages = session.messages.slice(-MAX_HISTORY_LENGTH);
    }
  }

  /**
   * Get session metadata
   * @param {string} sessionId
   * @returns {Promise<object>}
   */
  async getMetadata(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return {};
    
    return {
      ...session.metadata,
      messageCount: session.messages.length,
      lastAccess: new Date(session.lastAccess).toISOString(),
    };
  }

  /**
   * Update session metadata
   * @param {string} sessionId
   * @param {object} metadata
   */
  async updateMetadata(sessionId, metadata) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.metadata = { ...session.metadata, ...metadata };
      session.lastAccess = Date.now();
    }
  }

  /**
   * Clear a session
   * @param {string} sessionId
   */
  async clear(sessionId) {
    this.sessions.delete(sessionId);
  }

  /**
   * Check if session exists
   * @param {string} sessionId
   * @returns {boolean}
   */
  exists(sessionId) {
    return this.sessions.has(sessionId);
  }

  /**
   * Get all session IDs
   * @returns {string[]}
   */
  getAllSessionIds() {
    return Array.from(this.sessions.keys());
  }

  /**
   * Get session count
   * @returns {number}
   */
  getSessionCount() {
    return this.sessions.size;
  }

  /**
   * Cleanup expired sessions
   */
  _cleanup() {
    const now = Date.now();
    const expiredSessions = [];

    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastAccess > SESSION_TTL) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      this.sessions.delete(sessionId);
    }

    if (expiredSessions.length > 0) {
      console.log(`[SessionMemory] Cleaned up ${expiredSessions.length} expired sessions`);
    }
  }

  /**
   * Export session for persistence
   * @param {string} sessionId
   * @returns {object|null}
   */
  export(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    return {
      sessionId,
      messages: [...session.messages],
      metadata: { ...session.metadata },
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * Import session from persistence
   * @param {object} data
   */
  import(data) {
    if (!data.sessionId) return;

    this.sessions.set(data.sessionId, {
      messages: data.messages || [],
      metadata: data.metadata || {},
      lastAccess: Date.now(),
    });
  }

  /**
   * Destroy the store
   */
  destroy() {
    clearInterval(this._cleanupInterval);
    this.sessions.clear();
  }
}

// ============================================================================
// Singleton & Exports
// ============================================================================

let _store = null;

/**
 * Get the singleton SessionMemoryStore instance
 */
export function getSessionMemory() {
  if (!_store) {
    _store = new SessionMemoryStore();
  }
  return _store;
}

/**
 * Create a new SessionMemoryStore instance
 */
export function createSessionMemory() {
  return new SessionMemoryStore();
}

export default SessionMemoryStore;
