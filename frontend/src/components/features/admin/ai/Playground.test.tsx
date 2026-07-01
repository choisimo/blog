import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
});
