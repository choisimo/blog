import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const {
  mockAdminFetchRaw,
  mockFetchFlags,
  mockUseFeatureFlagsStore,
} = vi.hoisted(() => {
  const mockFetchFlags = vi.fn();
  const flags = {
    aiEnabled: true,
    ragEnabled: true,
    terminalEnabled: false,
    aiInline: true,
    codeExecutionEnabled: false,
    commentsEnabled: true,
  };
  const mockUseFeatureFlagsStore = Object.assign(
    vi.fn(() => ({
      flags,
      isLoading: false,
      fetchFlags: mockFetchFlags,
    })),
    { setState: vi.fn() },
  );

  return {
    mockAdminFetchRaw: vi.fn(),
    mockFetchFlags,
    mockUseFeatureFlagsStore,
  };
});

vi.mock("@/utils/network/apiBase", () => ({
  getApiBaseUrl: vi.fn(() => "https://worker.example.com"),
}));

vi.mock("@/services/admin/apiClient", () => ({
  adminFetchRaw: mockAdminFetchRaw,
}));

vi.mock("@/stores/runtime/useFeatureFlagsStore", () => ({
  useFeatureFlagsStore: mockUseFeatureFlagsStore,
}));

import {
  checkAgentHealthRequest,
  checkBackendHealth,
  checkProviderHealth,
  checkRAGHealth,
  getProviders,
  getProvidersResult,
  SystemHealth,
} from "./SystemHealth";

describe("checkBackendHealth", () => {
  afterEach(() => {
    mockAdminFetchRaw.mockReset();
    mockFetchFlags.mockReset();
    mockUseFeatureFlagsStore.mockClear();
    mockUseFeatureFlagsStore.setState.mockClear();
    vi.restoreAllMocks();
  });

  it("labels section refresh icon controls", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.endsWith("/api/v1/rag/health")) {
        return new Response(
          JSON.stringify({
            services: {
              embedding: { ok: true },
              chroma: { ok: true },
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      return new Response(null, { status: 200 });
    });
    mockAdminFetchRaw.mockImplementation(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.endsWith("/api/v1/admin/ai/providers")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: { providers: [] },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({
          ok: true,
          data: {
            status: "healthy",
            llm: { ok: true },
            tools: { count: 7 },
            uptime: 120,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    });

    render(<SystemHealth />);

    expect(screen.getByRole("button", { name: "Refresh core health" }))
      .toHaveAttribute("title", "Refresh core health");
    expect(screen.getByRole("button", { name: "Refresh RAG health" }))
      .toHaveAttribute("title", "Refresh RAG health");
    expect(screen.getByRole("button", { name: "Refresh AI providers" }))
      .toHaveAttribute("title", "Refresh AI providers");
    expect(screen.getByRole("button", { name: "Refresh feature flags" }))
      .toHaveAttribute("title", "Refresh feature flags");
    expect(screen.getByRole("button", { name: "Refresh agent health" }))
      .toHaveAttribute("title", "Refresh agent health");

    await waitFor(() => {
      expect(screen.getByText("All systems operational")).toBeInTheDocument();
    });
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

  it("returns RAG health errors from non-OK responses", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { message: "Chroma unavailable" },
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const health = await checkRAGHealth();

    expect(health).toMatchObject({
      embedding: false,
      chroma: false,
      error: "Chroma unavailable",
    });
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

  it("filters unsafe provider identifiers and normalizes provider display fields", async () => {
    mockAdminFetchRaw.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            providers: [
              {
                id: "bad%2Fprovider",
                name: "bad",
                displayName: "Bad Provider",
                healthStatus: "unknown",
                lastHealthCheck: null,
                isEnabled: true,
                modelCount: 1,
                enabledModelCount: 1,
              },
              {
                id: "openai",
                name: "openai",
                displayName: " \u001B[32mOpenAI\u001B[0m\u0000Gateway\r\nPrimary ",
                healthStatus: "healthy",
                lastHealthCheck: null,
                isEnabled: true,
                modelCount: 2,
                enabledModelCount: 1,
                healthError: " Error\u0000\u001B]0;ignored\u0007message ",
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

    expect(providers).toHaveLength(1);
    expect(providers[0]).toMatchObject({
      id: "openai",
      displayName: "OpenAI Gateway Primary",
      healthError: "Error message",
    });
  });

  it("returns provider load errors from non-OK admin responses", async () => {
    mockAdminFetchRaw.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: { message: "Provider inventory unavailable" },
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const result = await getProvidersResult();

    expect(result).toEqual({
      providers: [],
      errorMessage: "Provider inventory unavailable",
    });
  });

  it("checks agent health through the shared admin API client", async () => {
    mockAdminFetchRaw.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            status: "healthy",
            llm: { ok: true },
            tools: { count: 7 },
            uptime: 120,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const health = await checkAgentHealthRequest();

    expect(mockAdminFetchRaw).toHaveBeenCalledWith(
      "https://worker.example.com/api/v1/agent/health",
      expect.objectContaining({
        method: "GET",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(health).toEqual({
      status: "healthy",
      llm: { ok: true },
      tools: { count: 7 },
      uptime: 120,
    });
  });

  it("returns agent health errors from non-OK admin responses", async () => {
    mockAdminFetchRaw.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: { message: "Agent runtime unavailable" },
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const health = await checkAgentHealthRequest();

    expect(health).toEqual({
      status: "error",
      error: "Agent runtime unavailable",
    });
  });

  it("checks provider health through the shared admin API client", async () => {
    mockAdminFetchRaw.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            status: "healthy",
            latencyMs: 84,
            error: null,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const health = await checkProviderHealth("openai");

    expect(mockAdminFetchRaw).toHaveBeenCalledWith(
      "https://worker.example.com/api/v1/admin/ai/providers/openai/health",
      expect.objectContaining({
        method: "PUT",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(health).toEqual({
      status: "healthy",
      latencyMs: 84,
      error: null,
    });
  });

  it("rejects unsafe provider health selectors before admin fetch", async () => {
    const health = await checkProviderHealth("openai%2Fadmin");

    expect(health).toEqual({
      status: "down",
      error: "Invalid provider selector",
    });
    expect(mockAdminFetchRaw).not.toHaveBeenCalled();
  });

  it("marks provider health checks down on non-OK admin responses", async () => {
    mockAdminFetchRaw.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: { message: "Provider gateway unavailable" },
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const health = await checkProviderHealth("openai");

    expect(health).toEqual({
      status: "down",
      error: "Provider gateway unavailable",
    });
  });

  it("suppresses duplicate provider health checks while one is already running", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.endsWith("/api/v1/rag/health")) {
        return new Response(
          JSON.stringify({
            services: {
              embedding: { ok: true },
              chroma: { ok: true },
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      return new Response(null, { status: 200 });
    });

    let resolveProviderHealth: (value: Response) => void = () => {};
    const providerHealthPromise = new Promise<Response>((resolve) => {
      resolveProviderHealth = resolve;
    });
    const providerHealthCalls: string[] = [];

    mockAdminFetchRaw.mockImplementation(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.endsWith("/api/v1/admin/ai/providers/openai/health")) {
        providerHealthCalls.push(url);
        return providerHealthPromise;
      }

      if (url.endsWith("/api/v1/admin/ai/providers")) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              providers: [
                {
                  id: "openai",
                  name: "openai",
                  displayName: "OpenAI",
                  healthStatus: "unknown",
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
        );
      }

      return new Response(
        JSON.stringify({
          ok: true,
          data: {
            status: "healthy",
            llm: { ok: true },
            tools: { count: 7 },
            uptime: 120,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    });

    render(<SystemHealth />);

    const providerButton = await screen.findByRole("button", { name: /OpenAI/ });

    fireEvent.click(providerButton);
    fireEvent.click(providerButton);

    await waitFor(() => {
      expect(providerHealthCalls).toHaveLength(1);
    });

    resolveProviderHealth(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            status: "healthy",
            latencyMs: 84,
            error: null,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
  });
});
