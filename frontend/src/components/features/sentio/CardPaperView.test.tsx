import { useState } from 'react';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import CardPaperView from '@/components/features/sentio/CardPaperView';
import ThoughtCard from '@/components/features/sentio/ThoughtCard';
import LensCard from '@/components/features/sentio/LensCard';
import type { CardExplorationProps } from '@/components/features/sentio/CardExploration';
import { ThemeProvider } from '@/contexts/ThemeContext';

const card = {
  id: 'reading-question',
  trackKey: 'reading',
  title: '문단의 핵심은 무엇일까?',
  body: '주장과 근거를 함께 읽습니다.',
};

describe('Card paper reading', () => {
  it('closes only the paper on Escape and returns focus to its trigger', async () => {
    function Panel() {
      const [open, setOpen] = useState(true);
      return open ? (
        <div onKeyDown={event => event.key === 'Escape' && setOpen(false)}>
          <CardPaperView title={card.title}>
            <p>{card.body}</p>
          </CardPaperView>
        </div>
      ) : (
        <p>Panel closed</p>
      );
    }
    const user = userEvent.setup();
    render(<Panel />);
    const trigger = screen.getByRole('button', { name: /크게 보기/ });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: card.title });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
    expect(trigger).toHaveFocus();
    expect(screen.queryByText('Panel closed')).not.toBeInTheDocument();
  });

  it('shares unfinished questions and live responses between the card and paper', async () => {
    const user = userEvent.setup();
    const submitted: string[] = [];
    const exploration: CardExplorationProps = {
      available: true,
      questions: ['어떤 근거가 있을까?'],
      onExplore: question => {
        submitted.push(question);
      },
      onStop: () => {},
      onBack: () => {},
      onReset: () => {},
    };
    const { rerender } = render(
      <ThoughtCard card={card} index={0} exploration={exploration} />,
      { wrapper: ThemeProvider }
    );
    await user.type(screen.getByRole('textbox'), '다른 사례');
    await user.click(screen.getByRole('button', { name: /크게 보기/ }));
    let paper = within(screen.getByRole('dialog'));
    expect(paper.getByRole('textbox')).toHaveValue('다른 사례');
    await user.type(paper.getByRole('textbox'), '는?');
    await user.click(paper.getByRole('button', { name: '큰 화면 닫기' }));
    expect(screen.getByRole('textbox')).toHaveValue('다른 사례는?');
    await user.click(screen.getByRole('button', { name: /크게 보기/ }));
    paper = within(screen.getByRole('dialog'));
    await user.click(paper.getByRole('button', { name: '질문 보내기' }));
    expect(submitted).toEqual(['다른 사례는?']);
    rerender(
      <ThoughtCard
        card={card}
        index={0}
        exploration={{
          ...exploration,
          state: {
            status: 'streaming',
            turns: [],
            draft: {
              question: submitted[0],
              body: '추가 사례를 살펴봅니다.',
              questions: [],
            },
          },
        }}
      />
    );
    expect(paper.getByText('추가 사례를 살펴봅니다.')).toBeInTheDocument();
    expect(paper.getByRole('textbox')).toBeDisabled();
    await user.click(paper.getByRole('button', { name: '큰 화면 닫기' }));
    expect(screen.getByText('추가 사례를 살펴봅니다.')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('switches the paper between all summary points and evidence using one button', async () => {
    const user = userEvent.setup();
    render(
      <LensCard
        active
        evidence={{
          available: true,
          onGenerate: () => {},
          onStop: () => {},
          state: {
            status: 'complete',
            turns: [
              {
                question: '근거 분석',
                body: '원문에 근거한 상세한 설명입니다.',
                questions: [],
              },
            ],
          },
        }}
        card={{
          id: 'lens',
          personaId: 'analyst',
          angleKey: 'evidence',
          title: card.title,
          summary: card.body,
          detail: '문단에 제시된 근거입니다.',
          bullets: ['첫째', '둘째', '셋째', '넷째', '다섯째'],
          tags: [],
        }}
      />,
      { wrapper: ThemeProvider }
    );
    await user.click(screen.getByRole('button', { name: /크게 보기/ }));
    const paper = within(screen.getByRole('dialog'));
    expect(paper.getByText(card.body)).toBeInTheDocument();
    expect(
      paper.queryByText('문단에 제시된 근거입니다.')
    ).not.toBeInTheDocument();
    expect(
      paper.queryByText('원문에 근거한 상세한 설명입니다.')
    ).not.toBeInTheDocument();
    expect(paper.getByText('다섯째')).toBeVisible();
    expect(paper.getAllByRole('heading', { name: card.title })).toHaveLength(1);
    const toggle = paper.getByRole('button', {
      name: '분석 요점, 눌러서 근거 보기',
    });
    await user.click(toggle);
    expect(paper.getByText('원문에 근거한 상세한 설명입니다.')).toBeVisible();
    expect(paper.getByText('다섯째')).not.toBeVisible();
    expect(
      paper.getByRole('button', { name: '분석 근거, 눌러서 요점 보기' })
    ).toBe(toggle);
    await user.click(toggle);
    expect(paper.getByText('다섯째')).toBeVisible();
  });
});
