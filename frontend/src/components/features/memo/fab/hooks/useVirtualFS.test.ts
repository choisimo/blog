import { describe, expect, it } from "vitest";

import {
  normalizeVirtualFsPath,
  normalizeVirtualFsPathSegment,
  normalizeVirtualFsText,
} from "./useVirtualFS";

describe("useVirtualFS sanitizers", () => {
  it("strips ANSI and control characters from shell output text", () => {
    expect(normalizeVirtualFsText("\u001b[31mKafka post\u001b[0m\u0000")).toBe(
      "Kafka post",
    );
  });

  it("normalizes path values while removing unsafe control and backslash characters", () => {
    expect(normalizeVirtualFsPath("\u001b[32m/blog//2026/\\post\u001b[0m\u0000")).toBe(
      "/blog/2026/post",
    );
  });

  it("normalizes path segments without allowing slash separators", () => {
    expect(normalizeVirtualFsPathSegment("\u001b[33m2026/blog\u001b[0m")).toBe(
      "2026blog",
    );
  });
});
