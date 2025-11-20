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

export default comments;
