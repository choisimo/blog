import crypto from "crypto";
import {
  queryAll,
  queryOne,
  execute,
  isD1Configured,
} from "./base/d1.repository.js";

export { isD1Configured };

function normalizeEmoji(v) {
  return String(v || "")
    .trim()
    .slice(0, 8);
}

function normalizeFingerprint(v) {
  return String(v || "")
    .trim()
    .slice(0, 128);
}

function normalizeCommentId(v) {
  return String(v || "")
    .trim()
    .slice(0, 128);
}

function normalizePostId(v) {
  return String(v || "")
    .trim()
    .slice(0, 256);
}

/**
 * @todo Full Table 스캔 발생 가능성 있으니, 인덱스 추가 필요 -> 클라우드플레어 L7 단의 인덱싱 방안 찾아보기
 * @param {*} commentIds
 * @returns
 */
export async function getReactionsBatch(commentIds) {
  const ids = commentIds
    .map((id) => normalizeCommentId(id))
    .filter(Boolean)
    .slice(0, 200);

  if (ids.length === 0) return {};

  const placeholders = ids.map(() => "?").join(",");
  const rows = await queryAll(
    `SELECT comment_id, emoji, COUNT(*) as cnt
     FROM comment_reactions
     WHERE comment_id IN (${placeholders})
     GROUP BY comment_id, emoji`,
    ...ids,
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

/**
 * @todo INSERT OR IGNORE : id 값으로 crypto.randomUUID() 사용하므로 중복 누적 방지가 우회될 수 있음 -> emoji + user_fingerprint으로 중복 체크 필요
 * @param {*} commentId
 * @param {*} emoji
 * @param {*} fingerprint
 * @returns
 */
export async function addReaction(commentId, emoji, fingerprint) {
  const normalizedCommentId = normalizeCommentId(commentId);
  const normalizedEmoji = normalizeEmoji(emoji);
  const normalizedFingerprint = normalizeFingerprint(fingerprint);

  if (!normalizedCommentId || !normalizedEmoji || !normalizedFingerprint) {
    throw new Error("commentId, emoji, and fingerprint are required");
  }

  const id = `react-${crypto.randomUUID()}`;
  await execute(
    `INSERT OR IGNORE INTO comment_reactions (id, comment_id, emoji, user_fingerprint)
     VALUES (?, ?, ?, ?)`,
    id,
    normalizedCommentId,
    normalizedEmoji,
    normalizedFingerprint,
  );

  return { added: true };
}

/**
 * @todo emoji + user_fingerprint으로 중복 체크 필요 | 풀스캔 방지 위한 인덱스 필요함
 * @param {*} commentId
 * @param {*} emoji
 * @param {*} fingerprint
 * @returns
 */
export async function removeReaction(commentId, emoji, fingerprint) {
  const normalizedCommentId = normalizeCommentId(commentId);
  const normalizedEmoji = normalizeEmoji(emoji);
  const normalizedFingerprint = normalizeFingerprint(fingerprint);

  if (!normalizedCommentId || !normalizedEmoji || !normalizedFingerprint) {
    throw new Error("commentId, emoji, and fingerprint are required");
  }

  await execute(
    `DELETE FROM comment_reactions WHERE comment_id = ? AND emoji = ? AND user_fingerprint = ?`,
    normalizedCommentId,
    normalizedEmoji,
    normalizedFingerprint,
  );

  return { removed: true };
}

/**
 * @todo 조건 필터링 (where) 과 정렬 (ORDER BY) 가 동시에 일어나므로 복합 인덱스 적용이 필요함
 * @param {*} postId
 * @returns
 */
export async function getCommentsByPost(postId) {
  const normalizedPostId = normalizePostId(postId);

  const items = await queryAll(
    `SELECT id, post_id, author, content, email, status, created_at, updated_at
     FROM comments
     WHERE post_id = ? AND status = 'visible'
     ORDER BY created_at ASC`,
    normalizedPostId,
  );

  return items.map((d) => ({
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
  const normalizedAuthor = String(author || "")
    .trim()
    .slice(0, 64);
  const normalizedContent = String(content || "")
    .trim()
    .slice(0, 5000);
  const normalizedEmail = email ? String(email).trim().slice(0, 256) : null;

  if (!normalizedPostId || !normalizedAuthor || !normalizedContent) {
    throw new Error("postId, author, and content are required");
  }

  if (normalizedAuthor.length > 64 || normalizedContent.length > 5000) {
    throw new Error("Author or content too long");
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
    "visible",
    now,
    now,
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

/**
 * @todo 이중 데이터베이스 호출이 일어나고 있음, 업데이트를 이용하여 RETURNING 적용하여 쿼리 1번으로 네트워크 호출 최소화할 것
 * @param {*} id
 * @returns
 */
export async function deleteComment(id) {
  const existing = await queryOne("SELECT id FROM comments WHERE id = ?", id);
  if (!existing) {
    return null;
  }

  await execute(
    "UPDATE comments SET status = 'hidden', updated_at = ? WHERE id = ?",
    new Date().toISOString(),
    id,
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
    normalizedPostId,
  );

  return items.map((d) => ({
    id: d.id,
    postId: d.post_id,
    author: d.author,
    content: d.content,
    website: null,
    parentId: null,
    createdAt: d.created_at,
  }));
}
