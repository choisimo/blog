import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  sketch,
  prism,
  chain,
  SketchResult,
  PrismResult,
  ChainResult,
} from '@/services/ai';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { Sparkles, Loader2, X, Lightbulb, Layers, Link2, MessageCircle, ChevronRight } from 'lucide-react';
import DebateRoom, { DebateTopic } from './DebateRoom';
import useLanguage from '@/hooks/useLanguage';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

type Mode = 'idle' | 'sketch' | 'prism' | 'chain';

const ModeConfig: Record<Mode, { label: string; icon: React.ComponentType<{ className?: string }>; activeColor: string; description: string }> = {
  idle: { label: 'Idle', icon: Sparkles, activeColor: 'text-muted-foreground', description: '' },
  sketch: { label: 'Sketch', icon: Lightbulb, activeColor: 'text-amber-500 dark:text-amber-400', description: '감정과 핵심 포인트' },
  prism: { label: 'Prism', icon: Layers, activeColor: 'text-violet-500 dark:text-violet-400', description: '다각도 분석' },
  chain: { label: 'Chain', icon: Link2, activeColor: 'text-emerald-500 dark:text-emerald-400', description: '연쇄 질문' },
};

// Mood emoji mapping
const MOOD_EMOJI: Record<string, string> = {
  '설명적': '📖', '분석적': '🔍', '정보적': '💡', '교육적': '🎓',
  '흥미로운': '✨', '흥미': '✨', '호기심': '🤔', '탐구적': '🧭',
  '비판적': '⚡', '논쟁적': '🔥', '도전적': '💪', '철학적': '🌀',
  '서사적': '📜', '감성적': '💫', '실용적': '🔧', '창의적': '🎨',
};

function getMoodEmoji(mood: string): string {
  for (const [key, emoji] of Object.entries(MOOD_EMOJI)) {
    if (mood.includes(key)) return emoji;
  }
  return '💡';
}

// Prism facet accent colors (cycle by index)
const FACET_COLORS = [
  {
    bar: 'bg-violet-500',
    text: 'text-violet-700 dark:text-violet-300',
    bg: 'bg-violet-50/60 dark:bg-violet-900/15',
    border: 'border-violet-200/60 dark:border-violet-800/30',
    dot: 'bg-violet-400/60',
  },
  {
    bar: 'bg-blue-500',
    text: 'text-blue-700 dark:text-blue-300',
    bg: 'bg-blue-50/60 dark:bg-blue-900/15',
    border: 'border-blue-200/60 dark:border-blue-800/30',
    dot: 'bg-blue-400/60',
  },
  {
    bar: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-50/60 dark:bg-emerald-900/15',
    border: 'border-emerald-200/60 dark:border-emerald-800/30',
    dot: 'bg-emerald-400/60',
  },
  {
    bar: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-50/60 dark:bg-amber-900/15',
    border: 'border-amber-200/60 dark:border-amber-800/30',
    dot: 'bg-amber-400/60',
  },
];

function formatSketchResult(res: SketchResult): string {
  const bullets = res.bullets.map(b => `- ${b}`).join('\n');
  return [`**Mood:** ${res.mood}`, '', bullets].join('\n');
}

function formatPrismResult(res: PrismResult): string {
  return res.facets
    .map(f => `### ${f.title}\n${f.points.map(p => `- ${p}`).join('\n')}`)
    .join('\n\n');
}

function formatChainResult(res: ChainResult): string {
  return res.questions
    .map(q => `- **${q.q}**${q.why ? ` — ${q.why}` : ''}`)
    .join('\n');
}

export default function SparkInline({
  children,
  postTitle,
}: {
  children: React.ReactNode;
  postTitle?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<Mode>('idle');
  const [error, setError] = useState<string | null>(null);
  const [sketchRes, setSketchRes] = useState<SketchResult | null>(null);
  const [prismRes, setPrismRes] = useState<PrismResult | null>(null);
  const [chainRes, setChainRes] = useState<ChainResult | null>(null);
  const [activeMode, setActiveMode] = useState<Mode>('idle');
  const [showDebate, setShowDebate] = useState(false);
  const [debateTopic, setDebateTopic] = useState<DebateTopic | null>(null);
  const { isTerminal } = useTheme();
  const { language } = useLanguage();

  const text = useMemo(() => extractText(children), [children]);
  const hasText = text && text.length > 0;

  const run = async (which: Mode) => {
    if (!hasText) return;
    setOpen(true);
    setError(null);
    setLoading(which);
    setActiveMode(which);
    // clear previous
    setSketchRes(null);
    setPrismRes(null);
    setChainRes(null);
    try {
      if (which === 'sketch') {
        const res = await sketch({ paragraph: text, postTitle });
        setSketchRes(res);
        logEvent({ type: 'sketch', len: text.length });
        emitAiMemoLog({
          type: 'ai_qna',
          mode: 'sketch',
          question: text,
          answer: formatSketchResult(res),
          postTitle,
        });
      } else if (which === 'prism') {
        const res = await prism({ paragraph: text, postTitle });
        setPrismRes(res);
        logEvent({ type: 'prism', len: text.length });
        emitAiMemoLog({
          type: 'ai_qna',
          mode: 'prism',
          question: text,
          answer: formatPrismResult(res),
          postTitle,
        });
      } else if (which === 'chain') {
        const res = await chain({ paragraph: text, postTitle });
        setChainRes(res);
        logEvent({ type: 'chain', len: text.length });
        emitAiMemoLog({
          type: 'ai_qna',
          mode: 'chain',
          question: text,
          answer: formatChainResult(res),
          postTitle,
        });
      }
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : 'AI 호출 실패';
      setError(msg);
    } finally {
      setLoading('idle');
    }
  };

  const hasResult = sketchRes || prismRes || chainRes;
  const activeModeConfig = ModeConfig[activeMode];
  const tooltipLabel = language === 'ko' ? 'AI 설명 보기' : 'View AI explanation';
  const actionLabel = language === 'ko' ? 'AI로 문단 분석하기' : 'Analyze paragraph with AI';

  return (
    <>
      <p className='mb-4 leading-relaxed inline-block w-full group/spark relative'>
        {children}
        {hasText && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type='button'
                title={tooltipLabel}
                aria-label={tooltipLabel}
                aria-expanded={open}
                onClick={() => setOpen(v => !v)}
                className={cn(
                  'ml-2 inline-flex items-center justify-center rounded-full transition-all duration-200',
                  'min-h-[36px] min-w-[36px] md:min-h-[28px] md:min-w-[28px]',
                  'opacity-50 hover:opacity-100 group-hover/spark:opacity-80',
                  'hover:bg-primary/10 hover:scale-110',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  isTerminal && 'text-primary',
                )}
              >
                <Sparkles className={cn(
                  'h-4 w-4 md:h-3.5 md:w-3.5',
                  open && 'text-primary',
                )} />
                <span className='sr-only'>{actionLabel}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side='top'>
              {tooltipLabel}
            </TooltipContent>
          </Tooltip>
        )}
      </p>

      {/* Animated panel using CSS grid trick for smooth height transition */}
      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-300 ease-in-out',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
          '-mt-2 mb-6',
        )}
        aria-hidden={!open}
      >
        <div className='overflow-hidden'>
          <div
            className={cn(
              'rounded-2xl border shadow-sm',
              isTerminal
                ? 'bg-[hsl(var(--terminal-code-bg))] border-primary/20'
                : 'bg-card/80 backdrop-blur-sm border-border/60',
            )}
            role='region'
            aria-label='AI 분석 패널'
          >
            {/* Header with mode tabs */}
            <div className={cn(
              'flex items-center justify-between px-4 py-3 border-b',
              isTerminal ? 'border-primary/10 bg-primary/5' : 'border-border/40 bg-muted/30',
            )}>
              {/* Mode buttons - iOS segmented control style */}
              <div className={cn(
                'inline-flex rounded-xl p-1 gap-1',
                isTerminal ? 'bg-primary/10' : 'bg-muted/60',
              )}>
                {(['sketch', 'prism', 'chain'] as Mode[]).map((mode) => {
                  const config = ModeConfig[mode];
                  const Icon = config.icon;
                  const isActive = activeMode === mode && (hasResult !== null || loading === mode);
                  const isLoading = loading === mode;

                  return (
                    <button
                      key={mode}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                        'min-h-[32px] min-w-[70px] justify-center',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        isActive && !isTerminal && 'bg-background shadow-sm text-foreground',
                        isActive && isTerminal && 'bg-primary/20 text-primary shadow-sm',
                        !isActive && 'text-muted-foreground hover:text-foreground hover:bg-background/50',
                        isLoading && 'animate-pulse',
                      )}
                      disabled={loading !== 'idle'}
                      onClick={() => run(mode)}
                    >
                      {isLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Icon className={cn('h-3.5 w-3.5', isActive && config.activeColor)} />
                      )}
                      <span>{config.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Close button */}
              <button
                className={cn(
                  'flex items-center justify-center rounded-full transition-all duration-200',
                  'h-8 w-8 hover:bg-muted/80',
                  isTerminal && 'hover:bg-primary/10 text-primary/60 hover:text-primary',
                )}
                onClick={() => setOpen(false)}
                aria-label='닫기'
              >
                <X className='h-4 w-4' />
              </button>
            </div>

            {/* Content area */}
            <div className='px-4 py-4'>
              {/* Loading state */}
              {loading !== 'idle' && (
                <div className={cn(
                  'flex flex-col items-center gap-3 py-8 justify-center',
                )}>
                  <div className={cn(
                    'flex items-center justify-center w-12 h-12 rounded-2xl',
                    isTerminal ? 'bg-primary/10' : 'bg-muted',
                  )}>
                    <Loader2 className={cn(
                      'h-6 w-6 animate-spin',
                      isTerminal ? 'text-primary' : 'text-muted-foreground',
                    )} />
                  </div>
                  <div className='text-center'>
                    <p className={cn(
                      'text-sm font-medium',
                      isTerminal ? 'text-primary' : 'text-foreground',
                    )}>
                      {activeModeConfig.label} 분석 중...
                    </p>
                    <p className='text-xs text-muted-foreground mt-0.5'>잠시만 기다려 주세요...</p>
                  </div>
                </div>
              )}

              {/* Error state */}
              {error && (
                <div className={cn(
                  'rounded-xl px-4 py-3 text-sm',
                  'bg-destructive/10 text-destructive border border-destructive/20',
                )}>
                  {error}
                </div>
              )}

              {/* Sketch Result */}
              {sketchRes && loading === 'idle' && (
                <div className='space-y-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300'>
                  {/* Mood badge */}
                  <div className='flex items-center gap-2'>
                    <span className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
                      isTerminal
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
                    )}>
                      <span className='text-base mr-0.5' role='img' aria-label='mood'>{getMoodEmoji(sketchRes.mood)}</span>
                      {sketchRes.mood}
                    </span>
                  </div>

                  {/* Bullets */}
                  <ul className='space-y-2'>
                    {sketchRes.bullets.map((b, i) => (
                      <li
                        key={i}
                        className={cn(
                          'flex items-start gap-3 text-sm leading-relaxed',
                          isTerminal ? 'text-foreground/90' : 'text-foreground',
                        )}
                      >
                        <span className={cn(
                          'flex-shrink-0 w-1.5 h-1.5 rounded-full mt-2',
                          isTerminal ? 'bg-primary/60' : 'bg-amber-500/60',
                        )} />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Prism Result */}
              {prismRes && loading === 'idle' && (
                <div className='space-y-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300'>
                  {prismRes.facets.map((f, i) => {
                    const colors = FACET_COLORS[i % FACET_COLORS.length];
                    return (
                      <div
                        key={i}
                        className={cn(
                          'rounded-xl overflow-hidden border',
                          isTerminal
                            ? 'bg-primary/5 border-primary/20'
                            : `${colors.bg} ${colors.border}`,
                        )}
                      >
                        <div className='flex items-start gap-3 px-4 py-3'>
                          <div className={cn(
                            'w-1 self-stretch rounded-full shrink-0',
                            isTerminal ? 'bg-primary/50' : colors.bar,
                          )} />
                          <div className='flex-1 min-w-0'>
                            <div className={cn(
                              'font-medium text-sm mb-2',
                              isTerminal ? 'text-primary' : colors.text,
                            )}>
                              {f.title}
                            </div>
                            <ul className='space-y-1.5'>
                              {f.points.map((p, j) => (
                                <li
                                  key={j}
                                  className='flex items-start gap-2 text-sm leading-relaxed text-foreground/80'
                                >
                                  <span className={cn(
                                    'flex-shrink-0 w-1 h-1 rounded-full mt-2',
                                    isTerminal ? 'bg-primary/40' : colors.dot,
                                  )} />
                                  <span>{p}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Debate Button */}
                  <button
                    type='button'
                    onClick={() => {
                      setDebateTopic({
                        title: prismRes.facets[0]?.title || '다각도 분석',
                        context: text,
                        facets: prismRes.facets,
                        originalParagraph: text,
                      });
                      setShowDebate(true);
                    }}
                    className={cn(
                      'group w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all',
                      'hover:scale-[1.01] active:scale-[0.99]',
                      isTerminal
                        ? 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
                        : 'bg-violet-100/50 border-violet-300/50 text-violet-700 hover:bg-violet-100 dark:bg-violet-900/20 dark:border-violet-700/30 dark:text-violet-300 dark:hover:bg-violet-900/30',
                    )}
                  >
                    <MessageCircle className='h-4 w-4' />
                    <span className='text-sm font-medium flex-1 text-left'>이 주제로 상담 시작하기</span>
                    <ChevronRight className='h-4 w-4 transition-transform group-hover:translate-x-0.5' />
                  </button>
                </div>
              )}

              {/* Chain Result */}
              {chainRes && loading === 'idle' && (
                <div className='space-y-2.5 animate-in fade-in-0 slide-in-from-bottom-2 duration-300'>
                  {chainRes.questions.map((q, i) => (
                    <button
                      key={i}
                      type='button'
                      onClick={() => {
                        setDebateTopic({
                          title: q.q,
                          context: `${text}\n\n질문: ${q.q}${q.why ? `\n이유: ${q.why}` : ''}`,
                          originalParagraph: text,
                        });
                        setShowDebate(true);
                      }}
                      className={cn(
                        'w-full text-left rounded-xl px-4 py-3 border transition-all',
                        'hover:-translate-y-0.5 hover:shadow-sm active:scale-[0.99]',
                        isTerminal
                          ? 'bg-primary/5 border-primary/20 hover:bg-primary/10'
                          : 'bg-emerald-50/50 border-emerald-200/50 dark:bg-emerald-900/10 dark:border-emerald-800/30 hover:bg-emerald-50 dark:hover:bg-emerald-900/20',
                      )}
                    >
                      <div className={cn(
                        'font-medium text-sm flex items-start gap-2',
                        isTerminal ? 'text-primary' : 'text-emerald-700 dark:text-emerald-300',
                      )}>
                        <span className={cn(
                          'flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold mt-0.5',
                          isTerminal ? 'bg-primary/30 text-primary' : 'bg-emerald-500 text-white',
                        )}>
                          {i + 1}
                        </span>
                        <span>{q.q}</span>
                      </div>
                      {q.why && (
                        <p className='text-xs text-muted-foreground mt-1.5 ml-7'>
                          {q.why}
                        </p>
                      )}
                    </button>
                  ))}

                  {/* Debate prompt */}
                  <p className='text-xs text-center text-muted-foreground pt-2'>
                    질문을 클릭하여 AI와 상담을 시작하세요
                  </p>
                </div>
              )}

              {/* Empty state - when opened but no result yet */}
              {!hasResult && loading === 'idle' && !error && (
                <div className='py-8 flex flex-col items-center justify-center min-h-[180px]'>
                  <div className={cn(
                    'relative flex items-center justify-center w-14 h-14 rounded-2xl mb-4',
                    isTerminal ? 'bg-primary/10' : 'bg-muted',
                  )}>
                    <span className='absolute inset-0 rounded-2xl animate-ping opacity-20 bg-primary/40' />
                    <Sparkles className={cn(
                      'h-6 w-6 relative z-10',
                      isTerminal ? 'text-primary' : 'text-muted-foreground',
                    )} />
                  </div>
                  <p className='text-sm text-muted-foreground text-center'>
                    위 버튼을 눌러 AI 분석을 시작하세요
                  </p>
                  <div className='flex flex-wrap justify-center gap-4 mt-4 text-xs text-muted-foreground/70'>
                    <span><strong>Sketch</strong> - 핵심 포인트</span>
                    <span><strong>Prism</strong> - 다각도 분석</span>
                    <span><strong>Chain</strong> - 연쇄 질문</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Debate Room Modal - Portal to body to escape parent overflow constraints */}
      {showDebate && (debateTopic || prismRes) && createPortal(
        <div className='fixed inset-0 z-[var(--z-modal-overlay)] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-200'>
          <div className='w-full max-w-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300'>
            <DebateRoom
              topic={debateTopic || {
                title: prismRes?.facets[0]?.title || '다각도 분석',
                context: text,
                facets: prismRes?.facets,
                originalParagraph: text,
              }}
              postTitle={postTitle}
              onClose={() => {
                setShowDebate(false);
                setDebateTopic(null);
              }}
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
