import React, { useMemo, useState, useEffect } from 'react';
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
import { Sparkles, Loader2, X, Lightbulb, Layers, Link2, MessageCircle } from 'lucide-react';
import DebateRoom, { DebateTopic } from './DebateRoom';

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
  } catch {}
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

const ModeConfig: Record<Mode, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; description: string }> = {
  idle: { label: 'Idle', icon: Sparkles, color: 'text-muted-foreground', description: '' },
  sketch: { label: 'Sketch', icon: Lightbulb, color: 'text-amber-500 dark:text-amber-400', description: '감정과 핵심 포인트' },
  prism: { label: 'Prism', icon: Layers, color: 'text-violet-500 dark:text-violet-400', description: '다각도 분석' },
  chain: { label: 'Chain', icon: Link2, color: 'text-emerald-500 dark:text-emerald-400', description: '연쇄 질문' },
};

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

  return (
    <>
      <p className='mb-4 leading-relaxed inline-block w-full group/spark relative'>
        {children}
        {hasText && (
          <button
            type='button'
            title='AI로 문단 분석하기'
            aria-label='AI로 문단 분석하기'
            aria-expanded={open}
            onClick={() => setOpen(v => !v)}
            className={cn(
              'ml-2 inline-flex items-center justify-center rounded-full transition-all duration-200',
              'min-h-[36px] min-w-[36px] md:min-h-[28px] md:min-w-[28px]',
              'opacity-40 hover:opacity-100 group-hover/spark:opacity-70',
              'hover:bg-primary/10 hover:scale-110',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
              isTerminal && 'text-primary',
            )}
          >
            <Sparkles className={cn(
              'h-4 w-4 md:h-3.5 md:w-3.5',
              open && 'text-primary',
            )} />
          </button>
        )}
      </p>
      
      {open && (
        <div
          className={cn(
            '-mt-2 mb-6 overflow-hidden transition-all duration-300',
            // iOS-style card design
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
                const isActive = activeMode === mode && hasResult;
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
                      <Icon className={cn('h-3.5 w-3.5', isActive && config.color)} />
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
                'flex items-center gap-3 py-6 justify-center',
                isTerminal ? 'text-primary' : 'text-muted-foreground',
              )}>
                <Loader2 className='h-5 w-5 animate-spin' />
                <span className='text-sm'>
                  {activeModeConfig.label} 분석 중...
                </span>
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

            {/* Sketch Result - iOS Notes style */}
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
                    <Lightbulb className='h-3 w-3' />
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

            {/* Prism Result - Card grid style */}
            {prismRes && loading === 'idle' && (
              <div className='space-y-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300'>
                {prismRes.facets.map((f, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      'rounded-xl px-4 py-3 border',
                      isTerminal 
                        ? 'bg-primary/5 border-primary/20' 
                        : 'bg-violet-50/50 border-violet-200/50 dark:bg-violet-900/10 dark:border-violet-800/30',
                    )}
                  >
                    <div className={cn(
                      'font-medium text-sm mb-2 flex items-center gap-2',
                      isTerminal ? 'text-primary' : 'text-violet-700 dark:text-violet-300',
                    )}>
                      <Layers className='h-3.5 w-3.5' />
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
                            isTerminal ? 'bg-primary/40' : 'bg-violet-400/60',
                          )} />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                
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
                    'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all',
                    'hover:scale-[1.01] active:scale-[0.99]',
                    isTerminal 
                      ? 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20' 
                      : 'bg-violet-100/50 border-violet-300/50 text-violet-700 hover:bg-violet-100 dark:bg-violet-900/20 dark:border-violet-700/30 dark:text-violet-300 dark:hover:bg-violet-900/30',
                  )}
                >
                  <MessageCircle className='h-4 w-4' />
                  <span className='text-sm font-medium'>이 주제로 상담 시작하기</span>
                </button>
              </div>
            )}

            {/* Chain Result - Question cards */}
            {chainRes && loading === 'idle' && (
              <div className='space-y-2.5 animate-in fade-in-0 slide-in-from-bottom-2 duration-300'>
                {chainRes.questions.map((q, i) => (
                  <button 
                    key={i}
                    type='button'
                    onClick={() => {
                      // Start debate with this question as the topic
                      setDebateTopic({
                        title: q.q,
                        context: `${text}\n\n질문: ${q.q}${q.why ? `\n이유: ${q.why}` : ''}`,
                        originalParagraph: text,
                      });
                      setShowDebate(true);
                    }}
                    className={cn(
                      'w-full text-left rounded-xl px-4 py-3 border transition-all',
                      'hover:scale-[1.01] active:scale-[0.99]',
                      isTerminal 
                        ? 'bg-primary/5 border-primary/20 hover:bg-primary/10' 
                        : 'bg-emerald-50/50 border-emerald-200/50 dark:bg-emerald-900/10 dark:border-emerald-800/30 hover:bg-emerald-50 dark:hover:bg-emerald-900/20',
                    )}
                  >
                    <div className={cn(
                      'font-medium text-sm flex items-start gap-2',
                      isTerminal ? 'text-primary' : 'text-emerald-700 dark:text-emerald-300',
                    )}>
                      <Link2 className='h-3.5 w-3.5 mt-0.5 flex-shrink-0' />
                      <span>{q.q}</span>
                    </div>
                    {q.why && (
                      <p className='text-xs text-muted-foreground mt-1.5 ml-5'>
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
                  'flex items-center justify-center w-12 h-12 rounded-2xl mb-3',
                  isTerminal ? 'bg-primary/10' : 'bg-muted',
                )}>
                  <Sparkles className={cn(
                    'h-6 w-6',
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
      )}

      {/* Debate Room Modal - Portal to body to escape parent overflow constraints */}
      {showDebate && (debateTopic || prismRes) && createPortal(
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-200'>
          <div className='w-full max-w-lg animate-in zoom-in-95 slide-in-from-bottom-4 duration-300'>
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
