import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  Send,
  Loader2,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Lightbulb,
  Users,
  ArrowRight,
  GraduationCap,
  Swords,
  Compass,
  BarChart3,
  Sparkles,
  HelpCircle,
  ChevronLeft,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { streamChatEvents, invokeChatTask } from "@/services/chat";
import { PrismResult } from "@/services/ai";
import ChatMarkdown from "@/components/features/chat/ChatMarkdown";

export type DebateMessage = {
  id: string;
  role: "user" | "ai" | "system";
  content: string;
  stance?: "agree" | "disagree" | "neutral";
  timestamp: number;
};

export type DebateTopic = {
  title: string;
  context: string;
  facets?: PrismResult["facets"];
  originalParagraph?: string;
};

type DebateRoomProps = {
  topic: DebateTopic;
  onClose: () => void;
  postTitle?: string;
};

const THINKING_MESSAGES = [
  "생각하는 중...",
  "관점을 정리하고 있어요...",
  "답변을 구성하는 중...",
  "맥락을 분석하고 있어요...",
];

const DEBATE_STARTERS = [
  {
    label: "이 부분이 특히 신경 쓰여요",
    stance: "agree" as const,
    icon: ThumbsUp,
  },
  {
    label: "이 부분이 조금 불편해요",
    stance: "disagree" as const,
    icon: ThumbsDown,
  },
  {
    label: "조금 더 이해하고 정리하고 싶어요",
    stance: "neutral" as const,
    icon: Lightbulb,
  },
];

const DEFAULT_FOLLOW_UP_PROMPTS = [
  "내 상황에 맞게 풀어서 설명해줘",
  "다른 관점에서 보면 어떻게 느낄 수 있을까?",
  "앞으로 내가 어떤 선택을 할 수 있을지 같이 정리해줘",
  "지금 내가 놓치고 있는 포인트가 있다면 알려줘",
];

function normalizePrompt(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function pickUniquePrompts(items: string[], max = 3): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of items) {
    const normalized = normalizePrompt(item);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
    if (out.length >= max) break;
  }

  return out;
}

function extractChainQuestions(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const candidate = raw as { questions?: Array<{ q?: unknown }> };
  if (!Array.isArray(candidate.questions)) return [];

  return candidate.questions
    .map((q) => (typeof q?.q === "string" ? q.q : ""))
    .map(normalizePrompt)
    .filter(Boolean);
}

function derivePromptsFromResponse(text: string): string[] {
  const base = normalizePrompt(text);
  if (!base) return [];

  const ideas = base
    .split(/(?<=[.!?。！？])\s+/)
    .map(normalizePrompt)
    .filter(Boolean)
    .slice(0, 3)
    .map((line) => {
      if (line.endsWith("?") || line.endsWith("？")) return line;
      return `${line.replace(/[.!。]+$/, "")}에 대해 더 자세히 설명해줄래?`;
    });

  return pickUniquePrompts(ideas, 3);
}

type AIPersona = {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  systemPromptPrefix: string;
  color: string;
};

const AI_PERSONAS: AIPersona[] = [
  {
    id: "mentor",
    name: "멘토",
    icon: GraduationCap,
    description: "경험과 지혜로 조언하는 따뜻한 멘토",
    systemPromptPrefix:
      "당신은 10년 이상의 경험을 가진 따뜻한 멘토입니다. 사용자의 고민에 공감하면서도 경험에서 우러나온 실질적인 조언을 제공합니다. 격려와 지지를 아끼지 않으며, 사용자가 스스로 답을 찾을 수 있도록 안내합니다.",
    color: "from-amber-500 to-orange-500",
  },
  {
    id: "debater",
    name: "토론자",
    icon: Swords,
    description: "논리적으로 반박하며 생각을 날카롭게",
    systemPromptPrefix:
      "당신은 소크라테스식 문답을 하는 날카로운 토론자입니다. 사용자의 주장에 건설적인 반론을 제기하고, 논리의 허점을 부드럽게 지적합니다. 목표는 이기는 것이 아니라 더 깊은 이해에 도달하는 것입니다.",
    color: "from-red-500 to-pink-500",
  },
  {
    id: "explorer",
    name: "탐험가",
    icon: Compass,
    description: "새로운 관점과 가능성을 제시하는 호기심쟁이",
    systemPromptPrefix:
      '당신은 창의적인 관점을 제시하는 호기심 많은 탐험가입니다. 주제를 다양한 각도에서 바라보고, 예상치 못한 연결고리를 찾아냅니다. "만약에...?" 질문을 통해 사용자의 상상력을 자극합니다.',
    color: "from-blue-500 to-cyan-500",
  },
  {
    id: "analyst",
    name: "분석가",
    icon: BarChart3,
    description: "데이터와 논리로 상황을 분석하는 냉철한 분석가",
    systemPromptPrefix:
      "당신은 데이터와 논리를 기반으로 상황을 분석하는 냉철한 분석가입니다. 감정보다는 사실에 집중하고, 장단점을 객관적으로 정리합니다. 복잡한 문제를 구조화하여 명확하게 설명합니다.",
    color: "from-emerald-500 to-teal-500",
  },
];

function buildDebateSystemPrompt(
  topic: DebateTopic,
  stance?: "agree" | "disagree" | "neutral",
  persona?: AIPersona,
): string {
  const baseInstructions =
    persona?.systemPromptPrefix || "당신은 사려 깊은 상담 파트너입니다.";

  const lines: string[] = [
    baseInstructions,
    "",
    "다음 지침을 따르세요:",
    "1. 사용자의 감정과 생각을 먼저 공감하고, 차분하게 응답합니다.",
    "2. 옳고 그름을 판단하기보다, 사용자가 스스로 정리하고 선택할 수 있도록 도와줍니다.",
    "3. 조언이 필요할 때에는 예의 바르게, 구체적인 예시와 함께 제안합니다.",
    "4. 사용자가 새로운 관점이나 선택지를 발견하도록 부드럽게 질문을 던집니다.",
    "5. 말투는 친근하고 따뜻하게 유지하되, 과도하게 가볍지 않게 균형을 잡습니다.",
    "6. 응답은 2~4문장 정도로 간결하게, 지금 대화에서 가장 중요한 한두 가지에 집중합니다.",
    "",
    "---",
    "",
    "[상담 주제]",
    topic.title,
    "",
    "[맥락]",
    topic.context,
  ];

  if (topic.facets && topic.facets.length > 0) {
    lines.push("", "[참고할 수 있는 관점들]");
    topic.facets.forEach((f, i) => {
      lines.push(`${i + 1}. ${f.title}`);
      f.points.forEach((p) => lines.push(`   - ${p}`));
    });
  }

  if (stance === "agree") {
    lines.push(
      "",
      "사용자는 이 내용에 어느 정도 공감하고 있습니다. 그 공감을 바탕으로 조금 더 깊이 이해하고 정리할 수 있도록 도와주세요.",
    );
  } else if (stance === "disagree") {
    lines.push(
      "",
      "사용자는 이 내용에 대해 불편함 또는 다른 시각을 가지고 있습니다. 그 감정을 존중하면서 안전한 분위기에서 생각을 풀어낼 수 있도록 도와주세요.",
    );
  }

  return lines.join("\n");
}

type SelectionStep = "persona" | "stance" | "chat";

function StepProgress({
  step,
  isTerminal,
}: {
  step: SelectionStep;
  isTerminal: boolean;
}) {
  const steps: { key: SelectionStep; label: string }[] = [
    { key: "persona", label: "AI 선택" },
    { key: "stance", label: "마음" },
    { key: "chat", label: "대화" },
  ];
  const currentIdx = steps.findIndex((s) => s.key === step);

  return (
    <div className="flex items-center justify-center gap-0 mb-5">
      {steps.map((s, i) => {
        const isDone = i < currentIdx;
        const isActive = i === currentIdx;
        return (
          <React.Fragment key={s.key}>
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all duration-200",
                  isDone && !isTerminal && "bg-primary text-primary-foreground",
                  isDone && isTerminal && "bg-primary/80 text-background",
                  isActive &&
                    !isTerminal &&
                    "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-1",
                  isActive &&
                    isTerminal &&
                    "bg-primary/20 text-primary border border-primary/60 ring-2 ring-primary/20 ring-offset-1",
                  !isDone &&
                    !isActive &&
                    !isTerminal &&
                    "bg-muted text-muted-foreground",
                  !isDone &&
                    !isActive &&
                    isTerminal &&
                    "bg-primary/5 text-primary/30 border border-primary/15",
                )}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium",
                  isActive && !isTerminal && "text-primary",
                  isActive && isTerminal && "text-primary",
                  !isActive && "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "h-0.5 w-8 mb-4 transition-all duration-300",
                  i < currentIdx
                    ? isTerminal
                      ? "bg-primary/60"
                      : "bg-primary/50"
                    : isTerminal
                      ? "bg-primary/10"
                      : "bg-border",
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function DebateRoom({ topic, onClose }: DebateRoomProps) {
  const { isTerminal } = useTheme();
  const [messages, setMessages] = useState<DebateMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [thinkingMsgIdx, setThinkingMsgIdx] = useState(0);
  const [currentStance, setCurrentStance] = useState<
    "agree" | "disagree" | "neutral" | null
  >(null);
  const [selectedPersona, setSelectedPersona] = useState<AIPersona | null>(
    null,
  );
  const [selectionStep, setSelectionStep] = useState<SelectionStep>("persona");
  const [dynamicStarters, setDynamicStarters] = useState<
    typeof DEBATE_STARTERS | null
  >(null);
  const [startersLoading, setStartersLoading] = useState(false);
  const [followUpPrompts, setFollowUpPrompts] = useState<string[]>(
    DEFAULT_FOLLOW_UP_PROMPTS.slice(0, 3),
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const canSend = input.trim().length > 0 && !busy;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, busy]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  useEffect(() => {
    if (!busy) {
      setThinkingMsgIdx(0);
      return;
    }
    const interval = setInterval(() => {
      setThinkingMsgIdx((prev) => (prev + 1) % THINKING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [busy]);

  const addMessage = useCallback((msg: DebateMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const refreshFollowUps = useCallback(
    async (assistantText: string, streamedFollowUps?: string[]) => {
      const streamed = pickUniquePrompts(streamedFollowUps || [], 3);
      if (streamed.length > 0) {
        setFollowUpPrompts(streamed);
        return;
      }

      try {
        const result = await invokeChatTask<{
          questions?: Array<{ q?: string }>;
        }>({
          mode: "chain",
          payload: {
            paragraph: `${topic.title}\n\n${assistantText}`.slice(0, 1600),
            postTitle: topic.title,
          },
        });

        const dynamic = pickUniquePrompts(
          extractChainQuestions(result.data),
          3,
        );
        if (dynamic.length > 0) {
          setFollowUpPrompts(dynamic);
          return;
        }
      } catch {
        // fallback below
      }

      const derived = derivePromptsFromResponse(assistantText);
      if (derived.length > 0) {
        setFollowUpPrompts(derived);
      } else {
        setFollowUpPrompts(DEFAULT_FOLLOW_UP_PROMPTS.slice(0, 3));
      }
    },
    [topic.title],
  );

  const selectPersona = useCallback(
    (persona: AIPersona) => {
      setSelectedPersona(persona);
      setSelectionStep("stance");
      setDynamicStarters(null);
      setStartersLoading(true);
      invokeChatTask<{ questions?: Array<{ q?: string }> }>({
        mode: "chain",
        payload: {
          paragraph:
            `다음 주제로 AI 상담을 시작하려고 합니다: ${topic.title}\n\n${topic.context}`.slice(
              0,
              1200,
            ),
          postTitle: topic.title,
        },
      })
        .then((result) => {
          const questions = extractChainQuestions(result.data).slice(0, 3);
          if (questions.length === 3) {
            setDynamicStarters([
              { label: questions[0], stance: "agree" as const, icon: ThumbsUp },
              {
                label: questions[1],
                stance: "disagree" as const,
                icon: ThumbsDown,
              },
              {
                label: questions[2],
                stance: "neutral" as const,
                icon: Lightbulb,
              },
            ]);
          }
        })
        .catch(() => {
          /* fallback to DEBATE_STARTERS */
        })
        .finally(() => setStartersLoading(false));
    },
    [topic],
  );

  const startDebate = useCallback(
    async (stance: "agree" | "disagree" | "neutral") => {
      setCurrentStance(stance);
      setSelectionStep("chat");
      setBusy(true);

      const userMsg: DebateMessage = {
        id: `user_${Date.now()}`,
        role: "user",
        content:
          (dynamicStarters ?? DEBATE_STARTERS).find((s) => s.stance === stance)
            ?.label || "",
        stance,
        timestamp: Date.now(),
      };
      addMessage(userMsg);

      const aiId = `ai_${Date.now()}`;
      addMessage({
        id: aiId,
        role: "ai",
        content: "",
        timestamp: Date.now(),
      });

      const timeoutId = {
        current: null as ReturnType<typeof setTimeout> | null,
      };
      try {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        timeoutId.current = setTimeout(() => controller.abort(), 120000);

        const systemPrompt = buildDebateSystemPrompt(
          topic,
          stance,
          selectedPersona || undefined,
        );
        const starterText =
          stance === "agree"
            ? "이 부분이 특히 신경 쓰여요. 조금 더 이해하고 정리하고 싶어요."
            : stance === "disagree"
              ? "이 부분이 조금 불편해요. 다른 관점에서 생각해볼 수 있을까요?"
              : "조금 더 이해하고 정리하고 싶어요. 핵심 논점이 무엇인가요?";

        let acc = "";
        const streamedFollowUps: string[] = [];
        for await (const ev of streamChatEvents({
          text: `${systemPrompt}\n\n---\n\n사용자: ${starterText}`,
          signal: controller.signal,
          useArticleContext: false,
        })) {
          if (ev.type === "text") {
            acc += ev.text;
            setMessages((prev) =>
              prev.map((m) => (m.id === aiId ? { ...m, content: acc } : m)),
            );
          } else if (ev.type === "followups") {
            streamedFollowUps.push(...ev.questions);
          }
        }

        if (acc.trim()) {
          void refreshFollowUps(acc, streamedFollowUps);
        }
      } catch (err) {
        const error = err as Error;
        if (error.name === "AbortError") {
          const aiMsg = messages.find((m) => m.id === aiId);
          if (!aiMsg?.content) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiId
                  ? {
                      ...m,
                      content: "응답 시간이 초과되었어요. 다시 시도해주세요.",
                    }
                  : m,
              ),
            );
          }
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiId
                ? {
                    ...m,
                    content:
                      "죄송해요, 응답을 생성하지 못했어요. 다시 시도해주세요.",
                  }
                : m,
            ),
          );
        }
      } finally {
        if (timeoutId.current) clearTimeout(timeoutId.current);
        setBusy(false);
      }
    },
    [
      topic,
      addMessage,
      selectedPersona,
      refreshFollowUps,
      dynamicStarters,
      messages,
    ],
  );

  const sendMessage = useCallback(async () => {
    if (!canSend) return;

    const text = input.trim();
    setInput("");

    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    const userMsg: DebateMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    addMessage(userMsg);

    const aiId = `ai_${Date.now()}`;
    addMessage({
      id: aiId,
      role: "ai",
      content: "",
      timestamp: Date.now(),
    });

    setBusy(true);

    const timeoutId = { current: null as ReturnType<typeof setTimeout> | null };
    try {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      timeoutId.current = setTimeout(() => controller.abort(), 120000);

      const history = messages
        .filter((m) => m.role !== "system")
        .map((m) => `${m.role === "user" ? "사용자" : "AI"}: ${m.content}`)
        .join("\n\n");

      const systemPrompt = buildDebateSystemPrompt(
        topic,
        currentStance || undefined,
        selectedPersona || undefined,
      );
      const fullPrompt = [
        systemPrompt,
        "",
        "---",
        "",
        "[대화 기록]",
        history,
        "",
        `사용자: ${text}`,
      ].join("\n");

      let acc = "";
      const streamedFollowUps: string[] = [];
      for await (const ev of streamChatEvents({
        text: fullPrompt,
        signal: controller.signal,
        useArticleContext: false,
      })) {
        if (ev.type === "text") {
          acc += ev.text;
          setMessages((prev) =>
            prev.map((m) => (m.id === aiId ? { ...m, content: acc } : m)),
          );
        } else if (ev.type === "followups") {
          streamedFollowUps.push(...ev.questions);
        }
      }

      if (acc.trim()) {
        void refreshFollowUps(acc, streamedFollowUps);
      }
    } catch (err) {
      const error = err as Error;
      if (error.name === "AbortError") {
        setMessages((prev) => {
          const aiMsg = prev.find((m) => m.id === aiId);
          if (!aiMsg?.content) {
            return prev.map((m) =>
              m.id === aiId
                ? {
                    ...m,
                    content: "응답 시간이 초과되었어요. 다시 시도해주세요.",
                  }
                : m,
            );
          }
          return prev;
        });
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiId
              ? { ...m, content: "죄송해요, 응답을 생성하지 못했어요." }
              : m,
          ),
        );
      }
    } finally {
      if (timeoutId.current) clearTimeout(timeoutId.current);
      setBusy(false);
    }
  }, [
    canSend,
    input,
    messages,
    topic,
    currentStance,
    selectedPersona,
    addMessage,
    refreshFollowUps,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (canSend) sendMessage();
      }
    },
    [canSend, sendMessage],
  );

  const resetDebate = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setCurrentStance(null);
    setSelectedPersona(null);
    setSelectionStep("persona");
    setInput("");
    setFollowUpPrompts(DEFAULT_FOLLOW_UP_PROMPTS.slice(0, 3));
    setDynamicStarters(null);
    setBusy(false);
  }, []);

  const handleFollowUp = useCallback((prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  }, []);

  const handleInputResize = useCallback(
    (e: React.FormEvent<HTMLTextAreaElement>) => {
      const el = e.currentTarget;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    },
    [],
  );

  return (
    <div
      className={cn(
        "flex flex-col h-full max-h-[80vh] sm:max-h-[600px] overflow-hidden rounded-2xl border shadow-xl",
        isTerminal
          ? "bg-[hsl(var(--terminal-code-bg))] border-primary/30 font-mono shadow-[0_0_30px_hsl(var(--terminal-glow)/0.15)]"
          : "bg-card border-border",
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-3.5 border-b shrink-0",
          isTerminal
            ? "border-primary/20 bg-[hsl(var(--terminal-titlebar))]"
            : "border-border/40 bg-muted/40",
        )}
      >
        {isTerminal && (
          <div className="flex items-center gap-1.5 mr-3">
            <div className="w-3 h-3 rounded-full bg-[hsl(var(--terminal-window-btn-close))]" />
            <div className="w-3 h-3 rounded-full bg-[hsl(var(--terminal-window-btn-minimize))]" />
            <div className="w-3 h-3 rounded-full bg-[hsl(var(--terminal-window-btn-maximize))]" />
          </div>
        )}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={cn(
              "flex items-center justify-center h-10 w-10 rounded-full shrink-0",
              isTerminal
                ? "bg-primary/20 border border-primary/30"
                : "bg-primary/10",
            )}
          >
            <Users
              className={cn(
                "h-5 w-5",
                isTerminal ? "text-primary" : "text-primary",
              )}
            />
          </div>
          <div className="min-w-0">
            <h3
              className={cn(
                "font-semibold text-base truncate",
                isTerminal && "font-mono text-primary terminal-glow",
              )}
            >
              {isTerminal ? ">_ AI 상담실" : "AI 상담실"}
              {busy && (
                <span className="inline-flex items-center gap-1 ml-2">
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full animate-pulse",
                      isTerminal ? "bg-primary" : "bg-emerald-500",
                    )}
                  />
                </span>
              )}
            </h3>
            <p className="text-xs text-muted-foreground truncate max-w-[200px] sm:max-w-[280px]">
              {topic.title}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={resetDebate}
              className={cn(
                "flex items-center justify-center h-9 w-9 rounded-full transition-colors",
                isTerminal
                  ? "hover:bg-primary/20 text-primary/70 hover:text-primary"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground",
              )}
              aria-label="상담 초기화"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "flex items-center justify-center h-9 w-9 rounded-full transition-colors",
              isTerminal
                ? "hover:bg-primary/20 text-primary/70 hover:text-primary"
                : "hover:bg-muted text-muted-foreground hover:text-foreground",
            )}
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 space-y-5"
      >
        {/* Step 1: Persona Selection */}
        {selectionStep === "persona" && (
          <div className="space-y-5 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
            <StepProgress step="persona" isTerminal={isTerminal} />

            {/* Topic Card */}
            <div
              className={cn(
                "rounded-xl px-4 py-4 border",
                isTerminal
                  ? "bg-primary/5 border-primary/30"
                  : "bg-muted/40 border-border/60",
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex items-center justify-center h-9 w-9 rounded-lg shrink-0 mt-0.5",
                    isTerminal ? "bg-primary/20" : "bg-primary/10",
                  )}
                >
                  <MessageSquare className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-medium text-sm mb-2">{topic.title}</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {topic.context.length > 200
                      ? `${topic.context.slice(0, 200)}...`
                      : topic.context}
                  </p>
                </div>
              </div>
            </div>

            {/* Persona Selection */}
            <div className="space-y-4 pt-2">
              <div className="text-center space-y-1">
                <p className="text-sm font-medium flex items-center justify-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>어떤 AI와 상담할까요?</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  각 AI는 다른 관점과 스타일로 대화합니다
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {AI_PERSONAS.map((persona) => {
                  const Icon = persona.icon;
                  return (
                    <button
                      key={persona.id}
                      type="button"
                      onClick={() => selectPersona(persona)}
                      className={cn(
                        "group flex flex-col items-center gap-2 px-4 py-4 rounded-xl border transition-all",
                        "hover:scale-[1.02] active:scale-[0.98]",
                        isTerminal
                          ? "border-primary/30 hover:border-primary/60 hover:bg-primary/10"
                          : "border-border hover:border-primary/40 hover:bg-muted/50 hover:shadow-sm",
                      )}
                    >
                      <div
                        className={cn(
                          "flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-br",
                          persona.color,
                          "text-white shadow-lg transition-transform group-hover:scale-110 duration-200",
                        )}
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="text-center">
                        <span className="text-sm font-medium block">
                          {persona.name}
                        </span>
                        <span className="text-xs text-muted-foreground line-clamp-2">
                          {persona.description}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Stance Selection */}
        {selectionStep === "stance" && selectedPersona && (
          <div className="space-y-5 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
            <StepProgress step="stance" isTerminal={isTerminal} />

            {/* Selected Persona Display */}
            <div
              className={cn(
                "rounded-xl px-4 py-4 border",
                isTerminal
                  ? "bg-primary/5 border-primary/30"
                  : "bg-muted/40 border-border/60",
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-br shrink-0",
                    selectedPersona.color,
                    "text-white shadow-md",
                  )}
                >
                  <selectedPersona.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-medium text-sm">
                    {selectedPersona.name}와 상담
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {selectedPersona.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectionStep("persona")}
                  className={cn(
                    "flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors",
                    isTerminal
                      ? "text-primary/70 hover:text-primary hover:bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  뒤로가기
                </button>
              </div>
            </div>

            {/* Facets Preview */}
            {topic.facets && topic.facets.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground px-1">
                  관련 관점들:
                </p>
                <div className="flex flex-wrap gap-2">
                  {topic.facets.slice(0, 3).map((f, i) => (
                    <span
                      key={i}
                      className={cn(
                        "inline-flex items-center px-3 py-1.5 rounded-full text-xs",
                        isTerminal
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "bg-secondary text-secondary-foreground",
                      )}
                    >
                      {f.title}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Stance Selection */}
            <div className="space-y-4 pt-3">
              <p className="text-sm text-center text-muted-foreground">
                어떤 마음으로 상담을 시작할까요?
              </p>
              <div className="grid grid-cols-1 gap-2.5">
                {startersLoading ? (
                  <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>주제에 맞는 시작 모드를 생성하는 중...</span>
                  </div>
                ) : (
                  (dynamicStarters ?? DEBATE_STARTERS).map((starter) => {
                    const Icon = starter.icon;
                    return (
                      <button
                        key={starter.stance}
                        type="button"
                        onClick={() => startDebate(starter.stance)}
                        disabled={busy}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all",
                          "hover:scale-[1.01] active:scale-[0.99]",
                          isTerminal
                            ? "border-primary/30 hover:border-primary/50 hover:bg-primary/10"
                            : "border-border hover:border-primary/40 hover:bg-muted/50",
                          busy && "opacity-50 cursor-not-allowed",
                        )}
                      >
                        <div
                          className={cn(
                            "flex items-center justify-center h-9 w-9 rounded-lg shrink-0",
                            starter.stance === "agree" &&
                              "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                            starter.stance === "disagree" &&
                              "bg-orange-500/15 text-orange-600 dark:text-orange-400",
                            starter.stance === "neutral" &&
                              "bg-blue-500/15 text-blue-600 dark:text-blue-400",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium flex-1 text-left line-clamp-2">
                          {starter.label}
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Conversation Messages */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex",
              msg.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            {msg.role === "ai" ? (
              <div className="flex items-start gap-2.5 max-w-[88%]">
                {selectedPersona && (
                  <div
                    className={cn(
                      "flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br mt-1 shadow-sm",
                      selectedPersona.color,
                      "text-white",
                    )}
                  >
                    <selectedPersona.icon className="h-3.5 w-3.5" />
                  </div>
                )}
                <div
                  className={cn(
                    "rounded-2xl px-4 py-3 min-w-0",
                    isTerminal
                      ? "bg-primary/10 border border-primary/30 rounded-bl-md"
                      : "bg-secondary text-secondary-foreground rounded-bl-md",
                  )}
                >
                  {msg.content ? (
                    <>
                      <ChatMarkdown content={msg.content} />
                      {busy && (
                        <span className="inline-block w-0.5 h-4 bg-current ml-0.5 animate-pulse align-middle opacity-70" />
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground min-h-[44px]">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
                      </div>
                      <span className="text-xs transition-all duration-500">
                        {THINKING_MESSAGES[thinkingMsgIdx]}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div
                className={cn(
                  "max-w-[88%] rounded-2xl px-4 py-3",
                  msg.role === "user" &&
                    "bg-primary text-primary-foreground rounded-br-md",
                  msg.role === "system" && "bg-muted text-muted-foreground",
                )}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </p>

                {msg.role === "user" && msg.stance && (
                  <div className="flex items-center gap-1 mt-2 pt-2 border-t border-primary-foreground/20">
                    {msg.stance === "agree" && <ThumbsUp className="h-3 w-3" />}
                    {msg.stance === "disagree" && (
                      <ThumbsDown className="h-3 w-3" />
                    )}
                    {msg.stance === "neutral" && (
                      <Lightbulb className="h-3 w-3" />
                    )}
                    <span className="text-xs opacity-80">
                      {msg.stance === "agree" && "동의"}
                      {msg.stance === "disagree" && "반대"}
                      {msg.stance === "neutral" && "탐구"}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Quick Follow-ups after AI response */}
        {!busy &&
          messages.length > 0 &&
          messages[messages.length - 1]?.role === "ai" && (
            <div className="flex flex-wrap gap-2 pt-3">
              {followUpPrompts.map((prompt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleFollowUp(prompt)}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-full transition-colors",
                    isTerminal
                      ? "bg-primary/15 text-primary/90 hover:bg-primary/25 hover:text-primary border border-primary/30"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <HelpCircle className="h-3 w-3 shrink-0" />
                  {prompt}
                </button>
              ))}
            </div>
          )}
      </div>

      {/* Input Area */}
      {selectionStep === "chat" && (
        <div
          className={cn(
            "border-t px-4 py-4 shrink-0",
            isTerminal
              ? "border-primary/20 bg-primary/5"
              : "border-border/40 bg-muted/30",
          )}
        >
          <div
            className={cn(
              "flex items-end gap-2.5 rounded-xl border px-3 py-2.5",
              isTerminal
                ? "border-primary/30 bg-background/60"
                : "border-border bg-background",
            )}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={handleInputResize}
              placeholder="생각을 나눠보세요..."
              rows={1}
              className={cn(
                "flex-1 resize-none border-0 bg-transparent py-2 text-sm focus:outline-none focus:ring-0",
                "placeholder:text-muted-foreground/50",
                isTerminal && "font-mono",
              )}
              style={{ maxHeight: "120px" }}
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={!canSend}
              className={cn(
                "flex items-center justify-center h-10 w-10 rounded-lg transition-colors shrink-0",
                canSend
                  ? isTerminal
                    ? "bg-primary/25 text-primary hover:bg-primary/35 border border-primary/40"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed",
              )}
              aria-label="보내기"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-muted-foreground/50 text-right mt-1.5">
            Enter로 전송 · Shift+Enter 줄바꿈
          </p>
        </div>
      )}
    </div>
  );
}
