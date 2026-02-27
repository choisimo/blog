import { describe, expect, it } from "vitest";

import { parseQuizRichContent } from "@/components/features/sentio/QuizRichContent";

describe("parseQuizRichContent", () => {
  it("keeps regular markdown content with line breaks", () => {
    const source = "line 1\nline 2\nline 3";
    const parsed = parseQuizRichContent(source);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual({ type: "markdown", text: source });
  });

  it("parses html fence as visualization block", () => {
    const source = [
      "Question text",
      "",
      "```html",
      "<div id='chart'></div><script>window.foo=1</script>",
      "```",
    ].join("\n");

    const parsed = parseQuizRichContent(source);
    expect(parsed.some((seg) => seg.type === "viz")).toBe(true);
  });

  it("parses chart JSON fence as visualization block", () => {
    const source = [
      "```viz",
      "{",
      '  "type": "bar",',
      '  "title": "score",',
      '  "data": [{"label":"A","value":3},{"label":"B","value":8}]',
      "}",
      "```",
    ].join("\n");

    const parsed = parseQuizRichContent(source);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].type).toBe("viz");
  });

  it("returns viz_error for malformed visualization payload", () => {
    const source = ["```viz", "{ not-json }", "```"].join("\n");

    const parsed = parseQuizRichContent(source);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].type).toBe("viz_error");
  });
});
