import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, ZoomIn, ZoomOut, RotateCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

/**
 * Get thumbnail path for an image.
 * Thumbnails are generated as .thumb.webp files by the optimize-images script.
 */
function getThumbSrc(src: string): string {
  if (!src) return src;
  
  // Skip external URLs, data URIs, and already-thumbnail files
  if (/^(https?:)?\/\//i.test(src) || /^(data|blob):/i.test(src)) return src;
  if (src.includes('.thumb.')) return src;
  
  // Replace extension with .thumb.webp
  const lastDot = src.lastIndexOf('.');
  if (lastDot === -1) return src;
  
  return src.substring(0, lastDot) + '.thumb.webp';
}

interface ImageLightboxProps {
  src: string;
  alt?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImageLightbox({ src, alt, open, onOpenChange }: ImageLightboxProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(prev + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  }, []);

  const handleRotate = useCallback(() => {
    setRotation(prev => (prev + 90) % 360);
  }, []);

  const handleReset = useCallback(() => {
    setScale(1);
    setRotation(0);
    setImageLoaded(false);
  }, []);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      handleReset();
    }
    onOpenChange(newOpen);
  }, [onOpenChange, handleReset]);

  // Preload full image when lightbox opens
  useEffect(() => {
    if (open && src) {
      const img = new Image();
      img.onload = () => setImageLoaded(true);
      img.src = src;
    }
  }, [open, src]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        hideClose
        className="w-[100vw] h-[100vh] max-w-[100vw] max-h-[100vh] sm:w-auto sm:h-auto sm:max-w-[95vw] sm:max-h-[95vh] p-0 bg-black/95 border-none overflow-hidden rounded-none sm:rounded-lg"
        onPointerDownOutside={() => handleOpenChange(false)}
      >
        <VisuallyHidden>
          <DialogTitle>{alt || 'Image preview'}</DialogTitle>
          <DialogDescription>Click outside or press Escape to close</DialogDescription>
        </VisuallyHidden>
        
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomOut}
            className="h-9 w-9 rounded-full bg-white/10 text-white hover:bg-white/20"
            disabled={scale <= 0.5}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomIn}
            className="h-9 w-9 rounded-full bg-white/10 text-white hover:bg-white/20"
            disabled={scale >= 3}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRotate}
            className="h-9 w-9 rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleOpenChange(false)}
            className="h-9 w-9 rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div 
          className="flex items-center justify-center w-full h-full min-h-[50vh] p-3 sm:p-8 cursor-zoom-out"
          onClick={() => handleOpenChange(false)}
        >
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-white/70" />
            </div>
          )}
          <img
            src={src}
            alt={alt || ''}
            className={cn(
              'max-w-full max-h-[85vh] sm:max-h-[85vh] object-contain transition-all duration-300',
              'select-none',
              imageLoaded ? 'opacity-100' : 'opacity-0'
            )}
            style={{
              transform: `scale(${scale}) rotate(${rotation}deg)`,
            }}
            onClick={(e) => e.stopPropagation()}
            draggable={false}
          />
        </div>

        {alt && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            <p className="text-white/90 text-sm text-center">{alt}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ClickableImageProps {
  src: string;
  alt?: string;
  className?: string;
  isTerminal?: boolean;
  postPath?: string; // e.g., "2025/future-tech-six-insights" for resolving relative image paths
}

export function ClickableImage({ src, alt, className, isTerminal, postPath }: ClickableImageProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const [thumbError, setThumbError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Resolve relative paths to absolute
  let resolvedSrc = src;
  if (src) {
    if (src.startsWith('../../images/')) {
      resolvedSrc = src.replace('../../images/', '/images/');
    } else if (src.startsWith('../images/')) {
      resolvedSrc = src.replace('../images/', '/images/');
    } else if (src.startsWith('./images/')) {
      resolvedSrc = src.replace('./images/', '/images/');
    } else if (src.startsWith('image/')) {
      // Handle relative paths like "image/post-name/file.png"
      // Use postPath to get the year, e.g., "2025/future-tech-six-insights" -> "2025"
      const year = postPath?.split('/')[0] || '2025';
      resolvedSrc = `/posts/${year}/${src}`;
    }
  }

  // Get thumbnail version (falls back to original if thumb doesn't exist)
  const thumbSrc = getThumbSrc(resolvedSrc);

  // Intersection Observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '100px',
        threshold: 0.01,
      }
    );

    const currentRef = imgRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, []);

  // Handle thumbnail load error - fallback to original
  const handleThumbError = useCallback(() => {
    setThumbError(true);
  }, []);

  const handleThumbLoad = useCallback(() => {
    setThumbLoaded(true);
  }, []);

  // Use original if thumbnail failed to load
  const displaySrc = thumbError ? resolvedSrc : thumbSrc;

  return (
    <>
      <span className="my-8 text-center block">
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-xl inline-block relative overflow-hidden"
          aria-label={`View ${alt || 'image'} in full size`}
        >
          {/* Placeholder skeleton while loading */}
          {!thumbLoaded && (
            <div className="absolute inset-0 bg-muted/50 animate-pulse rounded-xl flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" />
            </div>
          )}
          <img
            ref={imgRef}
            src={isInView ? displaySrc : undefined}
            data-src={displaySrc}
            alt={alt || ''}
            loading="lazy"
            decoding="async"
            onLoad={handleThumbLoad}
            onError={handleThumbError}
            className={cn(
              'rounded-xl shadow-lg mx-auto max-w-full h-auto transition-all duration-300',
              'hover:scale-[1.02]',
              thumbLoaded ? 'opacity-100 blur-0' : 'opacity-0',
              isTerminal && 'rounded-lg border border-border',
              className
            )}
          />
          {/* Click hint overlay */}
          <div className={cn(
            'absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity',
            'bg-black/20 rounded-xl'
          )}>
            <ZoomIn className="h-8 w-8 text-white drop-shadow-lg" />
          </div>
        </button>
        {alt && (
          <span
            className={cn(
              'text-sm text-muted-foreground mt-2 italic',
              isTerminal && 'font-mono not-italic'
            )}
          >
            {isTerminal ? `// ${alt}` : alt}
          </span>
        )}
      </span>

      {/* Lightbox uses ORIGINAL full-size image */}
      <ImageLightbox
        src={resolvedSrc}
        alt={alt}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    </>
  );
}

export default ImageLightbox;
