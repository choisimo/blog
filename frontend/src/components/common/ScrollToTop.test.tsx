import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ScrollToTop } from './ScrollToTop';

const { useIsMobileMock, useThemeMock } = vi.hoisted(() => ({
  useIsMobileMock: vi.fn(),
  useThemeMock: vi.fn(),
}));

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: useIsMobileMock,
}));

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: useThemeMock,
}));

vi.mock('@/components/atoms/TouchIconButton', () => ({
  TouchIconButton: ({
    children,
    variant: _variant,
    ...props
  }: {
    children: React.ReactNode;
    variant?: string;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type='button' {...props}>
      {children}
    </button>
  ),
}));

describe('ScrollToTop', () => {
  afterEach(() => {
    useIsMobileMock.mockReset();
    useThemeMock.mockReset();
    vi.restoreAllMocks();
  });

  it('sanitizes the scroll button accessibility label and preserves className', () => {
    useIsMobileMock.mockReturnValue(false);
    useThemeMock.mockReturnValue({ isTerminal: false });

    render(
      <ScrollToTop
        label={'\u001b]0;Hidden label\u0007\u001b[31mBack to top\u0000'}
        className='custom-scroll'
      />
    );

    const button = screen.getByRole('button', { name: 'Back to top' });

    expect(button).toHaveClass('custom-scroll');
    expect(button).toHaveClass('opacity-0');
    expect(button.getAttribute('aria-label')).not.toContain('Hidden');
    expect(button.getAttribute('aria-label')).not.toContain('\u001b');
  });

  it('falls back to the default label when sanitized label is empty and scrolls to top on click', () => {
    useIsMobileMock.mockReturnValue(false);
    useThemeMock.mockReturnValue({ isTerminal: true });
    const scrollToMock = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    render(<ScrollToTop label={'\u001b]0;Hidden label\u0007\u001b[32m\u0007'} />);

    const button = screen.getByRole('button', { name: '맨 위로 이동' });

    expect(button).toHaveClass('border-[hsl(var(--terminal-inactive-border))]');

    fireEvent.click(button);

    expect(scrollToMock).toHaveBeenCalledWith({
      top: 0,
      behavior: 'smooth',
    });
  });

  it('does not render on mobile terminal layouts', () => {
    useIsMobileMock.mockReturnValue(true);
    useThemeMock.mockReturnValue({ isTerminal: true });

    render(<ScrollToTop label='Hidden button' />);

    expect(screen.queryByRole('button', { name: 'Hidden button' })).not.toBeInTheDocument();
  });
});
