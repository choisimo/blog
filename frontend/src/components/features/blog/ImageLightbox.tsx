import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type ComponentProps,
  type RefCallback,
  type ReactNode,
} from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { TouchIconButton } from '@/components/atoms/TouchIconButton';
import { X, ZoomIn, ZoomOut, RotateCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import {
  getThumbSrc,
  isVideoMedia,
  resolvePostMediaSrc,
  shouldUseThumb,
} from '@/utils/content/postMedia';

interface ImageLightboxProps {
  src: string;
  alt?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImageLightbox({
  src,
  alt,
  open,
  onOpenChange,
}: ImageLightboxProps) {
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
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);
  useEffect(() => {
    translateRef.current = translate;
  }, [translate]);

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

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        handleReset();
      }
      onOpenChange(newOpen);
    },
    [onOpenChange, handleReset]
  );

  // Callback ref: attaches wheel listener immediately when the Dialog portal renders the container DOM node.
  // This fixes the race condition where useEffect(,[open]) fires before the Radix Dialog portal mounts.
  const containerRef: RefCallback<HTMLDivElement> = useCallback(node => {
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
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
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
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
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
    },
    []
  );

  const handlePointerUp = useCallback(
    (_e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      // Only close if it was a clean click (no drag)
      if (!hasDragged.current && scaleRef.current <= 1) {
        handleOpenChange(false);
      }
    },
    [handleOpenChange]
  );

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
        className='w-[100vw] h-[100vh] max-w-[100vw] max-h-[100vh] sm:w-auto sm:h-auto sm:max-w-[95vw] sm:max-h-[95vh] p-0 bg-black/95 border-none overflow-hidden rounded-none sm:rounded-lg'
        onPointerDownOutside={() => handleOpenChange(false)}
      >
        <VisuallyHidden>
          <DialogTitle>{alt || 'Image preview'}</DialogTitle>
          <DialogDescription>
            Click outside or press Escape to close. Scroll to zoom. Drag to pan
            when zoomed.
          </DialogDescription>
        </VisuallyHidden>

        <div className='absolute top-4 right-4 z-20 flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-2 py-1.5 shadow-[0_18px_48px_rgba(0,0,0,0.45)] backdrop-blur-md'>
          <TouchIconButton
            variant='ghost'
            onClick={handleZoomOut}
            aria-label='Zoom out image preview'
            className='h-10 w-10 rounded-full bg-black/70 text-white shadow-lg ring-1 ring-white/20 transition-colors hover:bg-black/90 disabled:bg-black/40 disabled:text-white/45 disabled:ring-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black'
            disabled={scale <= 0.5}
          >
            <ZoomOut className='h-4 w-4' />
          </TouchIconButton>
          <TouchIconButton
            variant='ghost'
            onClick={handleZoomIn}
            aria-label='Zoom in image preview'
            className='h-10 w-10 rounded-full bg-black/70 text-white shadow-lg ring-1 ring-white/20 transition-colors hover:bg-black/90 disabled:bg-black/40 disabled:text-white/45 disabled:ring-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black'
            disabled={scale >= 4}
          >
            <ZoomIn className='h-4 w-4' />
          </TouchIconButton>
          <TouchIconButton
            variant='ghost'
            onClick={handleRotate}
            aria-label='Rotate image preview'
            className='h-10 w-10 rounded-full bg-black/70 text-white shadow-lg ring-1 ring-white/20 transition-colors hover:bg-black/90 disabled:bg-black/40 disabled:text-white/45 disabled:ring-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black'
          >
            <RotateCw className='h-4 w-4' />
          </TouchIconButton>
          <TouchIconButton
            variant='ghost'
            onClick={() => handleOpenChange(false)}
            aria-label='Close image preview'
            autoFocus
            className='h-10 w-10 rounded-full bg-white text-black shadow-lg ring-1 ring-white/20 transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black'
          >
            <X className='h-4 w-4' />
          </TouchIconButton>
        </div>

        <div
          ref={containerRef}
          data-testid='lightbox-container'
          className={cn(
            'flex items-center justify-center w-full h-full min-h-[50vh] p-3 sm:p-8',
            scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-out'
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {!imageLoaded && (
            <div className='absolute inset-0 flex items-center justify-center'>
              <Loader2 className='h-8 w-8 animate-spin text-white/70' />
            </div>
          )}
          <img
            src={src}
            alt={alt || ''}
            data-testid='lightbox-image'
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
          <div className='absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4'>
            <p className='text-white/90 text-sm text-center'>{alt}</p>
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

interface EmbeddedVideoProps extends ClickableImageProps {
  autoPlay?: boolean;
  controls?: boolean;
  loop?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  children?: ReactNode;
}

function useInView<T extends HTMLElement>() {
  const [isInView, setIsInView] = useState(false);
  const mediaRef = useRef<T>(null);

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

    const currentRef = mediaRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, []);

  return { isInView, mediaRef };
}

export function EmbeddedVideo({
  src,
  alt,
  className,
  isTerminal,
  postPath,
  autoPlay = true,
  controls = true,
  loop = true,
  muted = true,
  playsInline = true,
  children,
}: EmbeddedVideoProps) {
  const resolvedSrc = resolvePostMediaSrc(src, postPath);
  const { isInView, mediaRef } = useInView<HTMLVideoElement>();
  const [loadFailed, setLoadFailed] = useState(false);
  const hasDirectSrc = !!resolvedSrc;

  if (!hasDirectSrc && !children) {
    return null;
  }

  return (
    <span className='my-8 text-center block'>
      {loadFailed ? (
        <div
          className={cn(
            'rounded-xl border border-border/50 bg-muted/40 px-6 py-12 text-sm text-muted-foreground',
            isTerminal && 'rounded-lg border-border',
            className
          )}
        >
          {alt || 'Video unavailable'}
        </div>
      ) : (
        <video
          ref={mediaRef}
          src={hasDirectSrc && isInView ? resolvedSrc : undefined}
          data-src={hasDirectSrc ? resolvedSrc : undefined}
          autoPlay={autoPlay}
          controls={controls}
          loop={loop}
          muted={muted}
          playsInline={playsInline}
          preload='metadata'
          onCanPlay={event => {
            if (!autoPlay) return;
            void event.currentTarget.play().catch(() => undefined);
          }}
          onError={() => setLoadFailed(true)}
          className={cn(
            'rounded-xl shadow-lg mx-auto max-w-full h-auto bg-black',
            isTerminal && 'rounded-lg border border-border',
            className
          )}
          aria-label={alt || 'Embedded video'}
        >
          {children}
        </video>
      )}
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
  );
}

export function NormalizedVideoSource({
  src,
  postPath,
  ...props
}: ComponentProps<'source'> & { postPath?: string }) {
  const resolvedSrc =
    typeof src === 'string' ? resolvePostMediaSrc(src, postPath) : src;

  return <source {...props} src={resolvedSrc} />;
}

export function ClickableImage({
  src,
  alt,
  className,
  isTerminal,
  postPath,
}: ClickableImageProps) {
  const resolvedSrc = resolvePostMediaSrc(src, postPath);
  const isVideo = isVideoMedia(resolvedSrc);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const [thumbError, setThumbError] = useState(false);
  const { isInView, mediaRef: imgRef } = useInView<HTMLImageElement>();

  const handleThumbError = useCallback(() => {
    setThumbError(true);
  }, []);

  const handleThumbLoad = useCallback(() => {
    setThumbLoaded(true);
  }, []);

  if (isVideo) {
    return (
      <EmbeddedVideo
        src={resolvedSrc}
        alt={alt}
        className={className}
        isTerminal={isTerminal}
        postPath={postPath}
      />
    );
  }

  // Use original if thumbnail failed to load
  const displaySrc =
    thumbError || !shouldUseThumb(resolvedSrc)
      ? resolvedSrc
      : getThumbSrc(resolvedSrc);

  return (
    <>
      <span className='my-8 text-center block'>
        <button
          type='button'
          onClick={() => setLightboxOpen(true)}
          className='cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-xl inline-block relative overflow-hidden'
          aria-label={`View ${alt || 'image'} in full size`}
        >
          {/* Placeholder skeleton while loading */}
          {!thumbLoaded && (
            <div className='absolute inset-0 bg-muted/50 animate-pulse rounded-xl flex items-center justify-center'>
              <Loader2 className='h-6 w-6 animate-spin text-muted-foreground/50' />
            </div>
          )}
          <img
            ref={imgRef}
            src={isInView ? displaySrc : undefined}
            data-src={displaySrc}
            alt={alt || ''}
            loading='lazy'
            decoding='async'
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
          <div
            className={cn(
              'absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity',
              'bg-black/20 rounded-xl'
            )}
          >
            <ZoomIn className='h-8 w-8 text-white drop-shadow-lg' />
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
