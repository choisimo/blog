import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("filters polluted model and provider selectors before model actions", () => {
    const testModel = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        success: true,
        modelName: "gpt-test",
        latencyMs: 12,
        response: "ok",
      },
    });
    mockUseModels.mockReturnValue({
      models: [
        {
          id: "model-1%0Aevil",
          modelName: "polluted-model",
          displayName: "Polluted Model",
          modelIdentifier: "polluted-model",
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
        {
          id: "model-2",
          modelName: "bad-provider-model",
          displayName: "Bad Provider Model",
          modelIdentifier: "bad-provider-model",
          description: null,
          provider: {
            id: "provider-1%0Aevil",
            name: "polluted",
            displayName: "Polluted Provider",
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
      testModel,
    });

    render(<ModelsManager />);

    expect(screen.queryByText("Polluted Model")).not.toBeInTheDocument();
    expect(screen.queryByText("Bad Provider Model")).not.toBeInTheDocument();
    expect(screen.getByText("GPT Test")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Test/i }));

    expect(testModel).toHaveBeenCalledWith("model-1");
    expect(testModel).not.toHaveBeenCalledWith("model-1%0Aevil");
    expect(testModel).not.toHaveBeenCalledWith("model-2");
  });

  it("keeps the delete confirmation open and shows backend errors when deletion fails", async () => {
    const deleteModel = vi.fn().mockResolvedValue({
      ok: false,
      error: "Model is still referenced by routing rules",
    });
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
      deleteModel,
      testModel: vi.fn(),
    });

    render(<ModelsManager />);

    fireEvent.click(screen.getByRole("button", { name: "Open model actions for GPT Test" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /Delete/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Delete$/ }));

    await waitFor(() => {
      expect(deleteModel).toHaveBeenCalledWith("model-1");
    });
    expect(screen.getByText("Model is still referenced by routing rules")).toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});
