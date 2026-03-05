import { assertPostReaderPort } from "../../ports/post-reader.port.js";

/**
 * Scaffolding use case for list posts.
 * This use case intentionally contains only orchestration shape for migration.
 */
export function createListPostsUsecase({ postReader }) {
  assertPostReaderPort(postReader);

  return async function listPosts(input = {}) {
    const options = {
      year: input.year || undefined,
      includeDrafts: input.includeDrafts === true,
      limit: Number.isFinite(input.limit) ? Number(input.limit) : 0,
      offset: Number.isFinite(input.offset) ? Number(input.offset) : 0,
    };

    return postReader.listPosts(options);
  };
}
