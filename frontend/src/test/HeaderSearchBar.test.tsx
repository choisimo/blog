import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { HeaderSearchBar } from '@/components/features/search/HeaderSearchBar';

const navigateMock = vi.hoisted(() => vi.fn());
const addSearchQueryMock = vi.hoisted(() => vi.fn());
const removeSearchQueryMock = vi.hoisted(() => vi.fn());
const getRecentQueriesMock = vi.hoisted(() => vi.fn((): string[] => []));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useLocation: () => ({ pathname: '/blog' }),
}));

vi.mock('@/hooks/content/usePostsIndex', () => ({
  usePostsIndex: () => ({
    posts: [
      {
        title: 'hello world',
        description: '',
        tags: [],
        category: 'Search',
        year: '2026',
        slug: 'unsafe/slug',
      },
    ],
  }),
}));

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ isTerminal: false }),
}));

vi.mock('@/services/session/searchHistory', () => ({
  getRecentQueries: getRecentQueriesMock,
  addSearchQuery: addSearchQueryMock,
  removeSearchQuery: removeSearchQueryMock,
}));

describe('HeaderSearchBar', () => {
  it('normalizes query text before search history and falls back for unsafe selected post paths', async () => {
    render(<HeaderSearchBar presentation="inline" />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: ' hello\n\u0000 world ' } });

    await waitFor(() => {
      expect(screen.getByText('hello world')).toBeInTheDocument();
    });

    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(navigateMock).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(addSearchQueryMock).toHaveBeenCalledWith('hello world');
    expect(navigateMock).toHaveBeenCalledWith('/blog');
  });

  it('normalizes recent search entries before rendering and removal', async () => {
    getRecentQueriesMock.mockReturnValue([' old\nquery ', 'old query', '\u0000']);

    render(<HeaderSearchBar presentation="inline" />);

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);

    expect(await screen.findByText('old query')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove from history' }));

    expect(removeSearchQueryMock).toHaveBeenCalledWith('old query');
  });
});
