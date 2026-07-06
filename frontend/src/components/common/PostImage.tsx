import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

type PostImageVariant = 'card' | 'thumbnail' | 'hero' | 'avatar';

type PostImageProps = {
  src?: string;
  alt?: string;
  title?: string;
  variant?: PostImageVariant;
  className?: string;
  containerClassName?: string;
  showGradient?: boolean;
  gradientFrom?: string;
  gradientTo?: string;
};

const variantStyles: Record<PostImageVariant, { container: string; image: string; fallback: string }> = {
  card: {
    container: 'aspect-[16/9] overflow-hidden',
    image: 'h-full w-full object-cover',
    fallback: 'h-full w-full flex items-center justify-center text-2xl font-bold',
  },
  thumbnail: {
    container: 'h-12 w-12 overflow-hidden rounded-lg shrink-0',
    image: 'h-12 w-12 object-cover',
    fallback: 'flex h-12 w-12 items-center justify-center rounded-lg text-sm font-bold',
  },
  hero: {
    container: 'aspect-[16/10] overflow-hidden',
    image: 'w-full h-full object-cover transition-transform duration-500 group-hover:scale-105',
    fallback: 'w-full h-full',
  },
  avatar: {
    container: 'h-8 w-8 overflow-hidden rounded-full ring-2 ring-background shadow',
    image: 'h-full w-full object-cover',
    fallback: 'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold',
  },
};

const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const CONTROL_TEXT_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;

const sanitizePostImageText = (value: string): string =>
  value.replace(ANSI_ESCAPE_PATTERN, '').replace(CONTROL_TEXT_PATTERN, '').trim();

export function normalizePostImageSrc(src: string | undefined): string | null {
  const candidate = src?.trim();
  if (!candidate || /[\u0000-\u001F\u007F]/.test(candidate)) {
    return null;
  }

  if (candidate.startsWith('//')) {
    return null;
  }

  const scheme = candidate.match(/^([A-Za-z][A-Za-z0-9+.-]*):/);
  if (!scheme) {
    return candidate;
  }

  const protocol = `${scheme[1].toLowerCase()}:`;
  if (protocol === 'http:' || protocol === 'https:') {
    try {
      return new URL(candidate).href;
    } catch {
      return null;
    }
  }

  if (protocol === 'data:') {
    return /^data:image\//i.test(candidate) ? candidate : null;
  }

  return protocol === 'blob:' ? candidate : null;
}

export function PostImage({
  src,
  alt = '',
  title = '',
  variant = 'card',
  className,
  containerClassName,
  showGradient = true,
  gradientFrom = 'from-primary/80',
  gradientTo = 'to-primary',
}: PostImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(!!src);

  const handleError = useCallback(() => {
    setHasError(true);
    setIsLoading(false);
  }, []);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const styles = variantStyles[variant];
  const sanitizedAlt = sanitizePostImageText(alt);
  const sanitizedTitle = sanitizePostImageText(title);
  const fallbackChar =
    (sanitizedTitle || sanitizedAlt || '?').charAt(0).toUpperCase() || '?';
  const normalizedSrc = normalizePostImageSrc(src);
  const shouldShowImage = normalizedSrc && !hasError;

  return (
    <div className={cn(styles.container, containerClassName)}>
      {shouldShowImage ? (
        <>
          {isLoading && (
            <div 
              className={cn(
                'animate-pulse',
                showGradient 
                  ? `bg-gradient-to-br ${gradientFrom} ${gradientTo}` 
                  : 'bg-muted',
                styles.fallback
              )}
              aria-hidden
            />
          )}
          <img
            src={normalizedSrc}
            alt={sanitizedAlt}
            className={cn(
              styles.image,
              isLoading && 'opacity-0 absolute',
              className
            )}
            onError={handleError}
            onLoad={handleLoad}
            loading="lazy"
          />
        </>
      ) : (
        <div
          className={cn(
            showGradient 
              ? `bg-gradient-to-br ${gradientFrom} ${gradientTo} text-primary-foreground` 
              : 'bg-muted text-muted-foreground',
            styles.fallback,
            className
          )}
          aria-hidden
        >
          {variant !== 'hero' && fallbackChar}
        </div>
      )}
    </div>
  );
}

export default PostImage;
