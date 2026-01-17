/**
 * Persistent Memory - database-backed long-term storage
 * 
 * Provides persistent storage for user preferences, important facts,
 * and long-term conversation summaries.
 */

import { query, execute, isD1Configured } from '../../d1.js';

// Configuration
const TABLE_NAME = 'agent_memories';
const PREFERENCES_TABLE = 'agent_user_preferences';

/**
 * Persistent Memory Store
 */
class PersistentMemoryStore {
  constructor(options = {}) {
    this._d1Available = null;
  }

  /**
   * Check if DB is available
   */
  async _isD1Available() {
    if (this._d1Available !== null) {
      return this._d1Available;
    }
    
    try {
      this._d1Available = isD1Configured();
      return this._d1Available;
    } catch (error) {
      this._d1Available = false;
      return false;
    }
  }

  /**
   * Save a memory
   * @param {object} memory
   * @param {string} memory.sessionId
   * @param {string} memory.type - 'fact', 'preference', 'summary', 'note'
   * @param {string} memory.content
   * @param {object} [memory.metadata]
   */
  async save(memory) {
    try {
      const isAvailable = await this._isD1Available();
      if (!isAvailable) {
        console.warn('[PersistentMemory] DB not available, using fallback');
        return this._fallbackSave(memory);
      }

      const id = `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      await execute(
        `INSERT INTO ${TABLE_NAME} (id, session_id, type, content, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        id,
        memory.sessionId,
        memory.type || 'note',
        memory.content,
        JSON.stringify(memory.metadata || {}),
      );

      return { id, ...memory };
    } catch (error) {
      console.error('[PersistentMemory] Save failed:', error.message);
      return this._fallbackSave(memory);
    }
  }

  /**
   * Get memories for a session
   * @param {string} sessionId
   * @param {object} options
   */
  async getMemories(sessionId, options = {}) {
    try {
      const isAvailable = await this._isD1Available();
      if (!isAvailable) {
        return this._fallbackGet(sessionId, options);
      }

      const { type, limit = 50 } = options;
      
      let sql = `SELECT * FROM ${TABLE_NAME} WHERE session_id = ?`;
      const params = [sessionId];

      if (type) {
        sql += ` AND type = ?`;
        params.push(type);
      }

      sql += ` ORDER BY created_at DESC LIMIT ?`;
      params.push(limit);

      const result = await query(sql, ...params);
      
      return (result.results || []).map(row => ({
        id: row.id,
        sessionId: row.session_id,
        type: row.type,
        content: row.content,
        metadata: JSON.parse(row.metadata || '{}'),
        createdAt: row.created_at,
      }));
    } catch (error) {
      console.error('[PersistentMemory] Get failed:', error.message);
      return this._fallbackGet(sessionId, options);
    }
  }

  /**
   * Search memories by content
   * @param {string} searchQuery
   * @param {object} options
   */
  async search(searchQuery, options = {}) {
    try {
      const isAvailable = await this._isD1Available();
      if (!isAvailable) {
        return [];
      }

      const { sessionId, limit = 20 } = options;
      
      let sql = `SELECT * FROM ${TABLE_NAME} WHERE content LIKE ?`;
      const params = [`%${searchQuery}%`];

      if (sessionId) {
        sql += ` AND session_id = ?`;
        params.push(sessionId);
      }

      sql += ` ORDER BY created_at DESC LIMIT ?`;
      params.push(limit);

      const result = await query(sql, ...params);
      
      return (result.results || []).map(row => ({
        id: row.id,
        sessionId: row.session_id,
        type: row.type,
        content: row.content,
        metadata: JSON.parse(row.metadata || '{}'),
        createdAt: row.created_at,
      }));
    } catch (error) {
      console.error('[PersistentMemory] Search failed:', error.message);
      return [];
    }
  }

  /**
   * Delete a memory
   * @param {string} id
   */
  async delete(id) {
    try {
      const isAvailable = await this._isD1Available();
      if (!isAvailable) return;

      await execute(`DELETE FROM ${TABLE_NAME} WHERE id = ?`, id);
    } catch (error) {
      console.error('[PersistentMemory] Delete failed:', error.message);
    }
  }

  /**
   * Get user preferences
   * @param {string} sessionId
   */
  async getUserPreferences(sessionId) {
    try {
      const isAvailable = await this._isD1Available();
      if (!isAvailable) {
        return this._fallbackPreferences.get(sessionId) || {};
      }

      const result = await query(
        `SELECT * FROM ${PREFERENCES_TABLE} WHERE session_id = ?`,
        sessionId
      );

      if (result.results?.length > 0) {
        return JSON.parse(result.results[0].preferences || '{}');
      }
      return {};
    } catch (error) {
      console.error('[PersistentMemory] Get preferences failed:', error.message);
      return {};
    }
  }

  /**
   * Save user preferences
   * @param {string} sessionId
   * @param {object} preferences
   */
  async saveUserPreferences(sessionId, preferences) {
    try {
      const isAvailable = await this._isD1Available();
      if (!isAvailable) {
        this._fallbackPreferences.set(sessionId, preferences);
        return;
      }

      await execute(
        `INSERT INTO ${PREFERENCES_TABLE} (session_id, preferences, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(session_id) DO UPDATE SET
         preferences = excluded.preferences,
         updated_at = datetime('now')`,
        sessionId,
        JSON.stringify(preferences)
      );
    } catch (error) {
      console.error('[PersistentMemory] Save preferences failed:', error.message);
      this._fallbackPreferences.set(sessionId, preferences);
    }
  }

  /**
   * Clear all memories for a session
   * @param {string} sessionId
   */
  async clearSession(sessionId) {
    try {
      const isAvailable = await this._isD1Available();
      if (!isAvailable) {
        this._fallbackMemories.delete(sessionId);
        this._fallbackPreferences.delete(sessionId);
        return;
      }

      await execute(`DELETE FROM ${TABLE_NAME} WHERE session_id = ?`, sessionId);
      await execute(`DELETE FROM ${PREFERENCES_TABLE} WHERE session_id = ?`, sessionId);
    } catch (error) {
      console.error('[PersistentMemory] Clear failed:', error.message);
    }
  }

  // ============================================================================
  // Fallback in-memory storage (when D1 is unavailable)
  // ============================================================================

  _fallbackMemories = new Map();
  _fallbackPreferences = new Map();

  _fallbackSave(memory) {
    const id = `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sessionMemories = this._fallbackMemories.get(memory.sessionId) || [];
    sessionMemories.push({ id, ...memory, createdAt: new Date().toISOString() });
    this._fallbackMemories.set(memory.sessionId, sessionMemories);
    return { id, ...memory };
  }

  _fallbackGet(sessionId, options = {}) {
    const memories = this._fallbackMemories.get(sessionId) || [];
    let filtered = [...memories];
    
    if (options.type) {
      filtered = filtered.filter(m => m.type === options.type);
    }
    
    return filtered.slice(0, options.limit || 50).reverse();
  }
}

// ============================================================================
// Singleton & Exports
// ============================================================================

let _store = null;

/**
 * Get the singleton PersistentMemoryStore instance
 */
export function getPersistentMemory() {
  if (!_store) {
    _store = new PersistentMemoryStore();
  }
  return _store;
}

/**
 * Create a new PersistentMemoryStore instance
 */
export function createPersistentMemory(options) {
  return new PersistentMemoryStore(options);
}

export default PersistentMemoryStore;
