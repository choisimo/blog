import { describe, expect, it } from "vitest";

import { normalizeFabActionLabel } from "./index";

describe("normalizeFabActionLabel", () => {
  it("strips ANSI and control characters from dock action labels", () => {
    expect(normalizeFabActionLabel("\u001b[31mAI 채팅\u001b[0m\u0000")).toBe("AI 채팅");
  });

  it("collapses whitespace and uses fallback labels for unsafe empty values", () => {
    expect(normalizeFabActionLabel("  방문\n스택\t ")).toBe("방문 스택");
    expect(normalizeFabActionLabel("\u001b[32m\u0000", "Action fallback")).toBe(
      "Action fallback",
    );
    expect(normalizeFabActionLabel(null, "Action fallback")).toBe("Action fallback");
  });
});
