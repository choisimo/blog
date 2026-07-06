import { describe, expect, it } from "vitest";

import {
  normalizeShellCommanderText,
  normalizeShellCommandInput,
} from "./useShellCommander";

describe("useShellCommander sanitizers", () => {
  it("strips ANSI and control characters from shell output while preserving new lines", () => {
    expect(
      normalizeShellCommanderText("\u001b[31mfirst\u001b[0m\r\nsecond\u0000"),
    ).toBe("first\nsecond");
  });

  it("normalizes shell command input into a single safe command line", () => {
    expect(normalizeShellCommandInput("\u001b[32mfind\u001b[0m\tkafka\u0007")).toBe(
      "find kafka",
    );
  });

  it("returns safe fallbacks for empty sanitized output and rejects non-string command input", () => {
    expect(normalizeShellCommanderText("\u001b[33m\u0000", "fallback")).toBe(
      "fallback",
    );
    expect(normalizeShellCommandInput(null)).toBe("");
  });
});
