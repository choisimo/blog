import { Router } from 'express';
import { queryAll, queryOne, execute, isD1Configured } from '../lib/d1.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import crypto from 'crypto';

const router = Router();

// In-memory listener registry (single-process only) for SSE
const listenersByPost = new Map();
function addListener(postId, send) {
  const key = String(postId);
  let set = listenersByPost.get(key);
  if (!set) {
    set = new Set();
    listenersByPost.set(key, set);
  }
  set.add(send);
  return () => {
    try {
      set.delete(send);
      if (set.size === 0) listenersByPost.delete(key);
    } catch {}
  };
}
function broadcast(postId, payload) {
  const key = String(postId);
  const set = listenersByPost.get(key);
  if (!set || set.size === 0) return;
  for (const send of Array.from(set)) {
    try {
      send(payload);
    } catch {
      try {
        set.delete(send);
      } catch {}
    }
  }
}

// Middleware to check D1 configuration
const requireD1 = (req, res, next) => {
  if (!isD1Configured()) {
    return res.status(503).json({
      ok: false,
      error: 'Comments service not configured (D1 credentials missing)',
    });
  }
  next();
};

/**
 * GET /comments?postId=xxx - Get comments for a post
 * Also supports: ?postSlug=xxx or ?slug=xxx for convenience
 */
router.get('/', requireD1, async (req, res, next) => {
  try {
    // Support multiple parameter names for flexibility
    const postId = req.query.postId || req.query.postSlug || req.query.slug;
    if (!postId)
      return res.status(400).json({ 
        ok: false, 
        error: 'postId, postSlug, or slug is required',
        hint: 'Use ?postId=<id> or ?postSlug=<slug> to get comments for a post'
      });

    const items = await queryAll(
      `SELECT id, post_id, author, content, email, status, created_at, updated_at
       FROM comments
       WHERE post_id = ? AND status = 'visible'
       ORDER BY created_at ASC`,
      String(postId).trim().slice(0, 256)
    );

    // Map to frontend expected format
    const comments = items.map((d) => ({
      id: d.id,
      postId: d.post_id,
      author: d.author,
      content: d.content,
      website: null, // D1 schema uses email, not website
      parentId: null,
      createdAt: d.created_at,
    }));

    return res.json({ ok: true, data: { comments, total: comments.length } });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /comments - Create new comment
 */
router.post('/', requireD1, async (req, res, next) => {
  try {
    const { postId, postSlug, slug, author, content, email, website } = req.body || {};
    
    // Support multiple field names for post identifier
    const postIdentifier = postId || postSlug || slug;

    if (!postIdentifier || typeof postIdentifier !== 'string')
      return res.status(400).json({ 
        ok: false, 
        error: 'postId, postSlug, or slug is required',
        hint: 'Provide postId or postSlug in the request body'
      });
    if (!author || typeof author !== 'string')
      return res.status(400).json({ ok: false, error: 'author is required' });
    if (!content || typeof content !== 'string')
      return res.status(400).json({ ok: false, error: 'content is required' });

    // Basic validation
    if (author.length > 64 || content.length > 5000) {
      return res.status(400).json({ ok: false, error: 'Author or content too long' });
    }

    const normalizedPostId = String(postIdentifier).trim().slice(0, 256);
    const commentId = `comment-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    await execute(
      `INSERT INTO comments(id, post_id, author, email, content, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      commentId,
      normalizedPostId,
      author.trim().slice(0, 64),
      email ? email.trim().slice(0, 256) : null,
      content.trim().slice(0, 5000),
      'visible',
      now,
      now
    );

    // Best-effort realtime push to connected SSE clients
    try {
      const item = {
        id: commentId,
        postId: normalizedPostId,
        author: author.trim().slice(0, 64),
        content: content.trim().slice(0, 5000),
        website: website || null,
        parentId: null,
        createdAt: now,
      };
      broadcast(normalizedPostId, { type: 'append', items: [item] });
    } catch {}

    return res.json({ ok: true, data: { id: commentId } });
  } catch (err) {
    return next(err);
  }
});

/**
 * SSE stream for live comments per post
 */
router.get('/stream', requireD1, async (req, res, next) => {
  try {
    const postId = req.query.postId;
    if (!postId) {
      res.writeHead(400, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'postId is required' })}\n\n`);
      return res.end();
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const send = (data) => {
      const s = typeof data === 'string' ? data : JSON.stringify(data);
      const lines = String(s).split(/\n/);
      for (const line of lines) {
        res.write(`data: ${line}\n`);
      }
      res.write(`\n`);
    };

    // Register listener for instant broadcasts
    const unsubscribe = addListener(String(postId), send);
    send({ type: 'open' });

    let closed = false;
    const onClose = () => {
      closed = true;
      clearInterval(ping);
      try {
        if (typeof unsubscribe === 'function') unsubscribe();
      } catch {}
      try {
        res.end();
      } catch {}
    };
    req.on('close', onClose);

    // Heartbeat
    const ping = setInterval(() => {
      try {
        send({ type: 'ping' });
      } catch {
        onClose();
      }
    }, 25000);

    // Poll D1 for new entries after connection time
    let lastTs = Date.now();

    const poll = async () => {
      if (closed) return;
      try {
        const items = await queryAll(
          `SELECT id, post_id, author, content, email, status, created_at
           FROM comments
           WHERE post_id = ? AND status = 'visible'
           ORDER BY created_at ASC`,
          String(postId).trim().slice(0, 256)
        );

        const newItems = [];
        let maxTs = lastTs;

        for (const d of items) {
          const ts = d.created_at ? Date.parse(d.created_at) : 0;
          if (ts > lastTs) {
            maxTs = Math.max(maxTs, ts);
            newItems.push({
              id: d.id,
              postId: d.post_id,
              author: d.author,
              content: d.content,
              website: null,
              parentId: null,
              createdAt: d.created_at,
            });
          }
        }

        if (newItems.length > 0) {
          newItems.sort((a, b) =>
            a.createdAt && b.createdAt ? Date.parse(a.createdAt) - Date.parse(b.createdAt) : 0
          );
          send({ type: 'append', items: newItems });
          lastTs = maxTs;
        }
      } catch (e) {
        send({ type: 'error', message: e?.message || 'poll failed' });
      } finally {
        setTimeout(poll, 5000);
      }
    };

    poll();
  } catch (err) {
    return next(err);
  }
});

/**
 * DELETE /comments/:id - Delete comment (admin only)
 */
router.delete('/:id', requireD1, requireAdmin, async (req, res, next) => {
  try {
    const id = req.params.id;

    const existing = await queryOne('SELECT id FROM comments WHERE id = ?', id);
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Comment not found' });
    }

    // Soft delete by setting status to 'hidden'
    await execute(
      "UPDATE comments SET status = 'hidden', updated_at = ? WHERE id = ?",
      new Date().toISOString(),
      id
    );

    return res.json({ ok: true, data: { deleted: true } });
  } catch (err) {
    return next(err);
  }
});

export default router;
