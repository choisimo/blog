import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('preserves unsaved prompt edits when prompts are refreshed', async () => {
    mockAdminApiFetch
      .mockResolvedValueOnce({
        ok: true,
        data: {
          prompts: [
            {
              mode: 'default',
              label: 'Default',
              text: 'Server prompt v1',
              isOverridden: false,
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          prompts: [
            {
              mode: 'default',
              label: 'Default',
              text: 'Server prompt v2',
              isOverridden: false,
            },
          ],
        },
      });

    render(<PromptsManager />);

    const editor = await screen.findByPlaceholderText('Enter system prompt…');
    expect(editor).toHaveValue('Server prompt v1');

    fireEvent.change(editor, { target: { value: 'Unsaved local prompt' } });
    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));

    await waitFor(() => {
      expect(mockAdminApiFetch).toHaveBeenCalledTimes(2);
    });
    expect(editor).toHaveValue('Unsaved local prompt');
  });

  it('filters polluted prompt modes before rendering and saving', async () => {
    mockAdminApiFetch
      .mockResolvedValueOnce({
        ok: true,
        data: {
          prompts: [
            {
              mode: 'default%0Aevil',
              label: 'Polluted Prompt',
              text: 'Polluted prompt text',
              isOverridden: false,
            },
            {
              mode: 'default',
              label: 'Default',
              text: 'Server prompt',
              isOverridden: false,
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          mode: 'default',
          label: 'Default',
          text: 'Saved prompt',
          isOverridden: true,
        },
      });

    render(<PromptsManager />);

    const editor = await screen.findByPlaceholderText('Enter system prompt…');
    expect(screen.queryByText('Polluted Prompt')).not.toBeInTheDocument();
    expect(screen.queryByText('default%0Aevil')).not.toBeInTheDocument();

    fireEvent.change(editor, { target: { value: 'Edited prompt' } });
    fireEvent.click(screen.getByRole('button', { name: /Save/i }));

    await waitFor(() => {
      expect(mockAdminApiFetch).toHaveBeenCalledWith(
        '/prompts/default',
        expect.objectContaining({
          method: 'PUT',
          body: { text: 'Edited prompt' },
        }),
      );
    });

    expect(
      mockAdminApiFetch.mock.calls.some(([path]) =>
        String(path).includes('default%0Aevil'),
      ),
    ).toBe(false);
  });
});
