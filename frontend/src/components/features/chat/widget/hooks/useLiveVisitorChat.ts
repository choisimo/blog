import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { connectLiveChatStream, sendLiveChatMessage } from "@/services/chat";
import type { LiveChatEvent } from "@/services/chat/live";
import type {
  ChatMessage,
  ChatStatusBanner,
  ChatTransportStatus,
  SystemMessageLevel,
} from "../types";

const VISITOR_NAME_KEY = "aiChat.liveVisitorName";

function normalizeRoomKey(rawRoom: string): string {
  const fallback = "room:lobby";
  const trimmed = String(rawRoom || "")
    .trim()
    .toLowerCase();
  if (!trimmed) return fallback;

  const normalized = trimmed
    .replace(/[^a-z0-9:_-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);

  if (!normalized) return fallback;
  return normalized.startsWith("room:") ? normalized : `room:${normalized}`;
}

function toRoomKey(pathname: string): string {
  const normalized = (pathname || "/").replace(/\/+$/, "") || "/";
  const parts = normalized.split("/").filter(Boolean);

  if (parts.length === 0) return "room:lobby";

  if ((parts[0] === "blog" || parts[0] === "post") && parts.length >= 3) {
    const year = parts[1];
    const slug = parts.slice(2).join("-");
    return normalizeRoomKey(`room:blog:${year}:${slug}`);
  }

  if (parts[0] === "projects") {
    const project = parts[1] || "lobby";
    return normalizeRoomKey(`room:project:${project}`);
  }

  return normalizeRoomKey(`room:page:${parts.join(":")}`);
}

function formatRoomName(room: string): string {
  return String(room || "room:lobby")
    .replace(/^room:/, "")
    .replace(/:/g, "/");
}

function getVisitorName(): string {
  try {
    const existing = sessionStorage.getItem(VISITOR_NAME_KEY);
    if (existing && existing.trim()) return existing;
    const generated = `visitor-${Math.random().toString(36).slice(2, 6)}`;
    sessionStorage.setItem(VISITOR_NAME_KEY, generated);
    return generated;
  } catch {
    return `visitor-${Math.random().toString(36).slice(2, 6)}`;
  }
}

function normalizeSystemLevel(
  level?: "info" | "warn" | "error",
): SystemMessageLevel {
  if (level === "error" || level === "warn") return level;
  return "info";
}

function formatSessionMessage(message: string): string {
  const raw = String(message || "").trim();
  const normalized = raw.toLowerCase();

  if (normalized === "ai response completed") {
    return "AI 응답이 완료되었습니다.";
  }

  if (normalized === "your live message was delivered") {
    return "라이브 메시지가 전달되었습니다. 참여자가 없으면 답변이 바로 오지 않을 수 있습니다.";
  }

  if (normalized.endsWith("replied in the room")) {
    const suffix = "replied in the room";
    const name = raw.slice(0, -suffix.length).trim();
    return `${name || "assistant"}가 방에서 응답했습니다.`;
  }

  if (normalized.includes("replied in the room using")) {
    const marker = " replied in the room using ";
    const idx = raw.toLowerCase().indexOf(marker);
    if (idx >= 0) {
      const name = raw.slice(0, idx).trim();
      const context = raw.slice(idx + marker.length).trim();
      return `${name || "assistant"}가 ${context} 기반으로 방에서 응답했습니다.`;
    }
  }

  if (normalized === "auto room reply skipped due to temporary ai error") {
    return "자동 응답이 일시 오류로 생략되었습니다.";
  }

  return raw;
}

function buildLiveAuthorMeta(
  event: Extract<LiveChatEvent, { type: "live_message" | "typing" }>,
): string {
  if (event.senderType === "agent") {
    const metaParts = [
      event.personaStyle ? `${event.personaStyle} persona` : "live agent",
      event.contextKinds?.length
        ? `${event.contextKinds.join("+")} backed`
        : null,
      event.triggeredByMention ? "called in" : null,
      event.replyToName ? `replying to ${event.replyToName}` : null,
      event.turnIndex && event.roundSize
        ? `turn ${event.turnIndex}/${event.roundSize}`
        : null,
    ].filter(Boolean);
    return metaParts.join(" · ");
  }

  return [
    "live visitor",
    event.replyToName ? `replying to ${event.replyToName}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function normalizeActorKey(name: string): string {
  return String(name || "anonymous")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createLiveTypingMessageId(
  room: string,
  senderType: "client" | "agent" | undefined,
  name: string,
  roundId?: string,
): string {
  return [
    "live_typing",
    normalizeRoomKey(room),
    roundId || "standalone",
    senderType || "unknown",
    normalizeActorKey(name),
  ].join(":");
}

function buildTransportStatus(input: {
  phase: ChatTransportStatus["phase"];
  room: string;
  tone: SystemMessageLevel;
  onlineCount?: number;
  reconnectAttempts?: number;
}): ChatTransportStatus {
  const roomLabel = formatRoomName(input.room);

  if (input.phase === "connected") {
    return {
      phase: "connected",
      tone: input.tone,
      roomLabel,
      onlineCount: input.onlineCount,
      reconnectAttempts: 0,
      updatedAt: Date.now(),
      label: "연결됨",
      detail:
        input.onlineCount !== undefined
          ? `${roomLabel} 방에 연결되었습니다. 현재 ${input.onlineCount}명이 온라인입니다.`
          : `${roomLabel} 방에 연결되었습니다.`,
    };
  }

  if (input.phase === "reconnecting") {
    const attempt = input.reconnectAttempts ?? 1;
    return {
      phase: "reconnecting",
      tone: input.tone,
      roomLabel,
      reconnectAttempts: attempt,
      updatedAt: Date.now(),
      label: attempt > 1 ? `재연결 ${attempt}회` : "재연결 중",
      detail: `${roomLabel} 방 연결이 불안정합니다. ${attempt}회째 다시 연결하고 있습니다.`,
    };
  }

  if (input.phase === "disconnected") {
    return {
      phase: "disconnected",
      tone: input.tone,
      roomLabel,
      reconnectAttempts: input.reconnectAttempts,
      updatedAt: Date.now(),
      label: "끊김",
      detail: `${roomLabel} 방 연결이 끊어졌습니다.`,
    };
  }

  return {
    phase: "connecting",
    tone: input.tone,
    roomLabel,
    reconnectAttempts: 0,
    updatedAt: Date.now(),
    label: "연결 중",
    detail: `${roomLabel} 방에 연결하고 있습니다.`,
  };
}

function classifySessionNotification(
  message: string,
  level: SystemMessageLevel,
): {
  kind: "ignore" | "banner";
  tone: SystemMessageLevel;
  text?: string;
} {
  const normalized = String(message || "")
    .trim()
    .toLowerCase();
  const formatted = formatSessionMessage(message);

  if (normalized === "ai response completed") {
    return { kind: "ignore", tone: "info" };
  }

  if (normalized === "your live message was delivered") {
    return { kind: "ignore", tone: "info" };
  }

  if (
    normalized.endsWith("replied in the room") ||
    normalized.includes("replied in the room using")
  ) {
    return { kind: "ignore", tone: "info" };
  }

  if (normalized === "auto room reply skipped due to temporary ai error") {
    return {
      kind: "banner",
      tone: "warn",
      text: formatted,
    };
  }

  if (level === "error") {
    return {
      kind: "banner",
      tone: "error",
      text: formatted,
    };
  }

  if (level === "warn") {
    return {
      kind: "banner",
      tone: "warn",
      text: formatted,
    };
  }

  return { kind: "ignore", tone: level };
}

export function useLiveVisitorChat(input: {
  sessionId: string;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}) {
  const { sessionId, setMessages } = input;
  const initialRoom =
    typeof window === "undefined"
      ? "room:lobby"
      : toRoomKey(window.location.pathname);
  const connectedRef = useRef(false);
  const disconnectRef = useRef<(() => void) | null>(null);
  const liveSessionIdRef = useRef<string>(sessionId);
  const reconnectAttemptsRef = useRef(0);
  const bannerTimerRef = useRef<number | null>(null);
  const visitorName = useMemo(() => getVisitorName(), []);
  const [room, setRoom] = useState<string>(initialRoom);
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const [transportStatus, setTransportStatus] = useState<ChatTransportStatus>(
    () =>
      buildTransportStatus({
        phase: "connecting",
        room: initialRoom,
        tone: "info",
      }),
  );
  const [banner, setBanner] = useState<ChatStatusBanner | null>(null);

  const clearBannerTimer = useCallback(() => {
    if (bannerTimerRef.current !== null) {
      window.clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }
  }, []);

  const showBanner = useCallback(
    (nextBanner: ChatStatusBanner | null, autoHideMs?: number) => {
      clearBannerTimer();
      setBanner(nextBanner);

      if (nextBanner && autoHideMs) {
        bannerTimerRef.current = window.setTimeout(() => {
          setBanner((current) =>
            current?.id === nextBanner.id ? null : current,
          );
          bannerTimerRef.current = null;
        }, autoHideMs);
      }
    },
    [clearBannerTimer],
  );

  const upsertTypingBubble = useCallback(
    (event: Extract<LiveChatEvent, { type: "typing" }>) => {
      const sender = event.name || "anonymous";
      const typingId = createLiveTypingMessageId(
        event.room,
        event.senderType,
        sender,
        event.roundId,
      );

      setMessages((prev) => {
        const nextMessage: ChatMessage = {
          id: typingId,
          role: "assistant",
          channel: "live",
          authorName: sender,
          authorMeta: buildLiveAuthorMeta(event),
          liveSenderType: event.senderType === "agent" ? "agent" : "client",
          text: "",
          pending: true,
          typingLabel: `${sender}가 작성 중...`,
          typingKey: typingId,
          transient: true,
          expiresAt: Date.now() + 15_000,
        };

        const existingIndex = prev.findIndex(
          (message) => message.id === typingId,
        );
        const existing = existingIndex >= 0 ? prev[existingIndex] : null;
        if (existingIndex < 0 || (existing && !existing.pending)) {
          return [...prev, nextMessage];
        }

        return prev.map((message, index) =>
          index === existingIndex ? { ...message, ...nextMessage } : message,
        );
      });
    },
    [setMessages],
  );

  const commitLiveMessage = useCallback(
    (event: Extract<LiveChatEvent, { type: "live_message" }>) => {
      const sender = event.name || "anonymous";
      const typingId = createLiveTypingMessageId(
        event.room,
        event.senderType,
        sender,
        event.roundId,
      );
      const nextMessage: ChatMessage = {
        id: `live_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        role: "assistant",
        channel: "live",
        authorName: sender,
        authorMeta: buildLiveAuthorMeta(event),
        liveSenderType: event.senderType === "agent" ? "agent" : "client",
        text: event.text,
        pending: false,
        typingLabel: undefined,
        typingKey: typingId,
        transient: false,
        expiresAt: undefined,
        sources: event.sources,
      };

      setMessages((prev) => [
        ...prev.filter((message) => message.id !== typingId),
        nextMessage,
      ]);
    },
    [setMessages],
  );

  useEffect(() => {
    liveSessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    return () => {
      clearBannerTimer();
    };
  }, [clearBannerTimer]);

  const switchRoom = useCallback(
    (nextRoom: string) => {
      const normalized = normalizeRoomKey(nextRoom);
      connectedRef.current = false;
      reconnectAttemptsRef.current = 0;
      setTransportStatus(
        buildTransportStatus({
          phase: "connecting",
          room: normalized,
          tone: "info",
        }),
      );
      showBanner(null);
      try {
        disconnectRef.current?.();
      } catch {
        // ignore disconnect errors
      } finally {
        disconnectRef.current = null;
      }
      setRoom(normalized);
      setReconnectNonce((prev) => prev + 1);
    },
    [showBanner],
  );

  useEffect(() => {
    if (!sessionId) return;

    setTransportStatus(
      buildTransportStatus({
        phase: "connecting",
        room,
        tone: "info",
      }),
    );

    const disconnect = connectLiveChatStream({
      sessionId,
      room,
      name: visitorName,
      onEvent: (event: LiveChatEvent) => {
        if (event.type === "ping") return;

        if (event.type === "connected") {
          if (event.sessionId && typeof event.sessionId === "string") {
            liveSessionIdRef.current = event.sessionId;
          }

          const connectedRoom = event.room || room;
          const recovered = reconnectAttemptsRef.current > 0;
          connectedRef.current = true;
          setTransportStatus(
            buildTransportStatus({
              phase: "connected",
              room: connectedRoom,
              tone: "info",
              onlineCount: event.onlineCount,
            }),
          );

          if (recovered) {
            showBanner(
              {
                id: `live_recovered_${Date.now()}`,
                text: `${formatRoomName(connectedRoom)} 방 연결이 복구되었습니다.`,
                tone: "info",
              },
              2600,
            );
          } else {
            showBanner(null);
          }
          reconnectAttemptsRef.current = 0;
          return;
        }

        if (event.type === "presence") {
          const activeLiveSessionId = liveSessionIdRef.current || sessionId;
          if (event.sessionId === activeLiveSessionId) return;
          return;
        }

        if (event.type === "typing") {
          const sender = event.name || "anonymous";
          const activeLiveSessionId = liveSessionIdRef.current || sessionId;
          const isSelfEcho =
            event.sessionId === activeLiveSessionId &&
            sender.trim().toLowerCase() === visitorName.trim().toLowerCase();
          if (isSelfEcho) return;

          upsertTypingBubble(event);
          return;
        }

        if (event.type === "live_message") {
          const sender = event.name || "anonymous";
          const activeLiveSessionId = liveSessionIdRef.current || sessionId;
          const isSelfEcho =
            event.sessionId === activeLiveSessionId &&
            sender.trim().toLowerCase() === visitorName.trim().toLowerCase();
          if (isSelfEcho) return;

          const isLiveAgent =
            event.senderType === "agent" ||
            sender.toLowerCase() === "room-companion";

          if (isLiveAgent) {
            commitLiveMessage(event);
            return;
          }

          commitLiveMessage(event);
          return;
        }

        if (
          event.type === "session_notification" &&
          event.sessionId === (liveSessionIdRef.current || sessionId)
        ) {
          const lvl = normalizeSystemLevel(event.level);
          const notification = classifySessionNotification(event.message, lvl);

          if (notification.kind === "banner" && notification.text) {
            showBanner({
              id: `session_notice_${Date.now()}`,
              text: notification.text,
              tone: notification.tone,
            });
          }
        }
      },
      onError: () => {
        connectedRef.current = false;
        reconnectAttemptsRef.current += 1;
        const reconnecting = buildTransportStatus({
          phase: "reconnecting",
          room,
          tone: "warn",
          reconnectAttempts: reconnectAttemptsRef.current,
        });
        setTransportStatus(reconnecting);
        showBanner({
          id: "live_reconnecting",
          text: reconnecting.detail,
          tone: "warn",
        });
      },
    });
    disconnectRef.current = disconnect;

    return () => {
      connectedRef.current = false;
      disconnect();
      if (disconnectRef.current === disconnect) {
        disconnectRef.current = null;
      }
    };
  }, [
    commitLiveMessage,
    room,
    reconnectNonce,
    sessionId,
    showBanner,
    upsertTypingBubble,
    visitorName,
  ]);

  const sendVisitorMessage = useCallback(
    async (input: {
      text: string;
      replyToName?: string;
      mentionedAgents?: string[];
    }) => {
      await sendLiveChatMessage({
        sessionId: liveSessionIdRef.current || sessionId,
        text: input.text,
        room,
        name: visitorName,
        senderType: "client",
        replyToName: input.replyToName,
        mentionedAgents: input.mentionedAgents,
      });
    },
    [sessionId, visitorName, room],
  );

  return {
    banner,
    sendVisitorMessage,
    room,
    switchRoom,
    transportStatus,
  };
}
