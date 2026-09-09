import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSketch = vi.hoisted(() => vi.fn());

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ isTerminal: false }),
}));

vi.mock('@/hooks/i18n/useLanguage', () => ({
  default: () => ({ language: 'ko' }),
}));

vi.mock('@/services/discovery/ai', () => ({
  sketch: mockSketch,
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock('./PrismDeck', () => ({
  default: () => <div>Prism deck</div>,
}));

vi.mock('./ThoughtFeed', () => ({
  default: () => <div>Thought feed</div>,
}));

import SparkInline, { normalizeDisplayText } from './SparkInline';

describe('SparkInline', () => {
  beforeEach(() => {
    mockSketch.mockReset();
  });
  it('strips OSC and CSI ANSI escape sequences from display text', () => {
    expect(
      normalizeDisplayText(
        '\u001b]0;Hidden title\u0007Visible \u001b[31mspark\u001b[0m\u0000'
      )
    ).toBe('Visible spark');
  });

  it('sanitizes sketch metadata and rendered sketch results', async () => {
    mockSketch.mockResolvedValue({
      mood: '\u001b[31m분석적\u001b[0m\u0000\r\nInjected\u007F',
      bullets: [
        '\u001b[32mFirst\u001b[0m\u0000',
        'Second\r\nInjected\u007F',
        '',
      ],
    });

    render(
      <SparkInline
        postTitle={'Post\u001b[33m\u001b[0m\u0000\r\nInjected\u007F'}
      >
        {'Paragraph\u001b[34m\u001b[0m\u0000\r\nInjected\u007F'}
      </SparkInline>
    );

    fireEvent.click(screen.getByRole('button', { name: 'AI로 문단 분석하기' }));
    fireEvent.click(screen.getByRole('button', { name: /핵심 파악/ }));

    await waitFor(() => {
      expect(mockSketch).toHaveBeenCalledWith({
        paragraph: 'Paragraph Injected',
        postTitle: 'Post Injected',
      });
    });

    expect(await screen.findByText('분석적 Injected')).toBeInTheDocument();
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second Injected')).toBeInTheDocument();
  });

  it('sanitizes wrapper and trigger accessibility text boundaries', () => {
    const { container } = render(
      <SparkInline
        label={'\u001b[31mSpark wrapper\u0000'}
        title={'Spark\u0007 title'}
        triggerLabel={'\u001b[32mAnalyze text\u0008'}
        triggerTitle={'Open\u0009 AI'}
      >
        {'Paragraph text'}
      </SparkInline>
    );

    const wrapper = container.querySelector('[data-spark-inline-wrapper]');
    const trigger = screen.getByRole('button', { name: 'Analyze text' });

    expect(wrapper).toHaveAttribute('aria-label', 'Spark wrapper');
    expect(wrapper).toHaveAttribute('title', 'Spark title');
    expect(trigger).toHaveAttribute('title', 'Open AI');
    expect(trigger.getAttribute('aria-label')).not.toContain('\u001b');
    expect(container.textContent).not.toContain('\u001b');
    expect(container.textContent).not.toContain('\u0007');
  });
  it('switches analysis cards and restores focus when closed without losing results', () => {
    render(<SparkInline>Paragraph to explore.</SparkInline>);
    const trigger = screen.getByRole('button', { name: 'AI로 문단 분석하기' });
    expect(
      screen.queryByRole('group', { name: '분석 방식 선택' })
    ).not.toBeInTheDocument();
    fireEvent.click(trigger);
    const prism = screen.getByRole('button', { name: /다각도 분석/ });
    fireEvent.click(prism);
    expect(prism).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Prism deck')).toBeVisible();
    const chain = screen.getByRole('button', { name: /더 생각해보기/ });
    fireEvent.click(chain);
    expect(prism).toHaveAttribute('aria-pressed', 'false');
    expect(chain).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Prism deck')).not.toBeVisible();
    expect(screen.getByText('Thought feed')).toBeVisible();
    fireEvent.keyDown(chain, { key: 'Escape' });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(chain).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Thought feed')).toBeVisible();
    expect(mockSketch).not.toHaveBeenCalled();
  });

  it('collapses the selector and restores the selected button without resetting results', () => {
    const { container, rerender } = render(
      <SparkInline>Paragraph to explore.</SparkInline>
    );
    fireEvent.click(screen.getByRole('button', { name: 'AI로 문단 분석하기' }));
    const expanded = container.querySelector<HTMLElement>(
      '.sentio-expanded-modes'
    )!;
    fireEvent.click(screen.getByRole('button', { name: /다각도 분석/ }));
    expect(container.querySelector('.sentio-panel')).toHaveAttribute(
      'data-compact',
      'true'
    );
    expect(expanded.inert).toBe(true);
    expect(screen.getByRole('button', { name: '다각도 분석' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: '분석 방식 펼치기' }));
    expect(expanded.inert).toBe(false);
    expect(container.querySelector('.sentio-panel')).toHaveAttribute(
      'data-compact',
      'false'
    );
    expect(screen.getByRole('button', { name: /다각도 분석/ })).toHaveFocus();
    expect(screen.getByText('Prism deck')).toBeVisible();
    expect(mockSketch).not.toHaveBeenCalled();
    rerender(<SparkInline>A different paragraph.</SparkInline>);
    expect(container.querySelector('.sentio-panel')).toHaveAttribute(
      'data-compact',
      'false'
    );
  });

  it('allows retry after an analysis failure', async () => {
    mockSketch
      .mockRejectedValueOnce(new Error('Temporary failure'))
      .mockResolvedValueOnce({ mood: '분석적', bullets: ['Recovered result'] });
    render(<SparkInline>Paragraph to summarize.</SparkInline>);
    fireEvent.click(screen.getByRole('button', { name: 'AI로 문단 분석하기' }));
    fireEvent.click(screen.getByRole('button', { name: /핵심 파악/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Temporary failure'
    );
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('Recovered result')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(mockSketch).toHaveBeenCalledTimes(2);
  });

  it('keeps a late sketch response in its own mode during rapid switching', async () => {
    let resolveSketch!: (result: { mood: string; bullets: string[] }) => void;
    mockSketch.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveSketch = resolve;
        })
    );
    render(<SparkInline>Paragraph to explore.</SparkInline>);
    fireEvent.click(screen.getByRole('button', { name: 'AI로 문단 분석하기' }));
    fireEvent.click(screen.getByRole('button', { name: /핵심 파악/ }));
    const prism = screen.getByRole('button', { name: /다각도 분석/ });
    expect(prism).toBeEnabled();
    fireEvent.click(prism);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    resolveSketch({ mood: '분석적', bullets: ['Delayed summary'] });
    await waitFor(() =>
      expect(screen.getByText('Delayed summary')).not.toBeVisible()
    );
    expect(prism).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /핵심 파악/ }));
    await waitFor(() =>
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    );
    expect(screen.getByText('Delayed summary')).toBeVisible();
    expect(mockSketch).toHaveBeenCalledTimes(1);
  });
});
