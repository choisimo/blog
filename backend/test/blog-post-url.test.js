import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBlogPostPath,
  canonicalizeBlogPostPath,
} from "../src/lib/blog-post-url.js";

test("buildBlogPostPath returns the frontend blog route for valid post metadata", () => {
  assert.equal(buildBlogPostPath("2025", "latest"), "/blog/2025/latest");
  assert.equal(
    buildBlogPostPath("2025", "algo-096-비트-조작"),
    "/blog/2025/algo-096-비트-조작",
  );
});

test("buildBlogPostPath refuses incomplete metadata instead of inventing broken links", () => {
  assert.equal(buildBlogPostPath(undefined, "latest"), undefined);
  assert.equal(buildBlogPostPath("bad-year", "latest"), undefined);
  assert.equal(buildBlogPostPath("2025", ""), undefined);
});

test("canonicalizeBlogPostPath rewrites legacy markdown asset links to blog routes", () => {
  assert.equal(
    canonicalizeBlogPostPath({ url: "/posts/2025/latest.md" }),
    "/blog/2025/latest",
  );
  assert.equal(
    canonicalizeBlogPostPath({ url: "/posts/2025/latest?source=rag" }),
    "/blog/2025/latest?source=rag",
  );
});

test("canonicalizeBlogPostPath preserves canonical and external URLs", () => {
  assert.equal(
    canonicalizeBlogPostPath({ url: "/blog/2025/latest" }),
    "/blog/2025/latest",
  );
  assert.equal(
    canonicalizeBlogPostPath({ url: "https://example.com/post" }),
    "https://example.com/post",
  );
});
