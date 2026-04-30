import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  invokeChatTask,
  invokeLensFeed,
  type LensCard as LensCardData,
} from '@/services/chat';
import { FALLBACK_DATA } from '@/config/defaults';
import {
  getAsyncArtifactStatus,
  shouldPersistAsyncArtifactSource,
  useWarmingRetry,
  type AsyncArtifactStatus,
  type AsyncArtifactSource,
} from './useAsyncArtifact';

export type LensDeckSource = AsyncArtifactSource;

type UseLensDeckOptions = {
  paragraph: string;
  postTitle?: string;
  cacheKey: string;
  enabled: boolean;
  onReady?: (cards: LensCardData[], source: LensDeckSource) => void;
};

type UseLensDeckResult = {
  cards: LensCardData[];
  activeCard: LensCardData | null;
  currentIndex: number;
  loading: boolean;
  loadingMore: boolean;
  exhausted: boolean;
  status: AsyncArtifactStatus;
  source: LensDeckSource | null;
  canGoPrev: boolean;
  canGoNext: boolean;
  setCurrentIndex: (index: number) => void;
  goPrev: () => void;
  goNext: () => void;
};

type LensCursor = {
  seed: string;
  page: number;
  seenKeys: string[];
} | null;

type CachedLensDeck = {
  cards: LensCardData[];
  currentIndex: number;
  exhausted: boolean;
  source: LensDeckSource;
  nextCursor: LensCursor;
};

type PrismFacet = {
  title: string;
  points: string[];
};

type PrismTaskData = {
  facets?: PrismFacet[];
};

const PERSONA_BY_INDEX: LensCardData['personaId'][] = [
  'mentor',
  'explorer',
  'analyst',
  'debater',
];

function mapPrismFacetsToCards(
  paragraph: string,
  postTitle: string | undefined,
  facets: ReadonlyArray<{
    title: string;
    points: ReadonlyArray<string>;
  }>,
  sourceTag: 'feed' | 'fallback'
): LensCardData[] {
  const seed = `${postTitle || 'post'}-${paragraph.slice(0, 24) || 'lens'}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return facets.map((facet, index) => {
    const angleKey = `${seed || 'lens'}-${index + 1}`;
    const bullets = facet.points.slice(0, 5);
    return {
      id: `${sourceTag === 'fallback' ? 'fallback-' : 'task-'}${angleKey}`,
      personaId: PERSONA_BY_INDEX[index % PERSONA_BY_INDEX.length],
      angleKey,
      title: facet.title,
      summary: bullets[0] || facet.title,
      bullets,
      detail: [facet.title, ...facet.points].join('\n\n'),
      tags: [sourceTag, 'prism'],
    };
  });
}

function isFallbackTaskResponse(raw: unknown): boolean {
  return Boolean(
    raw &&
    typeof raw === 'object' &&
    '_fallback' in raw &&
    raw._fallback === true
  );
}

function normalizePrismFacets(data: PrismTaskData | null): PrismFacet[] {
  if (!data || !Array.isArray(data.facets)) return [];
  return data.facets
    .map(facet => ({
      title: typeof facet.title === 'string' ? facet.title.trim() : '',
      points: Array.isArray(facet.points)
        ? facet.points
            .filter((point): point is string => typeof point === 'string')
            .map(point => point.trim())
            .filter(Boolean)
        : [],
    }))
    .filter(facet => facet.title && facet.points.length > 0);
}

async function loadLensCardsViaTask({
  paragraph,
  postTitle,
  signal,
}: {
  paragraph: string;
  postTitle?: string;
  signal: AbortSignal;
}): Promise<LensCardData[]> {
  const result = await invokeChatTask<PrismTaskData>({
    mode: 'prism',
    payload: { paragraph, postTitle },
    signal,
  });

  if (isFallbackTaskResponse(result.raw)) {
    throw new Error('Prism task returned fallback data');
  }

  const facets = normalizePrismFacets(result.data);
  if (facets.length === 0) {
    throw new Error('Prism task returned no facets');
  }

  return mapPrismFacetsToCards(paragraph, postTitle, facets, 'feed');
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function mergeCards(
  previous: LensCardData[],
  incoming: LensCardData[]
): { items: LensCardData[]; appendedCount: number } {
  const seen = new Set(previous.map(card => card.angleKey));
  const appended = incoming.filter(card => {
    const key = card.angleKey;
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
): Exclude<LensDeckSource, 'fallback'> {
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

export function useLensDeck({
  paragraph,
  postTitle,
  cacheKey,
  enabled,
  onReady,
}: UseLensDeckOptions): UseLensDeckResult {
  const [cards, setCards] = useState<LensCardData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [source, setSource] = useState<LensDeckSource | null>(null);

  const nextCursorRef = useRef<LensCursor>(null);
  const readyKeyRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);
  const initialAbortRef = useRef<AbortController | null>(null);
  const loadMoreAbortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, CachedLensDeck>>(new Map());
  const activeCacheKeyRef = useRef<string | null>(null);

  const cardsRef = useRef<LensCardData[]>([]);
  const currentIndexRef = useRef(0);
  const exhaustedRef = useRef(false);
  const sourceRef = useRef<LensDeckSource | null>(null);
  const status = useMemo(() => getAsyncArtifactStatus(source), [source]);

  const notifyReady = useCallback(
    (nextCards: LensCardData[], nextSource: LensDeckSource) => {
      if (!onReady || nextCards.length === 0) return;
      const key = `${cacheKey}:${nextSource}:${nextCards
        .slice(0, 4)
        .map(card => card.angleKey)
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
  }, []);

  const resetState = useCallback(() => {
    setCards([]);
    setCurrentIndex(0);
    setLoading(false);
    setLoadingMore(false);
    setExhausted(false);
    setSource(null);
    nextCursorRef.current = null;
  }, []);

  const persistCache = useCallback(
    (overrides: Partial<CachedLensDeck> = {}) => {
      const currentKey = activeCacheKeyRef.current;
      const nextSource = overrides.source ?? sourceRef.current;
      if (!currentKey || !shouldPersistAsyncArtifactSource(nextSource)) return;

      cacheRef.current.set(currentKey, {
        cards: overrides.cards ?? cardsRef.current,
        currentIndex: overrides.currentIndex ?? currentIndexRef.current,
        exhausted: overrides.exhausted ?? exhaustedRef.current,
        source: nextSource,
        nextCursor: overrides.nextCursor ?? nextCursorRef.current,
      });
    },
    []
  );

  const hydrateCache = useCallback(
    (cached: CachedLensDeck) => {
      setCards(cached.cards);
      setCurrentIndex(cached.currentIndex);
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
    currentIndexRef.current = currentIndex;
    exhaustedRef.current = exhausted;
    sourceRef.current = source;
    persistCache();
  }, [cards, currentIndex, exhausted, persistCache, source]);

  const applyFallbackCards = useCallback(() => {
    const mapped = mapPrismFacetsToCards(
      paragraph,
      postTitle,
      FALLBACK_DATA.PRISM.FACETS,
      'fallback'
    );
    setCards(mapped);
    setCurrentIndex(0);
    setExhausted(true);
    setSource('fallback');
    nextCursorRef.current = null;
    notifyReady(mapped, 'fallback');
  }, [notifyReady, paragraph, postTitle]);

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
        setCards([]);
        setCurrentIndex(0);
        setExhausted(false);
        setSource(null);
        nextCursorRef.current = null;
      }

      try {
        const response = await invokeLensFeed(
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

        const items = response.items ?? [];
        const responseSource = resolveResponseSource(response);
        if (responseSource === 'warming') {
          setCards(items);
          setCurrentIndex(0);
          setExhausted(false);
          setSource('warming');
          nextCursorRef.current = response.nextCursor;
          return;
        }

        if (items.length === 0) {
          throw new Error('Empty lens feed');
        }

        setCards(items);
        setCurrentIndex(0);
        setExhausted(response.exhausted);
        setSource('feed');
        nextCursorRef.current = response.nextCursor;
        notifyReady(items, 'feed');
      } catch (error) {
        if (isAbortError(error) || requestId !== requestIdRef.current) {
          return;
        }

        if (warmingRetry && sourceRef.current === 'warming') {
          console.warn('[PrismDeck] warming refresh failed; retrying', error);
          return;
        }

        try {
          const mapped = await loadLensCardsViaTask({
            paragraph,
            postTitle,
            signal: controller.signal,
          });
          if (requestId !== requestIdRef.current || controller.signal.aborted) {
            return;
          }

          setCards(mapped);
          setCurrentIndex(0);
          setExhausted(true);
          setSource('feed');
          nextCursorRef.current = null;
          notifyReady(mapped, 'feed');
          return;
        } catch (taskError) {
          if (isAbortError(taskError) || controller.signal.aborted) {
            return;
          }
          console.warn(
            '[PrismDeck] lens-feed failed and task recovery failed, using local fallback cards',
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
      const mapped = await loadLensCardsViaTask({
        paragraph,
        postTitle,
        signal: controller.signal,
      });
      if (requestId !== requestIdRef.current || controller.signal.aborted) {
        return;
      }

      setCards(mapped);
      setCurrentIndex(0);
      setExhausted(true);
      setSource('feed');
      nextCursorRef.current = null;
      notifyReady(mapped, 'feed');
    } catch (error) {
      if (isAbortError(error) || controller.signal.aborted) {
        return;
      }
      console.warn(
        '[PrismDeck] warming exhausted; task recovery failed, using local fallback cards',
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
      const response = await invokeLensFeed(
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

      const incoming = response.items ?? [];
      let appendedCount = 0;
      setCards(prev => {
        const merged = mergeCards(prev, incoming);
        appendedCount = merged.appendedCount;
        return merged.items;
      });

      if (incoming.length === 0 && isWarmingResponse(response)) {
        setExhausted(false);
        nextCursorRef.current = response.nextCursor ?? cursor;
        persistCache({
          exhausted: false,
          source: 'feed',
          nextCursor: response.nextCursor ?? cursor,
        });
        return;
      }

      const isExhausted =
        response.exhausted ||
        response.nextCursor == null ||
        incoming.length === 0 ||
        appendedCount === 0;
      setExhausted(isExhausted);
      nextCursorRef.current = isExhausted ? null : response.nextCursor;
    } catch (error) {
      if (isAbortError(error) || requestId !== requestIdRef.current) {
        return;
      }

      console.warn('[PrismDeck] lens-feed prefetch failed', error);
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
    exhausted,
    loading,
    loadingMore,
    paragraph,
    persistCache,
    postTitle,
    source,
  ]);

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

  useEffect(() => {
    if (!enabled || cards.length === 0 || source !== 'feed') return;
    const remaining = cards.length - currentIndex - 1;
    if (remaining <= 2) {
      void loadMore();
    }
  }, [cards.length, currentIndex, enabled, loadMore, source]);

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < cards.length - 1;

  const goPrev = useCallback(() => {
    setCurrentIndex(prev => Math.max(prev - 1, 0));
  }, []);

  const goNext = useCallback(() => {
    setCurrentIndex(prev => Math.min(prev + 1, Math.max(cards.length - 1, 0)));
  }, [cards.length]);

  const activeCard = useMemo(
    () => cards[currentIndex] ?? null,
    [cards, currentIndex]
  );

  return {
    cards,
    activeCard,
    currentIndex,
    loading,
    loadingMore,
    exhausted,
    status,
    source,
    canGoPrev,
    canGoNext,
    setCurrentIndex,
    goPrev,
    goNext,
  };
}

export default useLensDeck;
