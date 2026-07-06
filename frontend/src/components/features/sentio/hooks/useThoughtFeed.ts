import { useCallback, useEffect, useRef, useState } from 'react';
import {
  invokeChatTask,
  invokeThoughtFeed,
  type ThoughtCard as ThoughtCardData,
} from '@/services/chat';
import { FALLBACK_DATA } from '@/config/defaults';
import {
  DEFAULT_WARMING_RETRY_DELAYS_MS,
  getAsyncArtifactStatus,
  shouldPersistAsyncArtifactSource,
  useWarmingRetry,
  type AsyncArtifactStatus,
  type AsyncArtifactSource,
} from './useAsyncArtifact';

export type ThoughtFeedSource = AsyncArtifactSource;

type UseThoughtFeedOptions = {
  paragraph: string;
  postTitle?: string;
  cacheKey: string;
  enabled: boolean;
  onReady?: (cards: ThoughtCardData[], source: ThoughtFeedSource) => void;
};

type ThoughtCursor = {
  seed: string;
  page: number;
  seenKeys: string[];
} | null;

type CachedThoughtFeed = {
  cards: ThoughtCardData[];
  exhausted: boolean;
  source: ThoughtFeedSource;
  nextCursor: ThoughtCursor;
};

type ChainQuestion = {
  q: string;
  why: string;
};

type ChainTaskData = {
  questions?: ChainQuestion[];
};

type UseThoughtFeedResult = {
  cards: ThoughtCardData[];
  loading: boolean;
  loadingMore: boolean;
  appendWarming: boolean;
  exhausted: boolean;
  status: AsyncArtifactStatus;
  source: ThoughtFeedSource | null;
  loadMore: () => Promise<void>;
};
const CONTROL_TEXT_PATTERN = /[\u0000-\u001F\u007F]+/g;
const COLLAPSED_WHITESPACE_PATTERN = /\s+/g;

function normalizeDisplayText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value
    .replace(CONTROL_TEXT_PATTERN, ' ')
    .replace(COLLAPSED_WHITESPACE_PATTERN, ' ')
    .trim();
  return normalized || fallback;
}

function normalizeCardKey(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value
    .trim()
    .replace(CONTROL_TEXT_PATTERN, '-')
    .replace(/[|/\\\s]+/g, '-')
    .replace(/[^A-Za-z0-9:_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 96);
  return normalized || fallback;
}

function normalizeThoughtCursor(value: unknown): ThoughtCursor {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<NonNullable<ThoughtCursor>>;
  const seed = normalizeCardKey(raw.seed, '');
  const page =
    typeof raw.page === 'number' && Number.isFinite(raw.page)
      ? Math.max(0, Math.trunc(raw.page))
      : 0;
  const seenKeys = Array.isArray(raw.seenKeys)
    ? raw.seenKeys
        .map((key, index) => normalizeCardKey(key, `seen-${index + 1}`))
        .filter(Boolean)
        .slice(0, 100)
    : [];
  return seed ? { seed, page, seenKeys } : null;
}

function normalizeThoughtCard(card: unknown, index: number): ThoughtCardData | null {
  if (!card || typeof card !== 'object') return null;
  const raw = card as Partial<ThoughtCardData>;
  const fallbackKey = `thought-${index + 1}`;
  const trackKey = normalizeCardKey(raw.trackKey ?? raw.id, fallbackKey);
  const id = normalizeCardKey(raw.id ?? trackKey, trackKey);
  const title = normalizeDisplayText(raw.title, `Thought ${index + 1}`);
  const body = normalizeDisplayText(raw.body, title);
  const bullets = Array.isArray(raw.bullets)
    ? raw.bullets
        .map((bullet) => normalizeDisplayText(bullet))
        .filter(Boolean)
        .slice(0, 8)
    : [];
  const tags = Array.isArray(raw.tags)
    ? raw.tags
        .map((tag) => normalizeDisplayText(tag).toLowerCase())
        .filter(Boolean)
        .slice(0, 8)
    : [];

  return {
    ...raw,
    id,
    trackKey,
    title,
    subtitle: normalizeDisplayText(raw.subtitle),
    body,
    bullets,
    tags,
  } as ThoughtCardData;
}

function normalizeThoughtCards(cards: unknown): ThoughtCardData[] {
  if (!Array.isArray(cards)) return [];
  return cards.flatMap((card, index) => {
    const normalized = normalizeThoughtCard(card, index);
    return normalized ? [normalized] : [];
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function mapChainQuestionsToThoughts(
  questions: ReadonlyArray<{ q: string; why: string }>,
  sourceTag: 'feed' | 'fallback'
): ThoughtCardData[] {
  return questions.map((question, index) => ({
    id: `${sourceTag === 'fallback' ? 'fallback' : 'task'}-thought-${index + 1}`,
    trackKey: `${sourceTag === 'fallback' ? 'fallback' : 'task'}-thought-${index + 1}`,
    title: question.q,
    subtitle: sourceTag === 'fallback' ? '질문 흐름 fallback' : '질문 흐름',
    body: question.why || question.q,
    bullets: [
      question.q,
      question.why || '이 질문을 한 단계 더 밀어보세요.',
      '카드 흐름 안에서 이 생각을 바로 이어갈 수 있습니다.',
    ],
    tags: [sourceTag, 'chain'],
  }));
}

function isFallbackTaskResponse(raw: unknown): boolean {
  return Boolean(
    raw &&
      typeof raw === 'object' &&
      '_fallback' in raw &&
      raw._fallback === true
  );
}

function normalizeChainQuestions(data: ChainTaskData | null): ChainQuestion[] {
  if (!data || !Array.isArray(data.questions)) return [];
  return data.questions
    .map(question => ({
      q: normalizeDisplayText(question.q),
      why: normalizeDisplayText(question.why),
    }))
    .filter(question => question.q);
}

async function loadThoughtCardsViaTask({
  paragraph,
  postTitle,
  signal,
}: {
  paragraph: string;
  postTitle?: string;
  signal: AbortSignal;
}): Promise<ThoughtCardData[]> {
  const result = await invokeChatTask<ChainTaskData>({
    mode: 'chain',
    payload: { paragraph, postTitle },
    signal,
  });

  if (isFallbackTaskResponse(result.raw)) {
    throw new Error('Chain task returned fallback data');
  }

  const questions = normalizeChainQuestions(result.data);
  if (questions.length === 0) {
    throw new Error('Chain task returned no questions');
  }

  return normalizeThoughtCards(mapChainQuestionsToThoughts(questions, 'feed'));
}

function mergeThoughtCards(
  previous: ThoughtCardData[],
  incoming: ThoughtCardData[]
): { items: ThoughtCardData[]; appendedCount: number } {
  const seen = new Set(previous.map(card => card.trackKey));
  const appended = incoming.filter(card => {
    const key = card.trackKey;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return {
    items: [...previous, ...appended],
    appendedCount: appended.length,
  };
}

function resolveResponseSource(
  response: { source?: string; warming?: boolean } | null | undefined
): Exclude<ThoughtFeedSource, 'fallback'> {
  if (response?.source === 'warming' || response?.warming === true) {
    return 'warming';
  }
  return 'feed';
}

function isWarmingResponse(
  response:
    | {
        source?: string;
        warming?: boolean;
      }
    | null
    | undefined
): boolean {
  return response?.warming === true || response?.source === 'warming';
}

export function useThoughtFeed({
  paragraph,
  postTitle,
  cacheKey,
  enabled,
  onReady,
}: UseThoughtFeedOptions): UseThoughtFeedResult {
  const [cards, setCards] = useState<ThoughtCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [appendWarming, setAppendWarming] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [source, setSource] = useState<ThoughtFeedSource | null>(null);

  const nextCursorRef = useRef<ThoughtCursor>(null);
  const readyKeyRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);
  const initialAbortRef = useRef<AbortController | null>(null);
  const loadMoreAbortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, CachedThoughtFeed>>(new Map());
  const activeCacheKeyRef = useRef<string | null>(null);
  const appendWarmingAttemptsRef = useRef(0);

  const cardsRef = useRef<ThoughtCardData[]>([]);
  const exhaustedRef = useRef(false);
  const sourceRef = useRef<ThoughtFeedSource | null>(null);
  const status = getAsyncArtifactStatus(source);

  const notifyReady = useCallback(
    (nextCards: ThoughtCardData[], nextSource: ThoughtFeedSource) => {
      if (!onReady || nextCards.length === 0) return;
      const key = `${cacheKey}:${nextSource}:${nextCards
        .slice(0, 6)
        .map(card => card.trackKey)
        .join('|')}`;
      if (readyKeyRef.current === key) return;
      readyKeyRef.current = key;
      onReady(nextCards, nextSource);
    },
    [cacheKey, onReady]
  );

  const cancelInFlight = useCallback(() => {
    requestIdRef.current += 1;
    initialAbortRef.current?.abort();
    loadMoreAbortRef.current?.abort();
    initialAbortRef.current = null;
    loadMoreAbortRef.current = null;
    appendWarmingAttemptsRef.current = 0;
    setAppendWarming(false);
  }, []);

  const resetState = useCallback(() => {
    setCards([]);
    setLoading(false);
    setLoadingMore(false);
    setAppendWarming(false);
    setExhausted(false);
    setSource(null);
    nextCursorRef.current = null;
    appendWarmingAttemptsRef.current = 0;
  }, []);

  const persistCache = useCallback(
    (overrides: Partial<CachedThoughtFeed> = {}) => {
      const currentKey = activeCacheKeyRef.current;
      const nextSource = overrides.source ?? sourceRef.current;
      if (!currentKey || !shouldPersistAsyncArtifactSource(nextSource)) return;

      cacheRef.current.set(currentKey, {
        cards: overrides.cards ?? cardsRef.current,
        exhausted: overrides.exhausted ?? exhaustedRef.current,
        source: nextSource,
        nextCursor: overrides.nextCursor ?? nextCursorRef.current,
      });
    },
    []
  );

  const hydrateCache = useCallback(
    (cached: CachedThoughtFeed) => {
      setCards(cached.cards);
      setLoading(false);
      setLoadingMore(false);
      setExhausted(cached.exhausted);
      setSource(cached.source);
      nextCursorRef.current = cached.nextCursor;
      notifyReady(cached.cards, cached.source);
    },
    [notifyReady]
  );

  useEffect(() => {
    cardsRef.current = cards;
    exhaustedRef.current = exhausted;
    sourceRef.current = source;
    persistCache();
  }, [cards, exhausted, persistCache, source]);

  const applyFallbackCards = useCallback(() => {
    const mapped = normalizeThoughtCards(mapChainQuestionsToThoughts(
      FALLBACK_DATA.CHAIN.QUESTIONS,
      'fallback'
    ));
    setCards(mapped);
    setAppendWarming(false);
    setExhausted(true);
    setSource('fallback');
    nextCursorRef.current = null;
    appendWarmingAttemptsRef.current = 0;
    notifyReady(mapped, 'fallback');
  }, [notifyReady]);

  const loadInitial = useCallback(
    async (warmingRetry = false) => {
      if (!paragraph.trim()) return;

      requestIdRef.current += 1;
      const requestId = requestIdRef.current;
      initialAbortRef.current?.abort();
      loadMoreAbortRef.current?.abort();
      const controller = new AbortController();
      initialAbortRef.current = controller;

      if (warmingRetry) {
        setLoading(cardsRef.current.length === 0);
      } else {
        setLoading(true);
        setLoadingMore(false);
        setAppendWarming(false);
        setCards([]);
        setExhausted(false);
        setSource(null);
        nextCursorRef.current = null;
        appendWarmingAttemptsRef.current = 0;
      }

      try {
        const response = await invokeThoughtFeed(
          {
            paragraph,
            postTitle,
            count: 4,
          },
          { signal: controller.signal }
        );
        if (requestId !== requestIdRef.current || controller.signal.aborted) {
          return;
        }

        const items = normalizeThoughtCards(response.items);
        const nextCursor = normalizeThoughtCursor(response.nextCursor);
        const responseSource = resolveResponseSource(response);
        if (responseSource === 'warming') {
          setCards(items);
          setExhausted(false);
          setSource('warming');
          nextCursorRef.current = nextCursor;
          return;
        }

        if (items.length === 0) {
          throw new Error('Empty thought feed');
        }

        setCards(items);
        setAppendWarming(false);
        setExhausted(response.exhausted === true);
        setSource('feed');
        nextCursorRef.current = nextCursor;
        appendWarmingAttemptsRef.current = 0;
        notifyReady(items, 'feed');
      } catch (error) {
        if (isAbortError(error) || requestId !== requestIdRef.current) {
          return;
        }

        if (warmingRetry && sourceRef.current === 'warming') {
          console.warn('[ThoughtFeed] warming refresh failed; retrying', error);
          return;
        }

        try {
          const mapped = await loadThoughtCardsViaTask({
            paragraph,
            postTitle,
            signal: controller.signal,
          });
          if (requestId !== requestIdRef.current || controller.signal.aborted) {
            return;
          }

          setCards(mapped);
          setAppendWarming(false);
          setExhausted(true);
          setSource('feed');
          nextCursorRef.current = null;
          appendWarmingAttemptsRef.current = 0;
          notifyReady(mapped, 'feed');
          return;
        } catch (taskError) {
          if (isAbortError(taskError) || controller.signal.aborted) {
            return;
          }
          console.warn(
            '[ThoughtFeed] thought-feed failed and task recovery failed, using local fallback cards',
            { feedError: error, taskError }
          );
        }

        applyFallbackCards();
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
        if (initialAbortRef.current === controller) {
          initialAbortRef.current = null;
        }
      }
    },
    [applyFallbackCards, notifyReady, paragraph, postTitle]
  );

  const recoverAfterWarmingExhausted = useCallback(async () => {
    if (!paragraph.trim()) {
      applyFallbackCards();
      return;
    }

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    initialAbortRef.current?.abort();
    const controller = new AbortController();
    initialAbortRef.current = controller;
    setLoading(cardsRef.current.length === 0);

    try {
      const mapped = await loadThoughtCardsViaTask({
        paragraph,
        postTitle,
        signal: controller.signal,
      });
      if (requestId !== requestIdRef.current || controller.signal.aborted) {
        return;
      }

      setCards(mapped);
      setAppendWarming(false);
      setExhausted(true);
      setSource('feed');
      nextCursorRef.current = null;
      appendWarmingAttemptsRef.current = 0;
      notifyReady(mapped, 'feed');
    } catch (error) {
      if (isAbortError(error) || controller.signal.aborted) {
        return;
      }
      console.warn(
        '[ThoughtFeed] warming exhausted; task recovery failed, using local fallback cards',
        error
      );
      if (requestId === requestIdRef.current) {
        applyFallbackCards();
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
      if (initialAbortRef.current === controller) {
        initialAbortRef.current = null;
      }
    }
  }, [applyFallbackCards, notifyReady, paragraph, postTitle]);

  const { reset: resetWarmingRetry } = useWarmingRetry({
    enabled:
      enabled &&
      Boolean(paragraph.trim()) &&
      (activeCacheKeyRef.current === cacheKey ||
        activeCacheKeyRef.current === null),
    status,
    onRetry: () => {
      if (activeCacheKeyRef.current !== cacheKey) return;
      void loadInitial(true);
    },
    onExhausted: () => {
      void recoverAfterWarmingExhausted();
    },
  });

  const loadMore = useCallback(async () => {
    if (
      loading ||
      loadingMore ||
      appendWarming ||
      exhausted ||
      source !== 'feed' ||
      !nextCursorRef.current
    ) {
      return;
    }

    const requestId = requestIdRef.current;
    const cursor = nextCursorRef.current;
    if (!cursor) return;

    loadMoreAbortRef.current?.abort();
    const controller = new AbortController();
    loadMoreAbortRef.current = controller;
    setLoadingMore(true);

    try {
      const response = await invokeThoughtFeed(
        {
          paragraph,
          postTitle,
          count: 4,
          cursor,
        },
        { signal: controller.signal }
      );
      if (requestId !== requestIdRef.current || controller.signal.aborted) {
        return;
      }

      const incoming = normalizeThoughtCards(response.items);
      const nextCursor = normalizeThoughtCursor(response.nextCursor);
      let appendedCount = 0;
      setCards(prev => {
        const merged = mergeThoughtCards(prev, incoming);
        appendedCount = merged.appendedCount;
        return merged.items;
      });

      if (incoming.length === 0 && isWarmingResponse(response)) {
        const nextAttempt = appendWarmingAttemptsRef.current + 1;
        const retryBudget = DEFAULT_WARMING_RETRY_DELAYS_MS.length;
        if (nextAttempt > retryBudget) {
          appendWarmingAttemptsRef.current = 0;
          setAppendWarming(false);
          setExhausted(true);
          nextCursorRef.current = null;
          persistCache({
            exhausted: true,
            source: 'feed',
            nextCursor: null,
          });
          return;
        }

        appendWarmingAttemptsRef.current = nextAttempt;
        setAppendWarming(true);
        setExhausted(false);
        nextCursorRef.current = nextCursor ?? cursor;
        persistCache({
          exhausted: false,
          source: 'feed',
          nextCursor: nextCursor ?? cursor,
        });
        return;
      }

      appendWarmingAttemptsRef.current = 0;
      setAppendWarming(false);
      const isExhausted =
        response.exhausted === true ||
        nextCursor == null ||
        incoming.length === 0 ||
        appendedCount === 0;
      setExhausted(isExhausted);
      nextCursorRef.current = isExhausted ? null : nextCursor;
    } catch (error) {
      if (isAbortError(error) || requestId !== requestIdRef.current) {
        return;
      }

      console.warn('[ThoughtFeed] thought-feed append failed', error);
      appendWarmingAttemptsRef.current = 0;
      setAppendWarming(false);
      setExhausted(true);
      nextCursorRef.current = null;
    } finally {
      if (requestId === requestIdRef.current) {
        setLoadingMore(false);
      }
      if (loadMoreAbortRef.current === controller) {
        loadMoreAbortRef.current = null;
      }
    }
  }, [
    appendWarming,
    exhausted,
    loading,
    loadingMore,
    paragraph,
    persistCache,
    postTitle,
    source,
  ]);

  useEffect(() => {
    if (!appendWarming || !enabled || source !== 'feed' || exhausted) return;

    const attempt = Math.max(1, appendWarmingAttemptsRef.current);
    const delay =
      DEFAULT_WARMING_RETRY_DELAYS_MS[
        Math.min(attempt - 1, DEFAULT_WARMING_RETRY_DELAYS_MS.length - 1)
      ] ?? 3000;
    const timer = window.setTimeout(() => {
      setAppendWarming(false);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [appendWarming, enabled, exhausted, source]);

  useEffect(() => {
    if (!paragraph.trim()) {
      readyKeyRef.current = null;
      activeCacheKeyRef.current = null;
      cancelInFlight();
      resetState();
      resetWarmingRetry();
      return;
    }

    if (activeCacheKeyRef.current === cacheKey) {
      return;
    }

    cancelInFlight();
    readyKeyRef.current = null;

    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      activeCacheKeyRef.current = cacheKey;
      hydrateCache(cached);
      return;
    }

    if (!enabled) {
      activeCacheKeyRef.current = null;
      resetState();
      resetWarmingRetry();
      return;
    }

    activeCacheKeyRef.current = cacheKey;
    void loadInitial();
  }, [
    cacheKey,
    cancelInFlight,
    enabled,
    hydrateCache,
    loadInitial,
    paragraph,
    resetState,
    resetWarmingRetry,
  ]);

  useEffect(() => {
    return () => {
      initialAbortRef.current?.abort();
      loadMoreAbortRef.current?.abort();
    };
  }, []);

  return {
    cards,
    loading,
    loadingMore,
    appendWarming,
    exhausted,
    status,
    source,
    loadMore,
  };
}

export default useThoughtFeed;
