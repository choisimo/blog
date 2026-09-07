import { useCallback, useEffect, useRef } from 'react';
import { Loader2, Milestone, Sparkles } from 'lucide-react';
import type { ThoughtCard as ThoughtCardData } from '@/services/chat';
import ThoughtCard from './ThoughtCard';
import { useThoughtFeed, type ThoughtFeedSource } from './hooks/useThoughtFeed';
import AsyncArtifactStatusChip from './AsyncArtifactStatusChip';
import './sentio.css';
import { useCardExploration } from './hooks/useCardExploration';

type ThoughtFeedProps = {
  paragraph: string;
  postTitle?: string;
  cacheKey: string;
  enabled: boolean;
  onReady?: (cards: ThoughtCardData[], source: ThoughtFeedSource) => void;
};

const CONTROL_TEXT_PATTERN = /[\u0000-\u001F\u007F]+/g;
const COLLAPSED_WHITESPACE_PATTERN = /\s+/g;

function normalizeDisplayText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value
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
          .replace(CONTROL_TEXT_PATTERN, '-')
          .replace(/[|/\\\s]+/g, '-')
          .replace(/[^A-Za-z0-9:_-]+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 160)
      : '';
  return normalized || 'thought-feed';
}

export default function ThoughtFeed({
  paragraph,
  postTitle,
  cacheKey,
  enabled,
  onReady,
}: ThoughtFeedProps) {
  const exploration = useCardExploration({
    scopeKey: `${cacheKey}::${paragraph}`,
    paragraph,
    postTitle,
    enabled,
  });
  const safePostTitle = normalizeDisplayText(postTitle);
  const safeCacheKey = normalizeCacheKey(cacheKey);
  const {
    cards,
    loading,
    loadingMore,
    appendWarming,
    exhausted,
    status,
    loadMore,
  } = useThoughtFeed({
    paragraph,
    postTitle: safePostTitle,
    cacheKey: safeCacheKey,
    enabled,
    onReady,
  });
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = scrollRef.current;
    const target = sentinelRef.current;
    if (!enabled || !root || !target || exhausted) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          void loadMore();
        }
      },
      {
        root,
        rootMargin: '0px 0px 220px 0px',
        threshold: 0.1,
      }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [cards.length, enabled, exhausted, loadMore]);

  const renderStatus = useCallback(() => {
    if (loadingMore || appendWarming) {
      return (
        <div className='sentio-feed-status' role='status'>
          <Loader2 className='h-3.5 w-3.5 animate-spin' />
          {appendWarming
            ? '다음 질문을 준비하고 있어요.'
            : '이어지는 질문을 불러오고 있어요.'}
        </div>
      );
    }

    if (exhausted) {
      return (
        <div className='sentio-feed-status' role='status'>
          <Sparkles className='h-3.5 w-3.5' />
          이어지는 질문을 모두 살펴봤어요.
        </div>
      );
    }

    return (
      <div className='sentio-feed-status' role='status'>
        <Milestone className='h-3.5 w-3.5' />
        아래로 내려 더 많은 질문을 살펴보세요.
      </div>
    );
  }, [appendWarming, exhausted, loadingMore]);

  if (loading) {
    return (
      <div
        className='sentio-results sentio-loading flex flex-col items-center justify-center gap-3 px-6 py-10 text-center'
        role='status'
      >
        <div className='flex h-14 w-14 items-center justify-center rounded-2xl bg-ui-soft'>
          <Loader2 className='h-6 w-6 animate-spin text-ui-success' />
        </div>
        <div>
          <p className='text-sm font-medium text-foreground'>
            생각을 넓힐 질문을 찾고 있어요
          </p>
          <p className='text-xs text-muted-foreground'>
            이 문단에서 이어지는 질문과 설명을 정리합니다.
          </p>
        </div>
      </div>
    );
  }

  if (cards.length === 0) {
    if (status === 'warming') {
      return (
        <div
          className='sentio-results sentio-loading flex flex-col items-center justify-center gap-3 px-6 py-10 text-center'
          role='status'
        >
          <div className='flex h-14 w-14 items-center justify-center rounded-2xl bg-ui-soft'>
            <Loader2 className='h-6 w-6 animate-spin text-ui-success' />
          </div>
          <div>
            <p className='text-sm font-medium text-foreground'>
              이어지는 질문을 준비하고 있어요
            </p>
            <p className='text-xs text-muted-foreground'>
              질문이 준비되면 여기에 표시됩니다.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className='rounded-[2rem] border border-border/60 bg-muted/30 px-5 py-10 text-center text-sm text-muted-foreground'>
        아직 표시할 질문이 없습니다.
      </div>
    );
  }

  return (
    <div className='sentio-results not-prose space-y-4' data-mode='chain'>
      <div className='sentio-result-heading'>
        <div>
          <span className='sentio-result-label'>생각의 흐름</span>
          <h4>질문에서 다음 질문으로</h4>
          <p>
            질문을 선택하면 같은 카드의 설명이 그 방향으로 실시간 갱신됩니다.
          </p>
        </div>
        <AsyncArtifactStatusChip
          status={status}
          labels={{
            warming: '질문 준비 중',
            'fallback-hard': '기본 질문',
            error: '연결 오류',
          }}
        />
      </div>

      <div
        ref={scrollRef}
        className='sentio-feed-scroll'
        tabIndex={0}
        role='region'
        aria-label='이어지는 질문'
      >
        {cards.map((card, index) => (
          <ThoughtCard
            key={card.id}
            card={card}
            index={index}
            exploration={{
              state: exploration.states[card.id],
              questions: (card.bullets ?? [])
                .filter(point => /[?？]|어떻게|무엇|왜/.test(point))
                .slice(0, 2).length
                ? (card.bullets ?? [])
                    .filter(point => /[?？]|어떻게|무엇|왜/.test(point))
                    .slice(0, 2)
                : [
                    '이 질문을 구체적인 사례로 풀어보면?',
                    '여기서 한 단계 더 나아가면 어떤 질문이 생길까?',
                  ],
              available: exploration.available,
              onExplore: question => {
                void exploration.explore(
                  {
                    id: card.id,
                    title: card.title,
                    body: [card.body, ...(card.bullets ?? [])].join('\n'),
                  },
                  question
                );
              },
              onStop: () => exploration.stop(card.id),
              onBack: () => exploration.back(card.id),
              onReset: () => exploration.reset(card.id),
            }}
          />
        ))}
        <div ref={sentinelRef} className='h-4 w-full' aria-hidden='true' />
      </div>

      {renderStatus()}
    </div>
  );
}
