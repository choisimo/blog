import { describe, expect, it } from "vitest";

import {
  buildChatInitialMessage,
  buildInspectorYaml,
  normalizeInsightWorkspaceLine,
  normalizeSearch,
  summarizeText,
} from "./InsightWorkspacePage";

describe("InsightWorkspacePage sanitizers", () => {
  it("strips ANSI and control characters from display lines", () => {
    expect(
      normalizeInsightWorkspaceLine("\u001b[31mInsight\nnode\u001b[0m\u0000"),
    ).toBe("Insight node");
  });

  it("normalizes graph search queries before matching nodes", () => {
    expect(normalizeSearch(" \u001b[32mGraph\nQuery\u001b[0m\u0000 ")).toBe(
      "graph query",
    );
  });

  it("summarizes sanitized text without leaking control sequences", () => {
    expect(
      summarizeText(
        "\u001b[31mThis is a long insight detail with extra words\u001b[0m\u0000",
        24,
      ),
    ).toBe("This is a long insigh...");
  });

  it("builds sanitized ChatWidget initial messages from post metadata", () => {
    expect(
      buildChatInitialMessage({
        title: "\u001b[31mUnsafe post\u001b[0m\u0000",
        year: "2026\n",
        slug: "\u001b[32msafe-slug\u001b[0m",
        tags: [],
      } as any),
    ).toBe(
      "Unsafe post 글을 기준으로 핵심 인사이트를 3가지로 요약해줘.\n\n게시물: 2026/safe-slug",
    );
  });

  it("builds sanitized inspector YAML metadata", () => {
    expect(
      buildInspectorYaml({
        id: "\u001b[31mpost:1\u001b[0m\u0000",
        type: "post",
        label: "Post",
        weight: Number.POSITIVE_INFINITY,
        x: 1,
        y: 1,
        postKey: "2026/post\u0000",
      } as any),
    ).toContain("name: post:1\n  postKey: 2026/post\n  weight: 0");
  });
});
