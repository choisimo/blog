import { describe, expect, it } from "vitest";

import {
  extractCommentList,
  mergeCommentItems,
  normalizeCommentBody,
  normalizeCommentItem,
  normalizeCommentLine,
  parseCommentStreamMessage,
} from "./commentFeed";

describe("commentFeed sanitizers", () => {
  it("strips ANSI and control characters from single-line comment fields", () => {
    expect(normalizeCommentLine("\u001b[31mAda\nLovelace\u001b[0m\u0000")).toBe(
      "Ada Lovelace",
    );
  });

  it("strips ANSI while preserving safe multiline comment bodies", () => {
    expect(
      normalizeCommentBody("\u001b[32mHello\r\n**world**\u001b[0m\u0000"),
    ).toBe("Hello\n**world**");
  });

  it("normalizes comment items and drops unsafe post ids or empty content", () => {
    expect(
      normalizeCommentItem({
        id: "\u001b[33mc-1\u001b[0m",
        postId: "2026/safe-post",
        author: "\u001b[31mAda\u001b[0m\u0000",
        content: "Hello\u0000 there",
        website: "https://example.com/profile\u0000",
        parentId: "parent-1\n",
        createdAt: "2026-07-05T00:00:00.000Z\u0000",
      }),
    ).toEqual({
      id: "c-1",
      postId: "2026/safe-post",
      author: "Ada",
      content: "Hello there",
      website: "https://example.com/profile",
      parentId: "parent-1",
      createdAt: "2026-07-05T00:00:00.000Z",
    });

    expect(
      normalizeCommentItem({
        postId: "../unsafe",
        author: "Ada",
        content: "Hello",
      }),
    ).toBeNull();
    expect(
      normalizeCommentItem({
        postId: "safe-post",
        author: "Ada",
        content: "\u001b[31m\u001b[0m",
      }),
    ).toBeNull();
  });
});

describe("commentFeed list and stream parsing", () => {
  it("extracts sorted sanitized comment lists while dropping invalid entries", () => {
    expect(
      extractCommentList({
        comments: [
          {
            id: "b",
            postId: "post-1",
            author: "B",
            content: "\u001b[31mSecond\u001b[0m",
            createdAt: "2026-07-05T00:01:00.000Z",
          },
          {
            id: "a",
            postId: "post-1",
            author: "A",
            content: "First\u0000",
            createdAt: "2026-07-05T00:00:00.000Z",
          },
          {
            postId: "post-1",
            author: "",
            content: "invalid",
          },
        ],
      }),
    ).toMatchObject([
      { id: "a", author: "A", content: "First" },
      { id: "b", author: "B", content: "Second" },
    ]);
  });

  it("parses append stream messages into sanitized items", () => {
    expect(
      parseCommentStreamMessage(
        JSON.stringify({
          type: "append",
          items: [
            {
              id: "c-1",
              postId: "post-1",
              author: "\u001b[31mAda\u001b[0m",
              content: "Stream\u0000 item",
            },
          ],
        }),
      ),
    ).toEqual({
      type: "append",
      items: [
        {
          id: "c-1",
          postId: "post-1",
          author: "Ada",
          content: "Stream item",
        },
      ],
    });
  });

  it("deduplicates comments by sanitized keys when merging", () => {
    expect(
      mergeCommentItems(
        [
          {
            id: "\u001b[31mc-1\u001b[0m",
            postId: "post-1",
            author: "Ada",
            content: "Hello",
          },
        ],
        [
          {
            id: "c-1",
            postId: "post-1",
            author: "\u001b[32mAda\u001b[0m",
            content: "Hello\u0000",
          },
        ],
      ),
    ).toEqual([
      {
        id: "c-1",
        postId: "post-1",
        author: "Ada",
        content: "Hello",
      },
    ]);
  });
});
