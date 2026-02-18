import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ChatMessage,
  ChatSessionMeta,
  UploadedChatImage,
  QuestionMode,
} from "../types";
import { PERSIST_OPTIN_KEY } from "../constants";
import {
  getStoredSessionId,
  storeSessionId,
  generateLocalSessionId,
  SESSION_MESSAGES_PREFIX,
  loadSessionsIndex,
} from "@/services/chat";

const SESSION_PERSIST_DEBOUNCE_MS = 400;
const MAX_MESSAGES_PER_SESSION = 200;

export function useChatState(options?: { initialMessage?: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState(options?.initialMessage || "");
  const [busy, setBusy] = useState(false);
  const [persistOptIn, setPersistOptIn] = useState<boolean>(true);

  const [sessionKey, setSessionKey] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const existing = getStoredSessionId();
    if (existing) return existing;

    const fresh = generateLocalSessionId();
    storeSessionId(fresh);
    return fresh;
  });

  const sessionId = sessionKey;

  const [sessions, setSessions] = useState<ChatSessionMeta[]>([]);
  const [showSessions, setShowSessions] = useState(false);
  const [showImageDrawer, setShowImageDrawer] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [isAggregatePrompt, setIsAggregatePrompt] = useState(false);
  const [firstTokenMs, setFirstTokenMs] = useState<number | null>(null);
  const [questionMode, setQuestionMode] = useState<QuestionMode>("article");
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
  const persistTimerRef = useRef<number | null>(null);

  const canSend =
    (input.trim().length > 0 || attachedImage !== null) && !busy;

  // Auto-scroll on new messages
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    sc.scrollTop = sc.scrollHeight + 1000;
  }, [messages, busy]);

  // Load persist opt-in preference
  useEffect(() => {
    const v =
      typeof window !== "undefined"
        ? window.localStorage.getItem(PERSIST_OPTIN_KEY)
        : null;
    setPersistOptIn(v !== "0");
  }, []);

  // Load sessions index
  useEffect(() => {
    if (typeof window === "undefined") return;
    setSessions(loadSessionsIndex());
  }, []);

  // Load messages for current session
  useEffect(() => {
    if (!persistOptIn || !sessionKey) return;
    try {
      const raw = localStorage.getItem(
        `${SESSION_MESSAGES_PREFIX}${sessionKey}`,
      );
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(parsed)) {
          setMessages(parsed.slice(-MAX_MESSAGES_PER_SESSION));
        }
      } else {
        setMessages([]);
      }
    } catch {
      void 0;
    }
  }, [persistOptIn, sessionKey]);

  useEffect(() => {
    if (!persistOptIn || !sessionKey) return;

    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }

    persistTimerRef.current = window.setTimeout(() => {
      try {
        localStorage.setItem(
          `${SESSION_MESSAGES_PREFIX}${sessionKey}`,
          JSON.stringify(messages.slice(-MAX_MESSAGES_PER_SESSION)),
        );
      } catch {
        void 0;
      } finally {
        persistTimerRef.current = null;
      }
    }, SESSION_PERSIST_DEBOUNCE_MS);

    return () => {
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, [messages, persistOptIn, sessionKey]);

  useEffect(() => {
    return () => {
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, []);

  // Handle attached image preview
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
        } catch {
          void 0;
        }
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
      localStorage.setItem(PERSIST_OPTIN_KEY, next ? "1" : "0");
    } catch {
      void 0;
    }
  }, [persistOptIn]);

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

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

  return {
    // State
    messages,
    setMessages,
    input,
    setInput,
    busy,
    setBusy,
    persistOptIn,
    setPersistOptIn,
    sessionId,
    sessionKey,
    setSessionKey,
    sessions,
    setSessions,
    showSessions,
    setShowSessions,
    showImageDrawer,
    setShowImageDrawer,
    showActionSheet,
    setShowActionSheet,
    selectedSessionIds,
    setSelectedSessionIds,
    isAggregatePrompt,
    setIsAggregatePrompt,
    firstTokenMs,
    setFirstTokenMs,
    questionMode,
    setQuestionMode,
    attachedImage,
    setAttachedImage,
    attachedPreviewUrl,
    setAttachedPreviewUrl,
    uploadedImages,
    setUploadedImages,
    // Refs
    scrollRef,
    abortRef,
    fileInputRef,
    textareaRef,
    lastPromptRef,
    // Computed
    canSend,
    summary,
    pageTitle,
    // Functions
    push,
    togglePersistStorage,
    focusInput,
  };
}
