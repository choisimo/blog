import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CommentSection, { normalizeCommentWebsiteUrl } from './CommentSection';
import { useCommentsFeed } from './commentFeed';
import { useFeatureFlags } from '@/stores/runtime/useFeatureFlagsStore';

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ isTerminal: false }),
}));

vi.mock('@/stores/runtime/useFeatureFlagsStore', () => ({
  useFeatureFlags: vi.fn(() => ({ flags: { aiEnabled: true } })),
}));

vi.mock('./commentFeed', () => ({
  mergeCommentItems: (prev: unknown[] | undefined, next: unknown[]) => [
    ...(prev || []),
    ...next,
  ],
  normalizeCommentPostId: (postId: string) =>
    postId && !postId.includes('/') ? postId : null,
  useCommentsFeed: vi.fn(),
}));

vi.mock('@/services/engagement/reactions', () => ({
  fetchReactionsBatch: vi.fn(() => Promise.resolve({})),
}));

vi.mock('./CommentReactions', () => ({
  default: ({ commentId }: { commentId: string }) => (
    <div aria-label={`reactions:${commentId}`} />
  ),
}));

vi.mock('./CommentInputModal', () => ({
  default: ({
    isOpen,
    contextLabel,
    contextPreview,
  }: {
    isOpen: boolean;
    contextLabel?: string;
    contextPreview?: string;
  }) =>
    isOpen ? (
      <div role='dialog' aria-label='composer'>
        {contextLabel && <span>{contextLabel}</span>}
        {contextPreview && <span>{contextPreview}</span>}
      </div>
    ) : null,
}));

vi.mock('@/services/chat', () => ({
  streamChatEvents: vi.fn(),
}));

vi.mock('@/services/discovery/rag', () => ({
  getRAGContextForChat: vi.fn(),
}));

vi.mock('@/services/session/fingerprint', () => ({
  getCachedAdvancedVisitorId: vi.fn(() => ''),
}));

vi.mock('@/utils/network/apiBase', () => ({
  getApiBaseUrl: () => 'https://api.example.test',
}));

const useCommentsFeedMock = vi.mocked(useCommentsFeed);
const useFeatureFlagsMock = vi.mocked(useFeatureFlags);

describe('CommentSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useFeatureFlagsMock.mockReturnValue({ flags: { aiEnabled: true } } as ReturnType<
      typeof useFeatureFlags
    >);
    useCommentsFeedMock.mockReturnValue({
      comments: [],
      setComments: vi.fn(),
      loading: false,
      error: null,
      hasArchived: false,
    } as ReturnType<typeof useCommentsFeed>);
  });

  it('sanitizes discussion labels, comment authors/content, websites, and actions', () => {
    const { container } = render(
      <CommentSection
        postId='post-1'
        label={'\u001b[35mThread\u0000'}
        title={'\u001b[34mThread title\u0007'}
        replyLabel={'\u001b[31mRespond\u0000'}
        quoteLabel={'\u001b[32mCite\u0000'}
        askAiLabel={'\u001b[33mAsk bot\u0000'}
      />
    );
    expect(screen.getByRole('region', { name: 'Thread' })).toHaveAttribute(
      'title',
      'Thread title'
    );

    useCommentsFeedMock.mockReturnValue({
      comments: [
        {
          id: 'comment-1',
          postId: 'post-1',
          author: '\u001b[31mAda\u0000',
          content: '\u001b[32mHello **world**\u0007',
          website: 'https://example.com/profile',
          createdAt: '2026-07-05T00:00:00.000Z',
        },
        {
          id: 'comment-2',
          postId: 'post-1',
          author: 'Mallory',
          content: 'Unsafe website',
          website: 'https://user:pass@example.com/profile',
          createdAt: '2026-07-05T00:01:00.000Z',
        },
      ],
      setComments: vi.fn(),
      loading: false,
      error: null,
      hasArchived: false,
    } as ReturnType<typeof useCommentsFeed>);

    const rendered = render(
      <CommentSection
        postId='post-1'
        label='Thread'
        replyLabel='Respond'
        quoteLabel='Cite'
        askAiLabel='Ask bot'
      />
    );

    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(rendered.container.textContent).toContain('Hello world');
    expect(screen.getByRole('link', { name: 'https://example.com/profile' })).toHaveAttribute(
      'href',
      'https://example.com/profile'
    );
    expect(
      screen.queryByRole('link', { name: 'https://user:pass@example.com/profile' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Respond: Ada' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cite: Ada' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask bot: Ada' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cite: Ada' }));

    expect(screen.getByRole('dialog', { name: 'composer' })).toBeInTheDocument();
    expect(screen.getByText('Ada의 메시지 인용')).toBeInTheDocument();
    expect(screen.getByText('Hello **world**')).toBeInTheDocument();
    expect(container.textContent).not.toContain('\u001b');
    expect(rendered.container.textContent).not.toContain('\u001b');
    expect(rendered.container.textContent).not.toContain('\u0000');
  });

  it('toggles AI discussion with sanitized labels and pressed state', () => {
    render(
      <CommentSection
        postId='post-1'
        aiAutoOnLabel={'\u001b[31mAI enabled\u0000'}
        aiAutoOffLabel={'\u001b[32mAI disabled\u0000'}
      />
    );

    expect(screen.getByRole('button', { name: 'AI disabled' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );

    fireEvent.click(screen.getByRole('button', { name: 'AI disabled' }));

    expect(localStorage.getItem('comment.aiDiscussion')).toBe('true');
    expect(screen.getByRole('button', { name: 'AI enabled' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('normalizes only safe comment website URLs', () => {
    expect(normalizeCommentWebsiteUrl('https://example.com/profile')).toBe(
      'https://example.com/profile'
    );
    expect(normalizeCommentWebsiteUrl('http://example.com/profile')).toBe(
      'http://example.com/profile'
    );
    expect(normalizeCommentWebsiteUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeCommentWebsiteUrl('https://user:pass@example.com/profile')).toBeNull();
    expect(normalizeCommentWebsiteUrl('https://example.com/%0Aunsafe')).toBeNull();
  });
});
