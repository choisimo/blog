import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { calculateReadingProgress } from '@/utils/content/readingProgress';

type ReadingProgressProps = { label?: string; targetSelector?: string };
const DEFAULT_READING_PROGRESS_LABEL = 'Reading progress';
const ANSI_ESCAPE_PATTERN = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const CONTROL_TEXT_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;

export const ReadingProgress = ({ label = DEFAULT_READING_PROGRESS_LABEL, targetSelector }: ReadingProgressProps = {}) => {
  const [progress, setProgress] = useState(0);
  const [top, setTop] = useState(0);
  const { isTerminal } = useTheme();
  const sanitizedLabel = label.replace(ANSI_ESCAPE_PATTERN, '').replace(CONTROL_TEXT_PATTERN, '').trim() || DEFAULT_READING_PROGRESS_LABEL;

  useEffect(() => {
    let frame: number | null = null;
    let target: Element | null = null;
    const header = document.querySelector('.ui-header');
    try { target = targetSelector ? document.querySelector(targetSelector) : null; } catch { /* Invalid optional selector falls back to document progress. */ }
    const update = () => {
      frame = null;
      const scrollY = window.scrollY;
      const rect = target?.getBoundingClientRect();
      // The header can scroll out of view. A fixed token leaves the bar floating over the article.
      const offset = Math.max(0, header?.getBoundingClientRect().bottom ?? 0);
      setTop(offset);
      setProgress(calculateReadingProgress(scrollY, rect ? rect.top + scrollY : 0,
        rect ? rect.height : document.documentElement.scrollHeight, window.innerHeight, rect ? offset : 0));
    };
    const schedule = () => { if (frame === null) frame = window.requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    observer?.observe(target || document.documentElement);
    if (header) observer?.observe(header);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer?.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [targetSelector]);

  return (
    <div className='ui-reading-progress' data-reading-progress style={{ top }}>
      <div className={cn('ui-reading-progress__track', isTerminal && 'bg-[hsl(var(--terminal-code-bg))]')}
        role='progressbar' aria-label={sanitizedLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
        <div className='ui-reading-progress__fill' style={{ transform: `scaleX(${progress / 100})` }} />
      </div>
      {progress > 0 && progress < 100 && <span className={cn('sr-only', isTerminal && 'font-mono')}>{Math.round(progress)}%</span>}
    </div>
  );
};
