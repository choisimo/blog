/**
 * Scaffolding port for post read operations.
 *
 * Intended shape:
 * - listPosts(options) => Promise<{items: Array, total?: number}>
 * - getPost(year, slug) => Promise<{item: object, markdown: string} | null>
 */
export function assertPostReaderPort(port) {
  if (!port || typeof port !== "object") {
    throw new Error("PostReader port must be an object");
  }
  if (typeof port.listPosts !== "function") {
    throw new Error("PostReader port missing method: listPosts");
  }
  if (typeof port.getPost !== "function") {
    throw new Error("PostReader port missing method: getPost");
  }
}
