import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetchSecrets = vi.hoisted(() => vi.fn());
const mockCreateSecret = vi.hoisted(() => vi.fn());
const mockUpdateSecret = vi.hoisted(() => vi.fn());
const mockDeleteSecret = vi.hoisted(() => vi.fn());
const mockRevealSecret = vi.hoisted(() => vi.fn());
const mockGenerateValue = vi.hoisted(() => vi.fn());
const mockFetchCategories = vi.hoisted(() => vi.fn());
const mockCreateCategory = vi.hoisted(() => vi.fn());
const mockUseSecrets = vi.hoisted(() => vi.fn());
const mockUseCategories = vi.hoisted(() => vi.fn());

vi.mock('./hooks', () => ({
  useSecrets: mockUseSecrets,
  useCategories: mockUseCategories,
}));

function createUseSecretsValue(overrides = {}) {
  return {
    secrets: [],
    loading: false,
    error: null,
    fetchSecrets: mockFetchSecrets,
    createSecret: mockCreateSecret,
    updateSecret: mockUpdateSecret,
    deleteSecret: mockDeleteSecret,
    revealSecret: mockRevealSecret,
    generateValue: mockGenerateValue,
    ...overrides,
  };
}

function createUseCategoriesValue(overrides = {}) {
  return {
    categories: [],
    loading: false,
    error: null,
    fetchCategories: mockFetchCategories,
    createCategory: mockCreateCategory,
    ...overrides,
  };
}

import { SecretsListManager } from './SecretsListManager';

describe('SecretsListManager', () => {
  beforeEach(() => {
    mockFetchSecrets.mockReset();
    mockCreateSecret.mockReset();
    mockUpdateSecret.mockReset();
    mockDeleteSecret.mockReset();
    mockRevealSecret.mockReset();
    mockGenerateValue.mockReset();
    mockFetchCategories.mockReset();
    mockCreateCategory.mockReset();
    mockUseSecrets.mockReset();
    mockUseCategories.mockReset();
    mockFetchSecrets.mockResolvedValue(undefined);
    mockUseSecrets.mockReturnValue(createUseSecretsValue());
    mockUseCategories.mockReturnValue(createUseCategoriesValue());
  });

  it('shows secret load errors without also showing the empty state', async () => {
    mockUseSecrets.mockReturnValue(
      createUseSecretsValue({
        error: 'Secrets inventory unavailable',
      }),
    );

    render(<SecretsListManager categories={[]} />);

    expect(screen.getByText('Secrets inventory unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No secrets found')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(mockFetchSecrets).toHaveBeenCalled();
    });
  });

  it('labels the secrets list refresh control', async () => {
    render(<SecretsListManager categories={[]} />);

    expect(screen.getByRole('button', { name: 'Refresh secrets list' }))
      .toHaveAttribute('title', 'Refresh secrets list');
    await waitFor(() => {
      expect(mockFetchSecrets).toHaveBeenCalled();
    });
  });
});
