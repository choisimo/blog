import { useCallback, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  RefreshCcw,
  Sparkles,
} from "lucide-react";
import type { LensCard as LensCardData } from "@/services/chat";
import { cn } from "@/lib/utils";
import LensCard from "./LensCard";
import LensEvidenceDrawer from "./LensEvidenceDrawer";
import { useLensDeck, type LensDeckSource } from "./hooks/useLensDeck";

type PrismDeckProps = {
  paragraph: string;
  postTitle?: string;
  requestKey: number;
  onReady?: (cards: LensCardData[], source: LensDeckSource) => void;
};

export default function PrismDeck({
  paragraph,
  postTitle,
  requestKey,
  onReady,
}: PrismDeckProps) {
  const {
    cards,
    activeCard,
    currentIndex,
    loading,
    loadingMore,
    exhausted,
    source,
    canGoPrev,
    canGoNext,
    goPrev,
    goNext,
    setCurrentIndex,
  } = useLensDeck({
    paragraph,
    postTitle,
    requestKey,
    onReady,
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const dragStartXRef = useRef<number | null>(null);
  const dragStartYRef = useRef<number | null>(null);

  const visibleCards = useMemo(
    () => cards.slice(currentIndex, currentIndex + 3),
    [cards, currentIndex],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      dragStartXRef.current = event.clientX;
      dragStartYRef.current = event.clientY;
    },
    [],
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
      if (deltaX < 0 && canGoNext) goNext();
      if (deltaX > 0 && canGoPrev) goPrev();
    },
    [canGoNext, canGoPrev, goNext, goPrev],
  );

  if (loading) {
    return (
      <div className="flex min-h-[24rem] flex-col items-center justify-center gap-3 rounded-[2rem] border border-violet-200/60 bg-[linear-gradient(135deg,rgba(245,243,255,0.92),rgba(250,245,255,0.88))] px-6 py-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
          <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            렌즈 카드를 불러오는 중입니다
          </p>
          <p className="text-xs text-muted-foreground">
            관점 스택을 구성하고 있어요.
          </p>
        </div>
      </div>
    );
  }

  if (!activeCard) {
    return (
      <div className="rounded-[2rem] border border-border/60 bg-muted/30 px-5 py-10 text-center text-sm text-muted-foreground">
        아직 표시할 lens 카드가 없습니다.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-violet-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-700">
                Prism Deck
              </span>
              {source === "fallback" && (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Fallback
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-foreground">
              Lens {currentIndex + 1} / {cards.length}
            </p>
            <p className="text-xs text-muted-foreground">
              좌우 화살표나 스와이프로 다음 관점을 이어서 소비합니다.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goPrev}
              disabled={!canGoPrev}
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors",
                canGoPrev
                  ? "border-border/70 bg-background hover:bg-muted"
                  : "cursor-not-allowed border-border/40 bg-muted/40 text-muted-foreground/40",
              )}
              aria-label="이전 관점"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={!canGoNext}
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors",
                canGoNext
                  ? "border-border/70 bg-background hover:bg-muted"
                  : "cursor-not-allowed border-border/40 bg-muted/40 text-muted-foreground/40",
              )}
              aria-label="다음 관점"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative h-[24rem]">
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
                  onOpenEvidence={
                    isActive ? () => setDrawerOpen(true) : undefined
                  }
                  onPointerDown={isActive ? handlePointerDown : undefined}
                  onPointerUp={isActive ? handlePointerUp : undefined}
                />
              );
            })}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/25 px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {loadingMore ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                뒤에서 다음 lens를 붙이고 있습니다.
              </>
            ) : exhausted ? (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                현재 시드에서 준비된 lens를 모두 소비했습니다.
              </>
            ) : (
              <>
                <RefreshCcw className="h-3.5 w-3.5" />
                남은 카드가 2장 이하가 되면 다음 lens를 미리 불러옵니다.
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {cards.map((card, index) => (
              <button
                key={card.id}
                type="button"
                onClick={() => setCurrentIndex(index)}
                className={cn(
                  "h-2.5 rounded-full transition-all",
                  index === currentIndex
                    ? "w-8 bg-violet-500"
                    : "w-2.5 bg-border hover:bg-violet-300",
                )}
                aria-label={`${index + 1}번 관점으로 이동`}
              />
            ))}
          </div>
        </div>
      </div>

      <LensEvidenceDrawer
        card={activeCard}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </>
  );
}
