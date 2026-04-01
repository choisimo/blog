import crypto from 'crypto';
import { queryAll, queryOne, execute, isD1Configured } from './base/d1.repository.js';

export { isD1Configured };

function normalizeEmoji(v) {
  return String(v || '').trim().slice(0, 8);
}

function normalizeFingerprint(v) {
  return String(v || '').trim().slice(0, 128);
}

function normalizeCommentId(v) {
  return String(v || '').trim().slice(0, 128);
}

function normalizePostId(v) {
  return String(v || '').trim().slice(0, 256);
}

export async function getReactionsBatch(commentIds) {
  const ids = commentIds
    .map(id => normalizeCommentId(id))
    .filter(Boolean)
    .slice(0, 200);

  if (ids.length === 0) return {};

  const placeholders = ids.map(() => '?').join(',');
  const rows = await queryAll(
    `SELECT comment_id, emoji, COUNT(*) as cnt
     FROM comment_reactions
     WHERE comment_id IN (${placeholders})
     GROUP BY comment_id, emoji`,
    ...ids
  );

  const reactions = {};
  for (const id of ids) reactions[id] = [];
  for (const r of rows) {
    const cid = String(r.comment_id);
    if (!reactions[cid]) reactions[cid] = [];
    reactions[cid].push({ emoji: r.emoji, count: r.cnt });
  }

  return reactions;
}

export async function addReaction(commentId, emoji, fingerprint) {
  const normalizedCommentId = normalizeCommentId(commentId);
  const normalizedEmoji = normalizeEmoji(emoji);
  const normalizedFingerprint = normalizeFingerprint(fingerprint);
  
  if (!normalizedCommentId || !normalizedEmoji || !normalizedFingerprint) {
    throw new Error('commentId, emoji, and fingerprint are required');
  }

  const id = `react-${crypto.randomUUID()}`;
  await execute(
    `INSERT OR IGNORE INTO comment_reactions (id, comment_id, emoji, user_fingerprint)
     VALUES (?, ?, ?, ?)`,
    id,
    normalizedCommentId,
    normalizedEmoji,
    normalizedFingerprint
  );

  return { added: true };
}

export async function removeReaction(commentId, emoji, fingerprint) {
  const normalizedCommentId = normalizeCommentId(commentId);
  const normalizedEmoji = normalizeEmoji(emoji);
  const normalizedFingerprint = normalizeFingerprint(fingerprint);
  
  if (!normalizedCommentId || !normalizedEmoji || !normalizedFingerprint) {
    throw new Error('commentId, emoji, and fingerprint are required');
  }

  await execute(
    `DELETE FROM comment_reactions WHERE comment_id = ? AND emoji = ? AND user_fingerprint = ?`,
    normalizedCommentId,
    normalizedEmoji,
    normalizedFingerprint
  );

  return { removed: true };
}

export async function getCommentsByPost(postId) {
  const normalizedPostId = normalizePostId(postId);
  
  const items = await queryAll(
    `SELECT id, post_id, author, content, email, status, created_at, updated_at
     FROM comments
     WHERE post_id = ? AND status = 'visible'
     ORDER BY created_at ASC`,
    normalizedPostId
  );

  return items.map(d => ({
    id: d.id,
    postId: d.post_id,
    author: d.author,
    content: d.content,
    website: null,
    parentId: null,
    createdAt: d.created_at,
  }));
}

export async function createComment(data) {
  const { postId, author, content, email } = data;
  
  const normalizedPostId = normalizePostId(postId);
  const normalizedAuthor = String(author || '').trim().slice(0, 64);
  const normalizedContent = String(content || '').trim().slice(0, 5000);
  const normalizedEmail = email ? String(email).trim().slice(0, 256) : null;
  
  if (!normalizedPostId || !normalizedAuthor || !normalizedContent) {
    throw new Error('postId, author, and content are required');
  }

  if (normalizedAuthor.length > 64 || normalizedContent.length > 5000) {
    throw new Error('Author or content too long');
  }

  const commentId = `comment-${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  await execute(
    `INSERT INTO comments(id, post_id, author, email, content, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    commentId,
    normalizedPostId,
    normalizedAuthor,
    normalizedEmail,
    normalizedContent,
    'visible',
    now,
    now
  );

  return {
    id: commentId,
    postId: normalizedPostId,
    author: normalizedAuthor,
    content: normalizedContent,
    website: null,
    parentId: null,
    createdAt: now,
  };
}

export async function deleteComment(id) {
  const existing = await queryOne('SELECT id FROM comments WHERE id = ?', id);
  if (!existing) {
    return null;
  }

  await execute(
    "UPDATE comments SET status = 'hidden', updated_at = ? WHERE id = ?",
    new Date().toISOString(),
    id
  );

  return { deleted: true };
}

export async function getCommentsByPostForStream(postId) {
  const normalizedPostId = normalizePostId(postId);
  
  const items = await queryAll(
    `SELECT id, post_id, author, content, email, status, created_at
     FROM comments
     WHERE post_id = ? AND status = 'visible'
     ORDER BY created_at ASC`,
    normalizedPostId
  );

  return items.map(d => ({
    id: d.id,
    postId: d.post_id,
    author: d.author,
    content: d.content,
    website: null,
    parentId: null,
    createdAt: d.created_at,
  }));
}
