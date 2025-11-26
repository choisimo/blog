import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Sparkles,
  Send,
  Loader2,
  Square,
  Image as ImageIcon,
  X,
  MoreVertical,
  Info,
  Terminal,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  streamChatEvents,
  ensureSession,
  uploadChatImage,
  invokeChatAggregate,
} from "@/services/chat";
import ChatMarkdown from "./ChatMarkdown";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTheme } from "@/contexts/ThemeContext";

export type SourceLink = {
  title?: string;
  url?: string;
  score?: number;
  snippet?: string;
};
export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  sources?: SourceLink[];
  followups?: string[];
};

type UploadedChatImage = {
  id: string;
  url: string;
  name: string;
  size: number;
};

type ChatSessionMeta = {
  id: string;
  title: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  mode: "article" | "general";
  articleUrl?: string;
  articleTitle?: string;
};

const CHAT_SESSIONS_INDEX_KEY = "ai_chat_sessions_index";
const CHAT_SESSION_STORAGE_PREFIX = "ai_chat_history_v2_";
const QUICK_PROMPTS = [
  "이 글을 3줄로 요약해줘.",
  "SEO 키워드 5개 추천해줘.",
  "블로그 글 제목 3개를 제안해줘.",
];

export default function ChatWidget(props: { onClose?: () => void }) {
  const isMobile = useIsMobile();
  const { isTerminal } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [persistOptIn, setPersistOptIn] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [sessionKey, setSessionKey] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      const existing = window.localStorage.getItem(
        "ai_chat_current_session_key",
      );
      if (existing && existing.trim()) return existing;
    } catch {}
    const fresh = `sess_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    try {
      window.localStorage.setItem("ai_chat_current_session_key", fresh);
    } catch {}
    return fresh;
  });
  const [sessions, setSessions] = useState<ChatSessionMeta[]>([]);
  const [showSessions, setShowSessions] = useState(false);
  const [showImageDrawer, setShowImageDrawer] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [isAggregatePrompt, setIsAggregatePrompt] = useState(false);
  const [firstTokenMs, setFirstTokenMs] = useState<number | null>(null);
  const [questionMode, setQuestionMode] = useState<"article" | "general">(
    "article",
  );
  const [attachedImage, setAttachedImage] = useState<File | null>(null);
  const [attachedPreviewUrl, setAttachedPreviewUrl] = useState<string | null>(
    null,
  );
  const [uploadedImages, setUploadedImages] = useState<UploadedChatImage[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lastPromptRef = useRef<string>("");

  const canSend = (input.trim().length > 0 || attachedImage !== null) && !busy;

  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    sc.scrollTop = sc.scrollHeight + 1000;
  }, [messages, busy]);

  useEffect(() => {
    const v =
      typeof window !== "undefined"
        ? window.localStorage.getItem("ai_chat_persist_optin")
        : null;
    setPersistOptIn(v === "1");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(CHAT_SESSIONS_INDEX_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setSessions(parsed);
    } catch {}
  }, []);

  useEffect(() => {
    ensureSession()
      .then((id) => setSessionId(id))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!persistOptIn || !sessionKey) return;
    try {
      const raw = localStorage.getItem(
        `${CHAT_SESSION_STORAGE_PREFIX}${sessionKey}`,
      );
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(parsed)) setMessages(parsed);
      } else {
        setMessages([]);
      }
    } catch {}
  }, [persistOptIn, sessionKey]);

  useEffect(() => {
    if (!persistOptIn || !sessionKey) return;
    try {
      localStorage.setItem(
        `${CHAT_SESSION_STORAGE_PREFIX}${sessionKey}`,
        JSON.stringify(messages),
      );
    } catch {}
  }, [messages, persistOptIn, sessionKey]);

  useEffect(() => {
    if (!attachedImage) {
      setAttachedPreviewUrl(null);
      return;
    }
    let url: string | null = null;
    try {
      url = URL.createObjectURL(attachedImage);
      setAttachedPreviewUrl(url);
    } catch {
      setAttachedPreviewUrl(null);
    }
    return () => {
      if (url) {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      }
    };
  }, [attachedImage]);

  const push = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const togglePersistStorage = useCallback(() => {
    const next = !persistOptIn;
    setPersistOptIn(next);
    try {
      localStorage.setItem("ai_chat_persist_optin", next ? "1" : "0");
    } catch {}
  }, [persistOptIn]);

  const runMobileAction = useCallback((fn: () => void) => {
    fn();
    setShowActionSheet(false);
  }, []);

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  const loadSession = useCallback((id: string) => {
    try {
      const raw = localStorage.getItem(`${CHAT_SESSION_STORAGE_PREFIX}${id}`);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(parsed)) {
          setMessages(parsed);
        } else {
          setMessages([]);
        }
      } else {
        setMessages([]);
      }
      setFirstTokenMs(null);
      setAttachedImage(null);
      setSessionKey(id);
      try {
        localStorage.setItem("ai_chat_current_session_key", id);
      } catch {}
    } catch {
      setMessages([]);
    }
  }, []);

  const toggleSessionSelected = useCallback((id: string) => {
    setSelectedSessionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const aggregateFromSessionIds = useCallback(
    (ids: string[]) => {
      const uniqueIds = Array.from(new Set(ids));
      if (!uniqueIds.length) return;
      const lines: string[] = ["[참조 세션 요약]"];

      uniqueIds.forEach((id, idx) => {
        const s = sessions.find((x) => x.id === id);
        if (!s) return;
        const title = s.title || s.articleTitle || `세션 ${idx + 1}`;
        const summaryText = s.summary || "(요약 없음)";
        lines.push(`${idx + 1}) ${title}`, summaryText, "");
      });

      lines.push(
        "---",
        "위 세션들을 모두 고려해서 다음 질문에 답해줘.",
        "",
        "(여기에 이어서 궁금한 점을 적어 주세요...)",
      );

      setInput(lines.join("\n"));
      setShowSessions(false);
      setSelectedSessionIds([]);
      setIsAggregatePrompt(true);
    },
    [sessions],
  );

  const send = useCallback(async () => {
    if (!canSend) return;
    const trimmed = input.trim();
    const imageToUpload = attachedImage;

    setBusy(true);
    setFirstTokenMs(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let aiId: string | null = null;

    try {
      let uploaded: {
        url: string;
        key: string;
        size: number;
        contentType: string;
      } | null = null;

      if (imageToUpload) {
        uploaded = await uploadChatImage(imageToUpload, controller.signal);
      }

      const baseText =
        trimmed || (imageToUpload ? "첨부한 이미지에 대해 설명해줘." : "");

      const lines: string[] = [baseText];

      if (uploaded && imageToUpload) {
        const sizeKb = Math.max(1, Math.round(uploaded.size / 1024));
        lines.push(
          "",
          "[첨부 이미지]",
          `URL: ${uploaded.url}`,
          `파일명: ${imageToUpload.name}`,
          `크기: ${sizeKb}KB`,
        );

        const entry: UploadedChatImage = {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          url: uploaded.url,
          name: imageToUpload.name,
          size: uploaded.size,
        };
        setUploadedImages((prev) => [entry, ...prev].slice(0, 12));
      }

      const text = lines.join("\n");
      lastPromptRef.current = text;
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      setInput("");
      setAttachedImage(null);
      setAttachedPreviewUrl(null);
      push({ id, role: "user", text });
      aiId = `${id}_ai`;

      if (isAggregatePrompt) {
        setIsAggregatePrompt(false);
        const aggregated = await invokeChatAggregate({
          prompt: text,
          signal: controller.signal,
        });
        push({ id: aiId, role: "assistant", text: aggregated });
      } else {
        let acc = "";
        push({ id: aiId, role: "assistant", text: "" });
        for await (const ev of streamChatEvents({
          text,
          signal: controller.signal,
          onFirstToken: (ms) => setFirstTokenMs(ms),
          useArticleContext: questionMode === "article",
        })) {
          if (ev.type === "text") {
            acc += ev.text;
            setMessages((prev) =>
              prev.map((m) => (m.id === aiId ? { ...m, text: acc } : m)),
            );
          } else if (ev.type === "sources") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiId ? { ...m, sources: ev.sources } : m,
              ),
            );
          } else if (ev.type === "followups") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiId ? { ...m, followups: ev.questions } : m,
              ),
            );
          } else if (ev.type === "done") {
          }
        }
      }
    } catch (e: any) {
      const msg = e?.message || "Chat failed";
      const errId =
        aiId != null
          ? `${aiId}_err`
          : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_err`;
      push({ id: errId, role: "system", text: msg });
    } finally {
      setBusy(false);
    }
  }, [attachedImage, canSend, input, isAggregatePrompt, push, questionMode]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearAll = useCallback(() => {
    if (messages.length > 0) {
      if (!window.confirm("대화를 삭제할까요?")) return;
    }
    setMessages([]);
    setFirstTokenMs(null);
    setAttachedImage(null);
    setAttachedPreviewUrl(null);
    setUploadedImages([]);
    setIsAggregatePrompt(false);
    const nextKey = `sess_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    setSessionKey(nextKey);
    try {
      localStorage.setItem("ai_chat_current_session_key", nextKey);
    } catch {}
  }, [messages.length]);

  const summary = useMemo(() => {
    if (messages.length === 0) return "";
    const assistants = messages.filter(
      (m) => m.role === "assistant" && m.text.trim(),
    );
    const last = assistants[assistants.length - 1];
    const txt = last?.text || "";
    return txt.length > 160 ? `${txt.slice(0, 160)}…` : txt;
  }, [messages]);

  const pageTitle = useMemo(() => {
    return typeof document !== "undefined" ? document.title : "";
  }, []);

  const handleAggregateFromSelected = useCallback(() => {
    if (!selectedSessionIds.length) return;
    aggregateFromSessionIds(selectedSessionIds);
  }, [aggregateFromSessionIds, selectedSessionIds]);

  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<{ sessionIds?: string[] }>).detail;
      const ids = detail?.sessionIds;
      if (!Array.isArray(ids) || !ids.length) return;
      const filtered = ids.filter((id) => typeof id === "string");
      if (!filtered.length) return;
      aggregateFromSessionIds(filtered);
    };
    window.addEventListener(
      "aiChat:aggregateFromGraph",
      handler as EventListener,
    );
    return () => {
      window.removeEventListener(
        "aiChat:aggregateFromGraph",
        handler as EventListener,
      );
    };
  }, [aggregateFromSessionIds]);

  useEffect(() => {
    if (!persistOptIn || !sessionKey) return;
    if (messages.length === 0) return;

    const nowIso = new Date().toISOString();
    const firstUser = messages.find((m) => m.role === "user" && m.text.trim());
    const baseTitle = (firstUser?.text || pageTitle || "새 대화")
      .split("\n")[0]
      .trim();
    const title =
      baseTitle.length > 60 ? `${baseTitle.slice(0, 60)}…` : baseTitle;
    const articleUrl =
      typeof window !== "undefined" ? window.location.href : undefined;

    setSessions((prev) => {
      const existing = prev.find((s) => s.id === sessionKey);
      const createdAt = existing?.createdAt || nowIso;
      const next: ChatSessionMeta = {
        id: sessionKey,
        title: existing?.title || title,
        summary,
        createdAt,
        updatedAt: nowIso,
        messageCount: messages.length,
        mode: questionMode,
        articleUrl: articleUrl || existing?.articleUrl,
        articleTitle: pageTitle || existing?.articleTitle,
      };
      const others = prev.filter((s) => s.id !== sessionKey);
      const updated = [next, ...others];
      try {
        localStorage.setItem(CHAT_SESSIONS_INDEX_KEY, JSON.stringify(updated));
        if (typeof window !== "undefined") {
          try {
            window.dispatchEvent(new CustomEvent("aiChat:sessionsUpdated"));
          } catch {}
        }
      } catch {}
      return updated;
    });
  }, [messages, summary, questionMode, pageTitle, persistOptIn, sessionKey]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (canSend) void send();
      }
    },
    [canSend, send],
  );

  const placeholder =
    questionMode === "article"
      ? "현재 글 내용에 대해 물어보고 싶은 것을 입력하세요..."
      : "자유롭게 궁금한 내용을 입력하세요...";

  return (
    <>
      <div
        className={cn(
          "fixed z-[10000] flex flex-col overflow-hidden border bg-background shadow-2xl transition-all",
          isMobile
            ? "inset-0 h-[100dvh] rounded-none safe-area"
            : "bottom-20 left-1/2 w-[min(100%-24px,42rem)] max-h-[80vh] -translate-x-1/2 rounded-2xl",
          isTerminal &&
            "border-border bg-[hsl(var(--terminal-code-bg))] rounded-lg",
        )}
      >
        {/* Terminal-style title bar */}
        {isTerminal && (
          <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border bg-[hsl(var(--terminal-titlebar))]">
            <span className="w-3 h-3 rounded-full bg-[hsl(var(--terminal-window-btn-close))]" />
            <span className="w-3 h-3 rounded-full bg-[hsl(var(--terminal-window-btn-minimize))]" />
            <span className="w-3 h-3 rounded-full bg-[hsl(var(--terminal-window-btn-maximize))]" />
            <span className="ml-3 font-mono text-xs text-muted-foreground">
              ~/ai-chat
            </span>
          </div>
        )}

        <div
          className={cn(
            "flex items-start justify-between border-b bg-background/95 px-4 py-3",
            isTerminal && "bg-transparent border-border",
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full bg-primary/10",
                isTerminal && "bg-primary/20 rounded-lg",
              )}
            >
              <Sparkles
                className={cn(
                  "h-5 w-5 text-primary",
                  isTerminal && "terminal-glow",
                )}
              />
            </div>
            <div>
              <p
                className={cn(
                  "text-sm font-semibold",
                  isTerminal && "font-mono text-primary",
                )}
              >
                {isTerminal ? ">_ AI Chat" : "AI Chat"}
              </p>
              <p
                className={cn(
                  "text-xs text-muted-foreground",
                  isTerminal && "font-mono",
                )}
              >
                {busy ? (
                  <span className="inline-flex items-center gap-1">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> 생성 중…
                    {firstTokenMs != null && (
                      <span className="ml-1 text-muted-foreground/70">
                        첫 토큰 {firstTokenMs}ms
                      </span>
                    )}
                  </span>
                ) : persistOptIn ? (
                  "기록 저장 ON"
                ) : (
                  "기록 저장 OFF"
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {!isMobile && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="hidden h-9 px-3 text-xs sm:inline-flex"
                disabled={!sessions.length}
                onClick={() => setShowSessions((v) => !v)}
              >
                최근 대화
              </Button>
            )}
            {isMobile ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="대화 옵션"
                onClick={() => setShowActionSheet(true)}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="대화 옵션"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 text-sm">
                  <DropdownMenuItem
                    disabled={!sessions.length}
                    onSelect={() => setShowSessions((v) => !v)}
                  >
                    최근 대화 보기
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!uploadedImages.length}
                    onSelect={() => setShowImageDrawer(true)}
                  >
                    이미지 메모 보기
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={togglePersistStorage}>
                    {persistOptIn ? "기록 저장 끄기" : "기록 저장 켜기"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={clearAll}>
                    대화 초기화
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {props.onClose && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9"
                aria-label="창 닫기"
                onClick={props.onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {showSessions && sessions.length > 0 && (
          <div className="border-b bg-muted/40">
            <div className="px-3 pt-2 max-h-40 overflow-y-auto text-xs space-y-1">
              {sessions.map((s) => {
                const checked = selectedSessionIds.includes(s.id);
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      className="h-3 w-3"
                      checked={checked}
                      onChange={() => toggleSessionSelected(s.id)}
                    />
                    <button
                      type="button"
                      className="flex-1 text-left"
                      onClick={() => {
                        loadSession(s.id);
                        setShowSessions(false);
                      }}
                    >
                      <div className="truncate font-medium">
                        {s.title || "제목 없음"}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                        {s.articleTitle && (
                          <span className="truncate">{s.articleTitle}</span>
                        )}
                        <span>{new Date(s.updatedAt).toLocaleString()}</span>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="px-3 pb-2 pt-1 border-t flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">
                선택된 세션: {selectedSessionIds.length}개
              </span>
              <Button
                type="button"
                size="sm"
                className="h-7 px-2 text-[11px]"
                disabled={!selectedSessionIds.length}
                onClick={handleAggregateFromSelected}
              >
                통합 질문하기
              </Button>
            </div>
          </div>
        )}

        <div
          className={cn(
            "flex items-center justify-between border-b px-4 py-2 text-[11px] text-muted-foreground",
            isTerminal &&
              "border-border font-mono bg-[hsl(var(--terminal-code-bg))]",
          )}
        >
          <span className="truncate">
            {isTerminal ? (
              questionMode === "article" ? (
                <>
                  <span className="text-primary/60">mode:</span>{" "}
                  <span className="text-primary">article</span>{" "}
                  <span className="text-muted-foreground/60">
                    ({pageTitle.slice(0, 30)}
                    {pageTitle.length > 30 ? "..." : ""})
                  </span>
                </>
              ) : (
                <>
                  <span className="text-primary/60">mode:</span>{" "}
                  <span className="text-primary">general</span>
                </>
              )
            ) : questionMode === "article" ? (
              `현재 글 '${pageTitle}' 기반`
            ) : (
              "일반 대화 모드"
            )}
          </span>
          <div
            className={cn(
              "inline-flex rounded-full border bg-muted/60 p-0.5",
              isTerminal && "rounded-none bg-transparent border-primary/30",
            )}
          >
            <Button
              size="sm"
              type="button"
              variant={questionMode === "article" ? "secondary" : "ghost"}
              className={cn(
                "h-6 px-2 text-[11px]",
                isTerminal && "rounded-none font-mono",
                isTerminal &&
                  questionMode === "article" &&
                  "bg-primary/20 text-primary",
                isTerminal &&
                  questionMode !== "article" &&
                  "text-muted-foreground hover:text-primary hover:bg-primary/10",
              )}
              onClick={() => setQuestionMode("article")}
            >
              {isTerminal ? "--article" : "현재 글"}
            </Button>
            <Button
              size="sm"
              type="button"
              variant={questionMode === "general" ? "secondary" : "ghost"}
              className={cn(
                "h-6 px-2 text-[11px]",
                isTerminal && "rounded-none font-mono",
                isTerminal &&
                  questionMode === "general" &&
                  "bg-primary/20 text-primary",
                isTerminal &&
                  questionMode !== "general" &&
                  "text-muted-foreground hover:text-primary hover:bg-primary/10",
              )}
              onClick={() => setQuestionMode("general")}
            >
              {isTerminal ? "--general" : "일반"}
            </Button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className={cn(
            "flex-1 overflow-auto px-4 py-3 space-y-3",
            isMobile ? "min-h-[40vh]" : "min-h-[140px] max-h-[46vh]",
            isTerminal && "space-y-2 font-mono text-sm",
          )}
        >
          {messages.length === 0 && (
            <div
              className={cn(
                "space-y-3 rounded-2xl border border-dashed px-4 py-5 text-xs text-muted-foreground mb-4",
                isTerminal &&
                  "rounded-none border-primary/30 bg-[hsl(var(--terminal-code-bg))]",
              )}
            >
              {isTerminal ? (
                <>
                  <p className="font-mono text-primary/80">
                    <span className="text-primary">$</span> ./ai-chat --help
                  </p>
                  <p className="font-mono text-muted-foreground text-[11px] leading-relaxed">
                    USAGE: Type your question and press Enter to execute.
                    <br />
                    TIP: Select a quick command below to get started.
                  </p>
                </>
              ) : (
                <p>빠르게 시작하려면 아래 프롬프트를 눌러보세요.</p>
              )}
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <Button
                    key={prompt}
                    size="sm"
                    variant="secondary"
                    className={cn(
                      "h-8 text-xs",
                      isTerminal &&
                        "rounded-none border border-primary/40 bg-transparent text-primary hover:bg-primary/20 hover:text-primary font-mono",
                    )}
                    onClick={() => {
                      setInput(prompt);
                      focusInput();
                    }}
                  >
                    {isTerminal ? `> ${prompt}` : prompt}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => {
            const isUser = m.role === "user";
            const isAssistant = m.role === "assistant";
            const isSystem = m.role === "system";

            // Terminal style rendering
            if (isTerminal) {
              return (
                <div key={m.id} className="space-y-1">
                  {isUser && (
                    <div className="flex items-start gap-2">
                      <span className="text-primary font-bold select-none shrink-0">
                        user@blog:~$
                      </span>
                      <span className="whitespace-pre-wrap text-foreground break-words">
                        {m.text}
                      </span>
                    </div>
                  )}
                  {isAssistant && (
                    <div className="pl-0 border-l-2 border-primary/30 ml-0">
                      <div className="flex items-center gap-2 text-[11px] text-primary/70 mb-1 pl-3">
                        <Terminal className="h-3 w-3" />
                        <span>AI Response</span>
                        {!m.text.trim() && (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            processing...
                          </span>
                        )}
                      </div>
                      <div className="pl-3 text-foreground/90">
                        {m.text.trim() ? (
                          <ChatMarkdown content={m.text} />
                        ) : (
                          <span className="terminal-cursor" />
                        )}
                      </div>
                      {Array.isArray(m.sources) && m.sources.length > 0 && (
                        <div className="mt-2 pl-3 text-[11px]">
                          <span className="text-primary/60"># Sources:</span>
                          <ul className="mt-1 space-y-0.5">
                            {m.sources.map((s, i) => (
                              <li key={i} className="text-muted-foreground">
                                <span className="text-primary/50">
                                  [{i + 1}]
                                </span>{" "}
                                {s.url ? (
                                  <a
                                    className="underline decoration-dotted hover:text-primary"
                                    href={s.url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {s.title || s.url}
                                  </a>
                                ) : (
                                  <span>{s.title || "출처"}</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {Array.isArray(m.followups) && m.followups.length > 0 && (
                        <div className="mt-2 pl-3">
                          <span className="text-[11px] text-primary/60">
                            # Related queries:
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {m.followups.map((q, i) => (
                              <button
                                key={i}
                                className="text-[11px] text-primary/80 hover:text-primary border border-primary/30 px-2 py-0.5 hover:bg-primary/10 transition-colors"
                                onClick={() => {
                                  setInput(q);
                                  focusInput();
                                }}
                              >
                                <ChevronRight className="inline h-3 w-3 -ml-0.5" />
                                {q}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {isSystem && (
                    <div className="flex items-start gap-2 text-destructive">
                      <span className="font-bold select-none shrink-0">
                        [ERROR]
                      </span>
                      <span className="whitespace-pre-wrap break-words">
                        {m.text}
                      </span>
                      {lastPromptRef.current && (
                        <button
                          className="text-[11px] underline ml-2 hover:text-destructive/80"
                          onClick={() => {
                            setInput(lastPromptRef.current);
                            focusInput();
                          }}
                        >
                          retry
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            }

            // Default style rendering
            return (
              <div
                key={m.id}
                className={cn("flex", isUser ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-full text-sm leading-relaxed rounded-2xl px-3 py-2 sm:max-w-[85%]",
                    isUser &&
                      "bg-primary text-primary-foreground rounded-br-sm",
                    isAssistant &&
                      "bg-secondary text-secondary-foreground rounded-bl-sm",
                    isSystem && "bg-destructive/10 text-destructive",
                  )}
                >
                  {isAssistant ? (
                    m.text.trim() ? (
                      <ChatMarkdown content={m.text} />
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        답변을 준비하고 있어요…
                      </div>
                    )
                  ) : (
                    <span className="whitespace-pre-wrap">{m.text}</span>
                  )}

                  {isAssistant &&
                    Array.isArray(m.sources) &&
                    m.sources.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="text-[11px] text-muted-foreground">
                          참고한 출처
                        </div>
                        <ul className="text-xs list-disc pl-4 space-y-1">
                          {m.sources.map((s, i) => (
                            <li key={i}>
                              {s.url ? (
                                <a
                                  className="underline"
                                  href={s.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {s.title || s.url}
                                </a>
                              ) : (
                                <span>{s.title || "출처"}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                  {isAssistant &&
                    Array.isArray(m.followups) &&
                    m.followups.length > 0 && (
                      <div className="mt-2">
                        <div className="text-[11px] text-muted-foreground mb-1">
                          연관 질문
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {m.followups.map((q, i) => (
                            <Button
                              key={i}
                              size="sm"
                              variant="secondary"
                              className="h-7 text-xs px-2"
                              onClick={() => {
                                setInput(q);
                                focusInput();
                              }}
                            >
                              {q}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                  {isSystem && lastPromptRef.current && (
                    <div className="mt-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs px-2"
                        onClick={() => {
                          setInput(lastPromptRef.current);
                          focusInput();
                        }}
                      >
                        다시 시도하기
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {persistOptIn && summary && (
          <div
            className={cn(
              "px-4 py-1 border-t text-[11px] text-muted-foreground truncate",
              isTerminal &&
                "font-mono border-border bg-[hsl(var(--terminal-code-bg))]",
            )}
          >
            {isTerminal ? (
              <span>
                <span className="text-primary/60"># Last output:</span>{" "}
                {summary}
              </span>
            ) : (
              <>지난 대화 요약: {summary}</>
            )}
          </div>
        )}

        <div
          className={cn(
            "border-t bg-background/95 px-3 py-3 mt-3 space-y-3",
            isMobile && "pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
            isTerminal && "bg-transparent border-border mt-0 py-2",
          )}
        >
          <div
            className={cn(
              "flex items-center justify-between gap-3 px-1 text-[11px] text-muted-foreground sm:px-3",
              isTerminal && "font-mono",
            )}
          >
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
              {isTerminal ? (
                <span className="text-primary/60">
                  # Type 'clear' or click below to start new session
                </span>
              ) : (
                <>
                  <Info className="h-3.5 w-3.5" />
                  <span className="leading-tight">
                    새 주제를 시작할 땐 새 대화를 눌러주세요.
                  </span>
                </>
              )}
            </div>
            <Button
              onClick={clearAll}
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-2 text-[11px]",
                isTerminal &&
                  "font-mono text-primary/80 hover:text-primary hover:bg-primary/10",
              )}
            >
              {isTerminal ? "clear" : "새 대화"}
            </Button>
          </div>
          {attachedImage && (
            <div
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground",
                isTerminal &&
                  "rounded-none border-primary/30 bg-[hsl(var(--terminal-code-bg))] font-mono",
              )}
            >
              <span className="inline-flex items-center gap-2 truncate">
                <div
                  className={cn(
                    "h-9 w-9 flex-shrink-0 overflow-hidden rounded bg-muted",
                    isTerminal && "rounded-none border border-primary/20",
                  )}
                >
                  {attachedPreviewUrl ? (
                    <img
                      src={attachedPreviewUrl}
                      alt={attachedImage.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="h-4 w-4 mx-auto my-auto" />
                  )}
                </div>
                <span className="inline-flex min-w-0 flex-col">
                  <span className="inline-flex items-center gap-1 truncate">
                    {isTerminal ? (
                      <span className="text-primary/60">[attached]</span>
                    ) : (
                      <ImageIcon className="h-3 w-3" />
                    )}
                    <span className="truncate">{attachedImage.name}</span>
                  </span>
                  <span className="text-[10px] opacity-70">
                    {Math.max(1, Math.round(attachedImage.size / 1024))}KB
                  </span>
                </span>
              </span>
              <button
                type="button"
                className={cn(
                  "text-[11px] underline",
                  isTerminal &&
                    "text-destructive/80 hover:text-destructive no-underline",
                )}
                onClick={() => setAttachedImage(null)}
              >
                {isTerminal ? "[x]" : "제거"}
              </button>
            </div>
          )}

          {/* Terminal-style input area */}
          {isTerminal ? (
            <div className="bg-[hsl(var(--terminal-code-bg))] border border-border px-3 py-2">
              <div className="flex items-end gap-2">
                <span className="text-primary font-mono font-bold select-none shrink-0 py-2">
                  user@blog:~$
                </span>
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={1}
                  placeholder={
                    questionMode === "article"
                      ? "query --context article"
                      : "query --mode general"
                  }
                  ref={textareaRef}
                  className="flex-1 resize-none border-0 bg-transparent px-0 py-2 text-sm font-mono text-foreground min-h-[36px] focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/50"
                />
                <div className="flex items-center gap-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const target = e.target as HTMLInputElement;
                      const file = target.files?.[0] ?? null;
                      setAttachedImage(file);
                    }}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 rounded-none border border-primary/30 text-primary/70 hover:text-primary hover:bg-primary/10 hover:border-primary/50"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="이미지 첨부"
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                  {busy ? (
                    <Button
                      onClick={stop}
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 rounded-none border border-destructive/50 text-destructive hover:bg-destructive/10"
                    >
                      <Square className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={send}
                      disabled={!canSend}
                      size="icon"
                      className="h-9 w-9 rounded-none border border-primary bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-30"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              {busy && (
                <div className="flex items-center gap-2 mt-2 text-[11px] font-mono text-primary/70">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Executing query...</span>
                  {firstTokenMs != null && (
                    <span className="text-muted-foreground">
                      (first token: {firstTokenMs}ms)
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-3xl border border-border bg-muted/60 px-3 py-2 shadow-inner sm:px-4 sm:py-3">
              <div className="flex items-end gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={2}
                  placeholder={placeholder}
                  ref={textareaRef}
                  className="flex-1 resize-none border-0 bg-transparent px-0 py-2 text-sm sm:text-base min-h-[52px] focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <div className="flex items-center gap-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const target = e.target as HTMLInputElement;
                      const file = target.files?.[0] ?? null;
                      setAttachedImage(file);
                    }}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-11 w-11 rounded-2xl border border-dashed border-muted-foreground/50 text-muted-foreground hover:border-muted-foreground"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="이미지 첨부"
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                  {busy ? (
                    <Button
                      onClick={stop}
                      size="icon"
                      variant="secondary"
                      className="h-12 w-12 rounded-2xl"
                    >
                      <Square className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={send}
                      disabled={!canSend}
                      size="icon"
                      className="h-12 w-12 rounded-2xl shadow-lg"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showImageDrawer} onOpenChange={setShowImageDrawer}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>이미지 메모</DialogTitle>
            <DialogDescription>
              최근 대화에서 첨부한 이미지들을 다시 확인할 수 있어요.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2 text-sm">
            {uploadedImages.length === 0 && (
              <p className="text-muted-foreground text-sm">
                저장된 이미지가 없습니다.
              </p>
            )}
            {uploadedImages.map((img) => (
              <button
                key={img.id}
                type="button"
                className="flex w-full items-center gap-3 rounded-lg border px-2 py-1 text-left hover:bg-muted"
                onClick={() => {
                  try {
                    window.open(img.url, "_blank", "noopener,noreferrer");
                  } catch {}
                }}
              >
                <div className="h-12 w-12 overflow-hidden rounded bg-muted">
                  <img
                    src={img.url}
                    alt={img.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex-1 truncate">
                  <div className="font-medium truncate">{img.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {Math.max(1, Math.round(img.size / 1024))}KB
                  </div>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={showActionSheet} onOpenChange={setShowActionSheet}>
        <SheetContent
          side="bottom"
          className="h-auto max-h-[80vh] rounded-t-3xl px-6 pb-6 pt-4"
          aria-describedby={undefined}
        >
          <SheetHeader className="text-left">
            <SheetTitle className="text-base">대화 옵션</SheetTitle>
            <SheetDescription>
              최근 대화 불러오기, 이미지 메모 보기 등 추가 기능을 사용할 수
              있어요.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3 text-sm">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left"
              disabled={!sessions.length}
              onClick={() =>
                runMobileAction(
                  () => sessions.length && setShowSessions((v) => !v),
                )
              }
            >
              <span>최근 대화 보기</span>
              <span className="text-[11px] text-muted-foreground">
                총 {sessions.length}개
              </span>
            </button>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left"
              disabled={!uploadedImages.length}
              onClick={() =>
                runMobileAction(
                  () => uploadedImages.length && setShowImageDrawer(true),
                )
              }
            >
              <span>이미지 메모 보기</span>
              <span className="text-[11px] text-muted-foreground">
                최근 {uploadedImages.length}개
              </span>
            </button>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left"
              onClick={() => runMobileAction(togglePersistStorage)}
            >
              <span>{persistOptIn ? "기록 저장 끄기" : "기록 저장 켜기"}</span>
            </button>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-2xl border border-destructive/40 px-4 py-3 text-left text-destructive"
              onClick={() => runMobileAction(clearAll)}
            >
              <span>대화 초기화</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
