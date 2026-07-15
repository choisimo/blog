import type { HTMLAttributes, ImgHTMLAttributes, ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSessionsIndex } from '@/services/chat';
import { VisitedPostsMinimap } from './VisitedPostsMinimap';
import { useVisitedPostsState } from './useVisitedPosts';

const navigateMock = vi.hoisted(() => vi.fn());
const isMobileMock = vi.hoisted(() => vi.fn(() => false));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => isMobileMock(),
}));

vi.mock('@/services/chat', () => ({
  loadSessionsIndex: vi.fn(() => []),
  storeSessionsIndex: vi.fn(),
}));

vi.mock('./useVisitedPosts', () => ({
  STORAGE_KEY: 'visited-posts',
  useVisitedPostsState: vi.fn(),
}));

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetClose: ({ children }: { children: ReactNode }) => <>{children}</>,
  SheetContent: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
  SheetHeader: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
  SheetTitle: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
    <h2 {...props}>{children}</h2>
  ),
  SheetTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/common/OptimizedImage', () => ({
  OptimizedImage: (props: ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

const useVisitedPostsStateMock = vi.mocked(useVisitedPostsState);
const loadSessionsIndexMock = vi.mocked(loadSessionsIndex);

const visitedPost = {
  path: '/blog/2026/safe-post',
  title: '\u001b[31mSafe Post\u0000',
  year: '2026\u0007',
  slug: 'safe-post\u0008',
  coverImage: '',
};

describe('VisitedPostsMinimap', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    isMobileMock.mockReturnValue(false);
    loadSessionsIndexMock.mockReturnValue([]);
    useVisitedPostsStateMock.mockReturnValue({
      items: [visitedPost],
      storageAvailable: true,
    });
  });

  it('sanitizes sheet labels, trigger labels, list labels, and visited post text', () => {
    const { container } = render(
      <VisitedPostsMinimap
        label={'\u001b[35mHistory panel\u0000'}
        title={'\u001b[34mRecent posts\u0000'}
        triggerLabel={'\u001b[32mOpen history\u0000'}
        listLabel={'\u001b[33mVisited list\u0000'}
        closeLabel={'\u001b[31mClose panel\u0000'}
      />
    );

    expect(screen.getByRole('button', { name: 'Open history' })).toBeInTheDocument();
    expect(container.querySelector('[aria-label="History panel"]')).toHaveAttribute(
      'title',
      'Recent posts'
    );
    expect(screen.getByRole('region', { name: 'Visited list' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close panel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '열기: Safe Post' })).toBeInTheDocument();
    expect(screen.getByText('2026/safe-post')).toBeInTheDocument();
    expect(container.textContent).not.toContain('\u001b');
    expect(container.textContent).not.toContain('\u0000');
  });

  it('keeps navigation paths unchanged when opening a sanitized post', () => {
    render(<VisitedPostsMinimap triggerLabel='Open history' />);

    fireEvent.click(screen.getByRole('button', { name: '열기: Safe Post' }));

    expect(navigateMock).toHaveBeenCalledWith('/blog/2026/safe-post');
  });

  it('sanitizes graph post and chat session display text', () => {
    loadSessionsIndexMock.mockReturnValue([
      {
        id: 'session-1',
        title: '\u001b[36mHelpful Chat\u0000',
        articleTitle: '\u001b[31mUnsafe Article\u0000',
        articleUrl: 'https://example.test/blog/2026/safe-post',
        summary: 'Helpful summary',
        createdAt: '2026-07-05T00:00:00.000Z',
        updatedAt: '2026-07-05T00:00:00.000Z',
        messageCount: 1,
        mode: 'article',
      },
    ]);

    render(<VisitedPostsMinimap />);
    fireEvent.click(screen.getByRole('button', { name: '그래프' }));

    expect(screen.getByText('Safe Post')).toBeInTheDocument();
    expect(screen.getByText('2026/safe-post')).toBeInTheDocument();
    expect(screen.getByText('Helpful Chat')).toBeInTheDocument();
  });

  it('renders nothing when storage is unavailable and there are no visited posts', () => {
    useVisitedPostsStateMock.mockReturnValue({
      items: [],
      storageAvailable: false,
    });

    const { container } = render(<VisitedPostsMinimap />);

    expect(container).toBeEmptyDOMElement();
  });
});
