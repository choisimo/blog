import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAdminApiFetch = vi.hoisted(() => vi.fn());
const mockToast = vi.hoisted(() => vi.fn());

vi.mock('@/services/admin/apiClient', () => ({
  adminApiFetch: mockAdminApiFetch,
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

import { PromptsManager } from './PromptsManager';

describe('PromptsManager', () => {
  beforeEach(() => {
    mockAdminApiFetch.mockReset();
    mockToast.mockReset();
  });

  it('shows prompt load errors inline instead of the empty editor state', async () => {
    mockAdminApiFetch.mockResolvedValue({
      ok: false,
      error: 'Prompt service unavailable',
    });

    render(<PromptsManager />);

    await waitFor(() => {
      expect(screen.getByText('Unable to load prompts')).toBeInTheDocument();
    });

    expect(screen.getByText('Prompt service unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
    expect(screen.queryByText(/Select a mode/i)).not.toBeInTheDocument();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to load prompts',
        description: 'Prompt service unavailable',
        variant: 'destructive',
      }),
    );
  });
});
