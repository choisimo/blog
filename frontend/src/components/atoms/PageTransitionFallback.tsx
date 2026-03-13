import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';

interface PageTransitionFallbackProps {
  className?: string;
}

export function PageTransitionFallback({ className }: PageTransitionFallbackProps) {
  const { isTerminal } = useTheme();

  return (
    <div
      className={cn(
        'min-h-screen flex flex-col items-center justify-center gap-4 bg-background animate-route-fade-in',
        className
      )}
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className={cn(
          'relative w-10 h-10',
          isTerminal && 'font-mono'
        )}
      >
        {isTerminal ? (
          <span className="text-primary text-lg animate-pulse crt-text-glow">
            ▋
          </span>
        ) : (
          <svg
            className="w-10 h-10 animate-spin text-primary/40"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
      </div>

      <div
        className={cn(
          'flex gap-1.5',
          isTerminal ? 'font-mono text-xs text-primary/50' : 'hidden'
        )}
        aria-hidden="true"
      >
        <span>loading</span>
        <span className="terminal-cursor" />
      </div>
    </div>
  );
}

export default PageTransitionFallback;
