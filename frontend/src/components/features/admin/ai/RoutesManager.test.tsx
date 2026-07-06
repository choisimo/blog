import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RoutesManager } from "./RoutesManager";
import { useModels, useRoutes } from "./hooks";

vi.mock("./hooks", () => ({
  useModels: vi.fn(),
  useRoutes: vi.fn(),
}));

const mockUseModels = vi.mocked(useModels);
const mockUseRoutes = vi.mocked(useRoutes);

describe("RoutesManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRoutes.mockReturnValue({
      routes: [],
      loading: false,
      error: "Route inventory unavailable",
      fetchRoutes: vi.fn(),
      createRoute: vi.fn(),
      updateRoute: vi.fn(),
      deleteRoute: vi.fn(),
    });
    mockUseModels.mockReturnValue({
      models: [],
      loading: false,
      error: null,
      fetchModels: vi.fn(),
      createModel: vi.fn(),
      updateModel: vi.fn(),
      deleteModel: vi.fn(),
      testModel: vi.fn(),
    });
  });

  it("shows route load errors without also showing the empty state", () => {
    render(<RoutesManager />);

    expect(
      screen.getByText("Route inventory unavailable"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/No routes configured/i),
    ).not.toBeInTheDocument();
  });

  it("labels route action menu controls", () => {
    mockUseRoutes.mockReturnValue({
      routes: [
        {
          id: "route-1",
          name: "default-chat",
          description: "Default chat route",
          routingStrategy: "simple",
          primaryModel: {
            id: "model-1",
            modelName: "gpt-test",
            displayName: "GPT Test",
          },
          fallbackModelIds: [],
          contextWindowFallbackIds: [],
          numRetries: 2,
          timeoutSeconds: 30,
          isDefault: true,
          isEnabled: true,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      loading: false,
      error: null,
      fetchRoutes: vi.fn(),
      createRoute: vi.fn(),
      updateRoute: vi.fn(),
      deleteRoute: vi.fn(),
    });

    render(<RoutesManager />);

    expect(screen.getByRole("button", { name: "Open route actions for default-chat" }))
      .toHaveAttribute("title", "Open route actions for default-chat");
  });

  it("filters polluted route and model selectors before route actions", async () => {
    const updateRoute = vi.fn().mockResolvedValue({ ok: true });
    mockUseRoutes.mockReturnValue({
      routes: [
        {
          id: "route-1%0Aevil",
          name: "polluted-route",
          description: "Polluted route",
          routingStrategy: "simple",
          primaryModel: {
            id: "model-1",
            modelName: "gpt-test",
            displayName: "GPT Test",
          },
          fallbackModelIds: [],
          contextWindowFallbackIds: [],
          numRetries: 2,
          timeoutSeconds: 30,
          isDefault: false,
          isEnabled: true,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "route-2",
          name: "bad-model-route",
          description: "Bad model route",
          routingStrategy: "simple",
          primaryModel: {
            id: "model-1%0Aevil",
            modelName: "polluted-model",
            displayName: "Polluted Model",
          },
          fallbackModelIds: [],
          contextWindowFallbackIds: [],
          numRetries: 2,
          timeoutSeconds: 30,
          isDefault: false,
          isEnabled: true,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "route-1",
          name: "fallback-chat",
          description: "Fallback chat route",
          routingStrategy: "simple",
          primaryModel: {
            id: "model-1",
            modelName: "gpt-test",
            displayName: "GPT Test",
          },
          fallbackModelIds: ["model-2%0Aevil", "model-1"],
          contextWindowFallbackIds: ["model-2%0Aevil", "model-1"],
          numRetries: 2,
          timeoutSeconds: 30,
          isDefault: false,
          isEnabled: true,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      loading: false,
      error: null,
      fetchRoutes: vi.fn(),
      createRoute: vi.fn(),
      updateRoute,
      deleteRoute: vi.fn(),
    });

    render(<RoutesManager />);

    expect(screen.queryByText("polluted-route")).not.toBeInTheDocument();
    expect(screen.queryByText("bad-model-route")).not.toBeInTheDocument();
    expect(screen.getByText("fallback-chat")).toBeInTheDocument();
    expect(screen.queryByText("model-2%0Aevil")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open route actions for fallback-chat" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /Set as Default/i }));

    expect(updateRoute).toHaveBeenCalledWith("route-1", { isDefault: true });
    expect(updateRoute).not.toHaveBeenCalledWith("route-1%0Aevil", {
      isDefault: true,
    });
  });

  it("keeps the delete confirmation open and shows backend errors when deletion fails", async () => {
    const deleteRoute = vi.fn().mockResolvedValue({
      ok: false,
      error: "Route is still referenced by active clients",
    });
    mockUseRoutes.mockReturnValue({
      routes: [
        {
          id: "route-1",
          name: "fallback-chat",
          description: "Fallback chat route",
          routingStrategy: "simple",
          primaryModel: {
            id: "model-1",
            modelName: "gpt-test",
            displayName: "GPT Test",
          },
          fallbackModelIds: [],
          contextWindowFallbackIds: [],
          numRetries: 2,
          timeoutSeconds: 30,
          isDefault: false,
          isEnabled: true,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      loading: false,
      error: null,
      fetchRoutes: vi.fn(),
      createRoute: vi.fn(),
      updateRoute: vi.fn(),
      deleteRoute,
    });

    render(<RoutesManager />);

    fireEvent.click(screen.getByRole("button", { name: "Open route actions for fallback-chat" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /Delete/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Delete$/ }));

    await waitFor(() => {
      expect(deleteRoute).toHaveBeenCalledWith("route-1");
    });
    expect(screen.getByText("Route is still referenced by active clients")).toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});
