import { useEffect, useState, useMemo, useCallback } from 'react';
import { throttle, cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';

export const ReadingProgress = () => {
  const [progress, setProgress] = useState(0);
  const { isTerminal } = useTheme();

  const updateProgress = useCallback(() => {
    const scrollTop = window.scrollY;
    const docHeight =
      document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = (scrollTop / docHeight) * 100;
    setProgress(Math.min(100, Math.max(0, scrollPercent)));
  }, []);

  const throttledUpdate = useMemo(
    () => throttle(updateProgress, 16),
    [updateProgress]
  );

  useEffect(() => {
    window.addEventListener('scroll', throttledUpdate);
    updateProgress();

    return () => window.removeEventListener('scroll', throttledUpdate);
  }, [throttledUpdate, updateProgress]);

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-50',
        'bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        'border-b border-border/40'
      )}
    >
      <div
        className={cn(
          'h-1 sm:h-0.5 w-full bg-muted/30',
          isTerminal && 'bg-[hsl(var(--terminal-code-bg))]'
        )}
      >
        <div
          className={cn(
            'h-full transition-all duration-75 ease-out',
            isTerminal
              ? 'bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.6)]'
              : 'bg-gradient-to-r from-primary via-primary to-primary/80'
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      {progress > 0 && progress < 100 && (
        <div
          className={cn(
            'absolute right-2 top-1/2 -translate-y-1/2 sm:hidden',
            'text-[10px] font-medium text-muted-foreground/70 tabular-nums',
            isTerminal && 'font-mono text-primary/60'
          )}
        >
          {Math.round(progress)}%
        </div>
      )}
    </div>
  );
};
