import type { BlogPost } from '@/types/blog';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BlogSidebar from './BlogSidebar';

const isTerminalMock = vi.hoisted(() => vi.fn(() => false));

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ isTerminal: isTerminalMock() }),
}));

vi.mock('./PostCard', () => ({
  PostCard: ({ post }: { post: BlogPost }) => (
    <article aria-label={`Recent post: ${post.title}`}>{post.title}</article>
  ),
}));

function post(overrides: Partial<BlogPost> = {}): BlogPost {
  return {
    title: 'Recent post',
    year: '2026',
    slug: 'recent-post',
    ...overrides,
  } as BlogPost;
}

describe('BlogSidebar', () => {
  beforeEach(() => {
    isTerminalMock.mockReturnValue(false);
  });

  it('sanitizes sidebar labels, category text, tag text, and active states', () => {
    const onCategorySelect = vi.fn();
    const onTagSelect = vi.fn();
    const { container } = render(
      <BlogSidebar
        label={'\u001b[35mFilters\u0000'}
        title={'\u001b[34mSidebar title\u0007'}
        categoriesLabel={'\u001b[31mTopics\u0000'}
        tagsLabel={'\u001b[32mTags\u0000'}
        categoryButtonLabel={'\u001b[33mChoose category\u0000'}
        tagButtonLabel={'\u001b[36mChoose tag\u0000'}
        categories={[
          { name: '\u001b[31mAI\u0000', count: 2.9 },
          { name: '\u0000', count: 1 },
          { name: 'Bad count', count: -2 },
        ]}
        tags={['\u001b[32mReact\u0000', '\u0000']}
        selectedCategory={'\u001b[31mAI\u0000'}
        selectedTags={['\u001b[32mReact\u0000']}
        onCategorySelect={onCategorySelect}
        onTagSelect={onTagSelect}
      />
    );

    expect(screen.getByRole('complementary', { name: 'Filters' })).toHaveAttribute(
      'title',
      'Sidebar title'
    );
    expect(screen.getByRole('region', { name: 'Topics' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Tags' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose category: AI' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByText('(2)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose category: Bad count' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(screen.getByText('(0)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose tag: React' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Choose category: AI' }));
    fireEvent.keyDown(screen.getByRole('button', { name: 'Choose tag: React' }), {
      key: 'Enter',
    });

    expect(onCategorySelect).toHaveBeenCalledWith('AI');
    expect(onTagSelect).toHaveBeenCalledWith('React');
    expect(container.textContent).not.toContain('\u001b');
    expect(container.textContent).not.toContain('\u0000');
  });

  it('renders up to five recent posts with sanitized section label', () => {
    render(
      <BlogSidebar
        recentPostsLabel={'\u001b[31mLatest\u0000'}
        recentPosts={Array.from({ length: 6 }, (_, index) =>
          post({ title: `Post ${index + 1}`, slug: `post-${index + 1}` })
        )}
      />
    );

    expect(screen.getByRole('region', { name: 'Latest' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(5);
    expect(screen.queryByRole('article', { name: 'Recent post: Post 6' })).not.toBeInTheDocument();
  });

  it('uses sanitized terminal headings without leaking control characters', () => {
    isTerminalMock.mockReturnValue(true);
    const { container } = render(
      <BlogSidebar
        categoriesLabel={'\u001b[31mTopics\u0000'}
        categories={[{ name: 'AI', count: 1 }]}
        tagsLabel={'\u001b[32mTags\u0000'}
        tags={['React']}
      />
    );

    expect(screen.getByText('$ ls topics/')).toBeInTheDocument();
    expect(screen.getByText('$ cat tags.txt')).toBeInTheDocument();
    expect(container.textContent).not.toContain('\u001b');
  });
});
