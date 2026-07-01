import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockAdminApiFetch = vi.hoisted(() => vi.fn());

vi.mock('@/services/admin/apiClient', () => ({
  adminApiFetch: mockAdminApiFetch,
}));

import { PostMetricsDetail } from './PostMetricsDetail';

describe('PostMetricsDetail', () => {
  afterEach(() => {
    mockAdminApiFetch.mockReset();
  });

  it('loads visits and metrics through the shared admin API client', async () => {
    mockAdminApiFetch.mockImplementation(async (endpoint: string) => {
      if (endpoint === '/posts/2026/hello-world/visits?limit=50&offset=0') {
        return {
          ok: true,
          data: {
            visits: [
              {
                id: 1,
                ip_address: '127.0.0.1',
                user_agent: 'Mozilla/5.0 Chrome/120.0',
                referer: 'https://example.com/ref',
                path: '/blog/2026/hello-world',
                session_id: 'session-1',
                visited_at: '2026-01-01T01:02:03.000Z',
              },
            ],
            total: 1,
          },
        };
      }

      if (endpoint === '/posts/2026/hello-world/metrics') {
        return {
          ok: true,
          data: {
            hourly: [{ hour: '2026-01-01T01:00:00.000Z', visits: 1 }],
          },
        };
      }

      return { ok: false, error: `Unexpected request: ${endpoint}` };
    });

    render(<PostMetricsDetail slug="hello-world" year="2026" onBack={vi.fn()} />);

    expect(await screen.findByText('127.0.0.1')).toBeInTheDocument();
    expect(screen.getByText('Chrome')).toBeInTheDocument();
    expect(screen.getByText('example.com')).toBeInTheDocument();
    expect(mockAdminApiFetch).toHaveBeenCalledWith(
      '/posts/2026/hello-world/visits?limit=50&offset=0',
      { pathPrefix: '/api/v1/admin/analytics' },
    );
    expect(mockAdminApiFetch).toHaveBeenCalledWith(
      '/posts/2026/hello-world/metrics',
      { pathPrefix: '/api/v1/admin/analytics' },
    );
  });

  it('shows the admin API error instead of an empty visitor log on visit failures', async () => {
    mockAdminApiFetch.mockImplementation(async (endpoint: string) => {
      if (endpoint.endsWith('/visits?limit=50&offset=0')) {
        return {
          ok: false,
          error: 'Session expired. Please log in again.',
        };
      }

      if (endpoint.endsWith('/metrics')) {
        return {
          ok: true,
          data: { hourly: [] },
        };
      }

      return { ok: false, error: `Unexpected request: ${endpoint}` };
    });

    render(<PostMetricsDetail slug="hello-world" year="2026" onBack={vi.fn()} />);

    expect(
      await screen.findByText('Session expired. Please log in again.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Unable to load visitor log.')).toBeInTheDocument();
    expect(screen.queryByText('No visits recorded yet.')).not.toBeInTheDocument();
  });
});
