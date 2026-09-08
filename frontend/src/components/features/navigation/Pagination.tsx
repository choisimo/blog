import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  label?: string;
  title?: string;
  firstPageLabel?: string;
  previousPageLabel?: string;
  nextPageLabel?: string;
  lastPageLabel?: string;
  pageLabel?: string;
  jumpLabel?: string;
  jumpInputLabel?: string;
  jumpPlaceholder?: string;
  jumpSubmitLabel?: string;
  showFirstLast?: boolean;
  showPageInfo?: boolean;
  showQuickJump?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const PAGINATION_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/g;
const PAGINATION_ANSI_ESCAPE_PATTERN = /\u001b\[[0-?]*[ -/]*[@-~]/g;
const PAGINATION_WHITESPACE_PATTERN = /\s+/g;
const DEFAULT_PAGINATION_LABEL = 'Pagination';
const DEFAULT_FIRST_PAGE_LABEL = 'First page';
const DEFAULT_PREVIOUS_PAGE_LABEL = 'Previous page';
const DEFAULT_NEXT_PAGE_LABEL = 'Next page';
const DEFAULT_LAST_PAGE_LABEL = 'Last page';
const DEFAULT_PAGE_LABEL = 'Page';
const DEFAULT_JUMP_LABEL = 'Jump to page';
const DEFAULT_JUMP_INPUT_LABEL = 'Page number';
const DEFAULT_JUMP_PLACEHOLDER = 'Go to';
const DEFAULT_JUMP_SUBMIT_LABEL = 'Go';

function normalizePaginationText(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;

  const normalized = String(value)
    .replace(PAGINATION_ANSI_ESCAPE_PATTERN, ' ')
    .replace(PAGINATION_CONTROL_PATTERN, ' ')
    .replace(PAGINATION_WHITESPACE_PATTERN, ' ')
    .trim();

  return normalized || null;
}

function normalizePaginationLabel(value: unknown, fallback: string): string {
  return normalizePaginationText(value) ?? fallback;
}

const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  className = '',
  label = DEFAULT_PAGINATION_LABEL,
  title,
  firstPageLabel = DEFAULT_FIRST_PAGE_LABEL,
  previousPageLabel = DEFAULT_PREVIOUS_PAGE_LABEL,
  nextPageLabel = DEFAULT_NEXT_PAGE_LABEL,
  lastPageLabel = DEFAULT_LAST_PAGE_LABEL,
  pageLabel = DEFAULT_PAGE_LABEL,
  jumpLabel = DEFAULT_JUMP_LABEL,
  jumpInputLabel = DEFAULT_JUMP_INPUT_LABEL,
  jumpPlaceholder = DEFAULT_JUMP_PLACEHOLDER,
  jumpSubmitLabel = DEFAULT_JUMP_SUBMIT_LABEL,
  showFirstLast = true,
  showPageInfo = true,
  showQuickJump = false,
  size = 'md',
}: PaginationProps) => {
  const { isTerminal } = useTheme();
  const [jumpValue, setJumpValue] = useState('');
  const [jumpPosition, setJumpPosition] = useState<string | null>(null);
  const safeTotalPages =
    Number.isFinite(totalPages) && totalPages > 0 ? Math.floor(totalPages) : 0;
  const safeCurrentPage =
    safeTotalPages > 0 && Number.isFinite(currentPage)
      ? Math.min(safeTotalPages, Math.max(1, Math.floor(currentPage)))
      : 1;
  const safeSize: NonNullable<PaginationProps['size']> =
    size === 'sm' || size === 'md' || size === 'lg' ? size : 'md';
  const safeLabel = normalizePaginationLabel(label, DEFAULT_PAGINATION_LABEL);
  const safeTitle = normalizePaginationText(title) ?? undefined;
  const safeFirstPageLabel = normalizePaginationLabel(
    firstPageLabel,
    DEFAULT_FIRST_PAGE_LABEL
  );
  const safePreviousPageLabel = normalizePaginationLabel(
    previousPageLabel,
    DEFAULT_PREVIOUS_PAGE_LABEL
  );
  const safeNextPageLabel = normalizePaginationLabel(
    nextPageLabel,
    DEFAULT_NEXT_PAGE_LABEL
  );
  const safeLastPageLabel = normalizePaginationLabel(
    lastPageLabel,
    DEFAULT_LAST_PAGE_LABEL
  );
  const safePageLabel = normalizePaginationLabel(pageLabel, DEFAULT_PAGE_LABEL);
  const safeJumpLabel = normalizePaginationLabel(jumpLabel, DEFAULT_JUMP_LABEL);
  const safeJumpInputLabel = normalizePaginationLabel(
    jumpInputLabel,
    DEFAULT_JUMP_INPUT_LABEL
  );
  const safeJumpPlaceholder = normalizePaginationLabel(
    jumpPlaceholder,
    DEFAULT_JUMP_PLACEHOLDER
  );
  const safeJumpSubmitLabel = normalizePaginationLabel(
    jumpSubmitLabel,
    DEFAULT_JUMP_SUBMIT_LABEL
  );

  const emitPageChange = useCallback(
    (page: number) => {
      if (!Number.isFinite(page) || safeTotalPages <= 0) return;
      const nextPage = Math.min(safeTotalPages, Math.max(1, Math.floor(page)));
      if (nextPage !== safeCurrentPage) {
        onPageChange(nextPage);
      }
    },
    [onPageChange, safeCurrentPage, safeTotalPages]
  );

  const handleJump = useCallback(() => {
    const page = Number.parseInt(jumpValue.replace(/[^\d]/g, ''), 10);
    emitPageChange(page);
    setJumpValue('');
    setJumpPosition(null);
  }, [emitPageChange, jumpValue]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleJump();
      } else if (e.key === 'Escape') {
        setJumpPosition(null);
        setJumpValue('');
      }
    },
    [handleJump]
  );

  if (safeTotalPages <= 1) return null;

  const sizeClasses = {
    sm: {
      button: 'h-[44px] w-[44px] min-h-[44px] min-w-[44px] text-xs',
      icon: 'h-3.5 w-3.5',
      gap: 'gap-1',
    },
    md: {
      button: 'h-[44px] w-[44px] min-h-[44px] min-w-[44px] text-sm',
      icon: 'h-4 w-4',
      gap: 'gap-1.5',
    },
    lg: {
      button: 'h-[48px] w-[48px] min-h-[44px] min-w-[44px] text-base',
      icon: 'h-5 w-5',
      gap: 'gap-2',
    },
  };

  const styles = sizeClasses[safeSize];

  const getVisiblePages = () => {
    const delta = size === 'sm' ? 1 : 2;
    const range: (number | string)[] = [];
    const rangeWithDots: (number | string)[] = [];

    for (
      let i = Math.max(2, safeCurrentPage - delta);
      i <= Math.min(safeTotalPages - 1, safeCurrentPage + delta);
      i++
    ) {
      range.push(i);
    }

    if (safeCurrentPage - delta > 2) {
      rangeWithDots.push(1, 'ellipsis-start');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (safeCurrentPage + delta < safeTotalPages - 1) {
      rangeWithDots.push('ellipsis-end', safeTotalPages);
    } else if (safeTotalPages > 1) {
      rangeWithDots.push(safeTotalPages);
    }

    return rangeWithDots;
  };

  const visiblePages = getVisiblePages();

  const renderNavButton = ({
    onClick,
    disabled,
    children,
    label,
    variant = 'outline',
  }: {
    onClick: () => void;
    disabled: boolean;
    children: React.ReactNode;
    label: string;
    variant?: 'outline' | 'ghost';
  }) => (
    <Button
      variant={variant}
      size='icon'
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        styles.button,
        'shrink-0 rounded-lg motion-safe:transition-transform motion-safe:duration-200',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        'hover:bg-primary/10 hover:border-primary/30',
        'motion-safe:active:scale-95',
        'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
      )}
    >
      {children}
    </Button>
  );

  const activePageClasses = isTerminal
    ? 'bg-green-400 text-black font-bold shadow-[0_0_8px_rgba(153,230,53,0.6)] scale-105 hover:bg-green-500 hover:text-black'
    : 'bg-primary text-primary-foreground shadow-md scale-105 hover:bg-primary/90';
  const focusRingClass = isTerminal
    ? 'focus-visible:ring-green-400'
    : 'focus-visible:ring-primary/40';

  const renderPageButton = ({
    page,
    isActive,
  }: {
    page: number;
    isActive: boolean;
  }) => (
    <Button
      key={page}
      variant={isActive ? 'default' : 'ghost'}
      size='icon'
      onClick={() => emitPageChange(page)}
      aria-label={`${safePageLabel} ${page}`}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        styles.button,
        'shrink-0 rounded-lg motion-safe:transition-transform motion-safe:duration-200',
        // 선택된 상태 (isActive) 디자인 변경
        isActive ? activePageClasses : 'font-medium hover:bg-muted',
        'motion-safe:active:scale-95',
        // 포커스 링도 테마에 맞춰 라임색으로 변경 (선택 사항)
        'focus-visible:ring-2 focus-visible:ring-offset-2',
        focusRingClass
      )}
    >
      {page}
    </Button>
  );

  const renderEllipsis = (position: string) => {
    if (!showQuickJump) {
      return (
        <span
          key={position}
          className={cn(
            styles.button,
            'flex items-center justify-center text-muted-foreground'
          )}
          aria-hidden
        >
          <MoreHorizontal className={styles.icon} />
        </span>
      );
    }

    return (
      <div key={position} className='relative'>
        <Button
          variant='ghost'
          size='icon'
          onClick={() =>
            setJumpPosition(current => (current === position ? null : position))
          }
          aria-expanded={jumpPosition === position}
          aria-label={safeJumpLabel}
          className={cn(
            styles.button,
            'rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted',
            'motion-safe:transition-transform motion-safe:duration-200'
          )}
        >
          <MoreHorizontal aria-hidden='true' className={styles.icon} />
        </Button>
        {jumpPosition === position && (
          <div className='absolute top-full left-1/2 -translate-x-1/2 mt-2 z-[var(--z-popover)]'>
            <div className='bg-popover border border-border rounded-xl shadow-lg p-2 flex gap-1.5'>
              <Input
                type='number'
                min={1}
                max={safeTotalPages}
                value={jumpValue}
                onChange={e => setJumpValue(e.target.value)}
                onKeyDown={handleKeyDown}
                aria-label={safeJumpInputLabel}
                placeholder={safeJumpPlaceholder}
                className='w-20 h-[44px] min-h-[44px] text-base rounded-lg text-center'
                autoFocus
              />
              <Button
                size='sm'
                onClick={handleJump}
                className='h-[44px] min-h-[44px] min-w-[44px] px-3 text-sm rounded-lg'
              >
                {safeJumpSubmitLabel}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <nav
      role='navigation'
      aria-label={safeLabel}
      title={safeTitle}
      className={cn('flex max-w-full flex-col items-center gap-3', className)}
    >
      <div
        className={cn(
          'flex max-w-full flex-wrap items-center justify-center',
          styles.gap
        )}
      >
        {showFirstLast && (
          <span className='inline-flex shrink-0'>
            {renderNavButton({
              onClick: () => emitPageChange(1),
              disabled: safeCurrentPage === 1,
              label: safeFirstPageLabel,
              variant: 'ghost',
              children: (
                <ChevronsLeft aria-hidden='true' className={styles.icon} />
              ),
            })}
          </span>
        )}

        {renderNavButton({
          onClick: () => emitPageChange(safeCurrentPage - 1),
          disabled: safeCurrentPage === 1,
          label: safePreviousPageLabel,
          children: <ChevronLeft aria-hidden='true' className={styles.icon} />,
        })}

        <span
          className='inline-flex min-h-11 items-center px-1 text-sm tabular-nums sm:hidden'
          aria-label={`${safePageLabel} ${safeCurrentPage} / ${safeTotalPages}`}
        >
          {safeCurrentPage} / {safeTotalPages}
        </span>
        <div className={cn('hidden items-center sm:flex', styles.gap, 'mx-1')}>
          {visiblePages.map(page =>
            typeof page === 'string'
              ? renderEllipsis(page)
              : renderPageButton({ page, isActive: safeCurrentPage === page })
          )}
        </div>

        {renderNavButton({
          onClick: () => emitPageChange(safeCurrentPage + 1),
          disabled: safeCurrentPage === safeTotalPages,
          label: safeNextPageLabel,
          children: <ChevronRight aria-hidden='true' className={styles.icon} />,
        })}

        {showFirstLast && (
          <span className='inline-flex shrink-0'>
            {renderNavButton({
              onClick: () => emitPageChange(safeTotalPages),
              disabled: safeCurrentPage === safeTotalPages,
              label: safeLastPageLabel,
              variant: 'ghost',
              children: (
                <ChevronsRight aria-hidden='true' className={styles.icon} />
              ),
            })}
          </span>
        )}
      </div>

      {showPageInfo && (
        <p className='text-xs text-muted-foreground'>
          Page{' '}
          <span className='font-medium text-foreground'>{safeCurrentPage}</span>{' '}
          of{' '}
          <span className='font-medium text-foreground'>{safeTotalPages}</span>
        </p>
      )}
    </nav>
  );
};

export default Pagination;
