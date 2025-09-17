import { Router } from 'express';
import { getDb, FieldValue } from '../lib/firebase.js';

const router = Router();

// In-memory listener registry (single-process only)
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

function toIso(ts) {
  try {
    return typeof ts?.toDate === 'function' ? ts.toDate().toISOString() : null;
  } catch {
    return null;
  }
}

router.get('/', async (req, res, next) => {
  try {
    const postId = req.query.postId;
    if (!postId)
      return res.status(400).json({ ok: false, error: 'postId is required' });

    const db = getDb();
    const snap = await db
      .collection('comments')
      .where('postId', '==', String(postId))
      .where('archived', '==', false)
      .get();

    const comments = [];
    snap.forEach(doc => {
      const d = doc.data();
      comments.push({
        id: doc.id,
        postId: d.postId,
        author: d.author,
        content: d.content,
        website: d.website || null,
        parentId: d.parentId || null,
        createdAt: toIso(d.createdAt),
      });
    });

    comments.sort((a, b) => {
      const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
      const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
      return ta - tb;
    });

    return res.json({ ok: true, data: { comments } });
  } catch (err) {
    return next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { postId, author, content, website, parentId } = req.body || {};

    if (!postId || typeof postId !== 'string')
      return res.status(400).json({ ok: false, error: 'postId is required' });
    if (!author || typeof author !== 'string')
      return res.status(400).json({ ok: false, error: 'author is required' });
    if (!content || typeof content !== 'string')
      return res.status(400).json({ ok: false, error: 'content is required' });

    // basic antispam: length clamps
    const doc = {
      postId: String(postId),
      author: String(author).trim().slice(0, 64),
      content: String(content).trim().slice(0, 5000),
      website: website ? String(website).trim().slice(0, 256) : undefined,
      parentId: parentId ? String(parentId) : null,
      createdAt: FieldValue.serverTimestamp(),
      archived: false,
    };

  const db = getDb();
  const ref = await db.collection('comments').add(doc);

  // best-effort realtime push to connected SSE clients
  try {
    const item = {
      id: ref.id,
      postId: String(postId),
      author: doc.author,
      content: doc.content,
      website: doc.website || null,
      parentId: doc.parentId || null,
      createdAt: new Date().toISOString(),
    };
    broadcast(String(postId), { type: 'append', items: [item] });
  } catch {}

  return res.json({ ok: true, data: { id: ref.id } });
  } catch (err) {
    return next(err);
  }
});

// SSE stream for live comments per post. Emits on new comment creation.
router.get('/stream', async (req, res, next) => {
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

    // register listener for instant broadcasts
    const unsubscribe = addListener(String(postId), send);
    send({ type: 'open' });

    let closed = false;
    const onClose = () => {
      closed = true;
      clearInterval(ping);
      try {
        // unregister if present
        if (typeof unsubscribe === 'function') unsubscribe();
      } catch {}
      try {
        res.end();
      } catch {}
    };
    req.on('close', onClose);

    // heartbeat
    const ping = setInterval(() => {
      try {
        send({ type: 'ping' });
      } catch {
        onClose();
      }
    }, 25000);

    // Poll Firestore for new entries after connection time (best-effort)
    const db = getDb();
    let lastTs = Date.now();

    const poll = async () => {
      if (closed) return;
      try {
        const snap = await db
          .collection('comments')
          .where('postId', '==', String(postId))
          .where('archived', '==', false)
          .get();
        const items = [];
        let maxTs = lastTs;
        snap.forEach(doc => {
          const d = doc.data();
          const ts = (typeof d.createdAt?.toDate === 'function' ? d.createdAt.toDate().getTime() : 0) || 0;
          if (ts > lastTs) {
            maxTs = Math.max(maxTs, ts);
            items.push({
              id: doc.id,
              postId: d.postId,
              author: d.author,
              content: d.content,
              website: d.website || null,
              parentId: d.parentId || null,
              createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : null,
            });
          }
        });
        if (items.length > 0) {
          items.sort((a, b) => (a.createdAt && b.createdAt ? Date.parse(a.createdAt) - Date.parse(b.createdAt) : 0));
          send({ type: 'append', items });
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

export default router;
