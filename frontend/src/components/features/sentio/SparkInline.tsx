import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { sketch, SketchResult } from '@/services/discovery/ai';
import type {
  LensCard as LensFeedCard,
  ThoughtCard as ThoughtFeedCard,
} from '@/services/chat';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import {
  Sparkles,
  Loader2,
  X,
  Lightbulb,
  Layers,
  Link2,
  ArrowUpRight,
  Check,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import useLanguage from '@/hooks/i18n/useLanguage';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import PrismDeck from './PrismDeck';
import ThoughtFeed from './ThoughtFeed';
import CardPaperView from '@/components/features/sentio/CardPaperView';
import ReadingSummary from '@/components/features/sentio/ReadingSummary';
import './sentio.css';
import './reading-panel.css';
import ModeReveal from './ModeReveal';

const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const CONTROL_TEXT_PATTERN = /[\u0000-\u001F\u007F]+/g;
const COLLAPSED_WHITESPACE_PATTERN = /\s+/g;

export function normalizeDisplayText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value
    .replace(ANSI_ESCAPE_PATTERN, ' ')
    .replace(CONTROL_TEXT_PATTERN, ' ')
    .replace(COLLAPSED_WHITESPACE_PATTERN, ' ')
    .trim();
  return normalized || fallback;
}

function normalizeTextList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => normalizeDisplayText(item))
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeSketchResult(result: SketchResult): SketchResult {
  return {
    ...result,
    mood: normalizeDisplayText(result.mood, '정보적'),
    bullets: normalizeTextList(result.bullets, 8),
  };
}

// Minimal telemetry to localStorage for future learning
function logEvent(event: Record<string, unknown>) {
  try {
    const key = 'aiMemo.events';
    const prev = JSON.parse(localStorage.getItem(key) || '[]');
    prev.push({ t: Date.now(), ...event });
    localStorage.setItem(key, JSON.stringify(prev.slice(-500))); // cap
  } catch {
    void 0;
  }
}

function emitAiMemoLog(detail: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent('aiMemo:log', {
        detail,
      })
    );
  } catch {
    void 0;
  }
}

function extractText(children: React.ReactNode): string {
  const parts: string[] = [];
  const walk = (node: React.ReactNode) => {
    if (node == null || node === false) return;
    if (typeof node === 'string' || typeof node === 'number') {
      parts.push(String(node));
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (React.isValidElement(node)) {
      walk(node.props.children);
    }
  };
  walk(children);
  return normalizeDisplayText(parts.join(' '));
}

const INLINE_ONLY_TAGS = new Set([
  'a',
  'abbr',
  'b',
  'br',
  'cite',
  'code',
  'del',
  'em',
  'i',
  'kbd',
  'mark',
  'q',
  's',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'time',
  'u',
  'var',
  'wbr',
]);

function hasNonInlineChildren(children: React.ReactNode): boolean {
  return React.Children.toArray(children).some(node => {
    if (node == null) return false;
    if (typeof node === 'string' || typeof node === 'number') return false;
    if (Array.isArray(node)) return hasNonInlineChildren(node);
    if (!React.isValidElement(node)) return false;

    const props = (node.props as { children?: React.ReactNode }) ?? {};

    if (node.type === React.Fragment) {
      return hasNonInlineChildren(props.children);
    }

    if (typeof node.type === 'string') {
      if (!INLINE_ONLY_TAGS.has(node.type)) {
        return true;
      }
      return hasNonInlineChildren(props.children);
    }

    return true;
  });
}

type Mode = 'idle' | 'sketch' | 'prism' | 'chain';
type FeedSource = 'feed' | 'warming' | 'fallback';
type LoadedModes = Record<Exclude<Mode, 'idle'>, boolean>;

function createInitialLoadedModes(): LoadedModes {
  return {
    sketch: false,
    prism: false,
    chain: false,
  };
}

const ModeConfig: Record<
  Mode,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  idle: {
    label: 'AI 분석',
    icon: Sparkles,
  },
  sketch: {
    label: '핵심 파악',
    icon: Lightbulb,
  },
  prism: {
    label: '다각도 분석',
    icon: Layers,
  },
  chain: {
    label: '더 생각해보기',
    icon: Link2,
  },
};

// Mood emoji mapping
const MOOD_EMOJI: Record<string, string> = {
  설명적: '📖',
  분석적: '🔍',
  정보적: '💡',
  교육적: '🎓',
  흥미로운: '✨',
  흥미: '✨',
  호기심: '🤔',
  탐구적: '🧭',
  비판적: '⚡',
  논쟁적: '🔥',
  도전적: '💪',
  철학적: '🌀',
  서사적: '📜',
  감성적: '💫',
  실용적: '🔧',
  창의적: '🎨',
};

function getMoodEmoji(mood: string): string {
  for (const [key, emoji] of Object.entries(MOOD_EMOJI)) {
    if (mood.includes(key)) return emoji;
  }
  return '💡';
}

function formatSketchResult(res: SketchResult): string {
  const safeResult = normalizeSketchResult(res);
  const bullets = safeResult.bullets.map(b => `- ${b}`).join('\n');
  return [`**Mood:** ${safeResult.mood}`, '', bullets].join('\n');
}

function formatLensFeedResult(cards: LensFeedCard[]): string {
  return cards
    .slice(0, 4)
    .map(
      (card, index) =>
        `### ${index + 1}. ${normalizeDisplayText(card.title, `Lens ${index + 1}`)}\n- ${normalizeDisplayText(card.summary)}\n${normalizeTextList(
          card.bullets,
          3
        )
          .map(bullet => `- ${bullet}`)
          .join('\n')}`
    )
    .join('\n\n');
}

function formatThoughtFeedResult(cards: ThoughtFeedCard[]): string {
  return cards
    .slice(0, 6)
    .map(
      card =>
        `- **${normalizeDisplayText(card.title)}**${normalizeDisplayText(card.subtitle) ? ` — ${normalizeDisplayText(card.subtitle)}` : ''}`
    )
    .join('\n');
}

export default function SparkInline({
  children,
  postTitle,
  wrapperTag,
  label,
  title,
  triggerLabel,
  triggerTitle,
}: {
  children: React.ReactNode;
  postTitle?: string;
  wrapperTag?: 'p' | 'div';
  label?: string;
  title?: string;
  triggerLabel?: string;
  triggerTitle?: string;
}) {
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const expandedModesRef = useRef<HTMLDivElement>(null);
  const compactModesRef = useRef<HTMLDivElement>(null);
  const focusModeRef = useRef<Mode | null>(null);
  const [compact, setCompact] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<Mode>('idle');
  const [error, setError] = useState<string | null>(null);
  const [sketchRes, setSketchRes] = useState<SketchResult | null>(null);
  const [activeMode, setActiveMode] = useState<Mode>('idle');
  const [loadedModes, setLoadedModes] = useState<LoadedModes>(
    createInitialLoadedModes
  );
  const { isTerminal } = useTheme();
  const { language } = useLanguage();

  const text = useMemo(() => extractText(children), [children]);
  const safePostTitle = useMemo(
    () => normalizeDisplayText(postTitle),
    [postTitle]
  );
  const safeWrapperLabel = useMemo(() => normalizeDisplayText(label), [label]);
  const safeWrapperTitle = useMemo(() => normalizeDisplayText(title), [title]);
  const hasText = text && text.length > 0;
  const contentKey = useMemo(
    () => `${safePostTitle ?? ''}::${text}`,
    [safePostTitle, text]
  );
  const contentKeyRef = useRef(contentKey);
  const ContentTag: 'p' | 'div' =
    wrapperTag ?? (hasNonInlineChildren(children) ? 'div' : 'p');

  useEffect(() => {
    contentKeyRef.current = contentKey;
    setOpen(false);
    setLoading('idle');
    setError(null);
    setSketchRes(null);
    setActiveMode('idle');
    setCompact(false);
    focusModeRef.current = null;
    setLoadedModes(createInitialLoadedModes());
  }, [contentKey]);

  useLayoutEffect(() => {
    if (expandedModesRef.current) expandedModesRef.current.inert = compact;
    if (compactModesRef.current) compactModesRef.current.inert = !compact;
    if (!focusModeRef.current) return;
    const region = compact ? compactModesRef.current : expandedModesRef.current;
    region
      ?.querySelector<HTMLButtonElement>(
        `[data-mode="${focusModeRef.current}"]`
      )
      ?.focus({ preventScroll: true });
    focusModeRef.current = null;
  }, [compact, activeMode]);

  const openMode = useCallback(
    async (mode: Exclude<Mode, 'idle'>) => {
      if (!hasText) return;

      setOpen(true);
      setError(null);
      setActiveMode(mode);
      if (!compact) focusModeRef.current = mode;
      setCompact(true);

      if (mode === 'sketch') {
        if (loadedModes.sketch || sketchRes || loading === 'sketch') {
          return;
        }

        setLoading('sketch');
        const requestContentKey = contentKey;

        try {
          const res = await sketch({
            paragraph: text,
            postTitle: safePostTitle,
          });
          if (contentKeyRef.current !== requestContentKey) return;

          const safeResult = normalizeSketchResult(res);
          setSketchRes(safeResult);
          setLoadedModes(prev =>
            prev.sketch ? prev : { ...prev, sketch: true }
          );
          logEvent({ type: 'sketch', len: text.length });
          emitAiMemoLog({
            type: 'ai_qna',
            mode: 'sketch',
            question: text,
            answer: formatSketchResult(safeResult),
            postTitle: safePostTitle,
          });
        } catch (e: unknown) {
          if (contentKeyRef.current !== requestContentKey) return;
          const msg = e instanceof Error ? e.message : 'AI 호출 실패';
          setError(normalizeDisplayText(msg, 'AI 호출 실패'));
        } finally {
          if (contentKeyRef.current === requestContentKey) {
            setLoading('idle');
          }
        }

        return;
      }

      if (!loadedModes[mode]) {
        logEvent({
          type: mode === 'prism' ? 'lens_feed' : 'thought_feed',
          len: text.length,
        });
        setLoadedModes(prev => (prev[mode] ? prev : { ...prev, [mode]: true }));
      }
    },
    [
      compact,
      contentKey,
      hasText,
      loadedModes,
      loading,
      safePostTitle,
      sketchRes,
      text,
    ]
  );

  const tooltipLabel = normalizeDisplayText(
    triggerTitle,
    language === 'ko' ? 'AI 설명 보기' : 'View AI explanation'
  );
  const actionLabel = normalizeDisplayText(
    triggerLabel,
    language === 'ko' ? 'AI로 문단 분석하기' : 'Analyze paragraph with AI'
  );
  const handleLensReady = useCallback(
    (cards: LensFeedCard[], source: FeedSource) => {
      emitAiMemoLog({
        type: 'ai_qna',
        mode: 'lens_feed',
        question: text,
        answer: formatLensFeedResult(cards),
        postTitle: safePostTitle,
        source,
      });
    },
    [safePostTitle, text]
  );
  const handleThoughtReady = useCallback(
    (cards: ThoughtFeedCard[], source: FeedSource) => {
      emitAiMemoLog({
        type: 'ai_qna',
        mode: 'thought_feed',
        question: text,
        answer: formatThoughtFeedResult(cards),
        postTitle: safePostTitle,
        source,
      });
    },
    [safePostTitle, text]
  );

  return (
    <>
      <ContentTag
        className='mb-4 leading-relaxed inline-block w-full group/spark relative'
        data-spark-inline-wrapper={ContentTag}
        aria-label={safeWrapperLabel || undefined}
        title={safeWrapperTitle || undefined}
      >
        {children}
        {hasText && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type='button'
                title={tooltipLabel}
                aria-label={actionLabel}
                ref={triggerRef}
                aria-controls={panelId}
                aria-expanded={open}
                onClick={() => setOpen(v => !v)}
                className={cn(
                  'sentio-trigger ml-2 inline-flex items-center justify-center rounded-full transition-transform duration-200 motion-reduce:transition-none',
                  'min-h-11 min-w-11',
                  'opacity-50 hover:opacity-100 group-hover/spark:opacity-80',
                  'hover:bg-primary/10 hover:scale-110',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  isTerminal && 'text-primary'
                )}
              >
                <Sparkles
                  className={cn(
                    'h-4 w-4 md:h-3.5 md:w-3.5',
                    open && 'text-primary'
                  )}
                />
                <span className='sr-only'>{actionLabel}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side='top'>{tooltipLabel}</TooltipContent>
          </Tooltip>
        )}
      </ContentTag>

      <div
        id={panelId}
        hidden={!open}
        className='sentio-panel sentio-reading-panel not-prose'
        data-mode={activeMode}
        data-compact={compact}
        role='region'
        aria-label='AI 분석 패널'
        onKeyDown={event => {
          if (event.key === 'Escape' && !event.nativeEvent.isComposing) {
            event.stopPropagation();
            setOpen(false);
            triggerRef.current?.focus();
          }
        }}
      >
        <div className='sentio-panel-header'>
          <div className='sentio-panel-heading'>
            <span className='sentio-heading-icon'>
              <Sparkles aria-hidden='true' size={18} />
            </span>
            <div>
              <p className='sentio-eyebrow'>AI와 함께 읽기</p>
            </div>
          </div>
          <button
            type='button'
            className='sentio-icon-button'
            onClick={() => {
              setOpen(false);
              triggerRef.current?.focus();
            }}
            aria-label='닫기'
          >
            <X aria-hidden='true' size={18} />
          </button>
        </div>

        <div
          className='sentio-expanded-modes'
          ref={expandedModesRef}
          aria-hidden={compact}
        >
          <div>
            <div
              id={`${panelId}-modes`}
              className='sentio-mode-grid'
              role='group'
              aria-label='분석 방식 선택'
            >
              {(['sketch', 'prism', 'chain'] as const).map(mode => {
                const config = ModeConfig[mode];
                const Icon = config.icon;
                const isActive = activeMode === mode;
                const isLoading = loading === mode;
                return (
                  <button
                    key={mode}
                    type='button'
                    className='sentio-mode-card'
                    data-mode={mode}
                    aria-pressed={isActive}
                    aria-controls={`${panelId}-result`}
                    onClick={() => void openMode(mode)}
                  >
                    <span className='sentio-mode-icon'>
                      <Icon aria-hidden='true' className='h-5 w-5' />
                    </span>
                    <span className='sentio-mode-copy'>
                      <span className='sentio-mode-title'>{config.label}</span>
                    </span>
                    <span className='sentio-mode-action' aria-hidden='true'>
                      {isLoading ? (
                        <Loader2 className='h-4 w-4 animate-spin motion-reduce:animate-none' />
                      ) : isActive ? (
                        <Check size={16} />
                      ) : (
                        <ArrowUpRight size={16} />
                      )}
                      <span>
                        {isLoading
                          ? '분석 중'
                          : isActive
                            ? '선택됨'
                            : '시작하기'}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div
          className='sentio-compact-modes'
          ref={compactModesRef}
          aria-hidden={!compact}
        >
          <div>
            <div
              className='sentio-compact-bar'
              role='group'
              aria-label='분석 방식 선택'
            >
              {(['sketch', 'prism', 'chain'] as const).map(mode => {
                const config = ModeConfig[mode];
                const Icon = config.icon;
                const selected = activeMode === mode;
                return (
                  <button
                    key={mode}
                    type='button'
                    className='sentio-compact-mode'
                    data-mode={mode}
                    aria-label={config.label}
                    title={config.label}
                    aria-pressed={selected}
                    aria-controls={`${panelId}-result`}
                    onClick={() => void openMode(mode)}
                  >
                    <Icon className='h-[18px] w-[18px]' aria-hidden='true' />
                    {selected && <span>{config.label}</span>}
                  </button>
                );
              })}
              <button
                type='button'
                className='sentio-icon-button sentio-expand-modes'
                aria-label='분석 방식 펼치기'
                title='분석 방식 펼치기'
                aria-expanded={!compact}
                aria-controls={`${panelId}-modes`}
                onClick={() => {
                  focusModeRef.current = activeMode;
                  setCompact(false);
                }}
              >
                <ChevronDown size={18} aria-hidden='true' />
              </button>
            </div>
          </div>
        </div>

        <div
          id={`${panelId}-result`}
          className='sentio-panel-content'
          hidden={activeMode === 'idle'}
        >
          <div hidden={activeMode !== 'sketch'}>
            <ModeReveal
              key={contentKey}
              active={open && activeMode === 'sketch'}
              pending={loading === 'sketch'}
              loader={
                <div
                  role='status'
                  className={cn(
                    'sentio-loading flex flex-col items-center gap-3 py-8 justify-center'
                  )}
                >
                  <div
                    className={cn(
                      'flex items-center justify-center w-12 h-12 rounded-2xl',
                      isTerminal ? 'bg-primary/10' : 'bg-muted'
                    )}
                  >
                    <Loader2
                      className={cn(
                        'h-6 w-6 animate-spin',
                        isTerminal ? 'text-primary' : 'text-muted-foreground'
                      )}
                    />
                  </div>
                  <div className='text-center'>
                    <p
                      className={cn(
                        'text-sm font-medium',
                        isTerminal ? 'text-primary' : 'text-foreground'
                      )}
                    >
                      {ModeConfig.sketch.label} 분석 중...
                    </p>
                  </div>
                </div>
              }
            >
              {/* Error state */}
              {error && (
                <div
                  role='alert'
                  className={cn(
                    'rounded-xl px-4 py-3 text-sm',
                    'bg-destructive/10 text-destructive border border-destructive/20'
                  )}
                >
                  <div className='flex items-center gap-2 font-medium'>
                    <AlertCircle aria-hidden='true' size={16} />
                    분석을 완료하지 못했습니다
                  </div>
                  <p className='mt-2'>{error}</p>
                  <button
                    type='button'
                    className='sentio-retry'
                    onClick={() => void openMode('sketch')}
                  >
                    다시 시도
                  </button>
                </div>
              )}

              {/* Sketch Result */}
              {sketchRes && loading === 'idle' && (
                <div className='space-y-4'>
                  {/* Mood badge */}
                  <div className='flex items-center gap-2'>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
                        isTerminal
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                      )}
                    >
                      <span
                        className='text-base mr-0.5'
                        role='img'
                        aria-label='mood'
                      >
                        {getMoodEmoji(sketchRes.mood)}
                      </span>
                      {sketchRes.mood}
                    </span>
                    <CardPaperView
                      title={ModeConfig.sketch.label}
                      eyebrow='문단 요약'
                      description={safePostTitle}
                      meta={
                        <span className='sentio-paper-mood'>
                          {sketchRes.mood}
                        </span>
                      }
                    >
                      <ReadingSummary points={sketchRes.bullets} />
                    </CardPaperView>
                  </div>

                  {/* Bullets */}
                  <ul className='space-y-2'>
                    {sketchRes.bullets.map((b, i) => (
                      <li
                        key={i}
                        className={cn(
                          'flex items-start gap-3 text-sm leading-relaxed',
                          isTerminal ? 'text-foreground/90' : 'text-foreground'
                        )}
                      >
                        <span
                          className={cn(
                            'flex-shrink-0 w-1.5 h-1.5 rounded-full mt-2',
                            isTerminal ? 'bg-primary/60' : 'bg-amber-500/60'
                          )}
                        />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </ModeReveal>
          </div>

          {/* Prism Result */}
          <div hidden={activeMode !== 'prism'}>
            {loadedModes.prism && (
              <PrismDeck
                paragraph={text}
                postTitle={safePostTitle}
                cacheKey={`${contentKey}:prism`}
                enabled={open && activeMode === 'prism'}
                onReady={handleLensReady}
              />
            )}
          </div>

          {/* Chain Result */}
          <div hidden={activeMode !== 'chain'}>
            {loadedModes.chain && (
              <ThoughtFeed
                paragraph={text}
                postTitle={safePostTitle}
                cacheKey={`${contentKey}:chain`}
                enabled={open && activeMode === 'chain'}
                onReady={handleThoughtReady}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
