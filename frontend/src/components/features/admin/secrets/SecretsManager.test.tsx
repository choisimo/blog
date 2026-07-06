import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetchOverview = vi.hoisted(() => vi.fn());
const mockUseSecretsOverview = vi.hoisted(() => vi.fn());

vi.mock('./hooks', () => ({
  useSecretsOverview: mockUseSecretsOverview,
}));

vi.mock('./SecretsListManager', () => ({
  SecretsListManager: ({
    initialCategoryFilter,
  }: {
    initialCategoryFilter: string | null;
  }) => (
    <div data-testid='secrets-list'>
      Secrets list category: {initialCategoryFilter ?? 'all'}
    </div>
  ),
}));

vi.mock('./AuditLogViewer', () => ({
  AuditLogViewer: () => <div>Audit log</div>,
}));

function createUseSecretsOverviewValue(overrides = {}) {
  return {
    overview: null,
    health: null,
    loading: false,
    error: null,
    fetchOverview: mockFetchOverview,
    ...overrides,
  };
}

import { SecretsManager } from './SecretsManager';

describe('SecretsManager', () => {
  beforeEach(() => {
    mockFetchOverview.mockReset();
    mockUseSecretsOverview.mockReset();
    mockFetchOverview.mockResolvedValue(undefined);
    mockUseSecretsOverview.mockReturnValue(createUseSecretsOverviewValue());
  });

  it('shows overview load errors without also showing overview empty states', async () => {
    mockUseSecretsOverview.mockReturnValue(
      createUseSecretsOverviewValue({
        error: 'Secrets\u0000 overview\r\nunavailable\u007F',
      }),
    );

    render(<SecretsManager />);

    expect(screen.getByText('Secrets overview unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No categories found.')).not.toBeInTheDocument();
    expect(screen.queryByText('No recent activity.')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(mockFetchOverview).toHaveBeenCalled();
    });
  });

  it('labels the secrets overview refresh control', async () => {
    render(<SecretsManager />);

    expect(
      screen.getByRole('button', { name: 'Refresh secrets overview' }),
    ).toHaveAttribute('title', 'Refresh secrets overview');
    await waitFor(() => {
      expect(mockFetchOverview).toHaveBeenCalled();
    });
  });

  it('opens the secrets list locally when an overview category is selected', async () => {
    mockUseSecretsOverview.mockReturnValue(
      createUseSecretsOverviewValue({
        overview: {
          stats: {
            missing_required: 0,
            expiring_soon: 0,
            total: 1,
            configured: 1,
          },
          categories: [
            {
              id: 'database',
              display_name: 'Database\u0000',
              description: 'Database\r\ncredentials\u007F',
              secret_count: 1,
            },
            {
              id: 'polluted\r\ncategory',
              display_name: 'Polluted Category',
              description: 'Polluted category',
              secret_count: 1,
            },
          ],
          recentActivity: [
            {
              id: 1,
              secret_id: 'secret-1',
              action: 'created',
              created_at: '2026-01-01T00:00:00.000Z',
              key_name: 'API_KEY',
            },
            {
              id: 2,
              secret_id: 'secret-2',
              action: 'deleted\u0000',
              created_at: '2026-01-01T00:00:00.000Z',
              key_name: 'POLLUTED_KEY',
            },
          ],
        },
      }),
    );

    render(<SecretsManager />);

    expect(screen.getByText('Database credentials')).toBeInTheDocument();
    expect(screen.getByText('API_KEY')).toBeInTheDocument();
    expect(screen.queryByText('Polluted Category')).not.toBeInTheDocument();
    expect(screen.queryByText('POLLUTED_KEY')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Database/i }));

    expect(screen.getByTestId('secrets-list')).toHaveTextContent(
      'Secrets list category: database',
    );
    await waitFor(() => {
      expect(mockFetchOverview).toHaveBeenCalled();
    });
  });
});
