import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CommentSection, {
  normalizeCommentWebsiteUrl,
} from '@/components/features/blog/CommentSection';
import type { CommentItem } from '@/components/features/blog/commentFeed';

let feedComments: CommentItem[] = [];

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ isTerminal: false }),
}));

vi.mock('@/stores/runtime/useFeatureFlagsStore', () => ({
  useFeatureFlags: () => ({ flags: { aiEnabled: false } }),
}));

vi.mock('@/components/features/blog/commentFeed', () => ({
  mergeCommentItems: (
    existing: CommentItem[] | null | undefined,
    next: CommentItem[]
  ) => [...(existing || []), ...next],
  normalizeCommentPostId: (postId: string) => postId.trim() || null,
  useCommentsFeed: () => ({
    comments: feedComments,
    setComments: vi.fn(),
    loading: false,
    error: null,
    hasArchived: false,
  }),
}));

vi.mock('@/services/engagement/reactions', () => ({
  ALLOWED_EMOJIS: ['👍', '🔥'],
  addReaction: vi.fn().mockResolvedValue(undefined),
  fetchReactionsBatch: vi.fn().mockResolvedValue({}),
  getUserReactions: vi.fn(() => new Set()),
  removeReaction: vi.fn().mockResolvedValue(undefined),
  setUserReactions: vi.fn(),
}));

vi.mock('@/services/chat', () => ({
  streamChatEvents: vi.fn(),
}));

vi.mock('@/services/discovery/rag', () => ({
  getRAGContextForChat: vi.fn().mockResolvedValue(''),
}));

vi.mock('@/services/session/fingerprint', () => ({
  getCachedAdvancedVisitorId: () => '',
}));

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => false,
}));

describe('normalizeCommentWebsiteUrl', () => {
  it('allows only absolute http and https urls', () => {
    expect(normalizeCommentWebsiteUrl(' https://example.com/profile ')).toBe(
      'https://example.com/profile'
    );
    expect(normalizeCommentWebsiteUrl('http://example.com')).toBe(
      'http://example.com/'
    );
    expect(normalizeCommentWebsiteUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeCommentWebsiteUrl('ftp://example.com/file')).toBeNull();
    expect(normalizeCommentWebsiteUrl('example.com')).toBeNull();
  });
});

describe('CommentSection website rendering', () => {
  beforeEach(() => {
    feedComments = [];
  });

  it('does not render unsafe website links from loaded comments', () => {
    feedComments = [
      {
        author: 'Ada',
        content: 'Unsafe profile',
        website: 'javascript:alert(1)',
        createdAt: '2026-07-03T00:00:00.000Z',
      },
    ] as CommentItem[];

    render(<CommentSection postId='post-1' />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText('javascript:alert(1)')).not.toBeInTheDocument();
  });

  it('renders normalized safe website links from loaded comments', () => {
    feedComments = [
      {
        author: 'Ada',
        content: 'Safe profile',
        website: ' https://example.com/profile ',
        createdAt: '2026-07-03T00:00:00.000Z',
      },
    ] as CommentItem[];

    render(<CommentSection postId='post-1' />);

    expect(
      screen.getByRole('link', { name: 'https://example.com/profile' })
    ).toHaveAttribute('href', 'https://example.com/profile');
  });
});
