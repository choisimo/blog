import { describe, expect, it } from "vitest";
import {
  normalizeCodeIDEErrorText,
  normalizeCodeIDEOutputText,
} from "./CodeIDE";

describe("CodeIDE output normalization", () => {
  it("removes ANSI escapes and unsafe controls from execution output while preserving newlines", () => {
    expect(
      normalizeCodeIDEOutputText("line one\r\n\u001B[31mline two\u001B[0m\u0000\u007F"),
    ).toBe("line one\nline two ");
  });

  it("collapses unsafe controls in execution errors to a single display line", () => {
    expect(
      normalizeCodeIDEErrorText("API\u0000\r\nfailed\u001B[31m!\u001B[0m\u007F"),
    ).toBe("API failed!");
  });
});
