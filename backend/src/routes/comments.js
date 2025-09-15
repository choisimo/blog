import { Router } from 'express';
import { getDb, FieldValue } from '../lib/firebase.js';

const router = Router();

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
    return res.json({ ok: true, data: { id: ref.id } });
  } catch (err) {
    return next(err);
  }
});

export default router;
