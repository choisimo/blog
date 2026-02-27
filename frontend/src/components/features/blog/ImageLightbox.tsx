import { useState, useCallback, useEffect, useRef, type RefCallback } from 'react';
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
  const [translate, setTranslate] = useState({ x: 0, y: 0 });

  // Refs for drag tracking
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const hasDragged = useRef(false);
  const scaleRef = useRef(scale);
  const translateRef = useRef(translate);

  // Keep refs in sync
  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => { translateRef.current = translate; }, [translate]);

  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(prev + 0.25, 4));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(prev => {
      const next = Math.max(prev - 0.25, 0.5);
      if (next <= 1) setTranslate({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handleRotate = useCallback(() => {
    setRotation(prev => (prev + 90) % 360);
  }, []);

  const handleReset = useCallback(() => {
    setScale(1);
    setRotation(0);
    setTranslate({ x: 0, y: 0 });
    setImageLoaded(false);
  }, []);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      handleReset();
    }
    onOpenChange(newOpen);
  }, [onOpenChange, handleReset]);

  // Callback ref: attaches wheel listener immediately when the Dialog portal renders the container DOM node.
  // This fixes the race condition where useEffect(,[open]) fires before the Radix Dialog portal mounts.
  const containerRef: RefCallback<HTMLDivElement> = useCallback((node) => {
    if (!node) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.15 : -0.15;
      setScale(prev => {
        const next = Math.min(Math.max(prev + delta, 0.5), 4);
        if (next <= 1) setTranslate({ x: 0, y: 0 });
        return next;
      });
    };
    node.addEventListener('wheel', handleWheel, { passive: false });
    // React will call this with null when the node unmounts — but callback refs called with null
    // don't get the previous node, so we store cleanup on the node itself.
    // For cleanup, we rely on the Dialog unmounting the whole subtree when closed.
  }, []);

  // Pointer drag handlers
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Only drag when zoomed in
    if (scaleRef.current <= 1) return;
    isDragging.current = true;
    hasDragged.current = false;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      tx: translateRef.current.x,
      ty: translateRef.current.y,
    };
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      hasDragged.current = true;
    }
    if (hasDragged.current) {
      setTranslate({
        x: dragStart.current.tx + dx,
        y: dragStart.current.ty + dy,
      });
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    // Only close if it was a clean click (no drag)
    if (!hasDragged.current && scaleRef.current <= 1) {
      handleOpenChange(false);
    }
  }, [handleOpenChange]);

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
          <DialogDescription>Click outside or press Escape to close. Scroll to zoom. Drag to pan when zoomed.</DialogDescription>
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
            disabled={scale >= 4}
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
          ref={containerRef}
          data-testid="lightbox-container"
          className={cn(
            'flex items-center justify-center w-full h-full min-h-[50vh] p-3 sm:p-8',
            scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-out',
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-white/70" />
            </div>
          )}
          <img
            src={src}
            alt={alt || ''}
            data-testid="lightbox-image"
            className={cn(
              'max-w-full max-h-[85vh] sm:max-h-[85vh] object-contain transition-[opacity] duration-300',
              'select-none pointer-events-none',
              imageLoaded ? 'opacity-100' : 'opacity-0'
            )}
            style={{
              transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale}) rotate(${rotation}deg)`,
            }}
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
