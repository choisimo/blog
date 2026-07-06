import * as React from 'react';
import { cn } from '@/lib/utils';

const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const CONTROL_TEXT_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;

const sanitizeCommandBarText = (value: string | number): string =>
  String(value).replace(ANSI_ESCAPE_PATTERN, '').replace(CONTROL_TEXT_PATTERN, '').trim();

const sanitizeCommandBarOptionalText = (value: unknown): string | undefined => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const sanitized = sanitizeCommandBarText(value);

  return sanitized.length > 0 ? sanitized : undefined;
};

const sanitizeCommandBarNode = (children: React.ReactNode): React.ReactNode => {
  if (typeof children === 'string' || typeof children === 'number') {
    return sanitizeCommandBarText(children);
  }

  if (Array.isArray(children)) {
    return children.map(sanitizeCommandBarNode);
  }

  return children;
};

/**
 * CommandBar - 터미널 스타일의 탭/버튼 그룹 컴포넌트
 * 
 * Design Philosophy: "키보드 키캡" 느낌의 날렵한 버튼
 * - Shape: 둥근 모서리 제거, radius 4px 유지
 * - Border: Neon Green 컬러와 Glow 효과
 * - Typography: Monospace 폰트 사용
 */

interface CommandBarProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

const CommandBar = React.forwardRef<HTMLElement, CommandBarProps>(
  ({ className, children, 'aria-label': ariaLabel, title, ...props }, ref) => (
    <nav
      ref={ref}
      className={cn(
        'flex items-center justify-between',
        'border-b border-border/30 pb-3 mb-5',
        className
      )}
      aria-label={sanitizeCommandBarOptionalText(ariaLabel)}
      title={sanitizeCommandBarOptionalText(title)}
      {...props}
    >
      {sanitizeCommandBarNode(children)}
    </nav>
  )
);
CommandBar.displayName = 'CommandBar';

interface CommandGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const CommandGroup = React.forwardRef<HTMLDivElement, CommandGroupProps>(
  ({ className, children, 'aria-label': ariaLabel, title, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center gap-3', className)}
      aria-label={sanitizeCommandBarOptionalText(ariaLabel)}
      title={sanitizeCommandBarOptionalText(title)}
      {...props}
    >
      {sanitizeCommandBarNode(children)}
    </div>
  )
);
CommandGroup.displayName = 'CommandGroup';

interface CommandButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  variant?: 'default' | 'close' | 'danger';
}

const CommandButton = React.forwardRef<HTMLButtonElement, CommandButtonProps>(
  (
    {
      className,
      active = false,
      variant = 'default',
      children,
      'aria-label': ariaLabel,
      title,
      ...props
    },
    ref
  ) => {
    const baseStyles = cn(
      // Base styles
      'bg-transparent',
      'px-4 py-2',
      'font-mono text-sm font-bold',
      'rounded-[4px]',
      'cursor-pointer',
      'transition-all duration-200',
      'uppercase tracking-wider',
      // Border
      'border',
      // Focus states
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      // Disabled
      'disabled:cursor-not-allowed disabled:opacity-50',
    );

    const variantStyles = {
      default: cn(
        'border-[hsl(var(--terminal-inactive-border))] text-muted-foreground',
        // Hover: 네온 그린 점등
        'hover:border-primary hover:text-primary',
        'hover:shadow-[var(--glow-shadow)]',
        'hover:[text-shadow:0_0_5px_hsl(var(--primary))]',
        // Active: 선택된 탭 - Dark text on neon green
        active && [
          'bg-primary text-[hsl(210_50%_2%)]',
          'border-primary',
          'shadow-[var(--glow-shadow)]',
        ],
      ),
      close: cn(
        'border-destructive/50 text-destructive',
        'hover:bg-destructive hover:text-white',
        'hover:border-destructive',
        'hover:shadow-[0_0_10px_hsl(var(--destructive)/0.5)]',
      ),
      danger: cn(
        'border-destructive/50 text-destructive',
        'hover:bg-destructive hover:text-white',
        'hover:border-destructive',
        'hover:shadow-[0_0_10px_hsl(var(--destructive)/0.5)]',
      ),
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variantStyles[variant], className)}
        aria-label={sanitizeCommandBarOptionalText(ariaLabel)}
        title={sanitizeCommandBarOptionalText(title)}
        {...props}
      >
        {sanitizeCommandBarNode(children)}
      </button>
    );
  }
);
CommandButton.displayName = 'CommandButton';

export { CommandBar, CommandGroup, CommandButton };
