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

  it("labels model action menu controls", () => {
    mockUseModels.mockReturnValue({
      models: [
        {
          id: "model-1",
          modelName: "gpt-test",
          displayName: "GPT Test",
          modelIdentifier: "gpt-test",
          description: null,
          provider: {
            id: "provider-1",
            name: "openai",
            displayName: "OpenAI",
            isEnabled: true,
          },
          contextWindow: 128000,
          maxTokens: 4096,
          cost: {
            inputPer1k: 0.001,
            outputPer1k: 0.002,
          },
          capabilities: {
            vision: false,
            streaming: true,
            functionCalling: false,
          },
          isEnabled: true,
          priority: 1,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      loading: false,
      error: null,
      fetchModels: vi.fn(),
      createModel: vi.fn(),
      updateModel: vi.fn(),
      deleteModel: vi.fn(),
      testModel: vi.fn(),
    });

    render(<ModelsManager />);

    expect(screen.getByRole("button", { name: "Open model actions for GPT Test" }))
      .toHaveAttribute("title", "Open model actions for GPT Test");
  });
});
