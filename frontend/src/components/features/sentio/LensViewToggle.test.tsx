import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import LensCard from './LensCard';
import { ThemeProvider } from '@/contexts/ThemeContext';

const card = {
  id: 'mentor',
  personaId: 'mentor' as const,
  angleKey: 'cause',
  title: '어떤 관찰이 근거가 될까?',
  summary: '원문에서 관찰을 찾습니다.',
  detail: '',
  bullets: ['사실과 해석 구분하기'],
  tags: [],
};

describe('One lens view toggle', () => {
  it('keeps one persistent button, keyboard focus and an actionable tooltip across both views', async () => {
    function Harness() {
      const [showEvidence, setShowEvidence] = useState(false);
      return (
        <LensCard
          active
          card={card}
          showEvidence={showEvidence}
          onToggleEvidence={() => setShowEvidence(value => !value)}
          evidence={{
            available: true,
            onGenerate: () => {},
            onStop: () => {},
            state: {
              status: 'complete',
              turns: [
                {
                  question: '근거',
                  body: '관찰에 기반한 설명입니다.',
                  questions: [],
                },
              ],
            },
          }}
        />
      );
    }
    const user = userEvent.setup();
    const { container } = render(<Harness />, { wrapper: ThemeProvider });
    const toggle = screen.getByRole('button', {
      name: '분석 요점, 눌러서 근거 보기',
    });
    await user.tab();
    expect(toggle).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      '눌러서 근거 보기'
    );
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    );
    await user.keyboard('{Enter}');
    expect(
      screen.getByRole('button', { name: '분석 근거, 눌러서 요점 보기' })
    ).toBe(toggle);
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('관찰에 기반한 설명입니다.')).toBeVisible();
    expect(screen.getByText('원문에서 관찰을 찾습니다.')).not.toBeVisible();
    expect(container.querySelectorAll('.sentio-lens-view-toggle')).toHaveLength(
      1
    );
    await user.keyboard(' ');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('원문에서 관찰을 찾습니다.')).toBeVisible();
  });
});
