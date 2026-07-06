import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CommentReactions from '@/components/features/blog/CommentReactions';
import type { ReactionCount } from '@/services/engagement/reactions';

const reactionMocks = vi.hoisted(() => ({
  addReaction: vi.fn(),
  removeReaction: vi.fn(),
  getUserReactions: vi.fn(),
  setUserReactions: vi.fn(),
}));

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/services/engagement/reactions', () => ({
  ALLOWED_EMOJIS: ['👍', '🔥'],
  addReaction: reactionMocks.addReaction,
  removeReaction: reactionMocks.removeReaction,
  getUserReactions: reactionMocks.getUserReactions,
  setUserReactions: reactionMocks.setUserReactions,
}));

describe('CommentReactions', () => {
  beforeEach(() => {
    reactionMocks.addReaction.mockReset();
    reactionMocks.removeReaction.mockReset();
    reactionMocks.getUserReactions.mockReset();
    reactionMocks.setUserReactions.mockReset();
    reactionMocks.getUserReactions.mockReturnValue(new Set());
  });

  it('normalizes incoming reactions before rendering counts', () => {
    const initialReactions = [
      { emoji: '🔥', count: 2 },
      { emoji: '🔥', count: 3.8 },
      { emoji: '👍', count: -1 },
      { emoji: '🚫', count: 10 },
    ] as unknown as ReactionCount[];

    render(
      <CommentReactions
        commentId='comment-1'
        initialReactions={initialReactions}
      />
    );

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.queryByText('🚫')).not.toBeInTheDocument();
    expect(screen.queryByText('-1')).not.toBeInTheDocument();
  });

  it('blocks duplicate in-flight reaction toggles in the same render frame', async () => {
    let resolveAdd: (() => void) | undefined;
    reactionMocks.addReaction.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          resolveAdd = resolve;
        })
    );

    render(<CommentReactions commentId='comment-1' />);

    fireEvent.click(screen.getByRole('button', { name: '+' }));

    const likeButton = screen.getByRole('button', { name: '👍' });
    fireEvent.click(likeButton);
    fireEvent.click(likeButton);

    expect(reactionMocks.addReaction).toHaveBeenCalledTimes(1);
    expect(reactionMocks.addReaction).toHaveBeenCalledWith('comment-1', '👍');

    resolveAdd?.();

    await waitFor(() =>
      expect(reactionMocks.setUserReactions).toHaveBeenCalledTimes(1)
    );
  });

  it('rejects unsafe comment ids before reading or toggling reactions', () => {
    render(<CommentReactions commentId='comment%0a1' />);

    expect(reactionMocks.getUserReactions).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '+' }));
    fireEvent.click(screen.getByRole('button', { name: '👍' }));

    expect(reactionMocks.addReaction).not.toHaveBeenCalled();
    expect(reactionMocks.removeReaction).not.toHaveBeenCalled();
    expect(reactionMocks.setUserReactions).not.toHaveBeenCalled();
  });
});
