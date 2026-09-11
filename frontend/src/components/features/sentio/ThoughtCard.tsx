import { isStructuredResponseText } from '@blog/shared/runtime/structured-response';
import { useLayoutEffect, useRef, useState } from 'react';
import CardPaperView from '@/components/features/sentio/CardPaperView';
import './sentio.css';
import CardExploration, {
  CardExplorationBody,
  type CardExplorationProps,
} from './CardExploration';
import type { ThoughtCard as ThoughtCardData } from '@/services/chat';

type ThoughtCardProps = {
  card: ThoughtCardData;
  index: number;
  exploration?: CardExplorationProps;
  readingPath?: boolean;
};

const CONTROL_TEXT_PATTERN = /[\u0000-\u001F\u007F]+/g;
const COLLAPSED_WHITESPACE_PATTERN = /\s+/g;

function normalizeDisplayText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string' || isStructuredResponseText(value)) return fallback;
  const normalized = value
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

export default function ThoughtCard({
  card,
  index,
  exploration,
  readingPath = false,
}: ThoughtCardProps) {
  const [question, setQuestion] = useState('');
  const frameRef = useRef<HTMLElement>(null);
  const originalHeight = useRef<number>();
  useLayoutEffect(() => {
    if (!exploration?.state && frameRef.current) {
      const height = frameRef.current.getBoundingClientRect().height;
      if (height > 0) originalHeight.current = height;
    }
  });
  const safeIndex = Number.isFinite(index) ? Math.max(0, Math.trunc(index)) : 0;
  const cardId = normalizeKey(card.id, `thought-${safeIndex + 1}`);
  const topicLabel = normalizeDisplayText(card.trackKey, cardId).replace(
    /[-_]+/g,
    ' '
  );
  const title = normalizeDisplayText(card.title, `Thought ${safeIndex + 1}`);
  const rawSubtitle = normalizeDisplayText(card.subtitle);
  const subtitle =
    readingPath && /질문 흐름 fallback/i.test(rawSubtitle)
      ? '이 문단에서 시작하는 질문'
      : rawSubtitle;
  const body = normalizeDisplayText(card.body, title);
  const bullets = normalizeTextList(card.bullets, 5).filter(
    bullet =>
      !readingPath ||
      (bullet !== title &&
        bullet !== body &&
        bullet !== '카드 흐름 안에서 이 생각을 바로 이어갈 수 있습니다.')
  );
  const tags = normalizeTextList(card.tags, 8).filter(
    tag =>
      !readingPath ||
      !['fallback', 'chain', 'task', 'feed'].includes(tag.toLowerCase())
  );

  const renderContent = (showTitle: boolean) =>
    exploration?.state ? (
      <CardExplorationBody state={exploration.state} />
    ) : (
      <>
        {showTitle && <h3>{title}</h3>}
        {subtitle && <p className='sentio-thought-subtitle'>{subtitle}</p>}
        <p className='sentio-thought-body'>{body}</p>
        {bullets.length > 0 && (
          <ul>
            {bullets.map((bullet, bulletIndex) => (
              <li key={`${cardId}-${bulletIndex}`}>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        )}
        {tags.length > 0 && (
          <div className='sentio-thought-tags'>
            {tags.map((tag, tagIndex) => (
              <span key={`${tag}-${tagIndex}`}>{tag}</span>
            ))}
          </div>
        )}
      </>
    );
  const controls = exploration && (
    <CardExploration
      {...exploration}
      composer={{ value: question, onChange: setQuestion }}
    />
  );

  return (
    <article
      ref={frameRef}
      className='sentio-thought not-prose'
      data-card-id={card.id}
      style={{
        minHeight: exploration?.state ? originalHeight.current : undefined,
      }}
    >
      <div className='sentio-thought-header'>
        <span
          className='sentio-thought-number'
          aria-label={`질문 ${safeIndex + 1}`}
        >
          {String(safeIndex + 1).padStart(2, '0')}
        </span>
        {!readingPath && (
          <span className='sentio-thought-topic'>{topicLabel}</span>
        )}
        <CardPaperView title={title} eyebrow='더 생각해보기'>
          {renderContent(false)}
          {controls}
        </CardPaperView>
      </div>
      {renderContent(true)}
      {controls}
    </article>
  );
}
