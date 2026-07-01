import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockAdminApiFetch = vi.hoisted(() => vi.fn());
const mockToast = vi.hoisted(() => vi.fn());

vi.mock('@/services/admin/apiClient', () => ({
  adminApiFetch: mockAdminApiFetch,
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

import { PromptsManager } from '@/components/features/admin/ai/PromptsManager';

type Prompt = {
  mode: string;
  label: string;
  text: string;
  isOverridden: boolean;
};

function prompt(overrides: Partial<Prompt> = {}): Prompt {
  return {
    mode: 'default',
    label: 'Default',
    text: 'Default prompt',
    isOverridden: false,
    ...overrides,
  };
}

describe('PromptsManager', () => {
  afterEach(() => {
    mockAdminApiFetch.mockReset();
    mockToast.mockReset();
  });

  it('loads prompts through the shared admin API client and saves trimmed server text', async () => {
    mockAdminApiFetch.mockImplementation(
      async (endpoint: string, options: { method?: string } = {}) => {
        if (endpoint === '/prompts') {
          return {
            ok: true,
            data: {
              prompts: [
                prompt({ mode: 'coding', label: 'Coding', text: 'Coding prompt' }),
                prompt(),
              ],
            },
          };
        }

        if (endpoint === '/prompts/default' && options.method === 'PUT') {
          return {
            ok: true,
            data: prompt({ text: 'Updated prompt', isOverridden: true }),
          };
        }

        return { ok: false, error: `Unexpected request: ${endpoint}` };
      },
    );

    render(<PromptsManager />);

    const editor = await screen.findByPlaceholderText(/Enter system prompt/i);
    expect(editor).toHaveValue('Default prompt');
    expect(mockAdminApiFetch).toHaveBeenCalledWith('/prompts', {
      pathPrefix: '/api/v1/agent',
    });

    fireEvent.change(editor, { target: { value: '  Updated prompt  ' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(mockAdminApiFetch).toHaveBeenCalledWith(
        '/prompts/default',
        expect.objectContaining({
          pathPrefix: '/api/v1/agent',
          method: 'PUT',
          body: { text: '  Updated prompt  ' },
        }),
      );
    });

    await waitFor(() => {
      expect(editor).toHaveValue('Updated prompt');
    });
    expect(screen.getByText('custom')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Save$/i })).toBeDisabled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Prompt saved',
        description: 'Default prompt updated',
      }),
    );
  });

  it('surfaces backend validation errors when saving fails', async () => {
    mockAdminApiFetch.mockImplementation(
      async (endpoint: string, options: { method?: string } = {}) => {
        if (endpoint === '/prompts') {
          return {
            ok: true,
            data: { prompts: [prompt()] },
          };
        }

        if (endpoint === '/prompts/default' && options.method === 'PUT') {
          return {
            ok: false,
            error: 'text must be a non-empty string',
          };
        }

        return { ok: false, error: `Unexpected request: ${endpoint}` };
      },
    );

    render(<PromptsManager />);

    const editor = await screen.findByPlaceholderText(/Enter system prompt/i);
    fireEvent.change(editor, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Save failed',
          description: 'text must be a non-empty string',
          variant: 'destructive',
        }),
      );
    });
    expect(editor).toHaveValue('   ');
  });
});
