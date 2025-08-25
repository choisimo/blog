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
  sizes?: string;
  onLoad?: () => void;
  onError?: () => void;
}

const generateWebPSrc = (src: string) => {
  if (src.startsWith('data:') || src.includes('.webp')) return src;
  const lastDotIndex = src.lastIndexOf('.');
  if (lastDotIndex === -1) return src;
  return `${src.slice(0, lastDotIndex)}.webp`;
};

const generateSrcSet = (
  src: string,
  sizes: number[] = [320, 640, 768, 1024, 1280]
) => {
  const baseSrc = src.split('.').slice(0, -1).join('.');
  const ext = src.split('.').pop();
  return sizes.map(size => `${baseSrc}_${size}w.${ext} ${size}w`).join(', ');
};

export const OptimizedImage = ({
  src,
  alt,
  className,
  width,
  height,
  placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PC9zdmc+',
  loading = 'lazy',
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  onLoad,
  onError,
}: OptimizedImageProps) => {
  const [imageSrc, setImageSrc] = useState(placeholder);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [supportsWebP, setSupportsWebP] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Check WebP support
  useEffect(() => {
    const webP = new Image();
    webP.onload = webP.onerror = () => {
      setSupportsWebP(webP.height === 2);
    };
    webP.src =
      'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
  }, []);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (loading === 'eager') {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '50px',
        threshold: 0.01,
      }
    );

    const currentImgRef = imgRef.current;
    if (currentImgRef) {
      observer.observe(currentImgRef);
    }

    return () => {
      if (currentImgRef) {
        observer.unobserve(currentImgRef);
      }
    };
  }, [loading]);

  // Load the actual image when in view
  useEffect(() => {
    if (!isInView) return;

    const img = new Image();
    const preferredSrc = supportsWebP ? generateWebPSrc(src) : src;

    img.onload = () => {
      setImageSrc(preferredSrc);
      setIsLoading(false);
      setHasError(false);
      onLoad?.();
    };

    img.onerror = () => {
      if (supportsWebP && preferredSrc !== src) {
        // Fallback to original format
        const fallbackImg = new Image();
        fallbackImg.onload = () => {
          setImageSrc(src);
          setIsLoading(false);
          setHasError(false);
          onLoad?.();
        };
        fallbackImg.onerror = () => {
          setHasError(true);
          setIsLoading(false);
          onError?.();
        };
        fallbackImg.src = src;
      } else {
        setHasError(true);
        setIsLoading(false);
        onError?.();
      }
    };

    img.src = preferredSrc;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [isInView, src, supportsWebP, onLoad, onError]);

  if (hasError) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm rounded',
          className
        )}
        style={{ width, height }}
        role='img'
        aria-label={`이미지를 불러올 수 없습니다: ${alt}`}
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
    <div className='relative overflow-hidden rounded'>
      <picture>
        {supportsWebP && (
          <source
            srcSet={generateSrcSet(generateWebPSrc(src))}
            sizes={sizes}
            type='image/webp'
          />
        )}
        <img
          ref={imgRef}
          src={imageSrc}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes}
          className={cn(
            'transition-all duration-500 ease-in-out',
            isLoading
              ? 'opacity-0 scale-105 blur-sm'
              : 'opacity-100 scale-100 blur-0',
            className
          )}
          loading={loading}
          decoding='async'
        />
      </picture>

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
