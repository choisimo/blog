import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BlogPost } from '@/types/blog';
import Index from './Index';

const mocks = vi.hoisted(() => ({
  getPosts: vi.fn(),
  getPostsPage: vi.fn(),
  getTags: vi.fn(),
  getPostBySlug: vi.fn(),
  getPostCategoryCounts: vi.fn(),
}));
vi.mock('@/data/content/posts', () => mocks);
vi.mock('@/hooks/seo/useSEO', () => ({ useSEO: vi.fn() }));
vi.mock('@/utils/seo/seo', () => ({
  generateSEOData: vi.fn(),
  generateStructuredData: vi.fn(),
}));
vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ isTerminal: false }),
}));
vi.mock('@/services/content/analytics', () => ({
  getEditorPicks: async () => ({ data: [], degraded: false }),
}));
vi.mock('@/services/content/site-content', () => ({
  HOME_AI_CTA_BLOCK_KEY: 'home',
  getSiteContentBlock: async () => null,
}));
vi.mock('@/components/features/home', () => ({
  HomeCategoryStrip: () => null,
  HomeEditorPicksSection: () => null,
  HomeLatestPostsSection: () => null,
  HomeMarkdownCta: () => null,
}));
vi.mock('@/components', () => ({
  PostCard: ({ post }: { post: BlogPost }) => <article>{post.title}</article>,
}));

const posts: BlogPost[] = Array.from({ length: 12 }, (_, index) => ({
  id: `${index}`,
  title: `React note ${index}`,
  year: '2026',
  slug: `react-${index}`,
  date: '2026-09-01',
  category: 'Web',
  tags: ['React'],
  description: '',
  content: '',
  language: 'ko',
}));

describe('Home search loading and recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPosts.mockResolvedValue(posts);
    mocks.getPostsPage.mockResolvedValue({ items: [] });
    mocks.getTags.mockResolvedValue([]);
    mocks.getPostBySlug.mockResolvedValue(null);
    mocks.getPostCategoryCounts.mockResolvedValue({});
  });

  it('settles a real search without repeated result updates and links to all matches', async () => {
    render(
      <MemoryRouter>
        <Index />
      </MemoryRouter>
    );
    const input = screen.getByRole('textbox', { name: '검색어' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'React' } });
    expect(await screen.findByText('12 matches')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(9);
    expect(
      screen.getByRole('link', { name: '전체 검색 결과 보기 (12개)' })
    ).toHaveAttribute('href', '/blog?q=React');
    expect(mocks.getPosts).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '검색어 지우기' }));
    await waitFor(() =>
      expect(screen.queryByText('12 matches')).not.toBeInTheDocument()
    );
  });

  it('does not call a pending or failed data load an empty result and supports retry', async () => {
    let rejectLoad: (error: Error) => void = () => undefined;
    mocks.getPosts.mockReturnValueOnce(
      new Promise<BlogPost[]>((_resolve, reject) => {
        rejectLoad = reject;
      })
    );
    render(
      <MemoryRouter>
        <Index />
      </MemoryRouter>
    );
    const input = screen.getByRole('textbox', { name: '검색어' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'React' } });
    expect(
      screen.getByText('검색할 글을 불러오는 중입니다.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/검색 결과가 없습니다/)).not.toBeInTheDocument();
    await act(async () => rejectLoad(new Error('Temporary outage')));
    expect(screen.queryByText(/검색 결과가 없습니다/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '검색 다시 시도' }));
    expect(await screen.findByText('12 matches')).toBeInTheDocument();
    expect(mocks.getPosts).toHaveBeenCalledTimes(2);
  });
});
