import type { BlogPost } from '@/types/blog';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PostCard from './PostCard';
import { prefetchPost } from '@/data/content/posts';

const bookmarkState = vi.hoisted(() => ({
  bookmarked: false,
  toggleBookmark: vi.fn(),
}));

vi.mock('@/hooks/i18n/useLanguage', () => ({
  default: () => ({ language: 'en' }),
}));

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ isTerminal: false }),
}));

vi.mock('@/hooks/content/useBookmarks', () => ({
  useIsBookmarked: () => bookmarkState,
}));

vi.mock('@/hooks/gesture/useTilt', () => ({
  useTilt: () => ({ current: null }),
}));

vi.mock('@/hooks/gesture/useSwipe', () => ({
  useSwipe: () => ({ ref: { current: null }, deltaX: 0, swiping: null }),
}));

vi.mock('@/utils/content/blog', () => ({
  formatDate: (value: string) => `\u001b[35m${value}\u0000`,
  resolveLocalizedPost: (post: BlogPost) => post,
}));

vi.mock('@/utils/shared/common', () => ({
  stripMarkdown: (value: string) => value.replace(/[*_`#]/g, '').slice(0, 200),
}));

vi.mock('@/data/content/posts', () => ({
  prefetchPost: vi.fn(),
}));

vi.mock('@/components/common/OptimizedImage', () => ({
  OptimizedImage: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

function post(overrides: Partial<BlogPost> = {}): BlogPost {
  return {
    title: 'Safe post',
    description: 'Safe description',
    excerpt: '',
    content: '',
    category: 'AI',
    tags: ['React'],
    date: '2026-07-05',
    readingTime: '3 min read',
    readTime: 3,
    year: '2026',
    slug: 'safe-post',
    coverImage: '/images/safe.png',
    ...overrides,
  } as BlogPost;
}

function renderPostCard(ui: React.ReactElement) {
  return render(<MemoryRouter initialEntries={['/blog?category=AI']}>{ui}</MemoryRouter>);
}

describe('PostCard', () => {
  beforeEach(() => {
    bookmarkState.bookmarked = false;
    bookmarkState.toggleBookmark.mockReset();
    vi.mocked(prefetchPost).mockReset();
  });

  it('sanitizes grid card text, labels, image alt text, and preserves safe links', () => {
    const { container } = renderPostCard(
      <PostCard
        post={post({
          title: '\u001b[31mSafe post\u0000',
          description: '**Safe description**\u0007',
          category: '\u001b[32mAI\u0000',
          tags: ['\u001b[33mReact\u0000', '\u0000'],
          readingTime: '\u001b[34m3 min read\u0000',
        })}
        label={'\u001b[35mArticle\u0000'}
        title={'\u001b[36mCard title\u0007'}
        openLabel={'\u001b[31mOpen article\u0000'}
        readLabel={'\u001b[32mContinue\u0000'}
        addBookmarkLabel={'\u001b[33mSave article\u0000'}
      />
    );

    expect(screen.getByRole('article', { name: 'Article: Safe post' })).toHaveAttribute(
      'title',
      'Card title'
    );
    expect(screen.getByRole('img', { name: 'Safe post' })).toHaveAttribute(
      'src',
      '/images/safe.png'
    );
    expect(screen.getAllByRole('link', { name: 'Open article: Safe post' })[0]).toHaveAttribute(
      'href',
      '/blog/2026/safe-post?category=AI'
    );
    expect(screen.getByRole('link', { name: 'Continue: Safe post' })).toHaveAttribute(
      'href',
      '/blog/2026/safe-post?category=AI'
    );
    expect(screen.getByRole('button', { name: 'Save article' })).toBeInTheDocument();
    expect(screen.getByText('Safe description')).toBeInTheDocument();
    expect(screen.getByText('#React')).toBeInTheDocument();
    expect(screen.getByText('3 min')).toBeInTheDocument();
    expect(container.textContent).not.toContain('\u001b');
    expect(container.textContent).not.toContain('\u0000');
  });

  it('toggles bookmark without navigating and uses bookmarked labels', () => {
    bookmarkState.bookmarked = true;
    renderPostCard(
      <PostCard
        post={post()}
        removeBookmarkLabel={'\u001b[31mUnsave article\u0000'}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Unsave article' }));

    expect(bookmarkState.toggleBookmark).toHaveBeenCalled();
  });

  it('prefetches only canonical safe post segments', () => {
    renderPostCard(<PostCard post={post()} />);

    fireEvent.mouseEnter(screen.getAllByRole('link', { name: 'Open post: Safe post' })[0]);

    expect(prefetchPost).toHaveBeenCalledWith('2026', 'safe-post');
  });

  it('falls back to blog links and placeholder artwork for unsafe segments and images', () => {
    renderPostCard(
      <PostCard
        post={post({
          slug: 'bad%2Fslug',
          coverImage: 'https://user:pass@example.test/image.png',
        })}
      />
    );

    expect(screen.queryByRole('img', { name: 'Safe post' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Open post: Safe post' })[0]).toHaveAttribute(
      'href',
      '/blog?category=AI'
    );
  });

  it('sanitizes mini variant link text and keeps image decorative', () => {
    const { container } = renderPostCard(
      <PostCard
        post={post({ title: '\u001b[31mMini post\u0000' })}
        variant='mini'
      />
    );

    expect(screen.getByRole('link', { name: 'Open post: Mini post' })).toHaveAttribute(
      'href',
      '/blog/2026/safe-post?category=AI'
    );
    expect(container.querySelector('img[alt=""]')).toHaveAttribute('src', '/images/safe.png');
  });
});
