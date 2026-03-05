import { assertCommentRepositoryPort } from "../../ports/comment-repository.port.js";

/**
 * Scaffolding use case for comment creation.
 * Route-level validation can gradually move into this use case.
 */
export function createCreateCommentUsecase({ commentRepository }) {
  assertCommentRepositoryPort(commentRepository);

  return async function createComment(input) {
    return commentRepository.createComment(input);
  };
}
