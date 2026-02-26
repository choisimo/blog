import { useCallback } from "react";
import type { ChatMessage, UploadedChatImage } from "../types";
import {
  streamChatEvents,
  uploadChatImage,
  invokeChatAggregate,
  startNewSession,
  getLiveRooms,
  getLiveRoomStats,
} from "@/services/chat";
import {
  getMemoryContextForChat,
  extractAndSaveMemories,
} from "@/services/memory";

function formatLiveRoomName(room: string): string {
  return String(room || "room:lobby")
    .replace(/^room:/, "")
    .replace(/:/g, "/");
}

type UseChatActionsProps = {
  canSend: boolean;
  input: string;
  setInput: (input: string) => void;
  attachedImage: File | null;
  setAttachedImage: (file: File | null) => void;
  setAttachedPreviewUrl: (url: string | null) => void;
  setBusy: (busy: boolean) => void;
  setFirstTokenMs: (ms: number | null) => void;
  abortRef: React.MutableRefObject<AbortController | null>;
  push: (msg: ChatMessage) => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  isAggregatePrompt: boolean;
  setIsAggregatePrompt: (value: boolean) => void;
  questionMode: "article" | "general";
  lastPromptRef: React.MutableRefObject<string>;
  setUploadedImages: React.Dispatch<React.SetStateAction<UploadedChatImage[]>>;
  messages: ChatMessage[];
  setSessionKey: (key: string) => void;
  currentLiveRoom: string;
  switchLiveRoom: (room: string) => void;
  sendVisitorMessage: (text: string) => Promise<void>;
  isMobile: boolean;
  livePinned: boolean;
  setLivePinned: React.Dispatch<React.SetStateAction<boolean>>;
};

export function useChatActions({
  canSend,
  input,
  setInput,
  attachedImage,
  setAttachedImage,
  setAttachedPreviewUrl,
  setBusy,
  setFirstTokenMs,
  abortRef,
  push,
  setMessages,
  isAggregatePrompt,
  setIsAggregatePrompt,
  questionMode,
  lastPromptRef,
  setUploadedImages,
  messages,
  setSessionKey,
  currentLiveRoom,
  switchLiveRoom,
  sendVisitorMessage,
  isMobile,
  livePinned,
  setLivePinned,
}: UseChatActionsProps) {
  const send = useCallback(async () => {
    if (!canSend) return;
    const trimmed = input.trim();

    const pushLiveSystem = (
      text: string,
      level: "info" | "warn" | "error" = "info",
    ) => {
      push({
        id: `live_cmd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        role: "system",
        text,
        systemLevel: level,
        systemKind: level === "error" ? "error" : "status",
      });
    };

    if (
      trimmed.toLowerCase() === "/live" ||
      trimmed.toLowerCase().startsWith("/live ")
    ) {
      const payload = trimmed.slice(5).trim();
      const command = payload.toLowerCase();

      if (!payload || command === "help" || command === "?") {
        setInput("");
        pushLiveSystem(
          [
            "[Live] Commands",
            "- /live <message> : 현재 방에 메시지 전송",
            "- /live on | off : live 고정 모드 켜기/끄기",
            "- /live pin | unpin : live 고정 모드 켜기/끄기",
            "- /live status : 현재 고정 모드 상태",
            "- /live list : 활성 방 목록 보기",
            "- /live room : 현재 접속 방 확인",
            "- /live room <room> : 방 이동 (예: /live room lobby)",
            "- /live join <room> : room 명령과 동일",
            "- /live lobby : 로비(room:lobby)로 이동",
          ].join("\n"),
        );
        return;
      }

      if (command === "status") {
        setInput("");
        pushLiveSystem(
          `[Live] 고정 모드: ${livePinned ? "ON" : "OFF"} · room: ${formatLiveRoomName(currentLiveRoom)}`,
        );
        return;
      }

      if (command === "on" || command === "pin" || command === "fixed") {
        setInput("");
        setLivePinned(true);
        pushLiveSystem(
          `[Live] 고정 모드가 켜졌습니다. 이제 일반 입력은 /live 없이 ${formatLiveRoomName(currentLiveRoom)} 방으로 전송됩니다.`,
        );
        return;
      }

      if (command === "off" || command === "unpin") {
        setInput("");
        setLivePinned(false);
        pushLiveSystem(
          "[Live] 고정 모드가 꺼졌습니다. 일반 AI 채팅으로 복귀합니다.",
        );
        return;
      }

      if (command === "list" || command === "rooms") {
        setInput("");
        try {
          const rooms = await getLiveRooms();
          if (rooms.length === 0) {
            pushLiveSystem("[Live] 현재 활성 방이 없습니다.");
            return;
          }

          const top = rooms.slice(0, 12);
          pushLiveSystem(
            [
              `[Live] Active rooms (${rooms.length})`,
              ...top.map(
                (r, idx) =>
                  `${idx + 1}. ${formatLiveRoomName(r.room)} · ${r.onlineCount} online`,
              ),
              "",
              "Use /live room <name> to move.",
            ].join("\n"),
          );
        } catch (e: any) {
          try {
            const stats = await getLiveRoomStats(currentLiveRoom);
            pushLiveSystem(
              [
                "[Live] 전체 방 목록 API를 사용할 수 없어 현재 방만 표시합니다.",
                `- ${formatLiveRoomName(stats.room)} · ${stats.onlineCount} online`,
              ].join("\n"),
              "warn",
            );
          } catch {
            pushLiveSystem(
              e?.message || "[Live] 방 목록을 가져오지 못했습니다.",
              "error",
            );
          }
        }
        return;
      }

      if (command === "room") {
        setInput("");
        pushLiveSystem(
          `[Live] 현재 방: ${formatLiveRoomName(currentLiveRoom)}`,
        );
        return;
      }

      if (command === "lobby") {
        setInput("");
        switchLiveRoom("room:lobby");
        pushLiveSystem("[Live] room:lobby 로 이동합니다. 재연결 중...");
        return;
      }

      if (command.startsWith("room ") || command.startsWith("join ")) {
        const nextRoom = payload.split(/\s+/).slice(1).join(" ").trim();
        if (!nextRoom) {
          setInput("");
          pushLiveSystem(
            "[Live] 방 이름이 필요합니다. 예: /live room lobby",
            "warn",
          );
          return;
        }

        setInput("");
        switchLiveRoom(nextRoom);
        pushLiveSystem(
          `[Live] ${formatLiveRoomName(nextRoom)} 방으로 이동합니다. 재연결 중...`,
        );
        return;
      }

      const liveText = payload;
      if (!liveText) return;

      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      setInput("");
      push({ id, role: "user", text: `[Live] ${liveText}` });

      try {
        await sendVisitorMessage(liveText);
      } catch (e: any) {
        push({
          id: `${id}_live_err`,
          role: "system",
          text: e?.message || "Live message delivery failed",
          systemLevel: "error",
        });
      }
      return;
    }

    if (
      livePinned &&
      trimmed &&
      !trimmed.startsWith("/") &&
      attachedImage === null
    ) {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      setInput("");
      push({ id, role: "user", text: `[Live] ${trimmed}` });

      try {
        await sendVisitorMessage(trimmed);
      } catch (e: any) {
        push({
          id: `${id}_live_err`,
          role: "system",
          text: e?.message || "Live message delivery failed",
          systemLevel: "error",
        });
      }
      return;
    }

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
        imageAnalysis?: string | null;
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

        // Show AI image analysis result if available
        if (uploaded.imageAnalysis) {
          lines.push("", "📷 **AI 이미지 분석:**", uploaded.imageAnalysis);
        }

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
        let memoryContext: string | null = null;

        try {
          memoryContext = await getMemoryContextForChat(baseText, 5);
        } catch {
          // Memory search failed, continue without context
        }

        let acc = "";
        let rafHandle: number | null = null;
        let mobileFlushTimer: number | null = null;
        const MOBILE_STREAM_FLUSH_MS = 48;

        const commitAssistantText = (snapshot: string) => {
          const id = aiId;
          setMessages((prev) =>
            prev.map((m) => (m.id === id ? { ...m, text: snapshot } : m)),
          );
        };

        const scheduleAssistantTextCommit = (snapshot: string) => {
          if (isMobile) {
            if (mobileFlushTimer !== null) return;
            mobileFlushTimer = window.setTimeout(() => {
              mobileFlushTimer = null;
              commitAssistantText(acc);
            }, MOBILE_STREAM_FLUSH_MS);
            return;
          }

          if (rafHandle !== null) cancelAnimationFrame(rafHandle);
          rafHandle = requestAnimationFrame(() => {
            rafHandle = null;
            commitAssistantText(snapshot);
          });
        };

        push({ id: aiId, role: "assistant", text: "" });
        for await (const ev of streamChatEvents({
          text: baseText,
          signal: controller.signal,
          onFirstToken: (ms) => setFirstTokenMs(ms),
          useArticleContext: questionMode === "article",
          imageUrl: uploaded?.url,
          imageAnalysis: uploaded?.imageAnalysis,
          memoryContext,
          enableRag: questionMode === "general",
        })) {
          if (ev.type === "text") {
            acc += ev.text;
            scheduleAssistantTextCommit(acc);
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
          }
        }

        // Flush any pending rAF update so the final text is committed immediately
        if (mobileFlushTimer !== null) {
          window.clearTimeout(mobileFlushTimer);
          mobileFlushTimer = null;
          commitAssistantText(acc);
        }
        if (rafHandle !== null) {
          cancelAnimationFrame(rafHandle);
          commitAssistantText(acc);
          rafHandle = null;
        }

        // Extract and save memories from conversation (fire and forget)
        if (acc) {
          extractAndSaveMemories(baseText, acc).catch(() => {
            // Silent fail - memory extraction is optional
          });
        }
      }
    } catch (e: any) {
      const msg = e?.message || "Chat failed";
      const errId =
        aiId != null
          ? `${aiId}_err`
          : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_err`;
      push({ id: errId, role: "system", text: msg, systemLevel: "error" });
    } finally {
      setBusy(false);
    }
  }, [
    canSend,
    input,
    attachedImage,
    setBusy,
    setFirstTokenMs,
    abortRef,
    push,
    setInput,
    setAttachedImage,
    setAttachedPreviewUrl,
    isAggregatePrompt,
    setIsAggregatePrompt,
    questionMode,
    lastPromptRef,
    setUploadedImages,
    setMessages,
    currentLiveRoom,
    switchLiveRoom,
    sendVisitorMessage,
    isMobile,
    livePinned,
    setLivePinned,
  ]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, [abortRef]);

  const clearAll = useCallback(
    async (skipConfirm = false) => {
      if (messages.length > 0 && !skipConfirm) {
        return false;
      }
      setMessages([]);
      setFirstTokenMs(null);
      setAttachedImage(null);
      setAttachedPreviewUrl(null);
      setUploadedImages([]);
      setIsAggregatePrompt(false);

      const nextKey = await startNewSession();
      setSessionKey(nextKey);
      return true;
    },
    [
      messages.length,
      setMessages,
      setFirstTokenMs,
      setAttachedImage,
      setAttachedPreviewUrl,
      setUploadedImages,
      setIsAggregatePrompt,
      setSessionKey,
    ],
  );

  return { send, stop, clearAll };
}
