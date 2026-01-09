import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { Clock, Map as MapIcon } from 'lucide-react';
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

type ChatSessionLite = {
  id: string;
  title?: string;
  summary?: string;
  articleUrl?: string;
  articleTitle?: string;
  updatedAt?: string;
};

export function useVisitedPostsState() {
  const [items, setItems] = useState<VisitedPostItem[]>([]);
  const [storageAvailable, setStorageAvailable] = useState(true);

  const read = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setItems([]);
        setStorageAvailable(true);
        return;
      }
      const parsed = JSON.parse(raw);
      // Validate that it's an array with proper structure
      if (!Array.isArray(parsed)) {
        // Invalid data - reset to empty array
        localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
        setItems([]);
        setStorageAvailable(true);
        return;
      }
      // Filter out any malformed items
      const validItems = parsed.filter(
        (item: any) =>
          item &&
          typeof item === 'object' &&
          typeof item.path === 'string' &&
          typeof item.title === 'string'
      );
      setItems(validItems);
      setStorageAvailable(true);
    } catch (e) {
      // JSON parse failed or other error - reset storage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      } catch {
        // localStorage completely unavailable
      }
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
  const [view, setView] = useState<'list' | 'graph'>('list');
  const [chatSessions, setChatSessions] = useState<ChatSessionLite[]>([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
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
    const readSessions = () => {
      try {
        const raw = localStorage.getItem('ai_chat_sessions_index');
        if (!raw) {
          setChatSessions([]);
          return;
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          // Invalid data - reset
          try {
            localStorage.setItem('ai_chat_sessions_index', JSON.stringify([]));
          } catch {}
          setChatSessions([]);
          return;
        }
        // Filter valid sessions
        const validSessions = parsed.filter(
          (s: any) => s && typeof s === 'object' && typeof s.id === 'string'
        );
        setChatSessions(validSessions);
      } catch {
        setChatSessions([]);
      }
    };
    readSessions();
    window.addEventListener(
      'aiChat:sessionsUpdated',
      readSessions as EventListener
    );
    return () => {
      window.removeEventListener(
        'aiChat:sessionsUpdated',
        readSessions as EventListener
      );
    };
  }, []);

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
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        hideClose
        className={cn(
          'p-0 bg-background/95',
          // Only apply backdrop-blur on desktop for performance
          !isMobile && 'backdrop-blur supports-[backdrop-filter]:backdrop-blur-lg',
          isMobile
            ? 'max-h-[75vh] rounded-t-[24px] border-x border-t border-border/60 shadow-[0_-18px_50px_rgba(15,23,42,0.18)]'
            : 'h-full w-[420px] border-l border-border/40'
        )}
        aria-describedby={undefined}
        style={
          isMobile
            ? { paddingBottom: 'env(safe-area-inset-bottom)' }
            : undefined
        }
      >
        <SheetHeader className='sticky top-0 z-10 border-b border-border/60 bg-background/98 px-5 pb-4 pt-5'>
          {isMobile && (
            <div className='mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted-foreground/30' aria-hidden />
          )}
          {/* Title row with count */}
          <div className='flex items-center gap-3'>
            <MapIcon className='h-5 w-5 text-muted-foreground' />
            <SheetTitle className='text-base font-semibold'>
              방문 기록
            </SheetTitle>
            <span className='text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full'>
              {items.length}개
            </span>
          </div>
          {/* Thumbnail stack row */}
          <div className='flex items-center gap-2 mt-3'>
            <div className='relative h-8 w-[100px]' aria-hidden>
              {topStack.map((p, i) => (
                <div
                  key={p.path}
                  className='absolute top-0 h-8 w-8 overflow-hidden rounded-full ring-2 ring-background shadow'
                  style={{ left: i * 20 }}
                  title={p.title}
                >
                  {p.coverImage ? (
                    <OptimizedImage
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
          {/* View toggle buttons */}
          <div className='flex items-center gap-1 text-xs bg-muted rounded-full p-0.5 mt-3 w-fit'>
            <button
              type='button'
              className={cn(
                'px-3 py-1.5 rounded-full transition-colors',
                view === 'list'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted-foreground/10'
              )}
              onClick={() => setView('list')}
            >
              리스트
            </button>
            <button
              type='button'
              className={cn(
                'px-3 py-1.5 rounded-full transition-colors',
                view === 'graph'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted-foreground/10'
              )}
              onClick={() => setView('graph')}
            >
              그래프
            </button>
          </div>
        </SheetHeader>
        {view === 'list' ? (
          <div
            ref={listContainerRef}
            tabIndex={0}
            className={cn(
              'overflow-y-auto px-4 pb-8 pt-4 focus:outline-none',
              isMobile ? 'max-h-[calc(75vh-160px)]' : 'flex-1'
            )}
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
            <ul className='space-y-2'>
              {items.map((p, idx) => (
                <li key={p.path}>
                  <button
                    onClick={() => go(p)}
                    className={cn(
                      'group flex w-full items-center gap-4 rounded-xl px-4 py-4 text-left transition-colors hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring',
                      activeIndex === idx && 'ring-2 ring-primary bg-primary/5'
                    )}
                  >
                    <div className='h-12 w-12 overflow-hidden rounded-lg shrink-0'>
                      {p.coverImage ? (
                        <OptimizedImage
                          src={p.coverImage}
                          alt=''
                          className='h-12 w-12 object-cover'
                        />
                      ) : (
                        <div className='flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-primary/80 to-primary text-primary-foreground text-sm font-bold'>
                          {(p.title || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className='min-w-0 flex-1'>
                      <div className='text-sm font-medium leading-snug text-left group-hover:text-primary line-clamp-2'>
                        {p.title}
                      </div>
                      <div className='flex items-center gap-1.5 mt-1 text-xs text-muted-foreground'>
                        <Clock className='h-3.5 w-3.5' />
                        <span>
                          {p.year}/{p.slug}
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            {/* 기록 지우기 버튼 */}
            <div className='mt-6 pt-4 border-t'>
              <Button
                variant='outline'
                size='sm'
                onClick={clearAll}
                className='w-full h-11'
              >
                기록 지우기
              </Button>
            </div>
          </div>
        ) : (
          <div className={cn(
            'overflow-y-auto px-4 pb-8 pt-4 space-y-3',
            isMobile ? 'max-h-[calc(75vh-160px)]' : 'flex-1'
          )}>
            {items.map(p => {
              const related = chatSessions.filter(s =>
                s.articleUrl && s.articleUrl.endsWith(p.path)
              );
              if (!related.length) return null;
              return (
                <div
                  key={p.path}
                  className='rounded-xl border bg-card/50 p-4 shadow-sm'
                >
                  <div className='text-sm font-semibold truncate'>{p.title}</div>
                  <div className='text-xs text-muted-foreground mb-2'>
                    {p.year}/{p.slug}
                  </div>
                  <ul className='mt-2 space-y-2'>
                    {related.map(s => {
                      const checked = selectedSessionIds.includes(s.id);
                      return (
                        <li
                          key={s.id}
                          className='flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/40'
                        >
                          <input
                            type='checkbox'
                            className='h-4 w-4 rounded'
                            checked={checked}
                            onChange={() => {
                              setSelectedSessionIds(prev =>
                                prev.includes(s.id)
                                  ? prev.filter(x => x !== s.id)
                                  : [...prev, s.id]
                              );
                            }}
                          />
                          <div className='min-w-0 flex-1'>
                            <span className='text-sm font-medium truncate block'>
                              {s.title || s.articleTitle || 'AI Chat 세션'}
                            </span>
                            {s.updatedAt && (
                              <span className='text-xs text-muted-foreground'>
                                {new Date(s.updatedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
            {!chatSessions.length && (
              <div className='text-sm text-muted-foreground px-2 py-8 text-center'>
                아직 저장된 AI Chat 세션이 없습니다.<br/>
                대화를 나누고 기록 저장을 켜면 여기에서 연결 관계를 볼 수 있어요.
              </div>
            )}
            {chatSessions.length > 0 && (
              <div className='mt-4 flex items-center justify-between border-t pt-4 px-1'>
                <span className='text-sm text-muted-foreground'>
                  선택: {selectedSessionIds.length}개
                </span>
                <Button
                  type='button'
                  size='sm'
                  className='h-10 px-4'
                  disabled={!selectedSessionIds.length}
                  onClick={() => {
                    if (!selectedSessionIds.length) return;
                    try {
                      window.dispatchEvent(
                        new CustomEvent('aiChat:aggregateFromGraph', {
                          detail: { sessionIds: selectedSessionIds },
                        })
                      );
                    } catch {}
                  }}
                >
                  통합 질문하기
                </Button>
              </div>
            )}
          </div>
        )}
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
