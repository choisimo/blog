import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ReadingProgress } from './ReadingProgress';

const { useThemeMock } = vi.hoisted(() => ({
  useThemeMock: vi.fn(),
}));

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: useThemeMock,
}));

const setScrollGeometry = ({
  scrollY,
  scrollHeight,
  innerHeight,
}: {
  scrollY: number;
  scrollHeight: number;
  innerHeight: number;
}) => {
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    value: scrollY,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: innerHeight,
  });
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    configurable: true,
    value: scrollHeight,
  });
};

describe('ReadingProgress', () => {
  afterEach(() => {
    useThemeMock.mockReset();
  });

  it('sanitizes the progressbar accessibility label and exposes progress values', async () => {
    useThemeMock.mockReturnValue({ isTerminal: false });
    setScrollGeometry({ scrollY: 500, scrollHeight: 1500, innerHeight: 500 });

    render(
      <ReadingProgress
        label={'\u001b]0;Hidden label\u0007\u001b[31mRead progress\u0000'}
      />
    );

    const progressbar = screen.getByRole('progressbar', {
      name: 'Read progress',
    });

    await waitFor(() => {
      expect(progressbar).toHaveAttribute('aria-valuenow', '50');
    });

    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax', '100');
    expect(progressbar.getAttribute('aria-label')).not.toContain('Hidden');
    expect(progressbar.getAttribute('aria-label')).not.toContain('\u001b');
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('falls back to the default label when sanitized label is empty and preserves terminal styling', async () => {
    useThemeMock.mockReturnValue({ isTerminal: true });
    setScrollGeometry({ scrollY: 250, scrollHeight: 1250, innerHeight: 250 });

    render(<ReadingProgress label={'\u001b]0;Hidden label\u0007\u001b[32m\u0007'} />);

    const progressbar = screen.getByRole('progressbar', {
      name: 'Reading progress',
    });

    await waitFor(() => {
      expect(progressbar).toHaveAttribute('aria-valuenow', '25');
    });

    expect(progressbar).toHaveClass('bg-[hsl(var(--terminal-code-bg))]');
    expect(screen.getByText('25%')).toHaveClass('font-mono');
  });
});
