import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetchOverview = vi.hoisted(() => vi.fn());
const mockUseSecretsOverview = vi.hoisted(() => vi.fn());

vi.mock('./hooks', () => ({
  useSecretsOverview: mockUseSecretsOverview,
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
        error: 'Secrets overview unavailable',
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
});
