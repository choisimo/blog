import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BlogPost } from '@/types/blog';
import Blog from './Blog';

const mocks = vi.hoisted(() => ({
  getPostsPage: vi.fn(),
  getAllCategories: vi.fn(),
  getAllTags: vi.fn(),
}));
vi.mock('@/data/content/posts', () => mocks);
vi.mock('@/hooks/seo/useSEO', () => ({ useSEO: vi.fn() }));
vi.mock('@/utils/seo/seo', () => ({
  generateSEOData: vi.fn(),
  generateStructuredData: vi.fn(),
}));
vi.mock('@/components', () => ({ Pagination: () => null }));

const post: BlogPost = {
  id: 'one',
  year: '2026',
  slug: 'react',
  title: 'React systems',
  date: '2026-09-01',
  category: 'Web',
  tags: ['React'],
  description: 'A technical note',
  content: '',
  language: 'ko',
};

function LocationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid='location'>{location.search}</output>
      <button onClick={() => navigate(-1)}>이전 조건</button>
    </>
  );
}

function renderBlog(path = '/blog') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Blog />
      <LocationProbe />
    </MemoryRouter>
  );
}

describe('Blog discovery navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAllCategories.mockResolvedValue([
      'AI',
      'DevOps',
      'Java',
      'Linux',
      'Network',
      'Web',
    ]);
    mocks.getAllTags.mockResolvedValue(['React', 'Linux']);
    mocks.getPostsPage.mockImplementation(async ({ page }) => ({
      items: [post],
      page,
      pageSize: 12,
      total: 1,
      totalPages: 1,
      hasMore: false,
    }));
  });

  it('applies incoming search and tag links and renders each matching post once', async () => {
    renderBlog('/blog?q=React&tag=React');
    await waitFor(() =>
      expect(mocks.getPostsPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'React', tags: ['React'], page: 1 }),
        { throwOnError: true }
      )
    );
    expect(screen.getByRole('searchbox', { name: '게시글 검색' })).toHaveValue(
      'React'
    );
    expect(await screen.findAllByTestId('post-link')).toHaveLength(1);
    expect(
      screen.getByRole('button', { name: 'React 태그 필터 해제' })
    ).toBeInTheDocument();
  });

  it('resets pagination when searching and preserves the selected category', async () => {
    renderBlog('/blog?category=Web&page=3');
    await screen.findByText('React systems');
    fireEvent.change(screen.getByRole('searchbox', { name: '게시글 검색' }), {
      target: { value: 'React' },
    });
    await waitFor(() =>
      expect(mocks.getPostsPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'React', category: 'Web', page: 1 }),
        { throwOnError: true }
      )
    );
    expect(screen.getByTestId('location')).toHaveTextContent(
      'category=Web&q=React'
    );
    expect(screen.getByTestId('location')).not.toHaveTextContent('page=');
  });

  it('keeps tag selection, full category selection, sorting and browser history in sync', async () => {
    renderBlog('/blog?page=2');
    fireEvent.click(
      await screen.findByRole('button', { name: '태그 선택 (2)' })
    );
    fireEvent.click(screen.getByRole('button', { name: '#React' }));
    await waitFor(() =>
      expect(mocks.getPostsPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ tags: ['React'], page: 1 }),
        { throwOnError: true }
      )
    );
    expect(screen.getByRole('button', { name: '#React' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    fireEvent.change(screen.getByLabelText('전체 주제'), {
      target: { value: 'Web' },
    });
    fireEvent.change(screen.getByLabelText('정렬'), {
      target: { value: 'title' },
    });
    await waitFor(() =>
      expect(mocks.getPostsPage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          tags: ['React'],
          category: 'Web',
          sort: 'title',
          page: 1,
        }),
        { throwOnError: true }
      )
    );
    fireEvent.click(screen.getByRole('button', { name: '이전 조건' }));
    await waitFor(() =>
      expect(screen.getByLabelText('정렬')).toHaveValue('date')
    );
    expect(screen.getByLabelText('전체 주제')).toHaveValue('Web');
  });

  it('normalizes invalid page input and avoids duplicate editorial links for short lists', async () => {
    renderBlog('/blog?page=invalid');
    await waitFor(() =>
      expect(mocks.getPostsPage).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 }),
        { throwOnError: true }
      )
    );
    expect(await screen.findAllByTestId('post-link')).toHaveLength(1);
  });

  it('retries a failed result request without clearing the current filters', async () => {
    mocks.getPostsPage.mockRejectedValueOnce(new Error('Temporary outage'));
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    renderBlog('/blog?tag=React&q=React');
    fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }));
    expect(await screen.findAllByTestId('post-link')).toHaveLength(1);
    expect(mocks.getPostsPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'React', tags: ['React'] }),
      { throwOnError: true }
    );
    consoleError.mockRestore();
  });
});
