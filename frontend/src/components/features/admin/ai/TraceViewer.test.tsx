import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetchTraces = vi.hoisted(() => vi.fn());
const mockFetchTraceDetail = vi.hoisted(() => vi.fn());
const mockFetchTraceStats = vi.hoisted(() => vi.fn());

vi.mock('./hooks', () => ({
  useTraces: () => ({
    traces: [
      {
        trace_id: 'trace-1',
        total_spans: 2,
        total_latency_ms: 120,
        status: 'success',
        root_span_type: 'client_request',
        model_id: null,
        provider_id: null,
        user_id: null,
        request_path: '/api/v1/agent/run',
        error_message: null,
        created_at: '2026-01-01T01:02:03.000Z',
        completed_at: '2026-01-01T01:02:03.120Z',
      },
    ],
    loading: false,
    error: null,
    total: 1,
    fetchTraces: mockFetchTraces,
    fetchTraceDetail: mockFetchTraceDetail,
    fetchTraceStats: mockFetchTraceStats,
  }),
}));

import { TraceViewer } from './TraceViewer';

describe('TraceViewer', () => {
  beforeEach(() => {
    mockFetchTraces.mockReset();
    mockFetchTraceDetail.mockReset();
    mockFetchTraceStats.mockReset();
    mockFetchTraces.mockResolvedValue(undefined);
    mockFetchTraceStats.mockResolvedValue({
      ok: true,
      data: {
        stats: {
          total_traces: 1,
          success_count: 1,
          error_count: 0,
          timeout_count: 0,
          avg_latency_ms: 120,
          max_latency_ms: 120,
          min_latency_ms: 120,
        },
      },
    });
  });

  it('shows trace detail load errors instead of stale or empty detail content', async () => {
    mockFetchTraceDetail.mockResolvedValue({
      ok: false,
      error: 'Trace not found',
    });

    render(<TraceViewer />);

    fireEvent.click(await screen.findByRole('button', { name: /View trace trace-1/i }));

    await waitFor(() => {
      expect(mockFetchTraceDetail).toHaveBeenCalledWith('trace-1');
    });

    expect(await screen.findByText('Trace not found')).toBeInTheDocument();
    expect(screen.queryByText('No trace data found')).not.toBeInTheDocument();
  });
});
