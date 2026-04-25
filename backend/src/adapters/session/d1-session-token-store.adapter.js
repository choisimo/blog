import crypto from "crypto";
import { queryOne, execute, isD1Configured } from "../../lib/d1.js";

/**
 * D1-backed SessionTokenStore adapter.
 */
function hashSessionToken(token) {
  return crypto.createHash("sha256").update(`user-session:${token}`).digest("hex");
}

export function createD1SessionTokenStore() {
  return {
    isAvailable() {
      return isD1Configured();
    },

    async findActiveByToken(token) {
      const tokenHash = hashSessionToken(token);
      const row = await queryOne(
        `SELECT id, session_token, session_token_hash, expires_at, is_active
         FROM user_sessions
         WHERE (
           (session_token_hash IS NOT NULL AND session_token_hash = ?)
           OR (session_token_hash IS NULL AND session_token = ?)
         ) AND is_active = 1`,
        tokenHash,
        token,
      );

      if (!row) return null;

      return {
        id: String(row.id),
        sessionToken: token,
        expiresAt: row.expires_at || null,
        isActive: Number(row.is_active) === 1,
      };
    },

    async touchActivity(sessionId) {
      const now = new Date().toISOString();
      await execute(
        `UPDATE user_sessions SET last_activity_at = ?, updated_at = ? WHERE id = ?`,
        now,
        now,
        sessionId,
      );
    },

    async deactivateById(sessionId) {
      await execute(
        `UPDATE user_sessions SET is_active = 0, updated_at = ? WHERE id = ? AND is_active = 1`,
        new Date().toISOString(),
        sessionId,
      );
    },
  };
}
