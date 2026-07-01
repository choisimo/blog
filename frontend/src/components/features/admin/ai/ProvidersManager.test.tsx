import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProvidersManager } from "./ProvidersManager";
import { useProviders } from "./hooks";

vi.mock("./hooks", () => ({
  useProviders: vi.fn(),
}));

const mockUseProviders = vi.mocked(useProviders);

describe("ProvidersManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseProviders.mockReturnValue({
      providers: [],
      loading: false,
      error: "Provider inventory unavailable",
      fetchProviders: vi.fn(),
      createProvider: vi.fn(),
      updateProvider: vi.fn(),
      deleteProvider: vi.fn(),
      checkHealth: vi.fn(),
      killSwitchProvider: vi.fn(),
      enableProvider: vi.fn(),
    });
  });

  it("shows provider load errors without also showing the empty state", () => {
    render(<ProvidersManager />);

    expect(
      screen.getByText("Provider inventory unavailable"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/No providers configured/i),
    ).not.toBeInTheDocument();
  });

  it("labels provider action menu controls", () => {
    mockUseProviders.mockReturnValue({
      providers: [
        {
          id: "provider-1",
          name: "openai",
          displayName: "OpenAI",
          apiBaseUrl: "https://api.openai.com/v1",
          apiKeyEnv: "OPENAI_API_KEY",
          isEnabled: true,
          healthStatus: "healthy",
          lastHealthCheck: null,
          modelCount: 1,
          enabledModelCount: 1,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      loading: false,
      error: null,
      fetchProviders: vi.fn(),
      createProvider: vi.fn(),
      updateProvider: vi.fn(),
      deleteProvider: vi.fn(),
      checkHealth: vi.fn(),
      killSwitchProvider: vi.fn(),
      enableProvider: vi.fn(),
    });

    render(<ProvidersManager />);

    expect(screen.getByRole("button", { name: "Open provider actions for OpenAI" }))
      .toHaveAttribute("title", "Open provider actions for OpenAI");
  });
});
