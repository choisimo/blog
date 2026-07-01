import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const hookMocks = vi.hoisted(() => ({
  createSecret: vi.fn(),
  deleteSecret: vi.fn(),
  fetchCategories: vi.fn(),
  fetchSecrets: vi.fn(),
  generateValue: vi.fn(),
  revealSecret: vi.fn(),
  updateSecret: vi.fn(),
}));

vi.mock('@/components/features/admin/secrets/hooks', () => ({
  useCategories: () => ({
    categories: [],
    loading: false,
    error: null,
    fetchCategories: hookMocks.fetchCategories,
    createCategory: vi.fn(),
  }),
  useSecrets: () => ({
    secrets: [
      {
        id: 'sec_1',
        category_id: 'cat_ai',
        key_name: 'OPENAI_API_KEY',
        display_name: 'OpenAI API Key',
        description: null,
        is_required: 1,
        is_sensitive: 1,
        value_type: 'string',
        validation_pattern: null,
        default_value: null,
        env_fallback: 'OPENAI_API_KEY',
        last_rotated_at: null,
        expires_at: null,
        created_at: '2026-07-01T00:00:00.000Z',
        updated_at: '2026-07-01T00:00:00.000Z',
        created_by: 'admin',
        updated_by: 'admin',
        has_value: true,
        category_name: 'AI',
      },
    ],
    loading: false,
    error: null,
    fetchSecrets: hookMocks.fetchSecrets,
    createSecret: hookMocks.createSecret,
    updateSecret: hookMocks.updateSecret,
    deleteSecret: hookMocks.deleteSecret,
    revealSecret: hookMocks.revealSecret,
    generateValue: hookMocks.generateValue,
  }),
}));

import { SecretsListManager } from '@/components/features/admin/secrets/SecretsListManager';
import type { SecretCategory } from '@/components/features/admin/secrets/types';

const categories: SecretCategory[] = [
  {
    id: 'cat_ai',
    name: 'ai',
    display_name: 'AI',
    description: null,
    icon: null,
    sort_order: 1,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
  },
];

describe('SecretsListManager plaintext break-glass flow', () => {
  afterEach(() => {
    Object.values(hookMocks).forEach((mock) => mock.mockReset());
  });

  it('prompts for a reason and retries reveal when the API requires one', async () => {
    hookMocks.revealSecret
      .mockResolvedValueOnce({
        ok: false,
        error: 'break-glass reason is required',
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          id: 'sec_1',
          keyName: 'OPENAI_API_KEY',
          value: 'secret-value',
        },
      });

    render(<SecretsListManager categories={categories} />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Reveal OPENAI_API_KEY' }),
    );

    expect(await screen.findByText('Audit Reason')).toBeInTheDocument();
    expect(hookMocks.revealSecret).toHaveBeenCalledWith('sec_1', undefined);

    fireEvent.change(screen.getByLabelText('Reason'), {
      target: { value: 'Rotating production provider key' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(hookMocks.revealSecret).toHaveBeenLastCalledWith(
        'sec_1',
        'Rotating production provider key',
      );
    });

    await waitFor(() => {
      expect(screen.getByText('secret-value')).toBeInTheDocument();
    });
  });
});
