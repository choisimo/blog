import { useEffect, useState } from 'react';
import { nextScrollVisibility } from '@/hooks/ui/scrollVisibility';

export function useScrollHide({
  enabled = true,
  resetKey = '',
  revealAtBottom = true,
}: {
  enabled?: boolean;
  resetKey?: string;
  revealAtBottom?: boolean;
} = {}): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    setHidden(false);
    if (!enabled) return;
    let state = { y: Math.max(0, window.scrollY), distance: 0, hidden: false };
    let frame: number | undefined;
    const onScroll = () => {
      if (frame !== undefined) return;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        const next = nextScrollVisibility(
          state,
          window.scrollY,
          document.documentElement.scrollHeight - window.innerHeight,
          revealAtBottom
        );
        if (next.hidden !== state.hidden) setHidden(next.hidden);
        state = next;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [enabled, resetKey, revealAtBottom]);
  return enabled && hidden;
}
