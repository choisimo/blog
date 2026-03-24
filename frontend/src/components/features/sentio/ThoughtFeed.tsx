import { useCallback, useEffect, useRef } from "react";
import { Loader2, Milestone, Sparkles } from "lucide-react";
import type { ThoughtCard as ThoughtCardData } from "@/services/chat";
import ThoughtCard from "./ThoughtCard";
import { useThoughtFeed, type ThoughtFeedSource } from "./hooks/useThoughtFeed";

type ThoughtFeedProps = {
  paragraph: string;
  postTitle?: string;
  cacheKey: string;
  enabled: boolean;
  onReady?: (cards: ThoughtCardData[], source: ThoughtFeedSource) => void;
};

export default function ThoughtFeed({
  paragraph,
  postTitle,
  cacheKey,
  enabled,
  onReady,
}: ThoughtFeedProps) {
  const { cards, loading, loadingMore, exhausted, source, loadMore } =
    useThoughtFeed({
      paragraph,
      postTitle,
      cacheKey,
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
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore();
        }
      },
      {
        root,
        rootMargin: "0px 0px 220px 0px",
        threshold: 0.1,
      },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [cards.length, enabled, exhausted, loadMore]);

  const renderStatus = useCallback(() => {
    if (loadingMore) {
      return (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-muted/25 px-4 py-3 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          다음 thought 카드를 붙이고 있습니다.
        </div>
      );
    }

    if (exhausted) {
      return (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-muted/25 px-4 py-3 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          현재 흐름에서 이어질 thought 카드를 모두 표시했습니다.
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-muted/25 px-4 py-3 text-xs text-muted-foreground">
        <Milestone className="h-3.5 w-3.5" />
        리스트 끝 sentinel이 보이면 다음 thought 카드를 자동으로 가져옵니다.
      </div>
    );
  }, [exhausted, loadingMore]);

  if (loading) {
    return (
      <div className="flex min-h-[24rem] flex-col items-center justify-center gap-3 rounded-[2rem] border border-emerald-200/60 bg-[linear-gradient(180deg,rgba(240,253,244,0.86),rgba(255,255,255,0.96))] px-6 py-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/90 shadow-sm">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            Thought feed를 구성하는 중입니다
          </p>
          <p className="text-xs text-muted-foreground">
            세로 탐색 카드를 정리하고 있어요.
          </p>
        </div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="rounded-[2rem] border border-border/60 bg-muted/30 px-5 py-10 text-center text-sm text-muted-foreground">
        아직 표시할 thought 카드가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
          Thought Feed
        </span>
        {source === "fallback" && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
            Fallback
          </span>
        )}
      </div>

      <div
        ref={scrollRef}
        className="max-h-[28rem] space-y-4 overflow-y-auto pr-1"
      >
        {cards.map((card, index) => (
          <ThoughtCard key={card.id} card={card} index={index} />
        ))}
        <div ref={sentinelRef} className="h-4 w-full" aria-hidden="true" />
      </div>

      {renderStatus()}
    </div>
  );
}
