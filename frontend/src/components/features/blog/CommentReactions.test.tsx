import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CommentReactions from './CommentReactions';
import {
  addReaction,
  getUserReactions,
  removeReaction,
  setUserReactions,
} from '@/services/engagement/reactions';

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/services/engagement/reactions', () => ({
  ALLOWED_EMOJIS: ['👍', '❤️', '😂'],
  addReaction: vi.fn(() => Promise.resolve()),
  removeReaction: vi.fn(() => Promise.resolve()),
  getUserReactions: vi.fn(() => new Set()),
  setUserReactions: vi.fn(),
}));

const addReactionMock = vi.mocked(addReaction);
const removeReactionMock = vi.mocked(removeReaction);
const getUserReactionsMock = vi.mocked(getUserReactions);
const setUserReactionsMock = vi.mocked(setUserReactions);

describe('CommentReactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserReactionsMock.mockReturnValue(new Set());
    addReactionMock.mockResolvedValue(undefined);
    removeReactionMock.mockResolvedValue(undefined);
  });

  it('sanitizes group labels, trigger text, reaction counts, and action labels', () => {
    const { container } = render(
      <CommentReactions
        commentId='comment-1'
        initialReactions={[
          { emoji: '👍' as never, count: 2.9 },
          { emoji: '👍' as never, count: 1 },
          { emoji: '🚫' as never, count: 9 },
          { emoji: '❤️' as never, count: -1 },
        ]}
        labelledTrigger
        label={'\u001b[35mReactions\u0000'}
        title={'\u001b[34mReaction controls\u0007'}
        addReactionLabel={'\u001b[31mAdd safe\u0000'}
        removeReactionLabel={'\u001b[32mRemove safe\u0000'}
        closePickerLabel={'\u001b[33mClose safe\u0000'}
        reactLabel={'\u001b[36mReact safe\u0000'}
        pickerLabel={'\u001b[35mPicker safe\u0000'}
      />
    );

    expect(screen.getByRole('group', { name: 'Reactions' })).toHaveAttribute(
      'title',
      'Reaction controls'
    );
    expect(screen.getByRole('button', { name: 'Add safe' })).toHaveTextContent('React safe');
    expect(
      screen
        .getAllByRole('button', { name: 'Add safe: 👍' })
        .find(button => button.textContent?.includes('3'))
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add safe' }));

    expect(screen.getByRole('group', { name: 'Picker safe' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close safe' })).toBeInTheDocument();
    expect(container.textContent).not.toContain('\u001b');
    expect(container.textContent).not.toContain('\u0000');
    expect(screen.queryByText('🚫')).not.toBeInTheDocument();
  });

  it('adds a reaction and persists sanitized user reaction state', async () => {
    render(<CommentReactions commentId='comment-1' labelledTrigger />);

    fireEvent.click(screen.getByRole('button', { name: 'Add reaction' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add reaction: 👍' }));

    await waitFor(() => {
      expect(addReactionMock).toHaveBeenCalledWith('comment-1', '👍');
    });
    expect(setUserReactionsMock).toHaveBeenCalledWith('comment-1', new Set(['👍']));
  });

  it('removes an existing user reaction', async () => {
    getUserReactionsMock.mockReturnValue(new Set(['👍']));

    render(
      <CommentReactions
        commentId='comment-1'
        initialReactions={[{ emoji: '👍' as never, count: 1 }]}
      />
    );

    const existingReactionButton = screen
      .getAllByRole('button', { name: 'Remove reaction: 👍' })
      .find(button => button.textContent?.includes('1'));

    expect(existingReactionButton).toBeInTheDocument();
    fireEvent.click(existingReactionButton!);

    await waitFor(() => {
      expect(removeReactionMock).toHaveBeenCalledWith('comment-1', '👍');
    });
    expect(setUserReactionsMock).toHaveBeenCalledWith('comment-1', new Set());
  });

  it('disables reaction controls for unsafe comment ids', () => {
    render(
      <CommentReactions
        commentId='comment%2Funsafe'
        initialReactions={[{ emoji: '👍' as never, count: 1 }]}
        labelledTrigger
      />
    );

    expect(screen.getByRole('button', { name: 'Add reaction' })).toBeDisabled();
    for (const button of screen.getAllByRole('button', { name: 'Add reaction: 👍' })) {
      expect(button).toBeDisabled();
    }
  });
});
