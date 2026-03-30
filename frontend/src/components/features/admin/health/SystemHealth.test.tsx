import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/network/apiBase", () => ({
  getApiBaseUrl: vi.fn(() => "https://worker.example.com"),
}));

import { checkBackendHealth } from "./SystemHealth";

describe("checkBackendHealth", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls the backend healthz endpoint through the worker proxy", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    await checkBackendHealth();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://worker.example.com/api/v1/healthz",
      expect.objectContaining({
        method: "GET",
        signal: expect.any(AbortSignal),
      })
    );
  });
});
