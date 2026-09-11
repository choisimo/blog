import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReadingPreferences } from '@/components/common/ReadingPreferences';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Header } from './Header';

function renderReader() {
  return render(
    <MemoryRouter initialEntries={['/blog/2026/knowledge']}>
      <LanguageProvider>
        <ThemeProvider>
          <TooltipProvider>
            <ReadingPreferences />
            <Header />
            <main id="main-content" tabIndex={-1} className="fn-post-page">Article</main>
          </TooltipProvider>
        </ThemeProvider>
      </LanguageProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('header reading settings', () => {
  it('returns focus to the actual pointer trigger without scrolling the article', async () => {
    const user = userEvent.setup();
    renderReader();
    screen.getByRole('main').focus();
    const trigger = screen.getByRole('button', { name: '읽기 환경' });
    const focus = vi.spyOn(trigger, 'focus');
    // Unlike userEvent.click, this does not focus the button before its click handler.
    fireEvent.click(trigger);
    expect(await screen.findByRole('dialog', { name: '읽는 방식도, 나답게.' })).toBeVisible();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(document.body).not.toHaveAttribute('data-scroll-locked');
  });

  it('hands compact settings to the reading dialog and applies persisted preferences', async () => {
    const user = userEvent.setup();
    renderReader();
    const trigger = screen.getByRole('button', { name: '설정' });
    trigger.focus();
    await user.keyboard('{Enter}');
    await user.click(await screen.findByRole('menuitem', { name: '읽기 환경' }));
    expect(await screen.findByRole('dialog', { name: '읽는 방식도, 나답게.' })).toBeVisible();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('slider', { name: /^글자 크기/ }), { target: { value: '22' } });
    await user.click(screen.getByRole('button', { name: '명조' }));
    expect(document.documentElement.style.getPropertyValue('--fn-reading-size')).toBe('22px');
    expect(JSON.parse(localStorage.getItem('fieldnotes.reading.v1')!)).toMatchObject({ size: 22, font: 'serif' });
    const focus = vi.spyOn(trigger, 'focus');
    await user.click(screen.getByRole('button', { name: '닫기' }));
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(document.body).not.toHaveAttribute('data-scroll-locked');
  });
});
