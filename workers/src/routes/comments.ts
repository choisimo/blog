import { Hono } from 'hono';
import type { Env, Comment } from '../types';
import { success, badRequest, notFound } from '../lib/response';
import { queryAll, execute, queryOne } from '../lib/d1';
import { requireAdmin } from '../middleware/auth';
import { isOriginAllowed } from '../lib/cors';

const comments = new Hono<{ Bindings: Env }>();

// GET /comments?postId=xxx - Get comments for a post
comments.get('/', async (c) => {
  const postId = c.req.query('postId');
  if (!postId) {
    return badRequest(c, 'postId is required');
  }

  const db = c.env.DB;
  const items = await queryAll<Comment>(
    db,
    `SELECT id, post_id, author, content, email, status, created_at, updated_at
     FROM comments
     WHERE post_id = ? AND status = 'visible'
     ORDER BY created_at ASC`,
    String(postId).trim().slice(0, 256)
  );

  // Normalize to camelCase and ensure date fallbacks
  const normalized = items.map(item => ({
    id: item.id,
    postId: (item as any).post_id || postId,
    author: item.author,
    content: item.content,
    email: item.email,
    status: item.status,
    createdAt: (item as any).created_at || new Date().toISOString(),
    updatedAt: (item as any).updated_at || new Date().toISOString(),
  }));

  return success(c, { comments: normalized });
});

// POST /comments - Create new comment
comments.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { postId, author, content, email } = body as Record<string, string>;

  if (!postId || !author || !content) {
    return badRequest(c, 'postId, author, and content are required');
  }

  // Basic validation
  if (author.length > 64 || content.length > 5000) {
    return badRequest(c, 'Author or content too long');
  }

  const db = c.env.DB;

  // Use the provided postId directly as the canonical thread key
  const normalizedPostId = String(postId).trim().slice(0, 256);

  const commentId = `comment-${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  await execute(
    db,
    `INSERT INTO comments(id, post_id, author, email, content, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    commentId,
    normalizedPostId,
    author.trim().slice(0, 64),
    email ? email.trim().slice(0, 256) : null,
    content.trim().slice(0, 5000),
    'visible', // or 'pending' if moderation is required
    now,
    now
  );

  return success(c, { id: commentId }, 201);
});

comments.get('/stream', async (c) => {
  const postId = c.req.query('postId');
  if (!postId) {
    return badRequest(c, 'postId is required');
  }

  const origin = c.req.header('Origin') || '';
  const allowed = isOriginAllowed(origin, c.env as Env);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: unknown) => {
        const payload = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      send({ type: 'hello', postId, ts: Date.now() });
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      for (let i = 0; i < 8; i++) {
        await sleep(15000);
        send({ type: 'ping', ts: Date.now() });
      }

      controller.close();
    },
  });

  const headers = new Headers({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  if (allowed && origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
  }
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  headers.set('Access-Control-Max-Age', '86400');

  return new Response(stream, { headers });
});

// DELETE /comments/:id - Delete comment (admin only)
comments.delete('/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');
  const db = c.env.DB;

  const existing = await queryOne<Comment>(db, 'SELECT id FROM comments WHERE id = ?', id);
  if (!existing) {
    return notFound(c, 'Comment not found');
  }

  // Soft delete by setting status to 'hidden'
  await execute(db, "UPDATE comments SET status = 'hidden', updated_at = ? WHERE id = ?", new Date().toISOString(), id);

  return success(c, { deleted: true });
});

// ========================================
// COMMENT REACTIONS (STICKERS)
// ========================================

// Available emoji reactions
const ALLOWED_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '💡'];

// GET /comments/:commentId/reactions - Get reactions for a comment
comments.get('/:commentId/reactions', async (c) => {
  const commentId = c.req.param('commentId');
  const db = c.env.DB;

  interface ReactionCount {
    emoji: string;
    count: number;
  }
  
  const reactions = await queryAll<ReactionCount>(
    db,
    `SELECT emoji, COUNT(*) as count
     FROM comment_reactions
     WHERE comment_id = ?
     GROUP BY emoji
     ORDER BY count DESC`,
    commentId
  );

  return success(c, { reactions });
});

// GET /comments/reactions/batch?commentIds=id1,id2,id3 - Get reactions for multiple comments
comments.get('/reactions/batch', async (c) => {
  const commentIdsParam = c.req.query('commentIds');
  if (!commentIdsParam) {
    return badRequest(c, 'commentIds is required');
  }

  const commentIds = commentIdsParam.split(',').slice(0, 100); // Limit to 100 comments
  if (commentIds.length === 0) {
    return success(c, { reactions: {} });
  }

  const db = c.env.DB;
  const placeholders = commentIds.map(() => '?').join(',');

  interface ReactionRow {
    comment_id: string;
    emoji: string;
    count: number;
  }

  const rows = await queryAll<ReactionRow>(
    db,
    `SELECT comment_id, emoji, COUNT(*) as count
     FROM comment_reactions
     WHERE comment_id IN (${placeholders})
     GROUP BY comment_id, emoji`,
    ...commentIds
  );

  // Group by comment_id
  const reactions: Record<string, Array<{ emoji: string; count: number }>> = {};
  for (const row of rows) {
    if (!reactions[row.comment_id]) {
      reactions[row.comment_id] = [];
    }
    reactions[row.comment_id]!.push({ emoji: row.emoji, count: row.count });
  }

  return success(c, { reactions });
});

// POST /comments/:commentId/reactions - Add a reaction
comments.post('/:commentId/reactions', async (c) => {
  const commentId = c.req.param('commentId');
  const body = await c.req.json().catch(() => ({}));
  const { emoji, fingerprint } = body as { emoji: string; fingerprint: string };

  if (!emoji || !fingerprint) {
    return badRequest(c, 'emoji and fingerprint are required');
  }

  if (!ALLOWED_EMOJIS.includes(emoji)) {
    return badRequest(c, 'Invalid emoji');
  }

  if (fingerprint.length > 64) {
    return badRequest(c, 'Invalid fingerprint');
  }

  const db = c.env.DB;

  // Check if comment exists
  const comment = await queryOne<{ id: string }>(
    db,
    'SELECT id FROM comments WHERE id = ? AND status = ?',
    commentId,
    'visible'
  );
  if (!comment) {
    return notFound(c, 'Comment not found');
  }

  // Try to insert reaction (will fail if duplicate due to unique constraint)
  const reactionId = `reaction-${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  try {
    await execute(
      db,
      `INSERT INTO comment_reactions(id, comment_id, emoji, user_fingerprint, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      reactionId,
      commentId,
      emoji,
      fingerprint.slice(0, 64),
      now
    );
    return success(c, { added: true, emoji }, 201);
  } catch (err: any) {
    // Unique constraint violation - user already reacted with this emoji
    if (err.message?.includes('UNIQUE constraint')) {
      return success(c, { added: false, message: 'Already reacted' });
    }
    throw err;
  }
});

// DELETE /comments/:commentId/reactions - Remove a reaction
comments.delete('/:commentId/reactions', async (c) => {
  const commentId = c.req.param('commentId');
  const body = await c.req.json().catch(() => ({}));
  const { emoji, fingerprint } = body as { emoji: string; fingerprint: string };

  if (!emoji || !fingerprint) {
    return badRequest(c, 'emoji and fingerprint are required');
  }

  const db = c.env.DB;

  await execute(
    db,
    `DELETE FROM comment_reactions
     WHERE comment_id = ? AND emoji = ? AND user_fingerprint = ?`,
    commentId,
    emoji,
    fingerprint.slice(0, 64)
  );

  return success(c, { removed: true });
});

export default comments;
