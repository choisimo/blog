import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type ComponentProps,
  type ReactNode,
} from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Loader2,
  Info,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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

const lightboxActionClassName =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition-[background-color,border-color,color,transform,opacity] duration-200 ease-smooth hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10 motion-reduce:transition-none motion-reduce:active:scale-100';

function getImageFileName(src: string): string {
  const withoutQuery = src.split(/[?#]/)[0] ?? src;
  const name = withoutQuery.split('/').filter(Boolean).pop();
  if (!name) return 'image';

  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

function formatScale(scale: number): string {
  return `${Math.round(scale * 100)}%`;
}

function LightboxAction({
  ariaLabel,
  label,
  icon,
  onClick,
  disabled,
  mobile,
}: {
  ariaLabel: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  mobile?: boolean;
}) {
  return (
    <button
      type='button'
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        lightboxActionClassName,
        mobile &&
          'min-h-[56px] flex-col gap-1 rounded-lg px-2 text-[11px] leading-none'
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
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
  const imageName = useMemo(() => getImageFileName(src), [src]);
  const imageLabel = alt?.trim() || imageName;
  const scaleLabel = formatScale(scale);

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

  const handleFitToScreen = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
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

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.15 : -0.15;
    setScale(prev => {
      const next = Math.min(Math.max(prev + delta, 0.5), 4);
      if (next <= 1) setTranslate({ x: 0, y: 0 });
      return next;
    });
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
    if (!open || !src) {
      return;
    }

    setImageLoaded(false);
    const img = new Image();
    img.onload = () => setImageLoaded(true);
    img.onerror = () => setImageLoaded(true);
    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [open, src]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        hideClose
        className='h-[100dvh] w-[100vw] max-w-[100vw] max-h-[100dvh] overflow-hidden rounded-none border-0 bg-white p-0 text-foreground shadow-none sm:h-[min(88vh,820px)] sm:w-[min(1120px,calc(100vw-3rem))] sm:max-w-[1120px] sm:rounded-lg sm:border sm:border-slate-200 sm:shadow-[0_24px_90px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-[#0b0f18]'
        onPointerDownOutside={() => handleOpenChange(false)}
      >
        <div className='flex h-full min-h-0 flex-col bg-white dark:bg-[#0b0f18]'>
          <header className='flex min-h-[64px] items-center justify-between gap-3 border-b border-slate-200 px-3 sm:px-5 dark:border-white/10'>
            <div className='flex min-w-0 items-center gap-2 sm:gap-3'>
              <button
                type='button'
                aria-label='Close image preview'
                onClick={() => handleOpenChange(false)}
                className='inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:hidden dark:text-slate-100 dark:hover:bg-white/10'
              >
                <X className='h-5 w-5' />
              </button>
              <div className='min-w-0'>
                <DialogTitle className='m-0 truncate text-sm font-semibold text-slate-950 sm:text-base dark:text-white'>
                  {imageName}
                </DialogTitle>
                <DialogDescription className='m-0 text-xs text-muted-foreground'>
                  1 / 1
                </DialogDescription>
              </div>
            </div>

            <div className='hidden items-center gap-2 sm:flex'>
              <LightboxAction
                ariaLabel='Zoom out image preview'
                label='축소'
                icon={<ZoomOut className='h-4 w-4' />}
                onClick={handleZoomOut}
                disabled={scale <= 0.5}
              />
              <LightboxAction
                ariaLabel='Zoom in image preview'
                label='확대'
                icon={<ZoomIn className='h-4 w-4' />}
                onClick={handleZoomIn}
                disabled={scale >= 4}
              />
              <LightboxAction
                ariaLabel='Fit image to screen'
                label='화면 맞춤'
                icon={<Maximize2 className='h-4 w-4' />}
                onClick={handleFitToScreen}
              />
              <LightboxAction
                ariaLabel='Reset image preview'
                label='원래 크기'
                icon={<RotateCcw className='h-4 w-4' />}
                onClick={handleReset}
              />
              <LightboxAction
                ariaLabel='Close image preview'
                label='닫기'
                icon={<X className='h-4 w-4' />}
                onClick={() => handleOpenChange(false)}
              />
            </div>
          </header>

          <div className='flex min-h-0 flex-1 gap-5 overflow-hidden p-3 pb-24 sm:p-5 sm:pb-5 lg:p-6'>
            <div
              data-testid='lightbox-container'
              className={cn(
                'relative flex min-h-[56vh] min-w-0 flex-1 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50/80 p-3 sm:min-h-[520px] sm:p-6 dark:border-white/10 dark:bg-black/20',
                scale > 1
                  ? 'cursor-grab active:cursor-grabbing'
                  : 'cursor-zoom-out'
              )}
              onWheel={handleWheel}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              {!imageLoaded && (
                <div className='absolute inset-0 flex items-center justify-center'>
                  <Loader2 className='h-8 w-8 animate-spin text-slate-400' />
                </div>
              )}
              <img
                src={src}
                alt={alt || ''}
                data-testid='lightbox-image'
                onLoad={() => setImageLoaded(true)}
                className={cn(
                  'max-h-full max-w-full select-none object-contain transition-[opacity] duration-300 motion-reduce:transition-none',
                  'pointer-events-none will-change-transform',
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                )}
                style={{
                  transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale}) rotate(${rotation}deg)`,
                }}
                draggable={false}
              />
            </div>

            <aside className='hidden w-64 shrink-0 space-y-3 xl:block'>
              <section className='rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]'>
                <div className='mb-4 flex items-center gap-2 text-sm font-semibold'>
                  <Info className='h-4 w-4 text-primary' />
                  이미지 정보
                </div>
                <dl className='space-y-3 text-xs'>
                  <div>
                    <dt className='text-muted-foreground'>파일명</dt>
                    <dd className='mt-1 break-all font-medium text-foreground'>
                      {imageName}
                    </dd>
                  </div>
                  <div>
                    <dt className='text-muted-foreground'>설명</dt>
                    <dd className='mt-1 leading-5 text-foreground/80'>
                      {imageLabel}
                    </dd>
                  </div>
                  <div>
                    <dt className='text-muted-foreground'>확대</dt>
                    <dd className='mt-1 font-medium text-foreground'>
                      {scaleLabel}
                    </dd>
                  </div>
                </dl>
              </section>
              <a
                href={src}
                download
                className='inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-100 dark:hover:bg-white/10'
              >
                <Download className='h-4 w-4' />
                다운로드
              </a>
              <section className='rounded-lg border border-primary/15 bg-primary/5 p-4 text-xs leading-5 text-muted-foreground'>
                두 손가락으로 확대/축소하거나, 확대된 상태에서 드래그해 위치를
                이동할 수 있습니다.
              </section>
            </aside>
          </div>

          <footer className='hidden min-h-[56px] items-center justify-between border-t border-slate-200 px-5 text-xs text-muted-foreground sm:flex dark:border-white/10'>
            <span>
              마우스 휠로 확대/축소, 드래그로 위치를 이동할 수 있습니다.
            </span>
            <span>{scaleLabel}</span>
          </footer>

          <div className='fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 shadow-[0_-16px_40px_rgba(15,23,42,0.12)] backdrop-blur sm:hidden dark:border-white/10 dark:bg-[#0b0f18]/95'>
            <div className='grid grid-cols-4 gap-2'>
              <LightboxAction
                ariaLabel='Zoom in image preview'
                label='확대'
                icon={<ZoomIn className='h-4 w-4' />}
                onClick={handleZoomIn}
                disabled={scale >= 4}
                mobile
              />
              <LightboxAction
                ariaLabel='Zoom out image preview'
                label='축소'
                icon={<ZoomOut className='h-4 w-4' />}
                onClick={handleZoomOut}
                disabled={scale <= 0.5}
                mobile
              />
              <LightboxAction
                ariaLabel='Fit image to screen'
                label='맞춤'
                icon={<Maximize2 className='h-4 w-4' />}
                onClick={handleFitToScreen}
                mobile
              />
              <LightboxAction
                ariaLabel='Reset image preview'
                label='원본'
                icon={<RotateCcw className='h-4 w-4' />}
                onClick={handleReset}
                mobile
              />
            </div>
          </div>
        </div>
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
      <span className='my-8 block text-center'>
        <button
          type='button'
          onClick={() => setLightboxOpen(true)}
          className='group relative inline-block cursor-zoom-in overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-[0_18px_48px_rgba(15,23,42,0.08)] transition-[border-color,box-shadow,transform] duration-200 ease-smooth hover:border-primary/30 hover:shadow-[0_22px_60px_rgba(37,99,235,0.14)] active:scale-[0.995] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-white/10 dark:bg-white/[0.03] motion-reduce:transition-none motion-reduce:active:scale-100'
          aria-label={`View ${alt || 'image'} in full size`}
        >
          {/* Placeholder skeleton while loading */}
          {!thumbLoaded && (
            <div className='absolute inset-1 flex animate-pulse items-center justify-center rounded-lg bg-muted/50'>
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
              'mx-auto h-auto max-w-full rounded-md transition-[opacity,filter,transform] duration-300',
              'group-hover:scale-[1.01] motion-reduce:transition-none motion-reduce:group-hover:scale-100',
              thumbLoaded ? 'opacity-100 blur-0' : 'opacity-0',
              isTerminal && 'rounded-lg border border-border',
              className
            )}
          />
          {/* Click hint overlay */}
          <div
            className={cn(
              'absolute inset-1 flex items-center justify-center rounded-md bg-slate-950/25 opacity-0 transition-opacity duration-200 group-hover:opacity-100 motion-reduce:transition-none'
            )}
          >
            <ZoomIn className='h-8 w-8 text-white drop-shadow-lg' />
          </div>
        </button>
        {alt && (
          <span
            className={cn(
              'mt-3 block text-sm text-muted-foreground',
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
