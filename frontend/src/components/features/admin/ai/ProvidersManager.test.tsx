import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("filters polluted provider ids before provider actions", () => {
    const checkHealth = vi.fn().mockResolvedValue({ ok: true });

    mockUseProviders.mockReturnValue({
      providers: [
        {
          id: "provider-1%0Aevil",
          name: "polluted",
          displayName: "Polluted Provider",
          apiBaseUrl: "https://polluted.example.com",
          apiKeyEnv: "POLLUTED_API_KEY",
          isEnabled: true,
          healthStatus: "healthy",
          lastHealthCheck: null,
          modelCount: 0,
          enabledModelCount: 0,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
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
      checkHealth,
      killSwitchProvider: vi.fn(),
      enableProvider: vi.fn(),
    });

    render(<ProvidersManager />);

    expect(screen.queryByText("Polluted Provider")).not.toBeInTheDocument();
    expect(screen.getByText("OpenAI")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Health/i }));

    expect(checkHealth).toHaveBeenCalledWith("provider-1");
    expect(checkHealth).not.toHaveBeenCalledWith("provider-1%0Aevil");
  });

  it("keeps the delete confirmation open and shows backend errors when deletion fails", async () => {
    const deleteProvider = vi.fn().mockResolvedValue({
      ok: false,
      error: "Provider is still referenced by models",
    });
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
          modelCount: 0,
          enabledModelCount: 0,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      loading: false,
      error: null,
      fetchProviders: vi.fn(),
      createProvider: vi.fn(),
      updateProvider: vi.fn(),
      deleteProvider,
      checkHealth: vi.fn(),
      killSwitchProvider: vi.fn(),
      enableProvider: vi.fn(),
    });

    render(<ProvidersManager />);

    fireEvent.click(screen.getByRole("button", { name: "Open provider actions for OpenAI" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /Delete/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Delete$/ }));

    await waitFor(() => {
      expect(deleteProvider).toHaveBeenCalledWith("provider-1");
    });
    expect(screen.getByText("Provider is still referenced by models")).toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});
