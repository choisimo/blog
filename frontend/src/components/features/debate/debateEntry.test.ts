import { describe, expect, it } from "vitest";

import {
  getModeIntentOptions,
  getModeIntro,
  normalizeDebateEntryLine,
  normalizeDebateEntryTopic,
} from "./debateEntry";

describe("debateEntry sanitizers", () => {
  it("strips ANSI and control characters from debate entry lines", () => {
    expect(
      normalizeDebateEntryLine("\u001b[31mQuestion\nflow\u001b[0m\u0000"),
    ).toBe("Question flow");
  });

  it("normalizes topic titles and facet metadata before entry copy is generated", () => {
    expect(
      normalizeDebateEntryTopic({
        title: "\u001b[32mUnsafe topic\u001b[0m\u0000",
        entryMode: "prism",
        facets: [
          {
            title: "\u001b[33mFacet\none\u001b[0m",
            points: ["Point\u0000 A", "\u001b[31m\u001b[0m"],
          },
          {
            title: "\u001b[31m\u001b[0m",
            points: [],
          },
        ],
      }),
    ).toEqual({
      title: "Unsafe topic",
      entryMode: "prism",
      facets: [
        {
          title: "Facet one",
          points: ["Point A"],
        },
      ],
    });
  });
});

describe("debateEntry copy generation", () => {
  it("uses sanitized chain titles in starter prompts", () => {
    const options = getModeIntentOptions({
      title: "\u001b[31mUnsafe question\u001b[0m\u0000",
      entryMode: "chain",
    });

    expect(options[0].starterText).toContain("Unsafe question");
    expect(options[0].starterText).not.toContain("\u001b");
    expect(options[0].starterText).not.toContain("\u0000");
  });

  it("counts only normalized prism facets in intro copy", () => {
    expect(
      getModeIntro({
        title: "Topic",
        entryMode: "prism",
        facets: [
          { title: "\u001b[32mFacet one\u001b[0m", points: [] },
          { title: "\u001b[31m\u001b[0m", points: [] },
        ],
      }).description,
    ).toBe(
      "1개의 관점을 바탕으로 비교, 반론, 적용 중 한 방향을 고를 수 있어요.",
    );
  });
});
