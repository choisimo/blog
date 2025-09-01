import { db, FieldValue } from '../_lib/firebaseAdmin.js';
import { methodAllowed, readJson, json } from '../_lib/http.js';

export default async function handler(req, res) {
  if (!methodAllowed(req, res, ['POST'])) return;

  try {
    const body = await readJson(req);
    const { postId, author, content, website, parentId } = body || {};

    if (!postId || typeof postId !== 'string')
      return json(res, 400, { error: 'postId is required' });
    if (!author || typeof author !== 'string')
      return json(res, 400, { error: 'author is required' });
    if (!content || typeof content !== 'string')
      return json(res, 400, { error: 'content is required' });

    const doc = {
      postId: String(postId),
      author: String(author).trim().slice(0, 64),
      content: String(content).trim().slice(0, 5000),
      website: website ? String(website).trim().slice(0, 256) : undefined,
      parentId: parentId ? String(parentId) : null,
      createdAt: FieldValue.serverTimestamp(),
      archived: false,
    };

    const ref = await db.collection('comments').add(doc);
    return json(res, 200, { id: ref.id });
  } catch (err) {
    return json(res, 500, {
      error: 'Failed to add comment',
      details: String(err),
    });
  }
}
