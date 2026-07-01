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
});
