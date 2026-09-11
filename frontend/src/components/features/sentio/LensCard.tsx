import { useId, useState } from 'react';
import LensViewToggle from './LensViewToggle';
import './lens-reading.css';
import CardPaperView from '@/components/features/sentio/CardPaperView';
import LensEvidence, {
  type LensEvidenceProps,
} from '@/components/features/sentio/LensEvidence';
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
  evidence?: LensEvidenceProps;
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
  evidence,
  stacked = false,
  depth = 0,
  active = false,
  showEvidence,
  onToggleEvidence,
  onPointerMove,
  onPointerDown,
  onPointerUp,
}: LensCardProps) {
  const [question, setQuestion] = useState('');
  const safePersonaId = normalizePersonaId(card.personaId);
  const persona = PERSONA_STYLES[safePersonaId];
  const PersonaIcon = persona.icon;
  const [localEvidence, setLocalEvidence] = useState(false);
  const evidenceVisible = showEvidence ?? localEvidence;
  const viewId = useId();
  const toggleEvidence = () => {
    if (onToggleEvidence) onToggleEvidence();
    else {
      if (!evidenceVisible && !evidence?.state) evidence?.onGenerate();
      setLocalEvidence(!evidenceVisible);
    }
  };
  const cardId = normalizeKey(card.id, 'lens-card');
  const title = normalizeDisplayText(card.title, 'Lens card');
  const summary = normalizeDisplayText(card.summary, title);
  const bullets = normalizeTextList(card.bullets, 8);
  const tags = normalizeTextList(card.tags, 8);
  const controls = active && exploration && (
    <CardExploration
      {...exploration}
      composer={{ value: question, onChange: setQuestion }}
    />
  );

  const personaBadge = (
    <span className={cn('fn-lens-persona sentio-lens-persona', persona.badge)}>
      <PersonaIcon className='h-3.5 w-3.5' />
      {persona.label}
    </span>
  );
  const overview = (allPoints: boolean) => (
    <>
      <p className='sentio-lens-summary'>{summary}</p>
      {!!bullets.length && (
        <ul className='sentio-lens-points'>
          {(allPoints ? bullets : bullets.slice(0, 4)).map((bullet, index) => (
            <li key={`${cardId}-${index}`}>{bullet}</li>
          ))}
        </ul>
      )}
      {!!tags.length && (
        <div className='sentio-thought-tags'>
          {(allPoints ? tags : tags.slice(0, 4)).map((tag, index) => (
            <span key={`${tag}-${index}`}>{tag}</span>
          ))}
        </div>
      )}
    </>
  );
  const evidenceContent = evidence ? (
    <LensEvidence {...evidence} />
  ) : (
    <p>현재 AI 분석을 사용할 수 없습니다.</p>
  );
  return (
    <article
      onPointerDown={event => {
        if (!event.currentTarget.contains(event.target as Node)) return;
        if (!(event.target as HTMLElement).closest('button, input, a'))
          onPointerDown?.(event);
      }}
      onPointerMove={event => {
        if (event.currentTarget.contains(event.target as Node))
          onPointerMove?.(event);
      }}
      onPointerUp={event => {
        if (event.currentTarget.contains(event.target as Node))
          onPointerUp?.(event);
      }}
      aria-hidden={stacked || undefined}
      data-card-id={card.id}
      className={cn(
        'sentio-lens sentio-lens-reading not-prose relative flex h-[36rem] flex-col rounded-2xl border',
        persona.shell,
        stacked && 'absolute inset-0 pointer-events-none',
        stacked && depth === 1 && 'translate-y-3 scale-[0.97] opacity-70',
        stacked && depth === 2 && 'translate-y-6 scale-[0.94] opacity-45'
      )}
    >
      <header className='sentio-lens-heading'>
        <div className='sentio-lens-meta'>
          {personaBadge}
          {active && !stacked && !exploration?.state && (
            <LensViewToggle
              showEvidence={evidenceVisible}
              onToggle={toggleEvidence}
              controls={`${viewId}-card`}
            />
          )}
        </div>
        <h3>{title}</h3>
      </header>
      <div
        id={`${viewId}-card`}
        className='sentio-lens-view'
        aria-label={evidenceVisible ? '분석 근거' : '분석 요점'}
      >
        {exploration?.state ? (
          <CardExplorationBody state={exploration.state} />
        ) : (
          <>
            <div hidden={evidenceVisible}>{overview(false)}</div>
            <div hidden={!evidenceVisible}>
              {evidenceVisible && evidenceContent}
            </div>
          </>
        )}
      </div>
      {active && !stacked && (
        <div className='sentio-lens-paper-action'>
          <CardPaperView
            title={title}
            eyebrow='다각도 분석'
            meta={
              <>
                {personaBadge}
                {!exploration?.state && (
                  <LensViewToggle
                    showEvidence={evidenceVisible}
                    onToggle={toggleEvidence}
                    controls={`${viewId}-paper`}
                  />
                )}
              </>
            }
          >
            <div
              id={`${viewId}-paper`}
              aria-label={evidenceVisible ? '분석 근거' : '분석 요점'}
            >
              {exploration?.state ? (
                <CardExplorationBody state={exploration.state} />
              ) : (
                <>
                  <div hidden={evidenceVisible}>{overview(true)}</div>
                  <div hidden={!evidenceVisible}>
                    {evidenceVisible && evidenceContent}
                  </div>
                </>
              )}
            </div>
            {controls}
          </CardPaperView>
        </div>
      )}
      {controls}
    </article>
  );
}
