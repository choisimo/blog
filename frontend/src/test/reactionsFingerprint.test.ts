import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/session/fingerprint", () => ({
  getCachedAdvancedVisitorId: vi.fn(() => null),
  getAdvancedFingerprint: vi.fn(() =>
    Promise.resolve({
      advancedVisitorId: "adv-real-id",
    }),
  ),
}));

import { getFingerprint } from "@/services/engagement/reactions";

describe("reaction fingerprint fallback", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("reuses a stable pending fingerprint until the advanced fingerprint resolves", () => {
    const first = getFingerprint();
    const second = getFingerprint();

    expect(first).toMatch(/^pending_/);
    expect(second).toBe(first);
    expect(localStorage.getItem("nodove_adv_fingerprint_pending")).toBe(first);
  });

  it("switches to the resolved advanced fingerprint once it is cached", async () => {
    const pending = getFingerprint();

    await Promise.resolve();

    const resolved = getFingerprint();
    expect(pending).toMatch(/^pending_/);
    expect(resolved).toBe("adv-real-id");
    expect(localStorage.getItem("nodove_adv_fingerprint_pending")).toBeNull();
  });
});
