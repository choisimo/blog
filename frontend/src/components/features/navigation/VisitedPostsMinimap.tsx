import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { X, Clock, Map } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';

export type VisitedPostItem = {
  path: string; // "/blog/:year/:slug"
  title: string;
  coverImage?: string;
  year: string;
  slug: string;
};

const STORAGE_KEY = 'visited.posts';

export function useVisitedPostsState() {
  const [items, setItems] = useState<VisitedPostItem[]>([]);
  const [storageAvailable, setStorageAvailable] = useState(true);

  const read = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr: VisitedPostItem[] = raw ? JSON.parse(raw) : [];
      setItems(Array.isArray(arr) ? arr : []);
      setStorageAvailable(true);
    } catch {
      setItems([]);
      setStorageAvailable(false);
    }
  }, []);

  useEffect(() => {
    read();
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === STORAGE_KEY) read();
    };
    const onCustom = () => read();
    const onStorageError = () => {
      setItems([]);
      setStorageAvailable(false);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('visitedposts:update', onCustom as EventListener);
    window.addEventListener('visitedposts:error', onStorageError);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(
        'visitedposts:update',
        onCustom as EventListener
      );
      window.removeEventListener('visitedposts:error', onStorageError);
    };
  }, [read]);

  return { items, storageAvailable };
}

export function useVisitedPosts() {
  return useVisitedPostsState().items;
}

function FallbackAvatar({ title }: { title: string }) {
  const ch = (title || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <div
      className='flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-primary text-primary-foreground text-xs font-bold ring-2 ring-background shadow'
      aria-hidden
    >
      {ch}
    </div>
  );
}

type VisitedPostsMinimapMode = 'default' | 'fab';

type VisitedPostsMinimapProps = {
  mode?: VisitedPostsMinimapMode;
};

export function VisitedPostsMinimap({
  mode = 'default',
}: VisitedPostsMinimapProps = {}) {
  const { items, storageAvailable } = useVisitedPostsState();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);
  const isMobile = useIsMobile();
  const listContainerRef = useRef<HTMLDivElement | null>(null);

  const topStack = useMemo(() => items.slice(0, 4), [items]);
  const externalTrigger = mode === 'fab';

  const go = (p: VisitedPostItem) => {
    setOpen(false);
    navigate(p.path);
  };

  const clearAll = () => {
    if (!storageAvailable) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      window.dispatchEvent(new CustomEvent('visitedposts:update'));
    } catch {}
  };

  useEffect(() => {
    if (!externalTrigger) return;
    const onRequestOpen = () => {
      if (!items.length) return;
      setOpen(true);
      setTimeout(() => listContainerRef.current?.focus(), 0);
    };
    window.addEventListener(
      'visitedposts:open',
      onRequestOpen as EventListener
    );
    return () =>
      window.removeEventListener(
        'visitedposts:open',
        onRequestOpen as EventListener
      );
  }, [externalTrigger, items.length]);

  useEffect(() => {
    if (!items.length && open) setOpen(false);
  }, [items.length, open]);

  if (!storageAvailable && !items.length) return null;
  if (!items.length) return null;

  const sheet = (
    <Sheet open={open} onOpenChange={setOpen}>
      {!externalTrigger && (
        <SheetTrigger asChild>
          <Button
            variant='secondary'
            size='sm'
            className='shadow-lg backdrop-blur-sm'
            aria-expanded={open}
            aria-label='Open visited posts history'
            onClick={() => {
              setTimeout(() => listContainerRef.current?.focus(), 0);
            }}
          >
            <Map className='mr-2 h-4 w-4' />
            Insight
          </Button>
        </SheetTrigger>
      )}
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(isMobile ? 'h-[90dvh]' : 'w-[380px] h-full', 'p-0')}
        aria-describedby={undefined}
        style={
          isMobile
            ? { paddingBottom: 'env(safe-area-inset-bottom)' }
            : undefined
        }
      >
        <SheetHeader className='sticky top-0 z-10 border-b bg-background px-4 py-3'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3 text-sm font-semibold'>
              <Map className='h-4 w-4' />
              <SheetTitle>Recently visited</SheetTitle>
              <div className='relative h-8 w-[96px]' aria-hidden>
                {topStack.map((p, i) => (
                  <div
                    key={p.path}
                    className='absolute top-0 h-8 w-8 overflow-hidden rounded-full ring-2 ring-background shadow'
                    style={{ right: i * 20 }}
                    title={p.title}
                  >
                    {p.coverImage ? (
                      <img
                        src={p.coverImage}
                        alt=''
                        className='h-full w-full object-cover'
                      />
                    ) : (
                      <FallbackAvatar title={p.title} />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className='flex items-center gap-1'>
              <Button
                variant='ghost'
                size='sm'
                onClick={clearAll}
                aria-label='Clear history'
              >
                Clear
              </Button>
              <Button
                variant='ghost'
                size='icon'
                onClick={() => setOpen(false)}
                aria-label='Close history'
              >
                <X className='h-4 w-4' />
              </Button>
            </div>
          </div>
        </SheetHeader>
        <div
          ref={listContainerRef}
          tabIndex={0}
          className='max-h-full overflow-y-auto p-2 focus:outline-none'
          onKeyDown={e => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveIndex(i => Math.min(i + 1, items.length - 1));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIndex(i => Math.max(i - 1, 0));
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              const p = items[activeIndex];
              if (p) go(p);
            }
          }}
          role='region'
          aria-label='Visited posts list'
        >
          <ul className='space-y-1'>
            {items.map((p, idx) => (
              <li key={p.path}>
                <button
                  onClick={() => go(p)}
                  className={cn(
                    'group flex w-full items-center gap-3 rounded-md px-3 py-3 md:px-2 md:py-2 text-left hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring',
                    activeIndex === idx && 'ring-2 ring-primary'
                  )}
                >
                  <div className='h-8 w-8 overflow-hidden rounded'>
                    {p.coverImage ? (
                      <img
                        src={p.coverImage}
                        alt=''
                        className='h-8 w-8 object-cover'
                      />
                    ) : (
                      <FallbackAvatar title={p.title} />
                    )}
                  </div>
                  <div className='min-w-0'>
                    <div className='truncate text-sm font-medium group-hover:text-primary'>
                      {p.title}
                    </div>
                    <div className='flex items-center gap-1 text-xs text-muted-foreground'>
                      <Clock className='h-3 w-3' />
                      <span>
                        {p.year}/{p.slug}
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );

  if (externalTrigger) {
    return sheet;
  }

  return (
    <div className='fixed bottom-8 right-24 z-50 select-none'>{sheet}</div>
  );
}

export default VisitedPostsMinimap;
