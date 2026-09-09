import '@testing-library/jest-dom/vitest';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ModeReveal from './ModeReveal';

function view(active = true, pending = false) {
  return (
    <ModeReveal
      active={active}
      pending={pending}
      loader={<p role='status'>Loading</p>}
    >
      <button>Explore result</button>
    </ModeReveal>
  );
}

describe('ModeReveal', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows loading before exposing a cached result to assistive technology', () => {
    render(view());
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(519));
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole('button')).toHaveTextContent('Explore result');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('waits for the real request even after the transition delay', () => {
    const { rerender } = render(view(true, true));
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    rerender(view(true, false));
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('replaces an interrupted activation and cleans up on unmount', () => {
    const { rerender, unmount } = render(view());
    const result = screen.getByText('Explore result');
    act(() => vi.advanceTimersByTime(400));
    rerender(view(false));
    rerender(view(true));
    act(() => vi.advanceTimersByTime(120));
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(400));
    expect(screen.getByRole('button')).toBe(result);
    rerender(view(false));
    rerender(view(true));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('skips the cosmetic delay for reduced motion while preserving real loading', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const { rerender } = render(view(true, true));
    expect(screen.getByRole('status')).toBeInTheDocument();
    rerender(view());
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });
});
