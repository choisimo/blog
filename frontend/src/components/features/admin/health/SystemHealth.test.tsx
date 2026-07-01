import { afterEach, describe, expect, it, vi } from "vitest";

const mockAdminFetchRaw = vi.hoisted(() => vi.fn());

vi.mock("@/utils/network/apiBase", () => ({
  getApiBaseUrl: vi.fn(() => "https://worker.example.com"),
}));

vi.mock("@/services/admin/apiClient", () => ({
  adminFetchRaw: mockAdminFetchRaw,
}));

import { checkBackendHealth, getProviders } from "./SystemHealth";

describe("checkBackendHealth", () => {
  afterEach(() => {
    mockAdminFetchRaw.mockReset();
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

  it("loads AI providers through the shared admin API client", async () => {
    mockAdminFetchRaw.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            providers: [
              {
                id: "openai",
                name: "openai",
                displayName: "OpenAI",
                healthStatus: "healthy",
                lastHealthCheck: null,
                isEnabled: true,
                modelCount: 2,
                enabledModelCount: 1,
              },
            ],
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const providers = await getProviders();

    expect(mockAdminFetchRaw).toHaveBeenCalledWith(
      "https://worker.example.com/api/v1/admin/ai/providers",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
    expect(providers).toHaveLength(1);
    expect(providers[0].displayName).toBe("OpenAI");
  });
});
