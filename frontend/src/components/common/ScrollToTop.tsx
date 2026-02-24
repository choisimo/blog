import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowUp } from 'lucide-react';
import { cn, throttle } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTheme } from '@/contexts/ThemeContext';

export const ScrollToTop = () => {
  const [isVisible, setIsVisible] = useState(false);
  const isMobile = useIsMobile();
  const { isTerminal } = useTheme();

  const shouldHide = isMobile && isTerminal;

  const toggleVisibility = useCallback(() => {
    if (window.scrollY > 300) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, []);

  const throttledToggle = useMemo(
    () => throttle(toggleVisibility, 100),
    [toggleVisibility]
  );

  useEffect(() => {
    window.addEventListener('scroll', throttledToggle);
    return () => window.removeEventListener('scroll', throttledToggle);
  }, [throttledToggle]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  // Don't render on mobile terminal (shell bar has integrated scroll-to-top)
  if (shouldHide) {
    return null;
  }

  return (
    <Button
      onClick={scrollToTop}
      size='icon'
      variant='outline'
      className={cn(
        'fixed right-4 md:right-6 lg:right-8 z-[var(--z-fab-bar)] rounded-full shadow-lg transition-all duration-300',
        'bottom-[calc(92px+env(safe-area-inset-bottom,0px))] md:bottom-28 lg:bottom-[calc(108px+env(safe-area-inset-bottom,0px))]',
        isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-0',
        // Muted styling to differentiate from AI feature buttons
        isTerminal
          ? 'border-[hsl(var(--terminal-inactive-border))] bg-background/80 text-[hsl(var(--terminal-glow)/0.6)] hover:text-[hsl(var(--terminal-glow))] hover:bg-background'
          : 'border-border/60 bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <ArrowUp className='h-4 w-4' />
    </Button>
  );
};
