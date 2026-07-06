import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CommentInputModal from '@/components/features/blog/CommentInputModal';

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => false,
}));

describe('CommentInputModal', () => {
  it('trims payload fields and blocks duplicate in-flight submissions', async () => {
    let resolveSubmit: (() => void) | undefined;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>(resolve => {
          resolveSubmit = resolve;
        })
    );
    const onClose = vi.fn();

    const { container } = render(
      <CommentInputModal
        isOpen
        onClose={onClose}
        onSubmit={onSubmit}
        isTerminal={false}
      />
    );

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: '  Ada  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add website (optional)' }));
    fireEvent.change(screen.getByPlaceholderText('https://example.com'), {
      target: { value: '  https://example.com  ' },
    });
    fireEvent.change(screen.getByLabelText('Comment'), {
      target: { value: '  First comment  ' },
    });

    const form = container.querySelector('#comment-form');
    expect(form).not.toBeNull();

    fireEvent.submit(form as HTMLFormElement);
    fireEvent.submit(form as HTMLFormElement);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      author: 'Ada',
      content: 'First comment',
      website: 'https://example.com',
    });

    resolveSubmit?.();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('releases the submit guard after a failed submission so users can retry', async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new Error('Temporarily unavailable'))
      .mockResolvedValueOnce(undefined);
    const onClose = vi.fn();

    const { container } = render(
      <CommentInputModal
        isOpen
        onClose={onClose}
        onSubmit={onSubmit}
        isTerminal={false}
      />
    );

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Ada' },
    });
    fireEvent.change(screen.getByLabelText('Comment'), {
      target: { value: 'Retry this' },
    });

    const form = container.querySelector('#comment-form');
    expect(form).not.toBeNull();

    fireEvent.submit(form as HTMLFormElement);

    expect(await screen.findByText('Temporarily unavailable')).toBeInTheDocument();

    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('normalizes control characters and unsafe website URLs before submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    const { container } = render(
      <CommentInputModal
        isOpen
        onClose={onClose}
        onSubmit={onSubmit}
        isTerminal={false}
      />
    );

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: ' Ada\u0000\nLovelace ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add website (optional)' }));
    fireEvent.change(screen.getByPlaceholderText('https://example.com'), {
      target: { value: 'https://user:pass@example.com/profile' },
    });
    fireEvent.change(screen.getByLabelText('Comment'), {
      target: { value: ' First\r\ncomment\u0000body ' },
    });

    fireEvent.submit(container.querySelector('#comment-form') as HTMLFormElement);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      author: 'Ada Lovelace',
      content: 'First\ncomment body',
      website: '',
    }));
  });
});
