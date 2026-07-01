import { render, screen } from "@testing-library/react";
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
});
