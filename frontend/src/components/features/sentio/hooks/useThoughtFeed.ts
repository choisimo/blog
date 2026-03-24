import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  invokeThoughtFeed,
  type ThoughtCard as ThoughtCardData,
} from "@/services/chat";
import { chain } from "@/services/discovery/ai";

export type ThoughtFeedSource = "feed" | "fallback";

type UseThoughtFeedOptions = {
  paragraph: string;
  postTitle?: string;
  requestKey: number;
  onReady?: (cards: ThoughtCardData[], source: ThoughtFeedSource) => void;
};

type ThoughtCursor = {
  seed: string;
  page: number;
  seenKeys: string[];
} | null;

type UseThoughtFeedResult = {
  cards: ThoughtCardData[];
  loading: boolean;
  loadingMore: boolean;
  exhausted: boolean;
  source: ThoughtFeedSource | null;
  loadMore: () => Promise<void>;
};

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

export function useThoughtFeed({
  paragraph,
  postTitle,
  requestKey,
  onReady,
}: UseThoughtFeedOptions): UseThoughtFeedResult {
  const [cards, setCards] = useState<ThoughtCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [source, setSource] = useState<ThoughtFeedSource | null>(null);
  const nextCursorRef = useRef<ThoughtCursor>(null);
  const readyKeyRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);
  const initialAbortRef = useRef<AbortController | null>(null);
  const loadMoreAbortRef = useRef<AbortController | null>(null);

  const notifyReady = useCallback(
    (nextCards: ThoughtCardData[], nextSource: ThoughtFeedSource) => {
      if (!onReady || nextCards.length === 0) return;
      const key = `${requestKey}:${nextSource}:${nextCards
        .slice(0, 6)
        .map((card) => card.trackKey)
        .join("|")}`;
      if (readyKeyRef.current === key) return;
      readyKeyRef.current = key;
      onReady(nextCards, nextSource);
    },
    [onReady, requestKey],
  );

  const loadInitial = useCallback(async () => {
    if (!paragraph.trim() || requestKey <= 0) return;

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    initialAbortRef.current?.abort();
    loadMoreAbortRef.current?.abort();
    const controller = new AbortController();
    initialAbortRef.current = controller;

    setLoading(true);
    setLoadingMore(false);
    setCards([]);
    setExhausted(false);
    setSource(null);
    nextCursorRef.current = null;
    readyKeyRef.current = null;

    try {
      const response = await invokeThoughtFeed(
        {
          paragraph,
          postTitle,
          count: 4,
        },
        { signal: controller.signal },
      );
      if (requestId !== requestIdRef.current || controller.signal.aborted)
        return;

      const items = response.items ?? [];
      if (items.length === 0) {
        throw new Error("Empty thought feed");
      }

      setCards(items);
      setExhausted(response.exhausted);
      setSource("feed");
      nextCursorRef.current = response.nextCursor;
      notifyReady(items, "feed");
    } catch (error) {
      if (isAbortError(error) || requestId !== requestIdRef.current) {
        return;
      }
      console.warn(
        "[ThoughtFeed] thought-feed failed, falling back to chain()",
        error,
      );
      const fallback = await chain({ paragraph, postTitle });
      if (requestId !== requestIdRef.current) return;

      const mapped = mapChainFallbackToThoughts(fallback.questions);
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
  }, [notifyReady, paragraph, postTitle, requestKey]);

  const loadMore = useCallback(async () => {
    if (
      loading ||
      loadingMore ||
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
      if (requestId !== requestIdRef.current || controller.signal.aborted)
        return;

      const incoming = response.items ?? [];
      let appendedCount = 0;
      setCards((prev) => {
        const merged = mergeThoughtCards(prev, incoming);
        appendedCount = merged.appendedCount;
        return merged.items;
      });

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
  }, [exhausted, loading, loadingMore, paragraph, postTitle, source]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    return () => {
      initialAbortRef.current?.abort();
      loadMoreAbortRef.current?.abort();
    };
  }, []);

  const stableCards = useMemo(() => cards, [cards]);

  return {
    cards: stableCards,
    loading,
    loadingMore,
    exhausted,
    source,
    loadMore,
  };
}

export default useThoughtFeed;
