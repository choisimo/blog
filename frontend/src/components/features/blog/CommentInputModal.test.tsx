import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CommentInputModal from './CommentInputModal';

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => false,
}));

describe('CommentInputModal', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  it('sanitizes dialog labels, context text, field labels, placeholders, and footer text', () => {
    const { container } = render(
      <CommentInputModal
        isOpen
        isTerminal={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        intent='reply'
        initialAuthor={'\u001b[31mAda\u0000'}
        initialContent={'\u001b[32mInitial text\u0007'}
        contextLabel={'\u001b[33mReplying to Mina\u0000'}
        contextPreview={'\u001b[34mQuoted text\u0007'}
        label={'\u001b[35mComment dialog\u0000'}
        title={'\u001b[36mComment title\u0007'}
        authorLabel={'\u001b[31mAuthor\u0000'}
        authorPlaceholder={'\u001b[32mYour display name\u0000'}
        replyPlaceholder={'\u001b[33mReply here\u0000'}
        contentLabel={'\u001b[34mBody\u0000'}
        footerHint={'\u001b[35mMarkdown ok\u0000'}
      />
    );

    expect(screen.getByRole('dialog', { name: 'Comment dialog' })).toHaveAttribute(
      'title',
      'Comment title'
    );
    expect(screen.getByText('Replying to Mina')).toBeInTheDocument();
    expect(screen.getByText('Quoted text')).toBeInTheDocument();
    expect(screen.getByLabelText('Author')).toHaveValue('Ada');
    expect(screen.getByLabelText('Author')).toHaveAttribute('placeholder', 'Your display name');
    expect(screen.getByLabelText('Body')).toHaveValue('Initial text');
    expect(screen.getByLabelText('Body')).toHaveAttribute('placeholder', 'Reply here');
    expect(screen.getByText('Markdown ok')).toBeInTheDocument();
    expect(container.textContent).not.toContain('\u001b');
    expect(container.textContent).not.toContain('\u0000');
  });

  it('submits sanitized author, content, and safe website then closes', async () => {
    const onSubmit = vi.fn(() => Promise.resolve());
    const onClose = vi.fn();
    render(
      <CommentInputModal
        isOpen
        isTerminal={false}
        onClose={onClose}
        onSubmit={onSubmit}
        authorLabel='Name'
        contentLabel='Comment'
        websiteShowLabel='Show website'
      />
    );

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: '\u001b[31mAda Lovelace\u0000' },
    });
    fireEvent.change(screen.getByLabelText('Comment'), {
      target: { value: '\u001b[32mHello\r\nworld\u0007' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Show website' }));
    fireEvent.change(screen.getByLabelText('Show website'), {
      target: { value: 'https://example.com/profile' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        author: 'Ada Lovelace',
        content: 'Hello\nworld',
        website: 'https://example.com/profile',
      });
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('drops unsafe websites and sanitizes submit errors', async () => {
    const onSubmit = vi.fn(() => Promise.reject(new Error('\u001b[31mNope\u0000')));
    render(
      <CommentInputModal
        isOpen
        isTerminal={false}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        websiteShowLabel='Show website'
      />
    );

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText('Comment'), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Show website' }));
    fireEvent.change(screen.getByLabelText('Show website'), {
      target: { value: 'https://user:pass@example.com/profile' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        author: 'Ada',
        content: 'Hello',
        website: '',
      });
    });
    expect(await screen.findByText('Nope')).toBeInTheDocument();
  });

  it('uses sanitized terminal controls and submits with ctrl enter', async () => {
    const onSubmit = vi.fn(() => Promise.resolve());
    render(
      <CommentInputModal
        isOpen
        isTerminal
        onClose={vi.fn()}
        onSubmit={onSubmit}
        cancelLabel={'\u001b[31mAbort\u0000'}
        submitLabel={'\u001b[32mWrite quit\u0000'}
        authorLabel={'\u001b[33mUser\u0000'}
        contentLabel={'\u001b[34mTerminal comment\u0000'}
      />
    );

    fireEvent.change(screen.getByLabelText('User'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText('Terminal comment'), {
      target: { value: 'Hello' },
    });
    fireEvent.keyDown(screen.getByLabelText('Terminal comment'), {
      key: 'Enter',
      ctrlKey: true,
    });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        author: 'Ada',
        content: 'Hello',
        website: '',
      });
    });
    expect(screen.getByRole('button', { name: 'Abort' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Write quit' })).toBeInTheDocument();
  });
});
