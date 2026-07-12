import { describe, expect, it } from "vitest";
import { buildInsightGraph, postKeyFromPath } from "./domain";

const basePost = {
  year: "2026",
  slug: "safe-post",
  title: "Safe Post",
  category: "Engineering",
  tags: ["ai"],
} as any;

describe("insight workspace domain guards", () => {
  it("rejects malformed or encoded-separator post paths", () => {
    expect(postKeyFromPath("/blog/2026/safe-post")).toBe("2026/safe-post");
    expect(postKeyFromPath("/blog/2026/bad%2Fslug")).toBeNull();
    expect(postKeyFromPath("/blog/2026/bad%00slug")).toBeNull();
    expect(postKeyFromPath("/blog/2026/%E0%A4%A")).toBeNull();
  });

  it("sanitizes graph nodes derived from chat and activity events", () => {
    const graph = buildInsightGraph({
      posts: [basePost],
      chatSessions: [
        {
          id: "chat\u0000/1",
          articleUrl: "/blog/2026/safe-post",
          title: "Chat\u0000\r\nInjected\u007F",
          summary: "Summary\r\nInjected",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          messageCount: 1,
          mode: "article",
        },
      ],
      aiMemoEvents: [
        {
          type: "thought",
          label: "Thought\u0000\r\nInjected\u007F",
          content: "Detail\r\nInjected",
          t: 1,
          page: { post: { year: "2026", slug: "safe-post" } },
        },
      ],
      curiosityEvents: [
        {
          type: "tag_click",
          context: {
            postId: "/blog/2026/safe-post",
            tag: "Tag\u0000\r\nInjected\u007F",
          },
          ts: 2,
        },
        {
          type: "search",
          context: {
            queryHash: "hash\u0000/one",
            queryText: "Query\r\nInjected",
          },
          ts: 3,
        },
      ],
    });

    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "chat", label: "Chat Injected" }),
        expect.objectContaining({ type: "thought", label: "Thought Injected" }),
        expect.objectContaining({ type: "tag", label: "#Tag Injected" }),
        expect.objectContaining({ type: "search", label: "Query Injected" }),
      ]),
    );
    const generatedNodeIds = graph.nodes
      .filter((node) => node.type !== "post")
      .map((node) => node.id)
      .join("\n");
    expect(generatedNodeIds).not.toMatch(/[\u0000-\u001F\u007F/]/);
  });
});
