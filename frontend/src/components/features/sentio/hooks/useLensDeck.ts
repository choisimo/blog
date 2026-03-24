import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invokeLensFeed, type LensCard as LensCardData } from "@/services/chat";
import { prism } from "@/services/discovery/ai";

export type LensDeckSource = "feed" | "fallback";

type UseLensDeckOptions = {
  paragraph: string;
  postTitle?: string;
  requestKey: number;
  onReady?: (cards: LensCardData[], source: LensDeckSource) => void;
};

type UseLensDeckResult = {
  cards: LensCardData[];
  activeCard: LensCardData | null;
  currentIndex: number;
  loading: boolean;
  loadingMore: boolean;
  exhausted: boolean;
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

const PERSONA_BY_INDEX: LensCardData["personaId"][] = [
  "mentor",
  "explorer",
  "analyst",
  "debater",
];

function mapPrismFallbackToCards(
  paragraph: string,
  postTitle: string | undefined,
  facets: Array<{ title: string; points: string[] }>,
): LensCardData[] {
  const seed = `${postTitle || "post"}-${paragraph.slice(0, 24) || "lens"}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return facets.map((facet, index) => {
    const angleKey = `${seed || "lens"}-${index + 1}`;
    const bullets = facet.points.slice(0, 5);
    return {
      id: `fallback-${angleKey}`,
      personaId: PERSONA_BY_INDEX[index % PERSONA_BY_INDEX.length],
      angleKey,
      title: facet.title,
      summary: bullets[0] || facet.title,
      bullets,
      detail: [facet.title, ...facet.points].join("\n\n"),
      tags: ["fallback", "prism"],
    };
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function mergeCards(
  previous: LensCardData[],
  incoming: LensCardData[],
): { items: LensCardData[]; appendedCount: number } {
  const seen = new Set(previous.map((card) => card.angleKey));
  const appended = incoming.filter((card) => {
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

export function useLensDeck({
  paragraph,
  postTitle,
  requestKey,
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

  const notifyReady = useCallback(
    (nextCards: LensCardData[], nextSource: LensDeckSource) => {
      if (!onReady || nextCards.length === 0) return;
      const key = `${requestKey}:${nextSource}:${nextCards
        .slice(0, 4)
        .map((card) => card.angleKey)
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
    setCurrentIndex(0);
    setExhausted(false);
    setSource(null);
    nextCursorRef.current = null;
    readyKeyRef.current = null;

    try {
      const response = await invokeLensFeed(
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
        throw new Error("Empty lens feed");
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
        "[PrismDeck] lens-feed failed, falling back to prism()",
        error,
      );
      const fallback = await prism({ paragraph, postTitle });
      if (requestId !== requestIdRef.current) return;

      const mapped = mapPrismFallbackToCards(
        paragraph,
        postTitle,
        fallback.facets,
      );
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
      const response = await invokeLensFeed(
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
        const merged = mergeCards(prev, incoming);
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
      console.warn("[PrismDeck] lens-feed prefetch failed", error);
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

  useEffect(() => {
    if (cards.length === 0 || source !== "feed") return;
    const remaining = cards.length - currentIndex - 1;
    if (remaining <= 2) {
      void loadMore();
    }
  }, [cards.length, currentIndex, loadMore, source]);

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < cards.length - 1;

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) =>
      Math.min(prev + 1, Math.max(cards.length - 1, 0)),
    );
  }, [cards.length]);

  const activeCard = useMemo(
    () => cards[currentIndex] ?? null,
    [cards, currentIndex],
  );

  return {
    cards,
    activeCard,
    currentIndex,
    loading,
    loadingMore,
    exhausted,
    source,
    canGoPrev,
    canGoNext,
    setCurrentIndex,
    goPrev,
    goNext,
  };
}

export default useLensDeck;
