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
import {
  overlayControlPlateClassName,
  overlayControlButtonClassName,
  overlayControlCloseButtonClassName,
} from '@/components/atoms/overlayControl';
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

const ANSI_ESCAPE_PATTERN = /\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
const CONTROL_TEXT_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;
const CONTROL_TEXT_DETECTOR = /[\u0000-\u001f\u007f-\u009f]/;
const SAFE_MEDIA_PROTOCOLS = new Set(['http:', 'https:']);
const IMAGE_PREVIEW_LOADING_LABEL = 'Loading image preview';
const IMAGE_THUMBNAIL_LOADING_LABEL = 'Loading image thumbnail';

function sanitizeMediaText(value: unknown): string {
  return String(value ?? '')
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(CONTROL_TEXT_PATTERN, '')
    .trim();
}

function hasUnsafePathSegment(path: string): boolean {
  return path
    .split('/')
    .some(segment => segment === '.' || segment === '..');
}

function normalizeMediaSrc(value: unknown): string {
  const src = String(value ?? '').replace(ANSI_ESCAPE_PATTERN, '').trim();
  if (!src || CONTROL_TEXT_DETECTOR.test(src) || src.includes('\\')) return '';

  let decodedSrc: string;
  try {
    decodedSrc = decodeURIComponent(src);
  } catch {
    return '';
  }

  if (CONTROL_TEXT_DETECTOR.test(decodedSrc) || decodedSrc.includes('\\')) {
    return '';
  }

  if (src.startsWith('//')) return '';

  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(src)) {
    let url: URL;
    try {
      url = new URL(src);
    } catch {
      return '';
    }

    if (!SAFE_MEDIA_PROTOCOLS.has(url.protocol)) return '';
    if (url.username || url.password) return '';

    return src;
  }

  const decodedPath = decodedSrc.split(/[?#]/, 1)[0] || '';
  if (hasUnsafePathSegment(decodedPath)) return '';

  return src;
}

export function ImageLightbox({
  src,
  alt,
  open,
  onOpenChange,
}: ImageLightboxProps) {
  const safeSrc = normalizeMediaSrc(src);
  const safeAlt = sanitizeMediaText(alt);
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
  const wheelCleanupRef = useRef<(() => void) | null>(null);

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
    wheelCleanupRef.current?.();
    wheelCleanupRef.current = null;

    if (node) {
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
      wheelCleanupRef.current = () => {
        node.removeEventListener('wheel', handleWheel);
      };
    }
  }, []);

  useEffect(() => {
    return () => {
      wheelCleanupRef.current?.();
      wheelCleanupRef.current = null;
    };
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
    if (open && safeSrc) {
      const img = new Image();
      img.onload = () => setImageLoaded(true);
      img.src = safeSrc;
    }
  }, [open, safeSrc]);

  if (!safeSrc) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        hideClose
        className='w-[100vw] h-[100vh] max-w-[100vw] max-h-[100vh] sm:w-auto sm:h-auto sm:max-w-[95vw] sm:max-h-[95vh] p-0 bg-black/95 border-none overflow-hidden rounded-none sm:rounded-lg'
        onPointerDownOutside={() => handleOpenChange(false)}
      >
        <VisuallyHidden>
          <DialogTitle>{safeAlt || 'Image preview'}</DialogTitle>
          <DialogDescription>
            Click outside or press Escape to close. Scroll to zoom. Drag to pan
            when zoomed.
          </DialogDescription>
        </VisuallyHidden>

        <div
          className={cn(
            'absolute top-4 right-4 z-20 flex items-center gap-2',
            overlayControlPlateClassName
          )}
        >
          <TouchIconButton
            variant='ghost'
            onClick={handleZoomOut}
            aria-label='Zoom out image preview'
            className={overlayControlButtonClassName}
            disabled={scale <= 0.5}
          >
            <ZoomOut aria-hidden='true' className='h-4 w-4' focusable='false' />
          </TouchIconButton>
          <TouchIconButton
            variant='ghost'
            onClick={handleZoomIn}
            aria-label='Zoom in image preview'
            className={overlayControlButtonClassName}
            disabled={scale >= 4}
          >
            <ZoomIn aria-hidden='true' className='h-4 w-4' focusable='false' />
          </TouchIconButton>
          <TouchIconButton
            variant='ghost'
            onClick={handleRotate}
            aria-label='Rotate image preview'
            className={overlayControlButtonClassName}
          >
            <RotateCw aria-hidden='true' className='h-4 w-4' focusable='false' />
          </TouchIconButton>
          <TouchIconButton
            variant='ghost'
            onClick={() => handleOpenChange(false)}
            aria-label='Close image preview'
            autoFocus
            className={overlayControlCloseButtonClassName}
          >
            <X aria-hidden='true' className='h-4 w-4' focusable='false' />
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
            <div
              aria-label={IMAGE_PREVIEW_LOADING_LABEL}
              className='absolute inset-0 flex items-center justify-center'
              role='status'
            >
              <Loader2 aria-hidden='true' className='h-8 w-8 animate-spin text-white/70' focusable='false' />
            </div>
          )}
          <img
            src={safeSrc}
            alt={safeAlt}
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

        {safeAlt && (
          <div className='absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4'>
            <p className='text-white/90 text-sm text-center'>{safeAlt}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export type ArticleMediaLayout =
  | 'center'
  | 'wide'
  | 'full'
  | 'compact'
  | 'aside-left'
  | 'aside-right';

interface ClickableImageProps {
  src: string;
  alt?: string;
  caption?: string;
  className?: string;
  isTerminal?: boolean;
  postPath?: string; // e.g., "2025/future-tech-six-insights" for resolving relative image paths
  layout?: ArticleMediaLayout;
  intrinsicWidth?: string | number;
  intrinsicHeight?: string | number;
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
  caption,
  className,
  isTerminal,
  postPath,
  layout = 'wide',
  autoPlay = true,
  controls = true,
  loop = true,
  muted = true,
  playsInline = true,
  children,
}: EmbeddedVideoProps) {
  const resolvedSrc = normalizeMediaSrc(resolvePostMediaSrc(src, postPath));
  const safeAlt = sanitizeMediaText(alt);
  const safeCaption = sanitizeMediaText(caption);
  const { isInView, mediaRef } = useInView<HTMLVideoElement>();
  const [loadFailed, setLoadFailed] = useState(false);
  const hasDirectSrc = !!resolvedSrc;

  if (!hasDirectSrc && !children) {
    return null;
  }

  return (
    <figure
      className={cn(
        'article-media-frame my-8 block text-center',
        isTerminal && 'article-media-frame--terminal'
      )}
      data-layout={layout}
    >
      {loadFailed ? (
        <div
          className={cn(
            'rounded-xl border border-border/50 bg-muted/40 px-6 py-12 text-sm text-muted-foreground',
            isTerminal && 'rounded-lg border-border',
            className
          )}
        >
          {safeAlt || 'Video unavailable'}
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
            'mx-auto h-auto max-w-full rounded-xl bg-black shadow-lg',
            isTerminal && 'rounded-lg border border-border',
            className
          )}
          aria-label={safeAlt || 'Embedded video'}
        >
          {children}
        </video>
      )}
      {(safeCaption || safeAlt) && (
        <figcaption
          className={cn(
            'mt-3 text-sm text-muted-foreground',
            isTerminal && 'font-mono not-italic'
          )}
        >
          {isTerminal ? `// ${safeCaption || safeAlt}` : safeCaption || safeAlt}
        </figcaption>
      )}
    </figure>
  );
}

export function NormalizedVideoSource({
  src,
  postPath,
  ...props
}: ComponentProps<'source'> & { postPath?: string }) {
  const resolvedSrc =
    typeof src === 'string'
      ? normalizeMediaSrc(resolvePostMediaSrc(src, postPath))
      : src;

  if (typeof src === 'string' && !resolvedSrc) return null;

  return <source {...props} src={resolvedSrc} />;
}

export function ClickableImage({
  src,
  alt,
  caption,
  className,
  isTerminal,
  postPath,
  layout = 'wide',
  intrinsicWidth,
  intrinsicHeight,
}: ClickableImageProps) {
  const resolvedSrc = normalizeMediaSrc(resolvePostMediaSrc(src, postPath));
  const safeAlt = sanitizeMediaText(alt);
  const safeCaption = sanitizeMediaText(caption);
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

  if (!resolvedSrc) return null;

  if (isVideo) {
    return (
      <EmbeddedVideo
        src={resolvedSrc}
        alt={safeAlt}
        caption={safeCaption}
        className={className}
        isTerminal={isTerminal}
        postPath={postPath}
        layout={layout}
      />
    );
  }

  // Use original if thumbnail failed to load
  const displaySrc =
    thumbError || !shouldUseThumb(resolvedSrc)
      ? resolvedSrc
      : getThumbSrc(resolvedSrc);

  const hasIntrinsicSize =
    intrinsicWidth !== undefined && intrinsicHeight !== undefined;
  const mediaAspectRatio = hasIntrinsicSize
    ? `${intrinsicWidth} / ${intrinsicHeight}`
    : undefined;
  const fallbackAspectClass =
    layout === 'aside-left' || layout === 'aside-right'
      ? 'aspect-[4/3]'
      : 'aspect-[16/9]';
  const displayCaption = safeCaption || safeAlt;

  return (
    <>
      <figure
        className={cn(
          'article-media-frame my-8 block',
          isTerminal && 'article-media-frame--terminal'
        )}
        data-layout={layout}
      >
        <div
          className={cn(
            'article-media-surface relative overflow-hidden rounded-2xl border border-border/60 bg-white/70 shadow-sm',
            'dark:bg-white/[0.03]',
            isTerminal &&
              'rounded border-border bg-[hsl(var(--terminal-code-bg))]'
          )}
        >
          <button
            type='button'
            onClick={() => setLightboxOpen(true)}
            className={cn(
              'group/article-image relative block w-full cursor-zoom-in overflow-hidden',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              !hasIntrinsicSize && fallbackAspectClass
            )}
            style={
              mediaAspectRatio ? { aspectRatio: mediaAspectRatio } : undefined
            }
            aria-label={`View ${safeAlt || safeCaption || 'image'} in full size`}
          >
            {!thumbLoaded && (
              <div
                aria-label={IMAGE_THUMBNAIL_LOADING_LABEL}
                className='absolute inset-0 flex items-center justify-center bg-muted/60'
                role='status'
              >
                <Loader2
                  aria-hidden='true'
                  className='h-6 w-6 animate-spin text-muted-foreground/60'
                  focusable='false'
                />
              </div>
            )}
            <img
              ref={imgRef}
              src={isInView ? displaySrc : undefined}
              data-src={displaySrc}
              alt={safeAlt}
              loading='lazy'
              decoding='async'
              onLoad={handleThumbLoad}
              onError={handleThumbError}
              className={cn(
                'h-full w-full object-contain transition-[opacity,transform] duration-300 ease-smooth',
                'group-hover/article-image:scale-[1.015]',
                thumbLoaded ? 'opacity-100 blur-0' : 'opacity-0',
                isTerminal && 'border-border',
                className
              )}
            />
            <span
              className={cn(
                'pointer-events-none absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full',
                'border border-white/35 bg-black/45 text-white opacity-0 shadow-sm backdrop-blur transition-[opacity,transform] duration-200 ease-smooth',
                'group-hover/article-image:opacity-100 group-hover/article-image:scale-100 group-focus-visible/article-image:opacity-100'
              )}
              aria-hidden='true'
            >
              <ZoomIn aria-hidden='true' className='h-5 w-5' focusable='false' />
            </span>
          </button>
        </div>

        {displayCaption && (
          <figcaption
            className={cn(
              'mx-auto mt-3 max-w-3xl text-center text-sm leading-relaxed text-muted-foreground',
              isTerminal && 'font-mono'
            )}
          >
            {isTerminal ? `// ${displayCaption}` : displayCaption}
          </figcaption>
        )}
      </figure>

      <ImageLightbox
        src={resolvedSrc}
        alt={safeAlt}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    </>
  );
}

export default ImageLightbox;
