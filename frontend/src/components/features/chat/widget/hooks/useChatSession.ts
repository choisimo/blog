import { useCallback, useEffect, useRef } from "react";
import type { ChatMessage, ChatSessionMeta, QuestionMode } from "../types";
import {
  switchToSession,
  loadSessionMessages,
  storeSessionsIndex,
} from "@/services/chat";

const SESSION_META_DEBOUNCE_MS = 450;

function normalizeHookSessionId(sessionId: unknown): string | null {
  if (typeof sessionId !== "string") return null;
  const value = sessionId.trim();
  if (!value || /[\r\n]/.test(value)) return null;
  return value;
}

function normalizeHookPromptLine(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized || null;
}

type UseChatSessionProps = {
  sessionKey: string;
  setSessionKey: (key: string) => void;
  sessions: ChatSessionMeta[];
  setSessions: React.Dispatch<React.SetStateAction<ChatSessionMeta[]>>;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  persistOptIn: boolean;
  questionMode: QuestionMode;
  summary: string;
  pageTitle: string;
  setFirstTokenMs: (ms: number | null) => void;
  setAttachedImage: (file: File | null) => void;
  setIsAggregatePrompt: (value: boolean) => void;
  setShowSessions: (value: boolean) => void;
  selectedSessionIds: string[];
  setSelectedSessionIds: React.Dispatch<React.SetStateAction<string[]>>;
  setInput: (input: string) => void;
};

export function useChatSession({
  sessionKey,
  setSessionKey,
  sessions,
  setSessions,
  messages,
  setMessages,
  persistOptIn,
  questionMode,
  summary,
  pageTitle,
  setFirstTokenMs,
  setAttachedImage,
  setIsAggregatePrompt,
  setShowSessions,
  selectedSessionIds,
  setSelectedSessionIds,
  setInput,
}: UseChatSessionProps) {
  const persistIndexTimerRef = useRef<number | null>(null);
  const sessionMetaTimerRef = useRef<number | null>(null);

  const scheduleSessionsIndexPersist = useCallback(
    (next: ChatSessionMeta[]) => {
      if (persistIndexTimerRef.current !== null) {
        window.clearTimeout(persistIndexTimerRef.current);
        persistIndexTimerRef.current = null;
      }

      persistIndexTimerRef.current = window.setTimeout(() => {
        storeSessionsIndex(next);
        persistIndexTimerRef.current = null;
      }, 400);
    },
    [],
  );

  const loadSession = useCallback(
    (id: string) => {
      const normalizedId = normalizeHookSessionId(id);
      if (!normalizedId) return;

      const loaded = loadSessionMessages<ChatMessage>(normalizedId);
      setMessages(loaded);
      setFirstTokenMs(null);
      setAttachedImage(null);
      setSessionKey(normalizedId);
      switchToSession(normalizedId);
    },
    [setMessages, setFirstTokenMs, setAttachedImage, setSessionKey],
  );

  const toggleSessionSelected = useCallback(
    (id: string) => {
      const normalizedId = normalizeHookSessionId(id);
      if (!normalizedId) return;

      setSelectedSessionIds((prev) => {
        const normalizedPrev = prev.flatMap((value) => {
          const normalized = normalizeHookSessionId(value);
          return normalized ? [normalized] : [];
        });
        return normalizedPrev.includes(normalizedId)
          ? normalizedPrev.filter((x) => x !== normalizedId)
          : [...normalizedPrev, normalizedId];
      });
    },
    [setSelectedSessionIds],
  );

  const aggregateFromSessionIds = useCallback(
    (ids: string[]) => {
      const uniqueIds = Array.from(
        new Set(
          ids.flatMap((id) => {
            const normalized = normalizeHookSessionId(id);
            return normalized ? [normalized] : [];
          }),
        ),
      );
      if (!uniqueIds.length) return;
      const lines: string[] = ["[참조 세션 요약]"];

      uniqueIds.forEach((id, idx) => {
        const s = sessions.find((x) => normalizeHookSessionId(x.id) === id);
        if (!s) return;
        const title =
          normalizeHookPromptLine(s.title) ||
          normalizeHookPromptLine(s.articleTitle) ||
          `세션 ${idx + 1}`;
        const summaryText =
          normalizeHookPromptLine(s.summary) || "(요약 없음)";
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
    [
      sessions,
      setInput,
      setShowSessions,
      setSelectedSessionIds,
      setIsAggregatePrompt,
    ],
  );

  const handleAggregateFromSelected = useCallback(() => {
    if (!selectedSessionIds.length) return;
    aggregateFromSessionIds(selectedSessionIds);
  }, [aggregateFromSessionIds, selectedSessionIds]);

  // Listen for external aggregate events
  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<{ sessionIds?: string[] }>).detail;
      const ids = detail?.sessionIds;
      if (!Array.isArray(ids) || !ids.length) return;
      const filtered = ids.flatMap((id) => {
        const normalized = normalizeHookSessionId(id);
        return normalized ? [normalized] : [];
      });
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

  // Update session index when messages change
  useEffect(() => {
    const normalizedSessionKey = normalizeHookSessionId(sessionKey);
    if (!persistOptIn || !normalizedSessionKey) return;
    if (messages.length === 0) return;
    if (messages[messages.length - 1]?.pending) return;
    if (sessionMetaTimerRef.current !== null) {
      window.clearTimeout(sessionMetaTimerRef.current);
      sessionMetaTimerRef.current = null;
    }

    sessionMetaTimerRef.current = window.setTimeout(() => {
      const nowIso = new Date().toISOString();
      const firstUser = messages.find(
        (m) => m.role === "user" && m.text.trim(),
      );
      const baseTitle = (firstUser?.text || pageTitle || "새 대화")
        .split("\n")[0]
        .trim();
      const title =
        baseTitle.length > 60 ? `${baseTitle.slice(0, 60)}…` : baseTitle;
      const articleUrl =
        typeof window !== "undefined" ? window.location.href : undefined;

      let nextSessions: ChatSessionMeta[] | null = null;
      setSessions((prev) => {
        const existing = prev.find(
          (s) => normalizeHookSessionId(s.id) === normalizedSessionKey,
        );
        const createdAt = existing?.createdAt || nowIso;
        const next: ChatSessionMeta = {
          id: normalizedSessionKey,
          title: existing?.title || title,
          summary,
          createdAt,
          updatedAt: nowIso,
          messageCount: messages.length,
          mode: questionMode,
          articleUrl: articleUrl || existing?.articleUrl,
          articleTitle: pageTitle || existing?.articleTitle,
        };
        const others = prev.filter(
          (s) => normalizeHookSessionId(s.id) !== normalizedSessionKey,
        );
        const updated = [next, ...others];
        nextSessions = updated;

        if (typeof window !== "undefined") {
          try {
            window.dispatchEvent(new CustomEvent("aiChat:sessionsUpdated"));
          } catch {
            void 0;
          }
        }
        return updated;
      });

      if (nextSessions) {
        scheduleSessionsIndexPersist(nextSessions);
      }
      sessionMetaTimerRef.current = null;
    }, SESSION_META_DEBOUNCE_MS);

    return () => {
      if (sessionMetaTimerRef.current !== null) {
        window.clearTimeout(sessionMetaTimerRef.current);
        sessionMetaTimerRef.current = null;
      }
    };
  }, [
    messages,
    summary,
    questionMode,
    pageTitle,
    persistOptIn,
    sessionKey,
    setSessions,
    scheduleSessionsIndexPersist,
  ]);

  useEffect(() => {
    return () => {
      if (sessionMetaTimerRef.current !== null) {
        window.clearTimeout(sessionMetaTimerRef.current);
        sessionMetaTimerRef.current = null;
      }
      if (persistIndexTimerRef.current !== null) {
        window.clearTimeout(persistIndexTimerRef.current);
        persistIndexTimerRef.current = null;
      }
    };
  }, []);

  return {
    loadSession,
    toggleSessionSelected,
    aggregateFromSessionIds,
    handleAggregateFromSelected,
  };
}
