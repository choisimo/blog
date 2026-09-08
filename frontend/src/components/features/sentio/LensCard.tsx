import { useRef } from 'react';
import { Compass, FlaskConical, MessageSquareQuote, Scale } from 'lucide-react';
import { cn } from '@/lib/utils';
import './sentio.css';
import CardExploration, {
  CardExplorationBody,
  type CardExplorationProps,
} from './CardExploration';
import type { LensCard as LensCardData } from '@/services/chat';

type LensCardProps = {
  card: LensCardData;
  exploration?: CardExplorationProps;
  stacked?: boolean;
  depth?: number;
  active?: boolean;
  showEvidence?: boolean;
  onToggleEvidence?: () => void;
  onPointerMove?: React.PointerEventHandler<HTMLElement>;
  onPointerDown?: React.PointerEventHandler<HTMLElement>;
  onPointerUp?: React.PointerEventHandler<HTMLElement>;
};

const PERSONA_STYLES: Record<
  LensCardData['personaId'],
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    shell: string;
    badge: string;
  }
> = {
  mentor: {
    label: 'Mentor',
    icon: MessageSquareQuote,
    shell: 'border-amber-300/60 bg-ui-surface dark:border-amber-400/30',
    badge:
      'bg-amber-50 text-amber-800 dark:bg-amber-400/10 dark:text-amber-200',
  },
  debater: {
    label: 'Debater',
    icon: Scale,
    shell: 'border-rose-300/60 bg-ui-surface dark:border-rose-400/30',
    badge: 'bg-rose-50 text-rose-800 dark:bg-rose-400/10 dark:text-rose-200',
  },
  explorer: {
    label: 'Explorer',
    icon: Compass,
    shell: 'border-sky-300/60 bg-ui-surface dark:border-sky-400/30',
    badge: 'bg-sky-50 text-sky-800 dark:bg-sky-400/10 dark:text-sky-200',
  },
  analyst: {
    label: 'Analyst',
    icon: FlaskConical,
    shell: 'border-emerald-300/60 bg-ui-surface dark:border-emerald-400/30',
    badge:
      'bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200',
  },
};
const DEFAULT_PERSONA_ID: LensCardData['personaId'] = 'mentor';
const CONTROL_TEXT_PATTERN = /[\u0000-\u001F\u007F]+/g;
const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const COLLAPSED_WHITESPACE_PATTERN = /\s+/g;

export function normalizeDisplayText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(CONTROL_TEXT_PATTERN, ' ')
    .replace(COLLAPSED_WHITESPACE_PATTERN, ' ')
    .trim();
  return normalized || fallback;
}

function normalizeKey(value: unknown, fallback: string): string {
  const normalized = normalizeDisplayText(value)
    .replace(/[|/\\\s]+/g, '-')
    .replace(/[^A-Za-z0-9:_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 96);
  return normalized || fallback;
}

function normalizeTextList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => normalizeDisplayText(item))
    .filter(Boolean)
    .slice(0, limit);
}

function normalizePersonaId(value: unknown): LensCardData['personaId'] {
  return typeof value === 'string' && value in PERSONA_STYLES
    ? (value as LensCardData['personaId'])
    : DEFAULT_PERSONA_ID;
}

export default function LensCard({
  card,
  exploration,
  stacked = false,
  depth = 0,
  active = false,
  showEvidence = false,
  onToggleEvidence,
  onPointerMove,
  onPointerDown,
  onPointerUp,
}: LensCardProps) {
  const safePersonaId = normalizePersonaId(card.personaId);
  const persona = PERSONA_STYLES[safePersonaId];
  const PersonaIcon = persona.icon;
  const interactionHint = showEvidence
    ? '클릭해 요점 보기'
    : '클릭해 근거 보기';
  const lensRef = useRef<HTMLElement>(null);
  const toggleEvidence = () => {
    onToggleEvidence?.();
    requestAnimationFrame(() => lensRef.current?.querySelector<HTMLButtonElement>('.sentio-evidence-toggle[tabindex="0"]')?.focus({ preventScroll: true }));
  };
  const cardId = normalizeKey(card.id, 'lens-card');
  const title = normalizeDisplayText(card.title, 'Lens card');
  const summary = normalizeDisplayText(card.summary, title);
  const detail = normalizeDisplayText(card.detail);
  const bullets = normalizeTextList(card.bullets, 8);
  const tags = normalizeTextList(card.tags, 8);

  return (
    <article
      ref={lensRef}
      onPointerDown={event => {
        if (!(event.target as HTMLElement).closest('button, input, a'))
          onPointerDown?.(event);
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      aria-hidden={stacked || undefined}
      data-card-id={card.id}
      className={cn(
        'sentio-lens not-prose relative flex h-[36rem] flex-col rounded-2xl border shadow-sm [perspective:1800px]',
        persona.shell,
        stacked && 'absolute inset-0 pointer-events-none',
        stacked && depth === 1 && 'translate-y-3 scale-[0.97] opacity-70',
        stacked && depth === 2 && 'translate-y-6 scale-[0.94] opacity-45'
      )}
    >
      <div className='relative min-h-0 flex-1'>
        {exploration?.state ? (
          <div className='sentio-lens-exploration-scroll'>
            <CardExplorationBody state={exploration.state} />
          </div>
        ) : (
          <div
            className={cn(
              'fn-lens-faces relative h-full w-full transition-transform duration-300 motion-reduce:transition-none [transform-style:preserve-3d]',
              active && showEvidence && '[transform:rotateY(180deg)]'
            )}
          >
            <div
              aria-hidden={showEvidence}
              className={cn(
                'fn-lens-face absolute inset-0 flex h-full flex-col overflow-hidden rounded-2xl px-5 py-5 [backface-visibility:hidden]',
                persona.shell,
                active && 'ring-1 ring-ui-line/20'
              )}
            >
              <div className='flex items-start justify-between gap-3'>
                <div className='min-w-0 space-y-2.5'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <span
                      className={cn(
                        'fn-lens-persona inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold',
                        persona.badge
                      )}
                    >
                      <PersonaIcon className='h-3.5 w-3.5' />
                      {persona.label}
                    </span>
                    {active && onToggleEvidence && (
                      <button
                        type='button'
                        className='sentio-evidence-toggle'
                        onClick={toggleEvidence}
                        aria-label={interactionHint}
                        aria-pressed={showEvidence}
                        tabIndex={showEvidence ? -1 : 0}
                      >
                        근거 보기
                      </button>
                    )}
                  </div>
                  <h3 className='max-w-full break-words text-[1.25rem] font-semibold leading-relaxed text-ui-text'>
                    {title}
                  </h3>
                </div>
              </div>

              <div className='fn-lens-prose mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1'>
                <div className='rounded-xl border border-ui-line/60 bg-ui-soft/50 px-3.5 py-3.5 shadow-sm'>
                  <p className='break-words text-sm leading-6 text-ui-text'>
                    {summary}
                  </p>
                </div>

                {bullets.length > 0 && (
                  <ul className='space-y-2.5'>
                    {bullets.slice(0, 4).map((bullet, index) => (
                      <li
                        key={`${cardId}-${index}`}
                        className='flex items-start gap-2.5'
                      >
                        <span className='mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ui-accent/60' />
                        <span className='break-words text-sm leading-6 text-ui-text'>
                          {bullet}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {tags.length > 0 && (
                  <div className='flex flex-wrap gap-2 pb-1'>
                    {tags.slice(0, 4).map((tag, tagIndex) => (
                      <span
                        key={`${tag}-${tagIndex}`}
                        className='rounded-full border border-ui-line bg-ui-soft/50 px-3 py-1 text-[11px] font-medium text-ui-muted'
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div
              aria-hidden={!showEvidence}
              className={cn(
                'fn-lens-face absolute inset-0 flex h-full flex-col overflow-hidden rounded-2xl px-5 py-5 [backface-visibility:hidden] [transform:rotateY(180deg)]',
                persona.shell,
                active && 'ring-1 ring-ui-line/20'
              )}
            >
              <div className='flex items-start justify-between gap-3'>
                <div className='min-w-0 space-y-2.5'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <span
                      className={cn(
                        'fn-lens-persona inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold',
                        persona.badge
                      )}
                    >
                      <PersonaIcon className='h-3.5 w-3.5' />
                      {persona.label}
                    </span>
                    <span className='rounded-full border border-ui-line bg-ui-soft/50 px-3 py-1 text-[10px] font-semibold text-ui-muted'>
                      분석 근거
                    </span>
                    {active && onToggleEvidence && (
                      <button
                        type='button'
                        className='sentio-evidence-toggle'
                        onClick={toggleEvidence}
                        aria-label={interactionHint}
                        aria-pressed={showEvidence}
                        tabIndex={showEvidence ? 0 : -1}
                      >
                        요점 보기
                      </button>
                    )}
                  </div>
                  <h3 className='break-words text-[1.2rem] font-semibold leading-relaxed text-ui-text'>
                    {title}
                  </h3>
                </div>
              </div>

              <div className='fn-lens-prose mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1'>
                {detail && (
                  <section className='space-y-2'>
                    <p className='text-[11px] font-semibold text-ui-muted'>
                      자세히 살펴보기
                    </p>
                    <div className='rounded-xl border border-ui-line/60 bg-ui-soft/50 px-3.5 py-3.5 text-sm leading-6 text-ui-text shadow-sm whitespace-pre-wrap'>
                      {detail}
                    </div>
                  </section>
                )}

                {bullets.length > 0 && (
                  <section className='space-y-2'>
                    <p className='text-[11px] font-semibold text-ui-muted'>
                      뒷받침하는 요점
                    </p>
                    <div className='space-y-2'>
                      {bullets.map((bullet, index) => (
                        <div
                          key={`${cardId}-evidence-${index}`}
                          className='rounded-xl border border-ui-line/60 bg-ui-soft/50 px-3.5 py-3 text-sm leading-6 text-ui-text shadow-sm'
                        >
                          {bullet}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {tags.length > 0 && (
                  <div className='flex flex-wrap gap-2 pb-1'>
                    {tags.slice(0, 4).map((tag, tagIndex) => (
                      <span
                        key={`${tag}-evidence-${tagIndex}`}
                        className='rounded-full border border-ui-line bg-ui-soft/50 px-3 py-1 text-[11px] font-medium text-ui-muted'
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      {active && exploration && <CardExploration {...exploration} />}
    </article>
  );
}
