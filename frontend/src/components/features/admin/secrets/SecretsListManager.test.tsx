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

  it('uses specific titles for secret row action controls', async () => {
    mockUseSecrets.mockReturnValue(
      createUseSecretsValue({
        secrets: [
          {
            id: 'secret-1',
            category_id: 'general',
            key_name: 'API_KEY',
            display_name: 'API key',
            description: null,
            is_required: 1,
            is_sensitive: 1,
            value_type: 'string',
            validation_pattern: null,
            default_value: null,
            env_fallback: null,
            last_rotated_at: null,
            expires_at: null,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
            created_by: null,
            updated_by: null,
            has_value: true,
            category_name: 'General',
          },
        ],
      }),
    );

    render(<SecretsListManager categories={[]} />);

    expect(screen.getByRole('button', { name: 'Reveal API_KEY' }))
      .toHaveAttribute('title', 'Reveal API_KEY');
    expect(screen.getByRole('button', { name: 'Copy API_KEY' }))
      .toHaveAttribute('title', 'Copy API_KEY');
    expect(screen.getByRole('button', { name: 'Edit API_KEY' }))
      .toHaveAttribute('title', 'Edit API_KEY');
    expect(screen.getByRole('button', { name: 'Delete API_KEY' }))
      .toHaveAttribute('title', 'Delete API_KEY');
    await waitFor(() => {
      expect(mockFetchSecrets).toHaveBeenCalled();
    });
  });
});
