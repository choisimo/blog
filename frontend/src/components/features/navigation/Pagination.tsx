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
  showFirstLast?: boolean;
  showPageInfo?: boolean;
  showQuickJump?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  className = '',
  showFirstLast = true,
  showPageInfo = true,
  showQuickJump = false,
  size = 'md',
}: PaginationProps) => {
  const { isTerminal } = useTheme();
  const [jumpValue, setJumpValue] = useState('');
  const [isJumpOpen, setIsJumpOpen] = useState(false);

  const handleJump = useCallback(() => {
    const page = parseInt(jumpValue, 10);
    if (!isNaN(page) && page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page);
    }
    setJumpValue('');
    setIsJumpOpen(false);
  }, [jumpValue, totalPages, currentPage, onPageChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleJump();
      } else if (e.key === 'Escape') {
        setIsJumpOpen(false);
        setJumpValue('');
      }
    },
    [handleJump]
  );

  if (totalPages <= 1) return null;

  const sizeClasses = {
    sm: { button: 'h-8 w-8 text-xs', icon: 'h-3.5 w-3.5', gap: 'gap-1' },
    md: { button: 'h-10 w-10 text-sm', icon: 'h-4 w-4', gap: 'gap-1.5' },
    lg: { button: 'h-12 w-12 text-base', icon: 'h-5 w-5', gap: 'gap-2' },
  };

  const styles = sizeClasses[size];

  const getVisiblePages = () => {
    const delta = size === 'sm' ? 1 : 2;
    const range: (number | string)[] = [];
    const rangeWithDots: (number | string)[] = [];

    for (
      let i = Math.max(2, currentPage - delta);
      i <= Math.min(totalPages - 1, currentPage + delta);
      i++
    ) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, 'ellipsis-start');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('ellipsis-end', totalPages);
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  };

  const visiblePages = getVisiblePages();

  const NavButton = ({
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
        'rounded-xl transition-all duration-200',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        'hover:bg-primary/10 hover:border-primary/30 hover:scale-105',
        'active:scale-95',
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

  const PageButton = ({
    page,
    isActive,
  }: {
    page: number;
    isActive: boolean;
  }) => (
<Button
  variant={isActive ? 'default' : 'ghost'}
  size='icon'
  onClick={() => onPageChange(page)}
  aria-label={`Page ${page}`}
  aria-current={isActive ? 'page' : undefined}
  className={cn(
    styles.button,
    'rounded-xl transition-all duration-200',
    // 선택된 상태 (isActive) 디자인 변경
    isActive ? activePageClasses : 'font-medium hover:bg-muted hover:scale-105',
    'active:scale-95',
    // 포커스 링도 테마에 맞춰 라임색으로 변경 (선택 사항)
    'focus-visible:ring-2 focus-visible:ring-offset-2',
    focusRingClass
  )}
>
  {page}
</Button>
  );

  const EllipsisButton = ({ position: _position }: { position: 'start' | 'end' }) => {
    if (!showQuickJump) {
      return (
        <span
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
      <div className='relative'>
        <Button
          variant='ghost'
          size='icon'
          onClick={() => setIsJumpOpen(!isJumpOpen)}
          aria-label='Jump to page'
          className={cn(
            styles.button,
            'rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted',
            'transition-all duration-200'
          )}
        >
          <MoreHorizontal className={styles.icon} />
        </Button>
        {isJumpOpen && (
          <div className='absolute top-full left-1/2 -translate-x-1/2 mt-2 z-[var(--z-popover)]'>
            <div className='bg-popover border border-border rounded-xl shadow-lg p-2 flex gap-1.5'>
              <Input
                type='number'
                min={1}
                max={totalPages}
                value={jumpValue}
                onChange={(e) => setJumpValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder='Go to'
                className='w-16 h-8 text-xs rounded-lg text-center'
                autoFocus
              />
              <Button
                size='sm'
                onClick={handleJump}
                className='h-8 px-2 text-xs rounded-lg'
              >
                Go
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
      aria-label='Pagination'
      className={cn('flex flex-col items-center gap-3', className)}
    >
      <div className={cn('flex items-center', styles.gap)}>
        {showFirstLast && (
          <NavButton
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            label='First page'
            variant='ghost'
          >
            <ChevronsLeft className={styles.icon} />
          </NavButton>
        )}

        <NavButton
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          label='Previous page'
        >
          <ChevronLeft className={styles.icon} />
        </NavButton>

        <div className={cn('flex items-center', styles.gap, 'mx-1')}>
          {visiblePages.map((page) =>
            typeof page === 'string' ? (
              <EllipsisButton
                key={page}
                position={page === 'ellipsis-start' ? 'start' : 'end'}
              />
            ) : (
              <PageButton key={page} page={page} isActive={currentPage === page} />
            )
          )}
        </div>

        <NavButton
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          label='Next page'
        >
          <ChevronRight className={styles.icon} />
        </NavButton>

        {showFirstLast && (
          <NavButton
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            label='Last page'
            variant='ghost'
          >
            <ChevronsRight className={styles.icon} />
          </NavButton>
        )}
      </div>

      {showPageInfo && (
        <p className='text-xs text-muted-foreground'>
          Page <span className='font-medium text-foreground'>{currentPage}</span> of{' '}
          <span className='font-medium text-foreground'>{totalPages}</span>
        </p>
      )}
    </nav>
  );
};

export default Pagination;
