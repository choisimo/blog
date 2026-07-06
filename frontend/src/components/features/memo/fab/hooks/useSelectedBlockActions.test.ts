import { describe, expect, it } from "vitest";

import {
  getSelectedBlockTextLength,
  normalizeSelectedBlockEventDetail,
} from "./useSelectedBlockActions";

describe("useSelectedBlockActions boundaries", () => {
  it("strips ANSI and control characters from selected block event details", () => {
    const detail = normalizeSelectedBlockEventDetail({
      text: "\u001b[31mSelected text\u001b[0m\u0000",
      markdown: "\u001b[32m# Heading\u001b[0m\r\nbody\u0007",
      title: "\u001b[33mPost title\u001b[0m\u0008",
      url: "\u001b[34m/posts/demo\u001b[0m\u0000",
      message: "\u001b[35mExplain this\u001b[0m\u0007",
      post: {
        year: "\u001b[36m2026\u001b[0m",
        slug: "\u001b[31mdemo-post\u001b[0m",
        title: "\u001b[32mDemo\u001b[0m",
      },
    });

    expect(detail).toEqual({
      text: "Selected text",
      markdown: "# Heading\nbody",
      title: "Post title",
      url: "/posts/demo",
      message: "Explain this",
      post: {
        year: "2026",
        slug: "demo-post",
        title: "Demo",
      },
    });
  });

  it("calculates selected block text length from sanitized markdown first", () => {
    const detail = normalizeSelectedBlockEventDetail({
      text: "fallback text",
      markdown: `\u001b[31m${"a".repeat(7000)}\u001b[0m`,
    });

    expect(getSelectedBlockTextLength(detail)).toBe(6000);
  });
});
