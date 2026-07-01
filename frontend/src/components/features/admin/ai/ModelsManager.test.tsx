import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModelsManager } from "./ModelsManager";
import { useModels, useProviders } from "./hooks";

vi.mock("./hooks", () => ({
  useModels: vi.fn(),
  useProviders: vi.fn(),
}));

const mockUseModels = vi.mocked(useModels);
const mockUseProviders = vi.mocked(useProviders);

describe("ModelsManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseModels.mockReturnValue({
      models: [],
      loading: false,
      error: "Model inventory unavailable",
      fetchModels: vi.fn(),
      createModel: vi.fn(),
      updateModel: vi.fn(),
      deleteModel: vi.fn(),
      testModel: vi.fn(),
    });
    mockUseProviders.mockReturnValue({
      providers: [],
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
  });

  it("shows model load errors without also showing the empty state", () => {
    render(<ModelsManager />);

    expect(
      screen.getByText("Model inventory unavailable"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/No models found/i)).not.toBeInTheDocument();
  });
});
