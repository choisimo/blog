/**
 * User Content Routes - Memos (notes) with JWT authentication
 * 
 * This handles the "memo notes" concept from userContent.ts
 * Different from memo_content/memo_versions which is single-memo + versioning
 * 
 * Uses the `memos` table (not memo_content)
 */

import { Hono } from 'hono';
import type { HonoEnv, Env } from '../types';
import { success, badRequest, notFound, unauthorized } from '../lib/response';
import { queryAll, execute, queryOne } from '../lib/d1';
import { verifyJwt } from '../lib/jwt';

const userContent = new Hono<HonoEnv>();

// Types
interface MemoNote {
  id: string;
  user_id: string;
  original_content: string;
  user_note: string | null;
  tags: string | null; // JSON array
  source: string | null; // JSON object
  created_at: string;
  updated_at: string;
}

/**
 * Extract user ID from JWT token
 */
async function getUserIdFromToken(c: any): Promise<string | null> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return null;

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  try {
    const payload = await verifyJwt(token, c.env);
    if (payload.type === 'refresh') return null;
    return payload.sub || null;
  } catch {
    return null;
  }
}

/**
 * Format memo for API response
 */
function formatMemo(memo: MemoNote) {
  let tags: string[] = [];
  let source: Record<string, unknown> | undefined;

  try {
    if (memo.tags) tags = JSON.parse(memo.tags);
  } catch { /* ignore */ }

  try {
    if (memo.source) source = JSON.parse(memo.source);
  } catch { /* ignore */ }

  return {
    id: memo.id,
    originalContent: memo.original_content,
    userNote: memo.user_note || '',
    tags,
    source,
    createdAt: memo.created_at,
    updatedAt: memo.updated_at,
  };
}

// ============================================================================
// Memo Notes API (multiple notes per user)
// ============================================================================

// GET /user-content/memos - List all memo notes for authenticated user
userContent.get('/memos', async (c) => {
  const userId = await getUserIdFromToken(c);
  if (!userId) {
    return unauthorized(c, 'Authentication required');
  }

  const cursor = c.req.query('cursor');
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);

  const db = c.env.DB;

  let query = `
    SELECT id, user_id, original_content, user_note, tags, source, created_at, updated_at
    FROM memos
    WHERE user_id = ?
  `;
  const params: any[] = [userId];

  if (cursor) {
    query += ` AND created_at < ?`;
    params.push(cursor);
  }

  query += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit + 1); // Fetch one extra to determine hasMore

  const memos = await queryAll<MemoNote>(db, query, ...params);

  const hasMore = memos.length > limit;
  const items = hasMore ? memos.slice(0, limit) : memos;
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].created_at : null;

  return success(c, items.map(formatMemo), 200, { cursor: nextCursor, hasMore });
});

// GET /user-content/memos/:id - Get specific memo note
userContent.get('/memos/:id', async (c) => {
  const userId = await getUserIdFromToken(c);
  if (!userId) {
    return unauthorized(c, 'Authentication required');
  }

  const memoId = c.req.param('id');
  const db = c.env.DB;

  const memo = await queryOne<MemoNote>(
    db,
    `SELECT id, user_id, original_content, user_note, tags, source, created_at, updated_at
     FROM memos WHERE id = ? AND user_id = ?`,
    memoId,
    userId
  );

  if (!memo) {
    return notFound(c, 'Memo not found');
  }

  return success(c, formatMemo(memo));
});

// POST /user-content/memos - Create new memo note
userContent.post('/memos', async (c) => {
  const userId = await getUserIdFromToken(c);
  if (!userId) {
    return unauthorized(c, 'Authentication required');
  }

  const body = await c.req.json().catch(() => ({}));
  const { originalContent, userNote, tags, source } = body as {
    originalContent: string;
    userNote?: string;
    tags?: string[];
    source?: Record<string, unknown>;
  };

  if (!originalContent || typeof originalContent !== 'string') {
    return badRequest(c, 'originalContent is required');
  }

  if (originalContent.length > 50000) {
    return badRequest(c, 'Content too large (max 50KB)');
  }

  const db = c.env.DB;
  const now = new Date().toISOString();
  const memoId = `memo-${crypto.randomUUID()}`;

  const tagsJson = tags && Array.isArray(tags) ? JSON.stringify(tags) : null;
  const sourceJson = source ? JSON.stringify(source) : null;

  await execute(
    db,
    `INSERT INTO memos (id, user_id, original_content, user_note, tags, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    memoId,
    userId,
    originalContent,
    userNote || null,
    tagsJson,
    sourceJson,
    now,
    now
  );

  const created = await queryOne<MemoNote>(
    db,
    `SELECT * FROM memos WHERE id = ?`,
    memoId
  );

  return success(c, formatMemo(created!), 201);
});

// PUT /user-content/memos/:id - Update memo note
userContent.put('/memos/:id', async (c) => {
  const userId = await getUserIdFromToken(c);
  if (!userId) {
    return unauthorized(c, 'Authentication required');
  }

  const memoId = c.req.param('id');
  const db = c.env.DB;

  // Check ownership
  const existing = await queryOne<MemoNote>(
    db,
    `SELECT id FROM memos WHERE id = ? AND user_id = ?`,
    memoId,
    userId
  );

  if (!existing) {
    return notFound(c, 'Memo not found');
  }

  const body = await c.req.json().catch(() => ({}));
  const { originalContent, userNote, tags, source } = body as {
    originalContent: string;
    userNote?: string;
    tags?: string[];
    source?: Record<string, unknown>;
  };

  if (!originalContent || typeof originalContent !== 'string') {
    return badRequest(c, 'originalContent is required');
  }

  const now = new Date().toISOString();
  const tagsJson = tags && Array.isArray(tags) ? JSON.stringify(tags) : null;
  const sourceJson = source ? JSON.stringify(source) : null;

  await execute(
    db,
    `UPDATE memos SET original_content = ?, user_note = ?, tags = ?, source = ?, updated_at = ?
     WHERE id = ?`,
    originalContent,
    userNote || null,
    tagsJson,
    sourceJson,
    now,
    memoId
  );

  const updated = await queryOne<MemoNote>(
    db,
    `SELECT * FROM memos WHERE id = ?`,
    memoId
  );

  return success(c, formatMemo(updated!));
});

// DELETE /user-content/memos/:id - Delete memo note
userContent.delete('/memos/:id', async (c) => {
  const userId = await getUserIdFromToken(c);
  if (!userId) {
    return unauthorized(c, 'Authentication required');
  }

  const memoId = c.req.param('id');
  const db = c.env.DB;

  // Check ownership
  const existing = await queryOne<MemoNote>(
    db,
    `SELECT id FROM memos WHERE id = ? AND user_id = ?`,
    memoId,
    userId
  );

  if (!existing) {
    return notFound(c, 'Memo not found');
  }

  await execute(db, `DELETE FROM memos WHERE id = ?`, memoId);

  return success(c, { deleted: true });
});

export default userContent;
