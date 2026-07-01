import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetchUsage = vi.hoisted(() => vi.fn());
const mockExportConfig = vi.hoisted(() => vi.fn());
const mockUseUsage = vi.hoisted(() => vi.fn());
const mockUseAIConfig = vi.hoisted(() => vi.fn());

vi.mock('./hooks', () => ({
  useUsage: mockUseUsage,
  useAIConfig: mockUseAIConfig,
}));

function createUsageData() {
  return {
    period: {
      start: '2026-01-01',
      end: '2026-01-07',
    },
    summary: {
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      avgLatencyMs: 0,
      successCount: 0,
      errorCount: 0,
    },
    breakdown: [],
  };
}

function createUseUsageValue(overrides = {}) {
  return {
    usage: createUsageData(),
    loading: false,
    error: null,
    fetchUsage: mockFetchUsage,
    ...overrides,
  };
}

import { UsageMonitor } from './UsageMonitor';

describe('UsageMonitor', () => {
  beforeEach(() => {
    mockFetchUsage.mockReset();
    mockExportConfig.mockReset();
    mockUseUsage.mockReset();
    mockUseAIConfig.mockReset();
    mockFetchUsage.mockResolvedValue(undefined);
    mockExportConfig.mockResolvedValue({
      ok: true,
      data: {
        exportedAt: '2026-01-01T00:00:00.000Z',
        providers: [],
        models: [],
        routes: [],
      },
    });
    mockUseAIConfig.mockReturnValue({
      exportConfig: mockExportConfig,
    });
    mockUseUsage.mockReturnValue(createUseUsageValue());
  });

  it('shows usage load errors without also showing the empty breakdown state', async () => {
    mockUseUsage.mockReturnValue(
      createUseUsageValue({
        error: 'Usage service unavailable',
      }),
    );

    render(<UsageMonitor />);

    expect(screen.getByText('Usage service unavailable')).toBeInTheDocument();
    expect(
      screen.queryByText(/No usage data available/i),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(mockFetchUsage).toHaveBeenCalled();
    });
  });
});
