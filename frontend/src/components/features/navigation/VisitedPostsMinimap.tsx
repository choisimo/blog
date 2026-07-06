import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { Clock, Map as MapIcon, X } from 'lucide-react';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/ui/use-mobile';
import { loadSessionsIndex, storeSessionsIndex } from '@/services/chat';
import {
  type VisitedPostItem,
  useVisitedPostsState,
  STORAGE_KEY,
} from './useVisitedPosts';

export type { VisitedPostItem };

type ChatSessionLite = {
  id: string;
  title?: string;
  articleTitle?: string;
  articleUrl?: string;
  updatedAt?: string | number;
};

function isChatSessionLite(item: unknown): item is ChatSessionLite {
  return (
    !!item &&
    typeof item === 'object' &&
    typeof (item as ChatSessionLite).id === 'string'
  );
}

const MINIMAP_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/;
const MINIMAP_CONTROL_REPLACE_PATTERN = /[\u0000-\u001F\u007F]+/g;
const ANSI_ESCAPE_PATTERN = /\u001b\[[0-?]*[ -/]*[@-~]/g;
const DEFAULT_HISTORY_LABEL = 'Visited posts history';
const DEFAULT_TRIGGER_LABEL = 'Open visited posts history';
const DEFAULT_LIST_LABEL = 'Visited posts list';
const DEFAULT_CLOSE_LABEL = 'Close history';

function decodeMinimapValue(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function normalizeMinimapLine(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value
    .replace(ANSI_ESCAPE_PATTERN, ' ')
    .replace(MINIMAP_CONTROL_REPLACE_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || null;
}

function normalizeOptionalMinimapText(value: unknown): string | undefined {
  return normalizeMinimapLine(value) ?? undefined;
}

function normalizeVisitedPostTitle(value: unknown): string {
  return normalizeMinimapLine(value) ?? 'Untitled post';
}

function normalizeVisitedPostPart(value: unknown): string {
  return normalizeMinimapLine(value) ?? '';
}

function normalizeMinimapSessionId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  const decoded = decodeMinimapValue(normalized);
  if (
    !normalized ||
    !decoded ||
    [normalized, decoded].some((candidate) => MINIMAP_CONTROL_PATTERN.test(candidate))
  ) {
    return null;
  }
  return normalized;
}

function normalizeMinimapArticleUrl(value: unknown): string | undefined {
  const url = normalizeMinimapLine(value);
  const decoded = url ? decodeMinimapValue(url) : null;
  if (
    !url ||
    !decoded ||
    /\s/.test(url) ||
    MINIMAP_CONTROL_PATTERN.test(decoded)
  ) return undefined;
  if (url.startsWith('/') && !url.startsWith('//')) return url;

  try {
    const parsed = new URL(url);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      !parsed.username &&
      !parsed.password
      ? parsed.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function normalizeMinimapUpdatedAt(value: unknown): string | number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const label = normalizeMinimapLine(value);
  return label ?? undefined;
}

export function normalizeMinimapChatSession(
  item: unknown
): ChatSessionLite | null {
  if (!isChatSessionLite(item)) return null;
  const id = normalizeMinimapSessionId(item.id);
  if (!id) return null;

  const title = normalizeMinimapLine(item.title) ?? undefined;
  const articleTitle = normalizeMinimapLine(item.articleTitle) ?? undefined;
  const articleUrl = normalizeMinimapArticleUrl(item.articleUrl);
  const updatedAt = normalizeMinimapUpdatedAt(item.updatedAt);

  return {
    id,
    ...(title ? { title } : {}),
    ...(articleTitle ? { articleTitle } : {}),
    ...(articleUrl ? { articleUrl } : {}),
    ...(updatedAt !== undefined ? { updatedAt } : {}),
  };
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
  label?: string;
  title?: string;
  triggerLabel?: string;
  listLabel?: string;
  closeLabel?: string;
};

export function VisitedPostsMinimap({
  mode = 'default',
  label = DEFAULT_HISTORY_LABEL,
  title,
  triggerLabel = DEFAULT_TRIGGER_LABEL,
  listLabel = DEFAULT_LIST_LABEL,
  closeLabel = DEFAULT_CLOSE_LABEL,
}: VisitedPostsMinimapProps = {}) {
  const { items, storageAvailable } = useVisitedPostsState();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);
  const [view, setView] = useState<'list' | 'graph'>('list');
  const [chatSessions, setChatSessions] = useState<ChatSessionLite[]>([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const isMobile = useIsMobile();
  const listContainerRef = useRef<HTMLElement | null>(null);

  const topStack = useMemo(() => items.slice(0, 4), [items]);
  const externalTrigger = mode === 'fab';
  const safeHistoryLabel = normalizeMinimapLine(label) ?? DEFAULT_HISTORY_LABEL;
  const safeTitle = normalizeOptionalMinimapText(title);
  const safeTriggerLabel = normalizeMinimapLine(triggerLabel) ?? DEFAULT_TRIGGER_LABEL;
  const safeListLabel = normalizeMinimapLine(listLabel) ?? DEFAULT_LIST_LABEL;
  const safeCloseLabel = normalizeMinimapLine(closeLabel) ?? DEFAULT_CLOSE_LABEL;

  const go = (p: VisitedPostItem) => {
    setOpen(false);
    navigate(p.path);
  };

  const clearAll = () => {
    if (!storageAvailable) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      window.dispatchEvent(new CustomEvent('visitedposts:update'));
    } catch {
      void 0;
    }
  };

  useEffect(() => {
    const readSessions = () => {
      try {
        const parsed = loadSessionsIndex();
        if (!Array.isArray(parsed)) {
          storeSessionsIndex([]);
          setChatSessions([]);
          return;
        }
        const validSessions = parsed.flatMap(item => {
          const normalized = normalizeMinimapChatSession(item);
          return normalized ? [normalized] : [];
        });
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

  const sheetContent = (
    <SheetContent
      side={isMobile ? 'bottom' : 'right'}
      hideClose
      aria-label={safeHistoryLabel}
      className={cn(
        'p-0 bg-background/95',
        // Only apply backdrop-blur on desktop for performance
        !isMobile && 'backdrop-blur supports-[backdrop-filter]:backdrop-blur-lg',
        isMobile
          ? 'max-h-[75vh] rounded-t-[24px] border-x border-t border-border/60 shadow-[0_-18px_50px_rgba(15,23,42,0.18)]'
          : 'h-full w-[420px] border-l border-border/40'
      )}
      aria-describedby={undefined}
      title={safeTitle}
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
            <MapIcon aria-hidden='true' className='h-5 w-5 text-muted-foreground' />
            <SheetTitle className='text-base font-semibold'>
              방문 기록
            </SheetTitle>
            <span className='text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full'>
              {items.length}개
            </span>
            <SheetClose asChild>
              <button
                type='button'
                aria-label={safeCloseLabel}
                className='ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors'
              >
                <X aria-hidden='true' className='h-4 w-4' />
              </button>
            </SheetClose>
          </div>
          {/* Thumbnail stack row */}
          <div className='flex items-center gap-2 mt-3'>
            <div className='relative h-8 w-[100px]' aria-hidden>
              {topStack.map((p, i) => {
                const postTitle = normalizeVisitedPostTitle(p.title);

                return (
                  <div
                    key={p.path}
                    className='absolute top-0 h-8 w-8 overflow-hidden rounded-full ring-2 ring-background shadow'
                    style={{ left: i * 20 }}
                    title={postTitle}
                  >
                    {p.coverImage ? (
                      <OptimizedImage
                        src={p.coverImage}
                        alt=''
                        className='h-full w-full object-cover'
                      />
                    ) : (
                      <FallbackAvatar title={postTitle} />
                    )}
                  </div>
                );
              })}
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
              aria-pressed={view === 'list'}
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
              aria-pressed={view === 'graph'}
            >
              그래프
            </button>
          </div>
        </SheetHeader>
        {view === 'list' ? (
          <section
            ref={listContainerRef}
            tabIndex={-1}
            className={cn(
              'overflow-y-auto overscroll-contain px-4 pb-8 pt-4 focus:outline-none',
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
            aria-label={safeListLabel}
          >
            <ul className='space-y-2'>
              {items.map((p, idx) => {
                const postTitle = normalizeVisitedPostTitle(p.title);
                const postYear = normalizeVisitedPostPart(p.year);
                const postSlug = normalizeVisitedPostPart(p.slug);
                const postMeta = [postYear, postSlug].filter(Boolean).join('/') || 'unknown';

                return (
                  <li key={p.path}>
                    <button
                      type='button'
                      aria-label={`열기: ${postTitle}`}
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
                          <div
                            aria-hidden='true'
                            className='flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-primary/80 to-primary text-primary-foreground text-sm font-bold'
                          >
                            {postTitle.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className='min-w-0 flex-1'>
                        <div className='text-sm font-medium leading-snug text-left group-hover:text-primary line-clamp-2'>
                          {postTitle}
                        </div>
                        <div className='flex items-center gap-1.5 mt-1 text-xs text-muted-foreground'>
                          <Clock aria-hidden='true' className='h-3.5 w-3.5' />
                          <span>{postMeta}</span>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
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
          </section>
        ) : (
          <div className={cn(
            'overflow-y-auto overscroll-contain px-4 pb-8 pt-4 space-y-3',
            isMobile ? 'max-h-[calc(75vh-160px)]' : 'flex-1'
          )}>
            {items.map(p => {
              const postTitle = normalizeVisitedPostTitle(p.title);
              const postYear = normalizeVisitedPostPart(p.year);
              const postSlug = normalizeVisitedPostPart(p.slug);
              const postMeta = [postYear, postSlug].filter(Boolean).join('/') || 'unknown';
              const related = chatSessions.filter(s =>
                s.articleUrl && s.articleUrl.endsWith(p.path)
              );
              if (!related.length) return null;
              return (
                <div
                  key={p.path}
                  className='rounded-xl border bg-card/50 p-4 shadow-sm'
                >
                  <div className='text-sm font-semibold truncate'>{postTitle}</div>
                  <div className='text-xs text-muted-foreground mb-2'>
                    {postMeta}
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
                              {normalizeMinimapLine(s.title || s.articleTitle) ?? 'AI Chat 세션'}
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
                    const validSelectedSessionIds = selectedSessionIds.flatMap(
                      id => {
                        const normalized = normalizeMinimapSessionId(id);
                        return normalized ? [normalized] : [];
                      }
                    );
                    if (!validSelectedSessionIds.length) return;
                    try {
                      window.dispatchEvent(
                        new CustomEvent('aiChat:aggregateFromGraph', {
                          detail: { sessionIds: validSelectedSessionIds },
                        })
                      );
                    } catch {
                      void 0;
                    }
                  }}
                >
                  통합 질문하기
                </Button>
              </div>
            )}
          </div>
        )}
      </SheetContent>
  );

  if (externalTrigger) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        {sheetContent}
      </Sheet>
    );
  }

  return (
    <div className='fixed bottom-8 right-24 z-[var(--z-fab-bar)] select-none'>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type='button'
            aria-label={safeTriggerLabel}
            className='flex h-11 items-center gap-2 rounded-full bg-background/95 px-3 shadow-lg ring-1 ring-border/50 backdrop-blur hover:bg-muted/80 transition-colors'
          >
            <Clock aria-hidden='true' className='h-4 w-4 text-muted-foreground' />
            <span className='text-xs font-medium text-foreground tabular-nums'>
              {items.length}
            </span>
          </button>
        </SheetTrigger>
        {sheetContent}
      </Sheet>
    </div>
  );
}

export default VisitedPostsMinimap;
