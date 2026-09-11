import { act, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ArticleReadingTools } from './ArticleReadingTools';
import type { SummaryResult } from '@/services/discovery/ai';

const summarize = vi.hoisted(() => vi.fn());
vi.mock('@/services/discovery/ai', () => ({ summary: summarize }));
vi.mock('@/stores/runtime/useFeatureFlagsStore', () => ({
  useFeatureFlags: () => ({ flags: { aiEnabled: true } }),
}));
vi.mock('@/hooks/content/useBookmarks', () => ({
  useIsBookmarked: () => ({ bookmarked: false, toggleBookmark: vi.fn() }),
}));
const props = {
  postId: '2026/reading',
  title: '읽기와 질문에 관한 긴 글',
  content: '원문 내용',
  onShare: () => {},
};
const deferred = () => {
  let resolve!: (value: SummaryResult) => void;
  const promise = new Promise<SummaryResult>(done => {
    resolve = done;
  });
  return { promise, resolve };
};

describe('Article summary paper', () => {
  beforeEach(() => summarize.mockReset());
  it('renders a visible title and safe Markdown instead of literal markup, and retains the result when reopened', async () => {
    const response = deferred();
    summarize.mockReturnValue(response.promise);
    const user = userEvent.setup();
    render(<ArticleReadingTools {...props} />, { wrapper: ThemeProvider });
    const trigger = screen.getByRole('button', { name: '핵심 요약' });
    await user.click(trigger);
    const paper = within(screen.getByRole('dialog', { name: '핵심 요약' }));
    expect(paper.getByRole('heading', { name: '핵심 요약' })).toBeVisible();
    expect(paper.getByRole('status')).toHaveTextContent('정리하고 있습니다');
    await act(async () =>
      response.resolve({
        summary:
          '### 한눈에 이해하기\n\n**관찰**과 `해석`을 구분합니다.\n\n[위험 링크](javascript:alert(1))',
        keyPoints: [
          '**첫째**, 원문을 읽습니다.',
          '```js\nconst question = 1;\n```',
        ],
      })
    );
    expect(
      paper.getByRole('heading', { name: '한눈에 이해하기' })
    ).toBeVisible();
    expect(paper.getByText('관찰').tagName).toBe('STRONG');
    expect(paper.getByText('해석').tagName).toBe('CODE');
    expect(paper.getByText('2가지')).toBeVisible();
    expect(
      screen.getByRole('dialog').querySelector('a[href^="javascript:"]')
    ).toBeNull();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
    await user.click(trigger);
    expect(summarize).toHaveBeenCalledTimes(1);
    expect(
      within(screen.getByRole('dialog')).getByRole('heading', {
        name: '한눈에 이해하기',
      })
    ).toBeVisible();
  });
  it('treats empty responses as recoverable errors and retries explicitly', async () => {
    summarize
      .mockResolvedValueOnce({ summary: '', keyPoints: [] })
      .mockResolvedValueOnce({ summary: '다시 불러온 요약입니다.' });
    const user = userEvent.setup();
    render(<ArticleReadingTools {...props} />, { wrapper: ThemeProvider });
    await user.click(screen.getByRole('button', { name: '핵심 요약' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '요약을 불러오지 못했습니다'
    );
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('다시 불러온 요약입니다.')).toBeVisible();
    expect(summarize).toHaveBeenCalledTimes(2);
  });
  it('ignores a late answer from a different article', async () => {
    const oldResponse = deferred();
    summarize
      .mockReturnValueOnce(oldResponse.promise)
      .mockResolvedValueOnce({ summary: '새 글의 요약' });
    const user = userEvent.setup();
    const { rerender } = render(<ArticleReadingTools {...props} />, {
      wrapper: ThemeProvider,
    });
    await user.click(screen.getByRole('button', { name: '핵심 요약' }));
    rerender(
      <ArticleReadingTools {...props} title='새 글' content='다른 원문' />
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
    await user.click(screen.getByRole('button', { name: '핵심 요약' }));
    expect(await screen.findByText('새 글의 요약')).toBeVisible();
    await act(async () => oldResponse.resolve({ summary: '오래된 글의 요약' }));
    expect(screen.queryByText('오래된 글의 요약')).not.toBeInTheDocument();
    expect(screen.getByText('새 글의 요약')).toBeVisible();
  });
});
