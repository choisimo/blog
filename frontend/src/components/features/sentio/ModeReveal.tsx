import { useEffect, useState, type ReactNode } from 'react';

// Keep fast/cached responses readable without delaying the actual request.
const REVEAL_DELAY_MS = 520;

export default function ModeReveal({
  active,
  pending,
  loader,
  children,
}: {
  active: boolean;
  pending: boolean;
  loader: ReactNode;
  children: ReactNode;
}) {
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    setSettled(false);
    if (!active) return;
    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (motion?.matches) {
      setSettled(true);
      return;
    }
    const timer = window.setTimeout(() => setSettled(true), REVEAL_DELAY_MS);
    const finishForReducedMotion = () => {
      if (motion?.matches) {
        window.clearTimeout(timer);
        setSettled(true);
      }
    };
    motion?.addEventListener('change', finishForReducedMotion);
    return () => {
      window.clearTimeout(timer);
      motion?.removeEventListener('change', finishForReducedMotion);
    };
  }, [active]);

  const busy = pending || !settled;

  return (
    <div className='sentio-reveal' data-loading={busy} aria-busy={busy}>
      <div className='sentio-reveal-loader' aria-hidden={!busy}>
        {loader}
      </div>
      <div className='sentio-reveal-content' aria-hidden={busy}>
        {children}
      </div>
    </div>
  );
}
