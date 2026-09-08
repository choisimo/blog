import {
  useState, useCallback, useEffect, useRef,
  type ComponentProps, type RefObject, type ReactNode,
  type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { TouchIconButton } from '@/components/atoms/TouchIconButton';
import { overlayControlPlateClassName, overlayControlButtonClassName, overlayControlCloseButtonClassName } from '@/components/atoms/overlayControl';
import { X, ZoomIn, ZoomOut, RotateCw, Maximize, Loader2, ImageOff, RefreshCw, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getThumbSrc, isVideoMedia, shouldUseThumb } from '@/utils/content/postMedia';
import { resolveMarkdownMediaPath } from '@/lib/markdown/markdownPolicy';
import { INITIAL_IMAGE_VIEW, constrainImageView, fitImageToViewport, normalizeImageDimension, type ImageSize, type ImageView } from '@/utils/content/imageGeometry';

interface ImageLightboxProps {
  src: string;
  alt?: string;
  caption?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusRef?: RefObject<HTMLButtonElement>;
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

export function ImageLightbox({ src, alt, caption, open, onOpenChange, returnFocusRef }: ImageLightboxProps) {
  const safeSrc = normalizeMediaSrc(src);
  const safeAlt = sanitizeMediaText(alt);
  const safeCaption = sanitizeMediaText(caption) || safeAlt;
  const closeRef = useRef<HTMLButtonElement>(null);
  if (!safeSrc) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className='ui-image-viewer'
        onOpenAutoFocus={event => {
          if (closeRef.current) {
            event.preventDefault();
            closeRef.current.focus({ preventScroll: true });
          }
        }}
        onCloseAutoFocus={event => {
          // This viewer is opened by an article button, not a Radix DialogTrigger.
          if (returnFocusRef?.current?.isConnected) {
            event.preventDefault();
            returnFocusRef.current.focus({ preventScroll: true });
          }
        }}
      >
        {/* The portal unmounts this state on close. A new source starts clean too. */}
        <ImagePreview key={safeSrc} src={safeSrc} alt={safeAlt} caption={safeCaption}
          closeRef={closeRef} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

type LoadState = 'loading' | 'ready' | 'error';
const EMPTY_SIZE: ImageSize = { width: 0, height: 0 };

function ImagePreview({ src, alt, caption, onClose, closeRef }: {
  src: string; alt: string; caption: string; onClose: () => void;
  closeRef: RefObject<HTMLButtonElement>;
}) {
  const [view, setView] = useState<ImageView>({ ...INITIAL_IMAGE_VIEW });
  const viewRef = useRef(view);
  const [status, setStatus] = useState<LoadState>('loading');
  const [attempt, setAttempt] = useState(0);
  const [naturalSize, setNaturalSize] = useState<ImageSize>(EMPTY_SIZE);
  const [viewport, setViewport] = useState<ImageSize>(EMPTY_SIZE);
  const canvasRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ distance: number; view: ImageView } | null>(null);

  const updateView = useCallback((change: (current: ImageView) => ImageView) => {
    const next = constrainImageView(change(viewRef.current), naturalSize, viewport);
    viewRef.current = next;
    setView(next);
  }, [naturalSize, viewport]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const measure = () => {
      const bounds = canvas.getBoundingClientRect();
      setViewport(previous => previous.width === bounds.width && previous.height === bounds.height
        ? previous : { width: bounds.width, height: bounds.height });
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(canvas);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  useEffect(() => { updateView(current => current); }, [updateView]);

  // A single native non-passive listener; it is attached only to the mounted canvas.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.deltaY || status === 'error') return;
      event.preventDefault();
      updateView(current => ({ ...current, scale: current.scale + (event.deltaY < 0 ? 0.15 : -0.15) }));
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [updateView, status]);

  const markLoaded = useCallback((image: HTMLImageElement) => {
    setNaturalSize({ width: image.naturalWidth, height: image.naturalHeight });
    setStatus('ready');
  }, []);

  // Cached assets can finish before React attaches the load handler.
  useEffect(() => {
    const image = imgRef.current;
    if (image?.complete && image.naturalWidth > 0) markLoaded(image);
  }, [attempt, markLoaded]);

  const zoom = (delta: number) => updateView(current => ({ ...current, scale: current.scale + delta }));
  const reset = () => updateView(() => ({ ...INITIAL_IMAGE_VIEW }));
  const rotate = () => updateView(current => ({ ...current, rotation: current.rotation + 90, x: 0, y: 0 }));
  const retry = () => { setStatus('loading'); setAttempt(current => current + 1); reset(); };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey || status === 'error') return;
    const key = event.key.toLowerCase();
    if (key === '+' || key === '=') { event.preventDefault(); zoom(0.25); }
    else if (key === '-') { event.preventDefault(); zoom(-0.25); }
    else if (key === '0') { event.preventDefault(); reset(); }
    else if (key === 'r') { event.preventDefault(); rotate(); }
    else if (event.target === canvasRef.current && viewRef.current.scale > 1 && key.startsWith('arrow')) {
      event.preventDefault();
      updateView(current => ({ ...current,
        x: current.x + (key === 'arrowleft' ? 48 : key === 'arrowright' ? -48 : 0),
        y: current.y + (key === 'arrowup' ? 48 : key === 'arrowdown' ? -48 : 0),
      }));
    }
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || status === 'error') return;
    if (event.pointerType !== 'touch' && viewRef.current.scale <= 1) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture?.(event.pointerId);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), view: { ...viewRef.current } };
    }
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()];
      const start = gesture.current;
      if (start.distance > 0) updateView(current => ({ ...current, scale: start.view.scale * Math.hypot(a.x - b.x, a.y - b.y) / start.distance }));
    } else if (pointers.current.size === 1 && viewRef.current.scale > 1) {
      updateView(current => ({ ...current, x: current.x + event.clientX - previous.x, y: current.y + event.clientY - previous.y }));
    }
  };
  const endPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const fit = fitImageToViewport(naturalSize, viewport, view.rotation);
  const controlsDisabled = status === 'error';

  return (
    <div className='ui-image-viewer__layout' onKeyDown={onKeyDown}>
      <div className='ui-image-viewer__header'>
        <div className='ui-image-viewer__heading'>
          <DialogTitle className='ui-image-viewer__title'>{alt || '이미지 보기'}</DialogTitle>
          <DialogDescription className='ui-image-viewer__description'>
            스크롤·두 손가락으로 확대, 드래그로 이동 · Esc 닫기
          </DialogDescription>
        </div>
        <TouchIconButton ref={closeRef} variant='ghost' onClick={onClose} aria-label='Close image preview'
          title='닫기 (Esc)' className={cn('ui-image-viewer__close', overlayControlCloseButtonClassName)}>
          <X aria-hidden='true' className='h-4 w-4' />
        </TouchIconButton>
      </div>
      <div ref={canvasRef} data-testid='lightbox-container' className='ui-image-viewer__canvas'
        data-zoomed={view.scale > 1} tabIndex={0} role='region' aria-label='이미지. +, − 확대 및 축소, 0 초기화, R 회전, 방향키 이동'
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endPointer}
        onPointerCancel={endPointer} onLostPointerCapture={endPointer}>
        {status === 'loading' && <div className='ui-image-viewer__status' role='status' aria-label={IMAGE_PREVIEW_LOADING_LABEL}>
          <Loader2 aria-hidden='true' className='h-8 w-8 motion-safe:animate-spin' /><span>원본을 불러오는 중</span>
        </div>}
        {status === 'error' && <div className='ui-image-viewer__status' role='status'>
          <ImageOff aria-hidden='true' className='h-8 w-8' /><p>이미지를 불러오지 못했습니다.</p>
          <button type='button' className='ui-image-retry' onClick={retry}><RefreshCw aria-hidden='true' />다시 시도</button>
        </div>}
        <img key={attempt} ref={imgRef} src={src} alt={alt} data-testid='lightbox-image'
          className='ui-image-viewer__image' data-state={status}
          onLoad={event => markLoaded(event.currentTarget)} onError={() => setStatus('error')}
          style={{ width: fit.width || undefined, height: fit.height || undefined,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale}) rotate(${view.rotation}deg)` }}
          draggable={false} decoding='async' />
      </div>
      <div className='ui-image-viewer__footer'>
        <p className='ui-image-viewer__caption ui-scroll-region'>{caption || '원본 이미지'}</p>
        <div className={cn('ui-image-viewer__tools', overlayControlPlateClassName)} role='group' aria-label='이미지 도구'>
          <TouchIconButton variant='ghost' onClick={() => zoom(-0.25)} aria-label='Zoom out image preview'
            title='축소 (−)' className={overlayControlButtonClassName} disabled={controlsDisabled || view.scale <= 0.5}>
            <ZoomOut aria-hidden='true' className='h-4 w-4' />
          </TouchIconButton>
          <TouchIconButton variant='ghost' onClick={() => zoom(0.25)} aria-label='Zoom in image preview'
            title='확대 (+)' className={overlayControlButtonClassName} disabled={controlsDisabled || view.scale >= 4}>
            <ZoomIn aria-hidden='true' className='h-4 w-4' />
          </TouchIconButton>
          <TouchIconButton variant='ghost' onClick={rotate} aria-label='Rotate image preview'
            title='회전 (R)' className={overlayControlButtonClassName} disabled={controlsDisabled}>
            <RotateCw aria-hidden='true' className='h-4 w-4' />
          </TouchIconButton>
          <TouchIconButton variant='ghost' onClick={reset} aria-label='Reset image preview'
            title='화면에 맞추기 (0)' className={overlayControlButtonClassName} disabled={controlsDisabled}>
            <Maximize aria-hidden='true' className='h-4 w-4' />
          </TouchIconButton>
        </div>
        <output className='ui-image-viewer__scale' aria-label='화면 맞춤 대비 배율'>{Math.round(view.scale * 100)}%</output>
        <a className='ui-image-viewer__original' href={src} target='_blank' rel='noopener noreferrer' aria-label='원본 이미지 새 탭에서 열기'>
          <ExternalLink aria-hidden='true' /><span>원본</span>
        </a>
      </div>
    </div>
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
    const element = mediaRef.current;
    if (!element) return;
    if (typeof IntersectionObserver === 'undefined') {
      setIsInView(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setIsInView(true);
        observer.disconnect();
      }
    }, { rootMargin: '200px', threshold: 0.01 });
    observer.observe(element);
    return () => observer.disconnect();
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
  const resolvedSrc = normalizeMediaSrc(resolveMarkdownMediaPath(src, postPath) ?? '');
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
      ? normalizeMediaSrc(resolveMarkdownMediaPath(src, postPath) ?? '')
      : src;

  if (typeof src === 'string' && !resolvedSrc) return null;

  return <source {...props} src={resolvedSrc} />;
}

export function ClickableImage(props: ClickableImageProps) {
  const resolvedSrc = normalizeMediaSrc(resolveMarkdownMediaPath(props.src, props.postPath) ?? '');
  if (!resolvedSrc) return null;
  if (isVideoMedia(resolvedSrc)) return <EmbeddedVideo key={resolvedSrc} {...props} src={resolvedSrc} />;
  // Do not carry an old error, thumbnail, size or open dialog across a source change.
  return <ArticleImage key={resolvedSrc} {...props} src={resolvedSrc} />;
}

function ArticleImage({ src, alt, caption, className, isTerminal, layout = 'wide', intrinsicWidth, intrinsicHeight }: ClickableImageProps) {
  const safeAlt = sanitizeMediaText(alt);
  const displayCaption = sanitizeMediaText(caption) || safeAlt;
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [status, setStatus] = useState<LoadState>('loading');
  const [originalFallback, setOriginalFallback] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const width = normalizeImageDimension(intrinsicWidth);
  const height = normalizeImageDimension(intrinsicHeight);
  const thumbnail = shouldUseThumb(src) ? getThumbSrc(src) : src;
  const displaySrc = originalFallback ? src : thumbnail;

  useEffect(() => {
    const image = imgRef.current;
    if (image?.complete && image.naturalWidth > 0) setStatus('ready');
  }, [displaySrc, attempt]);

  useEffect(() => {
    // Native lazy loading keeps a real src available to printing and non-scrolling readers.
    const prepare = () => { if (imgRef.current) imgRef.current.loading = 'eager'; };
    const restore = () => { if (imgRef.current) imgRef.current.loading = 'lazy'; };
    window.addEventListener('beforeprint', prepare);
    window.addEventListener('afterprint', restore);
    return () => {
      window.removeEventListener('beforeprint', prepare);
      window.removeEventListener('afterprint', restore);
    };
  }, []);

  const handleError = () => {
    if (displaySrc !== src) { setOriginalFallback(true); setStatus('loading'); }
    else setStatus('error');
  };
  const retry = () => { setAttempt(current => current + 1); setStatus('loading'); };

  return (
    <>
      <figure className={cn('article-media-frame', isTerminal && 'article-media-frame--terminal')} data-layout={layout}>
        <div className='article-media-surface'>
          {status === 'error' ? (
            <div className='article-image-error' role='status'>
              <ImageOff aria-hidden='true' /><p>{safeAlt ? `${safeAlt} — ` : ''}이미지를 불러오지 못했습니다.</p>
              <button ref={triggerRef} type='button' className='ui-image-retry' onClick={retry}><RefreshCw aria-hidden='true' />다시 시도</button>
              <a href={src} target='_blank' rel='noopener noreferrer'>원본 새 탭에서 열기</a>
            </div>
          ) : (
            <button ref={triggerRef} type='button' onClick={() => setLightboxOpen(true)}
              className='article-image-trigger' data-state={status}
              style={status === 'loading' && width && height ? { aspectRatio: `${width} / ${height}` } : undefined}
              aria-label={`View ${safeAlt || displayCaption || 'image'} in full size`} aria-haspopup='dialog'>
              {status === 'loading' && <span className='article-image-loading' role='status' aria-label={IMAGE_THUMBNAIL_LOADING_LABEL}>
                <Loader2 aria-hidden='true' className='h-6 w-6 motion-safe:animate-spin' /><span>이미지를 불러오는 중</span>
              </span>}
              <img key={`${displaySrc}:${attempt}`} ref={imgRef} src={displaySrc} data-src={displaySrc}
                alt={safeAlt} width={width} height={height} loading='lazy' decoding='async'
                onLoad={() => setStatus('ready')} onError={handleError} className={cn('article-image', className)} />
              <span className='article-image-affordance' aria-hidden='true'><ZoomIn /><span>확대 보기</span></span>
            </button>
          )}
        </div>
        <a className='article-print-source' hidden={status === 'ready'} href={src}>{safeAlt || '이미지'} — 원본 이미지</a>
        {displayCaption && <figcaption className='article-media-caption'>{displayCaption}</figcaption>}
      </figure>
      <ImageLightbox src={src} alt={safeAlt} caption={displayCaption} open={lightboxOpen}
        onOpenChange={setLightboxOpen} returnFocusRef={triggerRef} />
    </>
  );
}

export default ImageLightbox;
