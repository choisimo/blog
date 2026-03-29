import { useCallback, useEffect, useRef, useState } from "react";
import {
  invokeThoughtFeed,
  type ThoughtCard as ThoughtCardData,
} from "@/services/chat";
import { FALLBACK_DATA } from "@/config/defaults";
import {
  DEFAULT_WARMING_RETRY_DELAYS_MS,
  getAsyncArtifactStatus,
  shouldPersistAsyncArtifactSource,
  useWarmingRetry,
  type AsyncArtifactStatus,
  type AsyncArtifactSource,
} from "./useAsyncArtifact";

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

const APPEND_WARMING_RETRY_MS = DEFAULT_WARMING_RETRY_DELAYS_MS[1] ?? 3000;

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function mapChainFallbackToThoughts(
  questions: Array<{ q: string; why: string }>,
): ThoughtCardData[] {
  return questions.map((question, index) => ({
    id: `fallback-thought-${index + 1}`,
    trackKey: `fallback-thought-${index + 1}`,
    title: question.q,
    subtitle: "질문 흐름 fallback",
    body: question.why || question.q,
    bullets: [
      question.q,
      question.why || "이 질문을 한 단계 더 밀어보세요.",
      "카드 흐름 안에서 이 생각을 바로 이어갈 수 있습니다.",
    ],
    tags: ["fallback", "chain"],
  }));
}

function mergeThoughtCards(
  previous: ThoughtCardData[],
  incoming: ThoughtCardData[],
): { items: ThoughtCardData[]; appendedCount: number } {
  const seen = new Set(previous.map((card) => card.trackKey));
  const appended = incoming.filter((card) => {
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
  response: { source?: string; warming?: boolean } | null | undefined,
): Exclude<ThoughtFeedSource, "fallback"> {
  if (response?.source === "warming" || response?.warming === true) {
    return "warming";
  }
  return "feed";
}

function isWarmingResponse(
  response:
    | {
        source?: string;
        warming?: boolean;
      }
    | null
    | undefined,
): boolean {
  return response?.warming === true || response?.source === "warming";
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

  const cardsRef = useRef<ThoughtCardData[]>([]);
  const exhaustedRef = useRef(false);
  const sourceRef = useRef<ThoughtFeedSource | null>(null);
  const status = getAsyncArtifactStatus(source);

  const notifyReady = useCallback(
    (nextCards: ThoughtCardData[], nextSource: ThoughtFeedSource) => {
      if (!onReady || nextCards.length === 0) return;
      const key = `${cacheKey}:${nextSource}:${nextCards
        .slice(0, 6)
        .map((card) => card.trackKey)
        .join("|")}`;
      if (readyKeyRef.current === key) return;
      readyKeyRef.current = key;
      onReady(nextCards, nextSource);
    },
    [cacheKey, onReady],
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
    setLoading(false);
    setLoadingMore(false);
    setAppendWarming(false);
    setExhausted(false);
    setSource(null);
    nextCursorRef.current = null;
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
    [],
  );

  const hydrateCache = useCallback(
    (cached: CachedThoughtFeed) => {
      setCards(cached.cards);
      setLoading(false);
      setLoadingMore(false);
      setAppendWarming(false);
      setExhausted(cached.exhausted);
      setSource(cached.source);
      nextCursorRef.current = cached.nextCursor;
      notifyReady(cached.cards, cached.source);
    },
    [notifyReady],
  );

  useEffect(() => {
    cardsRef.current = cards;
    exhaustedRef.current = exhausted;
    sourceRef.current = source;
    persistCache();
  }, [cards, exhausted, persistCache, source]);

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
      }

      try {
        const response = await invokeThoughtFeed(
          {
            paragraph,
            postTitle,
            count: 4,
          },
          { signal: controller.signal },
        );
        if (requestId !== requestIdRef.current || controller.signal.aborted) {
          return;
        }

        const items = response.items ?? [];
        const responseSource = resolveResponseSource(response);
        if (responseSource === "warming") {
          setAppendWarming(false);
          setCards(items);
          setExhausted(Boolean(response.exhausted));
          setSource("warming");
          nextCursorRef.current = response.nextCursor;
          return;
        }

        if (items.length === 0) {
          throw new Error("Empty thought feed");
        }

        setAppendWarming(false);
        setCards(items);
        setExhausted(response.exhausted);
        setSource("feed");
        nextCursorRef.current = response.nextCursor;
        notifyReady(items, "feed");
      } catch (error) {
        if (isAbortError(error) || requestId !== requestIdRef.current) {
          return;
        }

        if (warmingRetry && sourceRef.current === "warming") {
          console.warn("[ThoughtFeed] warming refresh failed; retrying", error);
          return;
        }

        console.warn(
          "[ThoughtFeed] thought-feed failed, using local fallback cards",
          error,
        );
        const mapped = mapChainFallbackToThoughts(
          FALLBACK_DATA.CHAIN.QUESTIONS,
        );
        setAppendWarming(false);
        setCards(mapped);
        setExhausted(true);
        setSource("fallback");
        nextCursorRef.current = null;
        notifyReady(mapped, "fallback");
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
        if (initialAbortRef.current === controller) {
          initialAbortRef.current = null;
        }
      }
    },
    [notifyReady, paragraph, postTitle],
  );

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
      setAppendWarming(false);

      if (cardsRef.current.length > 0) {
        setSource("feed");
        setExhausted(nextCursorRef.current == null);
        notifyReady(cardsRef.current, "feed");
        return;
      }

      const mapped = mapChainFallbackToThoughts(FALLBACK_DATA.CHAIN.QUESTIONS);
      nextCursorRef.current = null;
      setCards(mapped);
      setExhausted(true);
      setSource("fallback");
      notifyReady(mapped, "fallback");
    },
  });

  const loadMore = useCallback(async () => {
    if (
      loading ||
      loadingMore ||
      appendWarming ||
      exhausted ||
      source !== "feed" ||
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
        { signal: controller.signal },
      );
      if (requestId !== requestIdRef.current || controller.signal.aborted) {
        return;
      }

      const incoming = response.items ?? [];
      let appendedCount = 0;
      setCards((prev) => {
        const merged = mergeThoughtCards(prev, incoming);
        appendedCount = merged.appendedCount;
        return merged.items;
      });

      if (incoming.length === 0 && isWarmingResponse(response)) {
        setAppendWarming(true);
        setExhausted(false);
        nextCursorRef.current = cursor;
        persistCache({
          exhausted: false,
          source: "feed",
          nextCursor: cursor,
        });
        return;
      }

      setAppendWarming(false);
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

      console.warn("[ThoughtFeed] thought-feed append failed", error);
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
    if (
      !appendWarming ||
      !enabled ||
      source !== "feed" ||
      exhausted ||
      !nextCursorRef.current
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      setAppendWarming(false);
    }, APPEND_WARMING_RETRY_MS);

    return () => {
      window.clearTimeout(timer);
    };
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
