import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PageTransitionFallback } from './PageTransitionFallback';

const { useThemeMock } = vi.hoisted(() => ({
  useThemeMock: vi.fn(),
}));

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: useThemeMock,
}));

describe('PageTransitionFallback', () => {
  afterEach(() => {
    useThemeMock.mockReset();
  });

  it('sanitizes the loading status accessibility label', () => {
    useThemeMock.mockReturnValue({ isTerminal: false });

    render(
      <PageTransitionFallback
        label={'\u001b]0;Hidden label\u0007\u001b[31mLoading route\u0000'}
        className='custom-fallback'
      />
    );

    const status = screen.getByRole('status', { name: 'Loading route' });

    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveClass('custom-fallback');
    expect(status.querySelector('svg')).toBeInTheDocument();
    expect(status.getAttribute('aria-label')).not.toContain('Hidden');
    expect(status).not.toHaveTextContent('loading');
  });

  it('preserves terminal fallback rendering and default label when sanitized label is empty', () => {
    useThemeMock.mockReturnValue({ isTerminal: true });

    const { container } = render(
      <PageTransitionFallback label={'\u001b]0;Hidden label\u0007\u001b[32m\u0007'} />
    );

    const status = screen.getByRole('status', { name: 'Loading page' });

    expect(status).toHaveAttribute('aria-label', 'Loading page');
    expect(screen.getByText('▋')).toHaveClass('crt-text-glow');
    expect(container.querySelector('.terminal-cursor')).toBeInTheDocument();
    expect(container.textContent).not.toContain('\u001b');
    expect(container.textContent).not.toContain('\u0007');
  });
});
