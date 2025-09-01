import { db } from '../_lib/firebaseAdmin.js';
import { methodAllowed, json, getQuery } from '../_lib/http.js';

export default async function handler(req, res) {
  if (!methodAllowed(req, res, ['GET'])) return;

  try {
    const { postId } = getQuery(req);
    if (!postId) return json(res, 400, { error: 'postId is required' });

    const query = db
      .collection('comments')
      .where('postId', '==', String(postId))
      .where('archived', '==', false);

    const snap = await query.get();

    const comments = [];
    snap.forEach(doc => {
      const d = doc.data();
      const createdAt = d.createdAt?.toDate
        ? d.createdAt.toDate().toISOString()
        : null;
      comments.push({
        id: doc.id,
        postId: d.postId,
        author: d.author,
        content: d.content,
        website: d.website || null,
        parentId: d.parentId || null,
        createdAt,
      });
    });

    comments.sort((a, b) => {
      const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
      const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
      return ta - tb;
    });

    return json(res, 200, { comments });
  } catch (err) {
    return json(res, 500, {
      error: 'Failed to list comments',
      details: String(err),
    });
  }
}
