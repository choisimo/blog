import type { BlogPost } from '@/types/blog';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import BlogCard from './BlogCard';
import { prefetchPost } from '@/data/content/posts';

vi.mock('@/hooks/i18n/useLanguage', () => ({
  default: () => ({ language: 'en' }),
}));

vi.mock('@/utils/content/blog', () => ({
  formatDate: (value: string) => `\u001b[35m${value}\u0000`,
  resolveLocalizedPost: (post: BlogPost) => post,
}));

vi.mock('@/utils/shared/common', () => ({
  stripMarkdown: (value: string) => value.replace(/[*_`#]/g, '').slice(0, 150),
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
    category: 'Frontend',
    author: 'Author',
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

function renderBlogCard(ui: React.ReactElement) {
  return render(<MemoryRouter initialEntries={['/blog?category=AI']}>{ui}</MemoryRouter>);
}

describe('BlogCard', () => {
  it('sanitizes card text, image alt text, labels, and preserves safe links', () => {
    const { container } = renderBlogCard(
      <BlogCard
        post={post({
          title: '\u001b[31mSafe post\u0000',
          description: '**Safe description**\u0007',
          category: '\u001b[32mFrontend\u0000',
          author: '\u001b[33mAuthor\u0000',
          tags: ['\u001b[34mReact\u0000', '\u0000'],
          readingTime: '\u001b[35m3 min read\u0000',
        })}
        label={'\u001b[36mArticle\u0000'}
        title={'\u001b[31mCard title\u0007'}
        readMoreLabel={'\u001b[32mContinue\u0000'}
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
    expect(screen.getByRole('link', { name: 'Safe post' })).toHaveAttribute(
      'href',
      '/blog/2026/safe-post?category=AI'
    );
    expect(screen.getByRole('link', { name: 'Continue: Safe post' })).toHaveAttribute(
      'href',
      '/blog/2026/safe-post?category=AI'
    );
    expect(screen.getByText('Safe description')).toBeInTheDocument();
    expect(screen.getByText('Frontend')).toBeInTheDocument();
    expect(screen.getByText('Author')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('3 min read')).toBeInTheDocument();
    expect(container.textContent).not.toContain('\u001b');
    expect(container.textContent).not.toContain('\u0000');
  });

  it('prefetches only canonical safe post segments', () => {
    renderBlogCard(<BlogCard post={post()} />);

    fireEvent.mouseEnter(screen.getByRole('link', { name: 'Safe post' }));

    expect(prefetchPost).toHaveBeenCalledWith('2026', 'safe-post');
  });

  it('falls back to blog links and placeholder artwork for unsafe segments and images', () => {
    renderBlogCard(
      <BlogCard
        post={post({
          year: '2026',
          slug: 'bad%2Fslug',
          coverImage: 'https://user:pass@example.test/image.png',
        })}
      />
    );

    expect(screen.queryByRole('img', { name: 'Safe post' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Safe post' })).toHaveAttribute(
      'href',
      '/blog?category=AI'
    );
  });
});
