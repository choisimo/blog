import { describe, expect, it } from "vitest";
import { normalizeErrorActionHref } from "@/pages/public/errors/ErrorStatusPage";

describe("normalizeErrorActionHref", () => {
  it("allows http, https, and mailto action hrefs", () => {
    expect(normalizeErrorActionHref(" https://example.com/help ")).toEqual({
      href: "https://example.com/help",
      external: true,
      opensNewTab: true,
    });
    expect(normalizeErrorActionHref("http://example.com/help")).toEqual({
      href: "http://example.com/help",
      external: true,
      opensNewTab: true,
    });
    expect(normalizeErrorActionHref("mailto:support@example.com")).toEqual({
      href: "mailto:support@example.com",
      external: true,
      opensNewTab: false,
    });
  });

  it("allows root-relative and hash action hrefs without opening new tabs", () => {
    expect(normalizeErrorActionHref("/status")).toEqual({
      href: "/status",
      external: false,
      opensNewTab: false,
    });
    expect(normalizeErrorActionHref("#retry")).toEqual({
      href: "#retry",
      external: false,
      opensNewTab: false,
    });
  });

  it("rejects unsafe or malformed action hrefs", () => {
    expect(normalizeErrorActionHref("javascript:alert(1)")).toBeNull();
    expect(normalizeErrorActionHref("//example.com/help")).toBeNull();
    expect(normalizeErrorActionHref("https://example.com/\nhelp")).toBeNull();
    expect(normalizeErrorActionHref("relative-path")).toBeNull();
  });
});
