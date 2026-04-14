import { describe, expect, it } from "vitest";

import {
  advanceCommentCursor,
  buildCommentsStreamUrl,
  extractCommentList,
  getCommentStreamRetryDelay,
  mergeCommentItems,
  parseCommentStreamMessage,
} from "@/components/features/blog/commentFeed";

describe("comment feed helpers", () => {
  it("deduplicates appended comments while keeping chronological order", () => {
    const merged = mergeCommentItems(
      [
        {
          id: "comment-2",
          postId: "2026/test-post",
          author: "B",
          content: "second",
          createdAt: "2026-04-11T12:00:02.000Z",
        },
      ],
      [
        {
          id: "comment-1",
          postId: "2026/test-post",
          author: "A",
          content: "first",
          createdAt: "2026-04-11T12:00:01.000Z",
        },
        {
          id: "comment-2",
          postId: "2026/test-post",
          author: "B",
          content: "second",
          createdAt: "2026-04-11T12:00:02.000Z",
        },
      ],
    );

    expect(merged.map((item) => item.id)).toEqual(["comment-1", "comment-2"]);
  });

  it("extracts comments from nested API responses", () => {
    const items = extractCommentList({
      data: {
        comments: [
          {
            id: "comment-2",
            postId: "2026/test-post",
            author: "B",
            content: "second",
            createdAt: "2026-04-11T12:00:02.000Z",
          },
          {
            id: "comment-1",
            postId: "2026/test-post",
            author: "A",
            content: "first",
            createdAt: "2026-04-11T12:00:01.000Z",
          },
        ],
      },
    });

    expect(items.map((item) => item.id)).toEqual(["comment-1", "comment-2"]);
  });

  it("parses append SSE payloads and ignores malformed events", () => {
    expect(
      parseCommentStreamMessage(
        JSON.stringify({
          type: "append",
          items: [
            {
              id: "comment-1",
              postId: "2026/test-post",
              author: "A",
              content: "hello",
            },
          ],
        }),
      ),
    ).toEqual({
      type: "append",
      items: [
        {
          id: "comment-1",
          postId: "2026/test-post",
          author: "A",
          content: "hello",
        },
      ],
    });

    expect(parseCommentStreamMessage("not-json")).toBeNull();
  });

  it("carries cursor parameters into the stream URL", () => {
    (
      window as Window & {
        APP_CONFIG?: { apiBaseUrl?: string | null };
        __APP_CONFIG?: { apiBaseUrl?: string | null };
      }
    ).APP_CONFIG = { apiBaseUrl: "https://api.nodove.com/" };

    expect(
      buildCommentsStreamUrl("2026/test-post", {
        since: "2026-04-11T12:00:00.000Z",
        sinceId: "comment-2",
      }),
    ).toBe(
      "https://api.nodove.com/api/v1/comments/stream?postId=2026%2Ftest-post&since=2026-04-11T12%3A00%3A00.000Z&sinceId=comment-2",
    );
  });

  it("advances the cursor to the newest appended comment", () => {
    expect(
      advanceCommentCursor(
        {
          since: "2026-04-11T11:59:59.000Z",
          sinceId: "comment-0",
        },
        [
          {
            id: "comment-1",
            postId: "2026/test-post",
            author: "A",
            content: "first",
            createdAt: "2026-04-11T12:00:01.000Z",
          },
          {
            id: "comment-2",
            postId: "2026/test-post",
            author: "B",
            content: "second",
            createdAt: "2026-04-11T12:00:02.000Z",
          },
        ],
      ),
    ).toEqual({
      since: "2026-04-11T12:00:02.000Z",
      sinceId: "comment-2",
    });
  });

  it("uses exponential backoff capped for comment stream reconnects", () => {
    expect(getCommentStreamRetryDelay(1)).toBe(1000);
    expect(getCommentStreamRetryDelay(2)).toBe(2000);
    expect(getCommentStreamRetryDelay(3)).toBe(4000);
    expect(getCommentStreamRetryDelay(10)).toBe(10000);
  });
});
