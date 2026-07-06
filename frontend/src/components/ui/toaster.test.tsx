import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Toaster } from './toaster';

const { useToastMock } = vi.hoisted(() => ({
  useToastMock: vi.fn(),
}));

vi.mock('@/hooks/ui/use-toast', () => ({
  useToast: useToastMock,
}));

describe('Toaster', () => {
  afterEach(() => {
    useToastMock.mockReset();
  });

  it('sanitizes toast title, description, and direct text action boundaries', () => {
    useToastMock.mockReturnValue({
      toasts: [
        {
          id: 'toast-1',
          title: '\u001b]0;Hidden title\u0007\u001b[31mSaved\u0000 now',
          description: '\u001b]2;Hidden description\u001b\\Ready\u0008 item',
          action: '\u001b]0;Hidden action\u0007\u001b[32mUndo\u0007',
        },
      ],
    });

    const { container } = render(<Toaster />);

    expect(screen.getByText('Saved now')).toBeInTheDocument();
    expect(screen.getByText('Ready item')).toBeInTheDocument();
    expect(screen.getByText('Undo')).toBeInTheDocument();
    expect(screen.queryByText(/\u001b\[[0-?]*[ -/]*[@-~]/)).not.toBeInTheDocument();
    expect(container.textContent).not.toContain('Hidden');
  });

  it('preserves numeric and rich toast nodes while omitting empty sanitized text', () => {
    useToastMock.mockReturnValue({
      toasts: [
        {
          id: 'toast-2',
          title: ['\u001b]0;Hidden array\u0007\u001b[31mSave', 'd\u0000'],
          description: 0,
          action: <button type='button'>Retry rich action</button>,
        },
        {
          id: 'toast-3',
          title: '\u001b]0;Hidden empty title\u0007\u001b[31m\u0000',
          description: '\u001b]0;Hidden empty description\u0007\u0007',
          action: 'Visible fallback',
        },
      ],
    });

    const { container } = render(<Toaster />);

    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry rich action' })).toBeInTheDocument();
    expect(screen.getByText('Visible fallback')).toBeInTheDocument();
    expect(container.textContent).not.toContain('\u001b');
    expect(container.textContent).not.toContain('\u0007');
    expect(container.textContent).not.toContain('Hidden');
  });
});
