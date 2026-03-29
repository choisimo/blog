import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { sketch, SketchResult } from "@/services/discovery/ai";
import type {
  LensCard as LensFeedCard,
  ThoughtCard as ThoughtFeedCard,
} from "@/services/chat";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { Sparkles, Loader2, X, Lightbulb, Layers, Link2 } from "lucide-react";
import useLanguage from "@/hooks/i18n/useLanguage";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import PrismDeck from "./PrismDeck";
import ThoughtFeed from "./ThoughtFeed";

// Minimal telemetry to localStorage for future learning
function logEvent(event: Record<string, unknown>) {
  try {
    const key = "aiMemo.events";
    const prev = JSON.parse(localStorage.getItem(key) || "[]");
    prev.push({ t: Date.now(), ...event });
    localStorage.setItem(key, JSON.stringify(prev.slice(-500))); // cap
  } catch {
    void 0;
  }
}

function emitAiMemoLog(detail: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent("aiMemo:log", {
        detail,
      }),
    );
  } catch {
    void 0;
  }
}

const ZERO_WIDTH_CHAR_RE = /[\u200B-\u200D\uFEFF]/g;

function normalizeContentIdentity(value: string | undefined): string {
  return String(value || "")
    .normalize("NFKC")
    .replace(ZERO_WIDTH_CHAR_RE, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractText(children: React.ReactNode): string {
  const parts: string[] = [];
  const walk = (node: React.ReactNode) => {
    if (node == null || node === false) return;
    if (typeof node === "string" || typeof node === "number") {
      parts.push(String(node));
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (React.isValidElement(node)) {
      walk(node.props.children);
    }
  };
  walk(children);
  return normalizeContentIdentity(parts.join(" "));
}

const INLINE_ONLY_TAGS = new Set([
  "a",
  "abbr",
  "b",
  "br",
  "cite",
  "code",
  "del",
  "em",
  "i",
  "kbd",
  "mark",
  "q",
  "s",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "time",
  "u",
  "var",
  "wbr",
]);

function hasNonInlineChildren(children: React.ReactNode): boolean {
  return React.Children.toArray(children).some((node) => {
    if (node == null || node === false) return false;
    if (typeof node === "string" || typeof node === "number") return false;
    if (Array.isArray(node)) return hasNonInlineChildren(node);
    if (!React.isValidElement(node)) return false;

    const props = (node.props as { children?: React.ReactNode }) ?? {};

    if (node.type === React.Fragment) {
      return hasNonInlineChildren(props.children);
    }

    if (typeof node.type === "string") {
      if (!INLINE_ONLY_TAGS.has(node.type)) {
        return true;
      }
      return hasNonInlineChildren(props.children);
    }

    return true;
  });
}

type Mode = "idle" | "sketch" | "prism" | "chain";
type FeedSource = "feed" | "warming" | "fallback";
type LoadedModes = Record<Exclude<Mode, "idle">, boolean>;

function createInitialLoadedModes(): LoadedModes {
  return {
    sketch: false,
    prism: false,
    chain: false,
  };
}

const ModeConfig: Record<
  Mode,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    activeColor: string;
    description: string;
  }
> = {
  idle: {
    label: "AI 분석",
    icon: Sparkles,
    activeColor: "text-muted-foreground",
    description: "",
  },
  sketch: {
    label: "핵심 파악",
    icon: Lightbulb,
    activeColor: "text-amber-500 dark:text-amber-400",
    description: "감정과 핵심 포인트",
  },
  prism: {
    label: "다각도 분석",
    icon: Layers,
    activeColor: "text-violet-500 dark:text-violet-400",
    description: "다각도 분석",
  },
  chain: {
    label: "더 생각해보기",
    icon: Link2,
    activeColor: "text-emerald-500 dark:text-emerald-400",
    description: "연쇄 질문",
  },
};

// Mood emoji mapping
const MOOD_EMOJI: Record<string, string> = {
  설명적: "📖",
  분석적: "🔍",
  정보적: "💡",
  교육적: "🎓",
  흥미로운: "✨",
  흥미: "✨",
  호기심: "🤔",
  탐구적: "🧭",
  비판적: "⚡",
  논쟁적: "🔥",
  도전적: "💪",
  철학적: "🌀",
  서사적: "📜",
  감성적: "💫",
  실용적: "🔧",
  창의적: "🎨",
};

function getMoodEmoji(mood: string): string {
  for (const [key, emoji] of Object.entries(MOOD_EMOJI)) {
    if (mood.includes(key)) return emoji;
  }
  return "💡";
}

function formatSketchResult(res: SketchResult): string {
  const bullets = res.bullets.map((b) => `- ${b}`).join("\n");
  return [`**Mood:** ${res.mood}`, "", bullets].join("\n");
}

function formatLensFeedResult(cards: LensFeedCard[]): string {
  return cards
    .slice(0, 4)
    .map(
      (card, index) =>
        `### ${index + 1}. ${card.title}\n- ${card.summary}\n${card.bullets
          .slice(0, 3)
          .map((bullet) => `- ${bullet}`)
          .join("\n")}`,
    )
    .join("\n\n");
}

function formatThoughtFeedResult(cards: ThoughtFeedCard[]): string {
  return cards
    .slice(0, 6)
    .map(
      (card) =>
        `- **${card.title}**${card.subtitle ? ` — ${card.subtitle}` : ""}`,
    )
    .join("\n");
}

export default function SparkInline({
  children,
  postTitle,
  wrapperTag,
}: {
  children: React.ReactNode;
  postTitle?: string;
  wrapperTag?: "p" | "div";
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<Mode>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sketchRes, setSketchRes] = useState<SketchResult | null>(null);
  const [activeMode, setActiveMode] = useState<Mode>("idle");
  const [loadedModes, setLoadedModes] = useState<LoadedModes>(
    createInitialLoadedModes,
  );
  const { isTerminal } = useTheme();
  const { language } = useLanguage();

  const text = useMemo(() => extractText(children), [children]);
  const hasText = text && text.length > 0;
  const normalizedPostTitle = useMemo(
    () => normalizeContentIdentity(postTitle),
    [postTitle],
  );
  const contentKey = useMemo(
    () => `${normalizedPostTitle}::${text}`,
    [normalizedPostTitle, text],
  );
  const contentKeyRef = useRef(contentKey);
  const ContentTag: "p" | "div" =
    wrapperTag ?? (hasNonInlineChildren(children) ? "div" : "p");

  useEffect(() => {
    contentKeyRef.current = contentKey;
    setOpen(false);
    setLoading("idle");
    setError(null);
    setSketchRes(null);
    setActiveMode("idle");
    setLoadedModes(createInitialLoadedModes());
  }, [contentKey]);

  const openMode = useCallback(
    async (mode: Exclude<Mode, "idle">) => {
      if (!hasText) return;

      setOpen(true);
      setError(null);
      setActiveMode(mode);

      if (mode === "sketch") {
        if (loadedModes.sketch || sketchRes || loading === "sketch") {
          return;
        }

        setLoading("sketch");
        const requestContentKey = contentKey;

        try {
          const res = await sketch({ paragraph: text, postTitle });
          if (contentKeyRef.current !== requestContentKey) return;

          setSketchRes(res);
          setLoadedModes((prev) =>
            prev.sketch ? prev : { ...prev, sketch: true },
          );
          logEvent({ type: "sketch", len: text.length });
          emitAiMemoLog({
            type: "ai_qna",
            mode: "sketch",
            question: text,
            answer: formatSketchResult(res),
            postTitle,
          });
        } catch (e: unknown) {
          if (contentKeyRef.current !== requestContentKey) return;
          const msg = e instanceof Error ? e.message : "AI 호출 실패";
          setError(msg);
        } finally {
          if (contentKeyRef.current === requestContentKey) {
            setLoading("idle");
          }
        }

        return;
      }

      if (!loadedModes[mode]) {
        logEvent({
          type: mode === "prism" ? "lens_feed" : "thought_feed",
          len: text.length,
        });
        setLoadedModes((prev) =>
          prev[mode] ? prev : { ...prev, [mode]: true },
        );
      }
    },
    [contentKey, hasText, loadedModes, loading, postTitle, sketchRes, text],
  );

  const hasResult =
    sketchRes !== null || loadedModes.prism || loadedModes.chain;
  const activeModeConfig = ModeConfig[activeMode];
  const tooltipLabel =
    language === "ko" ? "AI 설명 보기" : "View AI explanation";
  const actionLabel =
    language === "ko" ? "AI로 문단 분석하기" : "Analyze paragraph with AI";
  const handleLensReady = useCallback(
    (cards: LensFeedCard[], source: FeedSource) => {
      emitAiMemoLog({
        type: "ai_qna",
        mode: "lens_feed",
        question: text,
        answer: formatLensFeedResult(cards),
        postTitle,
        source,
      });
    },
    [postTitle, text],
  );
  const handleThoughtReady = useCallback(
    (cards: ThoughtFeedCard[], source: FeedSource) => {
      emitAiMemoLog({
        type: "ai_qna",
        mode: "thought_feed",
        question: text,
        answer: formatThoughtFeedResult(cards),
        postTitle,
        source,
      });
    },
    [postTitle, text],
  );

  return (
    <>
      <ContentTag
        className="mb-4 leading-relaxed inline-block w-full group/spark relative"
        data-spark-inline-wrapper={ContentTag}
      >
        {children}
        {hasText && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                title={tooltipLabel}
                aria-label={tooltipLabel}
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className={cn(
                  "ml-2 inline-flex items-center justify-center rounded-full transition-all duration-200",
                  "min-h-[36px] min-w-[36px] md:min-h-[28px] md:min-w-[28px]",
                  "opacity-50 hover:opacity-100 group-hover/spark:opacity-80",
                  "hover:bg-primary/10 hover:scale-110",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  isTerminal && "text-primary",
                )}
              >
                <Sparkles
                  className={cn(
                    "h-4 w-4 md:h-3.5 md:w-3.5",
                    open && "text-primary",
                  )}
                />
                <span className="sr-only">{actionLabel}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{tooltipLabel}</TooltipContent>
          </Tooltip>
        )}
      </ContentTag>

      {/* Animated panel using CSS grid trick for smooth height transition */}
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          "-mt-2 mb-6",
        )}
        aria-hidden={!open}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              "rounded-2xl border shadow-sm",
              isTerminal
                ? "bg-[hsl(var(--terminal-code-bg))] border-primary/20"
                : "bg-card/80 backdrop-blur-sm border-border/60",
            )}
            role="region"
            aria-label="AI 분석 패널"
          >
            {/* Header with mode tabs */}
            <div
              className={cn(
                "flex items-center justify-between px-4 py-3 border-b",
                isTerminal
                  ? "border-primary/10 bg-primary/5"
                  : "border-border/40 bg-muted/30",
              )}
            >
              {/* Mode buttons - iOS segmented control style */}
              <div
                className={cn(
                  "inline-flex rounded-xl p-1 gap-1",
                  isTerminal ? "bg-primary/10" : "bg-muted/60",
                )}
              >
                {(["sketch", "prism", "chain"] as Mode[]).map((mode) => {
                  const config = ModeConfig[mode];
                  const Icon = config.icon;
                  const isActive = activeMode === mode;
                  const isLoading = loading === mode;

                  return (
                    <button
                      key={mode}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
                        "min-h-[32px] min-w-[70px] justify-center",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        isActive &&
                          !isTerminal &&
                          "bg-background shadow-sm text-foreground",
                        isActive &&
                          isTerminal &&
                          "bg-primary/20 text-primary shadow-sm",
                        !isActive &&
                          "text-muted-foreground hover:text-foreground hover:bg-background/50",
                        isLoading && "animate-pulse",
                      )}
                      disabled={loading === "sketch"}
                      onClick={() => {
                        void openMode(mode as Exclude<Mode, "idle">);
                      }}
                    >
                      {isLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Icon
                          className={cn(
                            "h-3.5 w-3.5",
                            isActive && config.activeColor,
                          )}
                        />
                      )}
                      <span>{config.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Close button */}
              <button
                className={cn(
                  "flex items-center justify-center rounded-full transition-all duration-200",
                  "h-8 w-8 hover:bg-muted/80",
                  isTerminal &&
                    "hover:bg-primary/10 text-primary/60 hover:text-primary",
                )}
                onClick={() => setOpen(false)}
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content area */}
            <div className="px-4 py-4">
              {/* Loading state */}
              {loading !== "idle" && (
                <div
                  className={cn(
                    "flex flex-col items-center gap-3 py-8 justify-center",
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center justify-center w-12 h-12 rounded-2xl",
                      isTerminal ? "bg-primary/10" : "bg-muted",
                    )}
                  >
                    <Loader2
                      className={cn(
                        "h-6 w-6 animate-spin",
                        isTerminal ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                  </div>
                  <div className="text-center">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        isTerminal ? "text-primary" : "text-foreground",
                      )}
                    >
                      {activeModeConfig.label} 분석 중...
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      잠시만 기다려 주세요...
                    </p>
                  </div>
                </div>
              )}

              {/* Error state */}
              {error && (
                <div
                  className={cn(
                    "rounded-xl px-4 py-3 text-sm",
                    "bg-destructive/10 text-destructive border border-destructive/20",
                  )}
                >
                  {error}
                </div>
              )}

              {/* Sketch Result */}
              {activeMode === "sketch" && sketchRes && loading === "idle" && (
                <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                  {/* Mood badge */}
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
                        isTerminal
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
                      )}
                    >
                      <span
                        className="text-base mr-0.5"
                        role="img"
                        aria-label="mood"
                      >
                        {getMoodEmoji(sketchRes.mood)}
                      </span>
                      {sketchRes.mood}
                    </span>
                  </div>

                  {/* Bullets */}
                  <ul className="space-y-2">
                    {sketchRes.bullets.map((b, i) => (
                      <li
                        key={i}
                        className={cn(
                          "flex items-start gap-3 text-sm leading-relaxed",
                          isTerminal ? "text-foreground/90" : "text-foreground",
                        )}
                      >
                        <span
                          className={cn(
                            "flex-shrink-0 w-1.5 h-1.5 rounded-full mt-2",
                            isTerminal ? "bg-primary/60" : "bg-amber-500/60",
                          )}
                        />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Prism Result */}
              <div
                className={cn(activeMode === "prism" ? "block" : "hidden")}
                aria-hidden={activeMode !== "prism"}
              >
                {loadedModes.prism && (
                  <PrismDeck
                    paragraph={text}
                    postTitle={postTitle}
                    cacheKey={`${contentKey}:prism`}
                    enabled={activeMode === "prism"}
                    onReady={handleLensReady}
                  />
                )}
              </div>

              {/* Chain Result */}
              <div
                className={cn(activeMode === "chain" ? "block" : "hidden")}
                aria-hidden={activeMode !== "chain"}
              >
                {loadedModes.chain && (
                  <ThoughtFeed
                    paragraph={text}
                    postTitle={postTitle}
                    cacheKey={`${contentKey}:chain`}
                    enabled={activeMode === "chain"}
                    onReady={handleThoughtReady}
                  />
                )}
              </div>

              {/* Empty state - when opened but no result yet */}
              {!hasResult && loading === "idle" && !error && (
                <div className="py-8 flex flex-col items-center justify-center min-h-[180px]">
                  <div
                    className={cn(
                      "relative flex items-center justify-center w-14 h-14 rounded-2xl mb-4",
                      isTerminal ? "bg-primary/10" : "bg-muted",
                    )}
                  >
                    <span className="absolute inset-0 rounded-2xl animate-ping opacity-20 bg-primary/40" />
                    <Sparkles
                      className={cn(
                        "h-6 w-6 relative z-10",
                        isTerminal ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    위 버튼을 눌러 AI 분석을 시작하세요
                  </p>
                  <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs text-muted-foreground/70">
                    <span>
                      <strong>핵심 파악</strong> - 핵심 포인트
                    </span>
                    <span>
                      <strong>다각도 분석</strong> - 다양한 시각
                    </span>
                    <span>
                      <strong>더 생각해보기</strong> - 연쇄 질문
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
