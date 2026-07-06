import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageToggle } from './LanguageToggle';

const languageMocks = vi.hoisted(() => ({
  language: 'ko' as unknown,
  setLanguage: vi.fn(),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    language: languageMocks.language,
    setLanguage: languageMocks.setLanguage,
  }),
}));

vi.mock('@/components/atoms/TouchIconButton', () => ({
  TouchIconButton: ({
    children,
    ...props
  }: {
    children: ReactNode;
    [key: string]: unknown;
  }) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onSelect,
    ...props
  }: {
    children: ReactNode;
    onSelect?: () => void;
    [key: string]: unknown;
  }) => (
    <button type='button' onClick={onSelect} {...props}>
      {children}
    </button>
  ),
}));

describe('LanguageToggle', () => {
  beforeEach(() => {
    languageMocks.language = 'ko';
    languageMocks.setLanguage.mockReset();
  });

  it('falls back to Korean display state for unsupported runtime language values', () => {
    languageMocks.language = 'bad-lang';

    render(<LanguageToggle />);

    expect(
      screen.getByRole('button', { name: '언어 변경: 현재 한국어' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /한국어/ })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute(
      'aria-checked',
      'false'
    );
  });

  it('only emits allowlisted language values from menu options', () => {
    render(<LanguageToggle />);

    fireEvent.click(screen.getByRole('button', { name: 'EN' }));

    expect(languageMocks.setLanguage).toHaveBeenCalledWith('en');
  });

  it('sanitizes custom display labels while preserving allowlisted language values', () => {
    languageMocks.language = 'en';

    const { container } = render(
      <LanguageToggle
        labels={{
          ko: '\u001b]0;Hidden ko\u0007\u001b[31mKorean\u0000',
          en: '\u001b]0;Hidden en\u0007Eng\u0007lish',
        }}
      />
    );

    expect(
      screen.getByRole('button', { name: '언어 변경: 현재 English' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Korean' })).toHaveAttribute(
      'aria-checked',
      'false'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Korean' }));

    expect(languageMocks.setLanguage).toHaveBeenCalledWith('ko');
    expect(container.textContent).not.toContain('Hidden');
    expect(container.textContent).not.toContain('\u001b');
    expect(container.textContent).not.toContain('\u0007');
  });

  it('falls back to default labels when custom labels sanitize to empty', () => {
    render(
      <LanguageToggle
        labels={{
          ko: '\u001b]0;Hidden ko\u0007\u001b[31m\u0000',
          en: '\u001b]0;Hidden en\u0007\u0007',
        }}
      />
    );

    expect(
      screen.getByRole('button', { name: '언어 변경: 현재 한국어' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'EN' })).toBeInTheDocument();
  });
});
