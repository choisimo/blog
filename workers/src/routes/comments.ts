import { Hono } from 'hono';
import type { Env, Comment } from '../types';
import { success, badRequest, notFound } from '../lib/response';
import { queryAll, execute, queryOne } from '../lib/d1';
import { requireAdmin } from '../middleware/auth';

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

  return success(c, { comments: items });
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

export default comments;
