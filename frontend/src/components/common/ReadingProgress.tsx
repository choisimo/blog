import { useEffect, useState, useMemo, useCallback } from 'react';
import { Progress } from '@/components/ui/progress';
import { throttle } from '@/lib/utils';

export const ReadingProgress = () => {
  const [progress, setProgress] = useState(0);

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
    <div className='fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b'>
      <Progress value={progress} className='h-1 rounded-none' />
    </div>
  );
};
