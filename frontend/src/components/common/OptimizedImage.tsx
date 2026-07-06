import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  placeholder?: string;
  loading?: 'lazy' | 'eager';
  onLoad?: () => void;
  onError?: () => void;
}

type InViewCallback = () => void;

const callbackMap = new Map<Element, InViewCallback>();
const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const CONTROL_TEXT_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;

let sharedObserver: IntersectionObserver | null = null;

const sanitizeOptimizedImageText = (value: string): string =>
  value.replace(ANSI_ESCAPE_PATTERN, '').replace(CONTROL_TEXT_PATTERN, '').trim();

function getSharedObserver(): IntersectionObserver {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const cb = callbackMap.get(entry.target);
            if (cb) {
              cb();
              sharedObserver?.unobserve(entry.target);
              callbackMap.delete(entry.target);
            }
          }
        });
      },
      { rootMargin: '50px', threshold: 0.01 }
    );
  }

  return sharedObserver;
}

export function resolveOptimizedImageSrc(
  src: string,
  baseUrl?: string
): string | null {
  const candidate = src.trim();
  if (!candidate || /[\u0000-\u001F\u007F]/.test(candidate)) {
    return null;
  }

  if (candidate.startsWith('//')) {
    return null;
  }

  const scheme = candidate.match(/^([A-Za-z][A-Za-z0-9+.-]*):/);
  if (scheme) {
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

  const base = baseUrl ?? (import.meta.env?.BASE_URL ? String(import.meta.env.BASE_URL) : '/');
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  if (!normalizedBase || normalizedBase === '/') return candidate;

  // If already prefixed with BASE_URL, keep as-is.
  if (candidate.startsWith(`${normalizedBase}/`)) return candidate;

  // Root-relative assets need BASE_URL prefix for subpath deployments.
  if (candidate.startsWith('/')) return `${normalizedBase}${candidate}`;

  // Relative assets should be resolved under BASE_URL.
  return `${normalizedBase}/${candidate}`;
}

export const OptimizedImage = ({
  src,
  alt,
  className,
  width,
  height,
  placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PC9zdmc+',
  loading = 'lazy',
  onLoad,
  onError,
}: OptimizedImageProps) => {
  const resolvedSrc = resolveOptimizedImageSrc(src);
  const sanitizedAlt = sanitizeOptimizedImageText(alt);
  const errorLabel = sanitizedAlt
    ? `이미지를 불러올 수 없습니다: ${sanitizedAlt}`
    : '이미지를 불러올 수 없습니다';

  const [imageSrc, setImageSrc] = useState(placeholder);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (loading === 'eager') {
      setIsInView(true);
      return;
    }

    const el = imgRef.current;
    if (!el) return;

    callbackMap.set(el, () => setIsInView(true));
    getSharedObserver().observe(el);

    return () => {
      getSharedObserver().unobserve(el);
      callbackMap.delete(el);
    };
  }, [loading]);

  // Load the actual image when in view
  useEffect(() => {
    if (!isInView) return;

    if (!resolvedSrc) {
      setHasError(true);
      setIsLoading(false);
      onError?.();
      return;
    }

    const img = new Image();

    img.onload = () => {
      setImageSrc(resolvedSrc);
      setIsLoading(false);
      setHasError(false);
      onLoad?.();
    };

    img.onerror = () => {
      setHasError(true);
      setIsLoading(false);
      onError?.();
    };

    img.src = resolvedSrc;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [isInView, resolvedSrc, onLoad, onError]);

  if (hasError) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm rounded',
          className
        )}
        style={{ width, height }}
        role='img'
        aria-label={errorLabel}
      >
        <svg
          className='w-8 h-8'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
          aria-hidden='true'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
          />
        </svg>
      </div>
    );
  }

  return (
    <div className='relative overflow-hidden rounded w-full h-full'>
      <img
        ref={imgRef}
        src={imageSrc}
        alt={sanitizedAlt}
        width={width}
        height={height}
        className={cn(
          'transition-all duration-500 ease-in-out',
          isLoading && 'scale-105 blur-sm',
          !isLoading && 'scale-100 blur-0',
          className
        )}
        loading={loading}
        decoding='async'
      />

      {isLoading && (
        <div className='absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900'>
          <div className='relative'>
            <div className='animate-pulse bg-gray-200 dark:bg-gray-700 rounded-full w-12 h-12'></div>
            <div className='absolute inset-0 flex items-center justify-center'>
              <div className='animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent'></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
