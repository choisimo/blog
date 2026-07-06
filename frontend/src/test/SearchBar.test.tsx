import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  SearchBar,
  normalizeSearchBarErrorMessage,
} from '@/components/features/search/SearchBar';

const searchWebMock = vi.hoisted(() => vi.fn());

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ isTerminal: false }),
}));

vi.mock('@/services/discovery/webSearch', () => ({
  searchWeb: searchWebMock,
}));

describe('SearchBar', () => {
  it('normalizes web search error messages before display', () => {
    expect(normalizeSearchBarErrorMessage(' Rate\u0000\nlimited ')).toBe('Rate limited');
    expect(normalizeSearchBarErrorMessage(null)).toBe('Web search failed');
  });

  it('normalizes control characters before local Fuse search', async () => {
    const post = {
      title: 'hello world',
      description: '',
      content: '',
      tags: [],
      category: '',
    } as any;
    const onSearchResults = vi.fn();

    render(
      <SearchBar
        posts={[post]}
        onSearchResults={onSearchResults}
        enableWebSearch={false}
      />,
    );

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'hello\n\u0000 world' },
    });

    await waitFor(() => {
      expect(onSearchResults).toHaveBeenLastCalledWith([post]);
    });

    expect(screen.getByText("'hello world' 검색 결과")).toBeInTheDocument();
  });

  it('passes a normalized one-line query to web search', async () => {
    vi.useFakeTimers();
    searchWebMock.mockResolvedValue({ results: [], answer: 'done' });

    const onSearchResults = vi.fn();
    const onWebSearchResults = vi.fn();

    render(
      <SearchBar
        posts={[]}
        onSearchResults={onSearchResults}
        onWebSearchResults={onWebSearchResults}
      />,
    );

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: ' no\u0000\nmatch ' },
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    fireEvent.click(screen.getByRole('button', { name: /웹에서 검색/i }));

    await waitFor(() => {
      expect(searchWebMock).toHaveBeenCalledWith('no match', { maxResults: 5 });
    });

    vi.useRealTimers();
  });
});
