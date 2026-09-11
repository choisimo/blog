import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/contexts/ThemeContext';
import type { CardExplorationState } from './hooks/useCardExploration';

const feed = vi.hoisted(() => vi.fn());
const explore = vi.hoisted(() => vi.fn());
const states = vi.hoisted(() => ({
  current: {} as Record<string, CardExplorationState>,
}));
vi.mock('./hooks/useThoughtFeed', () => ({ useThoughtFeed: feed }));
vi.mock('./hooks/useCardExploration', () => ({
  useCardExploration: () => ({
    states: states.current,
    available: true,
    explore,
    stop: vi.fn(),
    back: vi.fn(),
    reset: vi.fn(),
  }),
}));
import ThoughtFeed from './ThoughtFeed';

const cards = [
  {
    id: 'fallback-thought-1',
    trackKey: 'fallback-thought-1',
    title: '주장의 근거는 무엇인가?',
    body: '관찰한 사실을 확인합니다.',
    bullets: [
      '주장의 근거는 무엇인가?',
      '관찰한 사실을 확인합니다.',
      '반례는 무엇인가?',
    ],
    tags: ['fallback', 'chain', '근거'],
  },
  {
    id: 'fallback-thought-2',
    trackKey: 'fallback-thought-2',
    title: '다른 관점은 무엇인가?',
    body: '가정을 확인합니다.',
    bullets: ['어떤 가정이 있는가?'],
    tags: [],
  },
];
const result = {
  cards,
  loading: false,
  loadingMore: false,
  appendWarming: false,
  exhausted: true,
  status: 'fallback-hard',
  loadMore: vi.fn(),
};
const props = {
  paragraph: '첫 번째 문단',
  cacheKey: 'post:paragraph',
  enabled: true,
};

describe('ThoughtFeed reading path', () => {
  beforeEach(() => {
    feed.mockReturnValue(result);
    states.current = {};
    explore.mockClear();
  });

  it('shows every question and native composer without the removed navigation section', async () => {
    const { container } = render(<ThoughtFeed {...props} />, {
      wrapper: ThemeProvider,
    });
    const inputs = await screen.findAllByRole('textbox');
    expect(inputs).toHaveLength(2);
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(
      screen.queryByText('이 문단에서 이어지는 질문')
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /이전 질문|다음 질문/ })
    ).not.toBeInTheDocument();
    expect(container.querySelector('.sentio-thought-path')).toBeInTheDocument();
    expect(screen.queryByText('fallback thought 1')).not.toBeInTheDocument();
    expect(screen.queryByText('chain')).not.toBeInTheDocument();
    expect(screen.getAllByText('관찰한 사실을 확인합니다.')).toHaveLength(1);
    expect(screen.getByText('기본 질문')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.type(inputs[1], '가정을 더 설명해 주세요{Enter}');
    expect(explore).toHaveBeenCalledWith(
      expect.objectContaining({ id: cards[1].id }),
      '가정을 더 설명해 주세요'
    );
  });

  it('retains drafts when questions append or the mode hides, but resets them for another paragraph', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ThoughtFeed {...props} />, {
      wrapper: ThemeProvider,
    });
    const inputs = await screen.findAllByRole('textbox');
    await user.type(inputs[0], '첫 카드 초안');
    await user.type(inputs[1], '둘째 카드 초안');
    feed.mockReturnValue({
      ...result,
      cards: [...cards, { ...cards[0], id: 'third', title: '세 번째 질문' }],
    });
    rerender(<ThoughtFeed {...props} />);
    expect((await screen.findAllByRole('textbox'))[0]).toHaveValue(
      '첫 카드 초안'
    );
    expect(screen.getAllByRole('textbox')[1]).toHaveValue('둘째 카드 초안');
    rerender(<ThoughtFeed {...props} enabled={false} />);
    rerender(<ThoughtFeed {...props} />);
    await waitFor(() =>
      expect(screen.getAllByRole('textbox')[0]).toHaveValue('첫 카드 초안')
    );
    rerender(<ThoughtFeed {...props} paragraph='완전히 다른 문단' />);
    await waitFor(() =>
      expect(screen.getAllByRole('textbox')[0]).toHaveValue('')
    );
  });

  it('keeps partial answers and errors in their own card and the expanded view', async () => {
    const user = userEvent.setup();
    states.current = {
      [cards[0].id]: {
        status: 'error',
        error: '연결을 확인하고 다시 시도해 주세요.',
        turns: [],
        draft: {
          question: '이어서 설명해 주세요',
          body: '수신한 부분 답변은 유지합니다.',
          questions: [],
        },
      },
    };
    render(<ThoughtFeed {...props} />, { wrapper: ThemeProvider });
    const articles = await screen.findAllByRole('article');
    expect(within(articles[0]).getByRole('alert')).toHaveTextContent(
      '연결을 확인'
    );
    expect(within(articles[1]).queryByRole('alert')).not.toBeInTheDocument();
    await user.click(
      within(articles[0]).getByRole('button', { name: /크게 보기/ })
    );
    const paper = screen.getByRole('dialog');
    expect(
      within(paper).getByText('수신한 부분 답변은 유지합니다.')
    ).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
    expect(
      within(articles[0]).getByRole('button', { name: /크게 보기/ })
    ).toHaveFocus();
  });
});
