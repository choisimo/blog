import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeToggle } from './ThemeToggle';

const themeMocks = vi.hoisted(() => ({
  theme: 'system' as unknown,
  isTerminal: false,
  setTheme: vi.fn(),
}));

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: themeMocks.theme,
    isTerminal: themeMocks.isTerminal,
    setTheme: themeMocks.setTheme,
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
    onClick,
    ...props
  }: {
    children: ReactNode;
    onClick?: () => void;
    [key: string]: unknown;
  }) => (
    <button type='button' onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

describe('ThemeToggle', () => {
  beforeEach(() => {
    themeMocks.theme = 'system';
    themeMocks.isTerminal = false;
    themeMocks.setTheme.mockReset();
  });

  it('falls back to system checked state for unsupported runtime theme values', () => {
    themeMocks.theme = 'bad-theme';

    render(<ThemeToggle />);

    expect(screen.getByRole('button', { name: /System/ })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByRole('button', { name: /Terminal/ })).toHaveAttribute(
      'aria-checked',
      'false'
    );
  });

  it('only emits allowlisted theme values from menu options', () => {
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole('button', { name: /Terminal/ }));

    expect(themeMocks.setTheme).toHaveBeenCalledWith('terminal');
  });

  it('preserves terminal selected checkmark emphasis outside terminal mode', () => {
    themeMocks.theme = 'terminal';
    themeMocks.isTerminal = false;

    render(<ThemeToggle />);

    expect(screen.getByText('✓')).toHaveClass('text-primary');
  });

  it('sanitizes custom trigger and menu labels while preserving theme values', () => {
    themeMocks.theme = 'terminal';
    themeMocks.isTerminal = true;

    const { container } = render(
      <ThemeToggle
        triggerLabel={'\u001b]0;Hidden trigger\u0007\u001b[31mSwitch theme\u0000'}
        labels={{
          light: '\u001b]0;Hidden light\u0007Lig\u0001ht',
          dark: '\u001b]0;Hidden dark\u0007\u001b[32mDark mode\u0002',
          system: '\u001b]0;Hidden system\u0007\u001b[33mSystem mode\u0003',
          terminal: '\u001b]0;Hidden terminal\u0007Term\u0004inal',
        }}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Switch theme' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Terminal/ })).toHaveAttribute(
      'aria-checked',
      'true'
    );

    fireEvent.click(screen.getByRole('button', { name: /Light/ }));

    expect(themeMocks.setTheme).toHaveBeenCalledWith('light');
    expect(container.textContent).not.toContain('Hidden');
    expect(container.textContent).not.toContain('\u001b');
    expect(container.textContent).not.toContain('\u0004');
  });

  it('falls back to default labels when custom labels sanitize to empty', () => {
    render(
      <ThemeToggle
        triggerLabel={'\u001b]0;Hidden trigger\u0007\u001b[31m\u0000'}
        labels={{
          light: '\u001b]0;Hidden light\u0007\u0001',
          dark: '\u001b]0;Hidden dark\u0007\u001b[32m\u0002',
          system: '\u001b]0;Hidden system\u0007\u0003',
          terminal: '\u001b]0;Hidden terminal\u0007\u0004',
        }}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Toggle theme' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Light/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dark/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /System/ })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByRole('button', { name: /Terminal/ })).toBeInTheDocument();
  });
});
