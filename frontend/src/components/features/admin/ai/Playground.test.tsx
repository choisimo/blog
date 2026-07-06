import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetchModels = vi.hoisted(() => vi.fn());
const mockFetchHistory = vi.hoisted(() => vi.fn());
const mockDeleteHistory = vi.hoisted(() => vi.fn());
const mockClearHistory = vi.hoisted(() => vi.fn());
const mockFetchTemplates = vi.hoisted(() => vi.fn());
const mockCreateTemplate = vi.hoisted(() => vi.fn());
const mockDeleteTemplate = vi.hoisted(() => vi.fn());
const mockApplyTemplate = vi.hoisted(() => vi.fn());
const mockRunPlayground = vi.hoisted(() => vi.fn());
const mockUseModels = vi.hoisted(() => vi.fn());
const mockUsePlayground = vi.hoisted(() => vi.fn());

vi.mock('./hooks', () => ({
  useModels: mockUseModels,
  usePlayground: mockUsePlayground,
}));

function createUseModelsValue(overrides = {}) {
  return {
    models: [],
    loading: false,
    error: null,
    fetchModels: mockFetchModels,
    createModel: vi.fn(),
    updateModel: vi.fn(),
    deleteModel: vi.fn(),
    testModel: vi.fn(),
    ...overrides,
  };
}

function createUsePlaygroundValue(overrides = {}) {
  return {
    history: [],
    templates: [],
    loading: false,
    running: false,
    error: null,
    templatesError: null,
    total: 0,
    runPlayground: mockRunPlayground,
    fetchHistory: mockFetchHistory,
    deleteHistory: mockDeleteHistory,
    clearHistory: mockClearHistory,
    fetchTemplates: mockFetchTemplates,
    createTemplate: mockCreateTemplate,
    deleteTemplate: mockDeleteTemplate,
    applyTemplate: mockApplyTemplate,
    ...overrides,
  };
}

import { Playground } from './Playground';

describe('Playground', () => {
  beforeEach(() => {
    mockFetchModels.mockReset();
    mockFetchHistory.mockReset();
    mockDeleteHistory.mockReset();
    mockClearHistory.mockReset();
    mockFetchTemplates.mockReset();
    mockCreateTemplate.mockReset();
    mockDeleteTemplate.mockReset();
    mockApplyTemplate.mockReset();
    mockRunPlayground.mockReset();
    mockUseModels.mockReset();
    mockUsePlayground.mockReset();
    mockFetchModels.mockResolvedValue(undefined);
    mockFetchHistory.mockResolvedValue(undefined);
    mockFetchTemplates.mockResolvedValue(undefined);
    mockUseModels.mockReturnValue(createUseModelsValue());
    mockUsePlayground.mockReturnValue(createUsePlaygroundValue());
  });

  it('shows playground load errors without also showing history empty state', async () => {
    mockUsePlayground.mockReturnValue(
      createUsePlaygroundValue({
        error: 'Playground history unavailable',
      }),
    );

    render(<Playground />);

    fireEvent.click(screen.getByRole('tab', { name: /History/i }));

    expect(screen.getByText('Playground history unavailable')).toBeInTheDocument();
    expect(
      screen.queryByText(/No history yet/i),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(mockFetchHistory).toHaveBeenCalledWith({ limit: 20 });
    });
  });

  it('shows model load errors in the playground panel', async () => {
    mockUseModels.mockReturnValue(
      createUseModelsValue({
        error: 'Model inventory unavailable',
      }),
    );

    render(<Playground />);

    expect(screen.getByText('Model inventory unavailable')).toBeInTheDocument();
    await waitFor(() => {
      expect(mockFetchModels).toHaveBeenCalledWith(undefined, true);
    });
  });

  it('shows template load errors without also showing the template empty state', async () => {
    mockUsePlayground.mockReturnValue(
      createUsePlaygroundValue({
        templatesError: 'Prompt templates unavailable',
      }),
    );

    render(<Playground />);

    fireEvent.click(screen.getByRole('tab', { name: /Templates/i }));

    expect(screen.getByText('Prompt templates unavailable')).toBeInTheDocument();
    expect(
      screen.queryByText(/No templates yet/i),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(mockFetchTemplates).toHaveBeenCalled();
    });
  });

  it('labels history and template icon controls', async () => {
    const user = userEvent.setup();

    mockUsePlayground.mockReturnValue(
      createUsePlaygroundValue({
        history: [
          {
            id: 'hist-1',
            title: 'Draft title',
            system_prompt: null,
            user_prompt: 'Write a concise intro',
            model_id: 'model-1',
            model_name: 'GPT Test',
            provider_id: 'provider-1',
            provider_name: 'OpenAI',
            response: 'Draft response',
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30,
            latency_ms: 123,
            estimated_cost: 0.001,
            temperature: 0.7,
            max_tokens: null,
            status: 'success',
            error_message: null,
            metadata: null,
            created_at: '2026-01-01T00:00:00.000Z',
          },
        ],
        templates: [
          {
            id: 'tpl-1',
            name: 'Intro Template',
            description: null,
            category: 'writing',
            system_prompt: null,
            user_prompt_template: 'Write an intro for {{topic}}',
            variables: null,
            default_model_id: null,
            default_temperature: 0.7,
            default_max_tokens: null,
            is_public: 0,
            usage_count: 0,
            created_by: null,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
    );

    render(<Playground />);

    await user.click(screen.getByRole('tab', { name: /History/i }));

    expect(await screen.findByRole('button', { name: 'View playground history hist-1' }))
      .toHaveAttribute('title', 'View playground history hist-1');
    expect(screen.getByRole('button', { name: 'Delete playground history hist-1' }))
      .toHaveAttribute('title', 'Delete playground history hist-1');

    await user.click(screen.getByRole('tab', { name: /Templates/i }));

    expect(await screen.findByRole('button', { name: 'Delete prompt template Intro Template' }))
      .toHaveAttribute('title', 'Delete prompt template Intro Template');
    await waitFor(() => {
      expect(mockFetchHistory).toHaveBeenCalledWith({ limit: 20 });
      expect(mockFetchTemplates).toHaveBeenCalled();
    });
  });

  it('filters polluted model, history, and template selectors before UI actions', async () => {
    const user = userEvent.setup();
    mockRunPlayground.mockResolvedValue({
      ok: true,
      data: {
        results: [],
      },
    });
    mockUseModels.mockReturnValue(
      createUseModelsValue({
        models: [
          {
            id: 'model-1%0Aevil',
            displayName: 'Polluted Model',
            isEnabled: true,
            provider: {
              displayName: 'Provider',
            },
          },
          {
            id: 'model-1',
            displayName: 'Safe Model',
            isEnabled: true,
            provider: {
              displayName: 'Provider',
            },
          },
        ],
      }),
    );
    mockUsePlayground.mockReturnValue(
      createUsePlaygroundValue({
        history: [
          {
            id: 'hist-1%0Aevil',
            title: 'Polluted history',
            system_prompt: null,
            user_prompt: 'Polluted prompt',
            model_id: 'model-1',
            model_name: 'GPT Test',
            provider_id: 'provider-1',
            provider_name: 'OpenAI',
            response: null,
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30,
            latency_ms: 123,
            estimated_cost: 0.001,
            temperature: 0.7,
            max_tokens: null,
            status: 'success',
            error_message: null,
            metadata: null,
            created_at: '2026-01-01T00:00:00.000Z',
          },
          {
            id: 'hist-1',
            title: 'Safe history',
            system_prompt: null,
            user_prompt: 'Safe prompt',
            model_id: 'model-1%0Aevil',
            model_name: 'GPT Test',
            provider_id: 'provider-1',
            provider_name: 'OpenAI',
            response: null,
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30,
            latency_ms: 123,
            estimated_cost: 0.001,
            temperature: 0.7,
            max_tokens: null,
            status: 'success',
            error_message: null,
            metadata: null,
            created_at: '2026-01-01T00:00:00.000Z',
          },
        ],
        templates: [
          {
            id: 'tpl-1%0Aevil',
            name: 'Polluted Template',
            description: null,
            category: 'writing',
            system_prompt: null,
            user_prompt_template: 'Polluted template',
            variables: null,
            default_model_id: null,
            default_temperature: 0.7,
            default_max_tokens: null,
            is_public: 0,
            usage_count: 0,
            created_by: null,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
          {
            id: 'tpl-1',
            name: 'Safe Template',
            description: null,
            category: 'writing%0Aevil',
            system_prompt: null,
            user_prompt_template: 'Safe template',
            variables: null,
            default_model_id: 'model-1',
            default_temperature: 0.7,
            default_max_tokens: null,
            is_public: 0,
            usage_count: 0,
            created_by: null,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
    );

    render(<Playground />);

    expect(screen.queryByText('Polluted Model')).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Enter your prompt here...'), {
      target: { value: 'Run safely' },
    });
    fireEvent.click(screen.getByText('Safe Model'));
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    await waitFor(() => {
      expect(mockRunPlayground).toHaveBeenCalledWith(
        expect.objectContaining({
          model_ids: ['model-1'],
          user_prompt: 'Run safely',
        }),
      );
    });

    await user.click(screen.getByRole('tab', { name: /History/i }));
    expect(screen.queryByText('Polluted history')).not.toBeInTheDocument();
    expect(screen.getByText('Safe history')).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Delete playground history hist-1' }),
    );
    expect(mockDeleteHistory).toHaveBeenCalledWith('hist-1');
    expect(mockDeleteHistory).not.toHaveBeenCalledWith('hist-1%0Aevil');

    await user.click(screen.getByRole('tab', { name: /Templates/i }));
    expect(screen.queryByText('Polluted Template')).not.toBeInTheDocument();
    expect(screen.getByText('Safe Template')).toBeInTheDocument();
    expect(screen.queryByText('writing%0Aevil')).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Delete prompt template Safe Template' }),
    );
    await user.click(screen.getByRole('button', { name: /^Delete$/ }));
    expect(mockDeleteTemplate).toHaveBeenCalledWith('tpl-1');
    expect(mockDeleteTemplate).not.toHaveBeenCalledWith('tpl-1%0Aevil');
  });

  it('enforces the five model comparison limit in the run payload', async () => {
    const models = Array.from({ length: 6 }, (_, index) => ({
      id: `model-${index + 1}`,
      displayName: `Model ${index + 1}`,
      isEnabled: true,
      provider: {
        displayName: 'Provider',
      },
    }));
    mockRunPlayground.mockResolvedValue({
      ok: true,
      data: {
        results: [],
      },
    });
    mockUseModels.mockReturnValue(
      createUseModelsValue({
        models,
      }),
    );

    render(<Playground />);

    fireEvent.change(screen.getByPlaceholderText('Enter your prompt here...'), {
      target: { value: 'Compare these models' },
    });
    for (const model of models) {
      fireEvent.click(screen.getByText(model.displayName));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    await waitFor(() => {
      expect(mockRunPlayground).toHaveBeenCalledWith(
        expect.objectContaining({
          model_ids: ['model-1', 'model-2', 'model-3', 'model-4', 'model-5'],
        }),
      );
    });
  });
});
