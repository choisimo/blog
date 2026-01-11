import { useCallback, useEffect } from "react";
import type { ChatMessage, ChatSessionMeta, QuestionMode } from "../types";
import {
  CHAT_SESSIONS_INDEX_KEY,
  CHAT_SESSION_STORAGE_PREFIX,
  CURRENT_SESSION_KEY,
} from "../constants";

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
  const loadSession = useCallback(
    (id: string) => {
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
          localStorage.setItem(CURRENT_SESSION_KEY, id);
        } catch {
          void 0;
        }
      } catch {
        setMessages([]);
      }
    },
    [setMessages, setFirstTokenMs, setAttachedImage, setSessionKey],
  );

  const toggleSessionSelected = useCallback(
    (id: string) => {
      setSelectedSessionIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
      );
    },
    [setSelectedSessionIds],
  );

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

  // Update session index when messages change
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
          } catch {
            void 0;
          }
        }
      } catch {
        void 0;
      }
      return updated;
    });
  }, [messages, summary, questionMode, pageTitle, persistOptIn, sessionKey, setSessions]);

  return {
    loadSession,
    toggleSessionSelected,
    aggregateFromSessionIds,
    handleAggregateFromSelected,
  };
}
