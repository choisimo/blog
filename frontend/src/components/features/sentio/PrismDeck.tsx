import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import type { LensCard as LensCardData } from '@/services/chat';
import './sentio.css';
import LensCard from './LensCard';
import { useLensDeck, type LensDeckSource } from './hooks/useLensDeck';
import AsyncArtifactStatusChip from './AsyncArtifactStatusChip';

type PrismDeckProps = {
  paragraph: string;
  postTitle?: string;
  cacheKey: string;
  enabled: boolean;
  onReady?: (cards: LensCardData[], source: LensDeckSource) => void;
};

const CONTROL_TEXT_PATTERN = /[\u0000-\u001F\u007F]+/g;
const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const COLLAPSED_WHITESPACE_PATTERN = /\s+/g;

export function normalizePrismDeckText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(CONTROL_TEXT_PATTERN, ' ')
    .replace(COLLAPSED_WHITESPACE_PATTERN, ' ')
    .trim();
  return normalized || undefined;
}

function normalizeCacheKey(value: unknown): string {
  const normalized =
    typeof value === 'string'
      ? value
          .trim()
          .replace(ANSI_ESCAPE_PATTERN, '')
          .replace(CONTROL_TEXT_PATTERN, '-')
          .replace(/[|/\\\s]+/g, '-')
          .replace(/[^A-Za-z0-9:_-]+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 160)
      : '';
  return normalized || 'prism-deck';
}

export default function PrismDeck({
  paragraph,
  postTitle,
  cacheKey,
  enabled,
  onReady,
}: PrismDeckProps) {
  const safePostTitle = normalizePrismDeckText(postTitle);
  const safeCacheKey = normalizeCacheKey(cacheKey);
  const {
    cards,
    activeCard,
    currentIndex,
    loading,
    loadingMore,
    appendWarming,
    status,
    canGoPrev,
    canGoNext,
    goPrev,
    goNext,
  } = useLensDeck({
    paragraph,
    postTitle: safePostTitle,
    cacheKey: safeCacheKey,
    enabled,
    onReady,
  });
  const [showEvidence, setShowEvidence] = useState(false);
  const dragStartXRef = useRef<number | null>(null);
  const dragStartYRef = useRef<number | null>(null);
  const dragMovedRef = useRef(false);

  const visibleCards = useMemo(
    () => cards.slice(currentIndex, currentIndex + 3),
    [cards, currentIndex]
  );

  useEffect(() => {
    setShowEvidence(false);
  }, [activeCard?.id, safeCacheKey]);

  const handleGoPrev = useCallback(() => {
    setShowEvidence(false);
    dragMovedRef.current = false;
    goPrev();
  }, [goPrev]);

  const handleGoNext = useCallback(() => {
    setShowEvidence(false);
    dragMovedRef.current = false;
    goNext();
  }, [goNext]);

  const handleToggleEvidence = useCallback(() => {
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    setShowEvidence(prev => !prev);
  }, []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      dragStartXRef.current = event.clientX;
      dragStartYRef.current = event.clientY;
      dragMovedRef.current = false;
    },
    []
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (dragStartXRef.current == null || dragStartYRef.current == null)
        return;
      const deltaX = event.clientX - dragStartXRef.current;
      const deltaY = event.clientY - dragStartYRef.current;
      if (Math.abs(deltaX) > 12 || Math.abs(deltaY) > 12) {
        dragMovedRef.current = true;
      }
    },
    []
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (dragStartXRef.current == null || dragStartYRef.current == null)
        return;
      const deltaX = event.clientX - dragStartXRef.current;
      const deltaY = event.clientY - dragStartYRef.current;
      dragStartXRef.current = null;
      dragStartYRef.current = null;

      if (Math.abs(deltaX) < 70 || Math.abs(deltaX) < Math.abs(deltaY)) return;
      dragMovedRef.current = true;
      if (deltaX < 0 && canGoNext) handleGoNext();
      if (deltaX > 0 && canGoPrev) handleGoPrev();
    },
    [canGoNext, canGoPrev, handleGoNext, handleGoPrev]
  );

  if (loading) {
    return (
      <div
        className='sentio-results sentio-loading flex flex-col items-center justify-center gap-3 px-6 py-10 text-center'
        role='status'
      >
        <div className='flex h-14 w-14 items-center justify-center rounded-2xl bg-ui-soft'>
          <Loader2 className='h-6 w-6 animate-spin text-ui-accent' />
        </div>
        <div>
          <p className='text-sm font-medium text-foreground'>
            다양한 관점을 살펴보고 있어요
          </p>
          <p className='text-xs text-muted-foreground'>
            문단의 주장과 근거를 정리하고 있습니다.
          </p>
        </div>
      </div>
    );
  }

  if (!activeCard) {
    if (status === 'warming') {
      return (
        <div
          className='sentio-results sentio-loading flex flex-col items-center justify-center gap-3 px-6 py-10 text-center'
          role='status'
        >
          <div className='flex h-14 w-14 items-center justify-center rounded-2xl bg-ui-soft'>
            <Loader2 className='h-6 w-6 animate-spin text-ui-accent' />
          </div>
          <div>
            <p className='text-sm font-medium text-foreground'>
              새로운 관점을 준비하고 있어요
            </p>
            <p className='text-xs text-muted-foreground'>
              분석이 준비되면 여기에 표시됩니다.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className='rounded-[2rem] border border-border/60 bg-muted/30 px-5 py-10 text-center text-sm text-muted-foreground'>
        아직 표시할 관점이 없습니다.
      </div>
    );
  }

  return (
    <>
      <div className='sentio-results not-prose space-y-4'>
        <div className='sentio-result-heading'>
          <div>
            <span className='sentio-result-label'>관점 탐색</span>
            <h4>하나의 문단, 서로 다른 시선</h4>
            <p>카드를 눌러 근거를 확인하고, 화살표로 다음 관점을 살펴보세요.</p>
          </div>
          <AsyncArtifactStatusChip
            status={status}
            labels={{
              warming: '분석 중',
              'fallback-hard': '기본 분석',
              error: '연결 오류',
            }}
          />
        </div>

        <div className='sentio-deck-stage'>
          {visibleCards
            .slice()
            .reverse()
            .map((card, reverseIndex, arr) => {
              const depth = arr.length - reverseIndex - 1;
              const isActive = depth === 0;
              return (
                <LensCard
                  key={card.id}
                  card={card}
                  stacked={!isActive}
                  depth={depth}
                  active={isActive}
                  showEvidence={isActive && showEvidence}
                  onToggleEvidence={isActive ? handleToggleEvidence : undefined}
                  onPointerDown={isActive ? handlePointerDown : undefined}
                  onPointerMove={isActive ? handlePointerMove : undefined}
                  onPointerUp={isActive ? handlePointerUp : undefined}
                />
              );
            })}
        </div>

        <div className='sentio-deck-nav'>
          <button
            type='button'
            onClick={handleGoPrev}
            disabled={!canGoPrev}
            className='sentio-icon-button'
            aria-label='이전 관점'
          >
            <ArrowLeft className='h-4 w-4' />
          </button>

          <div className='sentio-deck-position'>
            <span aria-live='polite'>
              관점 {currentIndex + 1} <span aria-hidden='true'>/</span>{' '}
              {cards.length}
            </span>
            <progress
              className='sentio-deck-progress'
              value={currentIndex + 1}
              max={cards.length}
              aria-label='관점 탐색 진행'
            />
          </div>

          <button
            type='button'
            onClick={handleGoNext}
            disabled={!canGoNext}
            className='sentio-icon-button'
            aria-label='다음 관점'
          >
            {(loadingMore || appendWarming) && !canGoNext ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              <ArrowRight className='h-4 w-4' />
            )}
          </button>
        </div>
      </div>
    </>
  );
}
