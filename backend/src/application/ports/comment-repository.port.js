/**
 * Scaffolding port for comment aggregate persistence.
 *
 * Intended shape:
 * - getCommentsByPost(postId)
 * - createComment(input)
 * - deleteComment(commentId)
 * - getReactionsBatch(commentIds)
 * - addReaction(commentId, emoji, fingerprint)
 * - removeReaction(commentId, emoji, fingerprint)
 */
export function assertCommentRepositoryPort(port) {
  if (!port || typeof port !== "object") {
    throw new Error("CommentRepository port must be an object");
  }

  const required = [
    "getCommentsByPost",
    "createComment",
    "deleteComment",
    "getReactionsBatch",
    "addReaction",
    "removeReaction",
  ];

  for (const method of required) {
    if (typeof port[method] !== "function") {
      throw new Error(`CommentRepository port missing method: ${method}`);
    }
  }
}
