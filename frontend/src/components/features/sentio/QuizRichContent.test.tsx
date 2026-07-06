import { describe, expect, it } from "vitest";
import {
  normalizeQuizRichDisplayText,
  parseQuizRichContent,
} from "./QuizRichContent";

describe("QuizRichContent", () => {
  it("sanitizes visualization display metadata before building chart specs", () => {
    const segments = parseQuizRichContent(
      [
        "```viz",
        '{"title":"Chart\\u0000 Title\\r\\nInjected\\u007F","data":[{"label":"A\\u0000\\r\\nInjected\\u007F","value":2}]}',
        "```",
      ].join("\n"),
    );

    const [segment] = segments;

    expect(segment?.type).toBe("viz");
    if (segment?.type !== "viz") {
      throw new Error("Expected visualization segment");
    }

    expect(segment.spec.title).toBe("Chart Title Injected");
    expect(segment.spec.js).toContain('"labels":["A Injected"]');
  });

  it("strips OSC and CSI ANSI escape sequences from visualization display text", () => {
    expect(
      normalizeQuizRichDisplayText(
        "\u001b]0;Hidden title\u0007Visible \u001b[31mchart\u001b[0m\u0000",
      ),
    ).toBe("Visible chart");
  });
});
