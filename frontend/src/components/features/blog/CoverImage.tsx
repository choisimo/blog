import { useState } from 'react';
import { cn } from '@/lib/utils';

interface CoverImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackText?: string;
}

export const CoverImage = ({
  src,
  alt,
  className,
  fallbackText = 'No image',
}: CoverImageProps) => {
  const [errored, setErrored] = useState(false);

  if (!src || errored) {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center bg-muted text-xs font-medium text-muted-foreground dark:bg-white/10 dark:text-white/70',
          className
        )}
        role='img'
        aria-label={`${alt} placeholder`}
      >
        {fallbackText}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setErrored(true)}
    />
  );
};
