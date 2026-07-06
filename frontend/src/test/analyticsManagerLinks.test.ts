import { describe, expect, it } from "vitest";
import { buildAnalyticsBlogHref } from "@/components/features/admin/analytics/AnalyticsManager";

describe("buildAnalyticsBlogHref", () => {
  it("builds blog links from safe analytics selectors", () => {
    expect(buildAnalyticsBlogHref("2026", "safe-slug_1")).toBe(
      "/#/blog/2026/safe-slug_1",
    );
  });

  it("fails closed for unsafe analytics selectors", () => {
    expect(buildAnalyticsBlogHref("26", "safe-slug")).toBeNull();
    expect(buildAnalyticsBlogHref("2026", "../slug")).toBeNull();
    expect(buildAnalyticsBlogHref("2026", "slug/child")).toBeNull();
    expect(buildAnalyticsBlogHref("2026", "slug%0Achild")).toBeNull();
    expect(buildAnalyticsBlogHref("2026", null)).toBeNull();
  });
});
