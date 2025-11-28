import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * TerminalPanel - 터미널 출력 창 스타일의 정보 패널 컴포넌트
 * 
 * Design Philosophy: "터미널 출력 창처럼 보여야 한다"
 * - 왼쪽 강조 라인 (Neon Green)
 * - OUTPUT_LOG 라벨
 * - Monospace 폰트 섹션 제목
 * - > 프롬프트 스타일 리스트
 */

interface TerminalPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  children: React.ReactNode;
}

const TerminalPanel = React.forwardRef<HTMLDivElement, TerminalPanelProps>(
  ({ className, label = 'OUTPUT_LOG', children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        // Background
        'bg-[hsl(var(--terminal-panel,var(--card)))]',
        'bg-opacity-95',
        // Border
        'border border-[hsl(var(--terminal-inactive-border,var(--border)))]',
        'border-l-[3px] border-l-primary',
        // Spacing & Shape
        'p-6 rounded-[4px]',
        // Typography
        'text-foreground',
        // Position for pseudo-element
        'relative',
        className
      )}
      {...props}
    >
      {/* OUTPUT_LOG label */}
      <span
        className={cn(
          'absolute -top-2.5 right-3',
          'bg-background px-2',
          'text-muted-foreground/60',
          'font-mono text-[10px] uppercase tracking-wider'
        )}
        aria-hidden
      >
        {label}
      </span>
      {children}
    </div>
  )
);
TerminalPanel.displayName = 'TerminalPanel';

interface TerminalSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  children: React.ReactNode;
}

const TerminalSection = React.forwardRef<HTMLDivElement, TerminalSectionProps>(
  ({ className, title, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('mb-6 last:mb-0', className)}
      {...props}
    >
      {/* 주석(//) 스타일 제목 */}
      <h3 className={cn(
        'text-muted-foreground',
        'font-mono text-sm',
        'mb-3',
        'font-normal'
      )}>
        {title.startsWith('//') ? title : `// ${title}`}
      </h3>
      {children}
    </div>
  )
);
TerminalSection.displayName = 'TerminalSection';

interface TerminalListProps extends React.HTMLAttributes<HTMLUListElement> {
  children: React.ReactNode;
}

const TerminalList = React.forwardRef<HTMLUListElement, TerminalListProps>(
  ({ className, children, ...props }, ref) => (
    <ul
      ref={ref}
      className={cn('list-none p-0 m-0 space-y-2', className)}
      {...props}
    >
      {children}
    </ul>
  )
);
TerminalList.displayName = 'TerminalList';

interface TerminalListItemProps extends React.LiHTMLAttributes<HTMLLIElement> {
  highlight?: boolean;
  children: React.ReactNode;
}

const TerminalListItem = React.forwardRef<HTMLLIElement, TerminalListItemProps>(
  ({ className, highlight = false, children, ...props }, ref) => (
    <li
      ref={ref}
      className={cn(
        'flex items-start gap-2.5',
        'text-sm leading-relaxed',
        highlight && [
          'text-foreground',
          '[text-shadow:0_0_2px_rgba(255,255,255,0.5)]',
        ],
        className
      )}
      {...props}
    >
      {/* 프롬프트 아이콘 (>) */}
      <span
        className={cn(
          'text-primary font-bold font-mono',
          'select-none shrink-0'
        )}
        aria-hidden
      >
        {'>'}
      </span>
      <span className="flex-1">{children}</span>
    </li>
  )
);
TerminalListItem.displayName = 'TerminalListItem';

/**
 * TerminalOutput - 명령어 실행 결과 표시용 컴포넌트
 */
interface TerminalOutputProps extends React.HTMLAttributes<HTMLPreElement> {
  children: React.ReactNode;
}

const TerminalOutput = React.forwardRef<HTMLPreElement, TerminalOutputProps>(
  ({ className, children, ...props }, ref) => (
    <pre
      ref={ref}
      className={cn(
        'font-mono text-xs',
        'text-foreground/90',
        'whitespace-pre-wrap',
        'leading-relaxed',
        'p-4',
        'bg-[hsl(var(--terminal-code-bg))]',
        'border border-border/30',
        'rounded-[4px]',
        'overflow-auto',
        className
      )}
      {...props}
    >
      {children}
    </pre>
  )
);
TerminalOutput.displayName = 'TerminalOutput';

/**
 * TerminalPrompt - 입력 프롬프트 스타일 컴포넌트
 */
interface TerminalPromptProps extends React.HTMLAttributes<HTMLDivElement> {
  path?: string;
  children?: React.ReactNode;
}

const TerminalPrompt = React.forwardRef<HTMLDivElement, TerminalPromptProps>(
  ({ className, path = '~', children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-center gap-2',
        'font-mono text-sm',
        className
      )}
      {...props}
    >
      <span className="text-primary/60">{path}</span>
      <span className="text-primary font-bold">$</span>
      {children && <span className="text-foreground">{children}</span>}
    </div>
  )
);
TerminalPrompt.displayName = 'TerminalPrompt';

export {
  TerminalPanel,
  TerminalSection,
  TerminalList,
  TerminalListItem,
  TerminalOutput,
  TerminalPrompt,
};
