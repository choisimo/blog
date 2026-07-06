import { describe, expect, it } from "vitest";

import {
  normalizePostsManifestItems,
  normalizePostsManifestText,
} from "./usePostsManifest";

describe("usePostsManifest sanitizers", () => {
  it("strips ANSI and control characters from manifest text fields", () => {
    expect(normalizePostsManifestText("\u001b[31mPost title\u001b[0m\u0000")).toBe(
      "Post title",
    );
  });

  it("normalizes manifest items and drops unpublished or unsafe URL entries", () => {
    expect(
      normalizePostsManifestItems([
        {
          slug: "\u001b[32msafe-post\u001b[0m\u0000",
          title: "\u001b[31mSafe title\u001b[0m\u0000",
          category: " dev\nops ",
          date: " 2026-07-05 ",
          tags: ["\u001b[33mAI\u001b[0m", "\u0000"],
          url: "/blog/2026//safe-post",
        },
        {
          slug: "draft",
          title: "Draft",
          category: "dev",
          date: "2026-07-05",
          tags: [],
          url: "/blog/2026/draft",
          published: false,
        },
        {
          slug: "unsafe",
          title: "Unsafe",
          category: "dev",
          date: "2026-07-05",
          tags: [],
          url: "javascript:alert(1)",
        },
      ]),
    ).toEqual([
      {
        slug: "safe-post",
        title: "Safe title",
        category: "dev ops",
        date: "2026-07-05",
        tags: ["AI"],
        url: "/blog/2026/safe-post",
      },
    ]);
  });

  it("returns an empty list for non-array manifest payloads", () => {
    expect(normalizePostsManifestItems(null)).toEqual([]);
  });
});
