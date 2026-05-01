import { useCallback } from "react";
import type {
  ChatMessage,
  ChatMessageAttachment,
  LiveReplyTarget,
  UploadedChatImage,
} from "../types";
import type { PageContext } from "@/services/chat/types";
import type { SelectedBlockAttachment } from "@/services/chat";
import {
  createChatIdempotencyKey,
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
} from "@/services/personal/memory";

function formatLiveRoomName(room: string): string {
  return String(room || "room:lobby")
    .replace(/^room:/, "")
    .replace(/:/g, "/");
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

type UseChatActionsProps = {
  canSend: boolean;
  input: string;
  setInput: (input: string) => void;
  attachedImage: File | null;
  selectedBlockAttachments: SelectedBlockAttachment[];
  setAttachedImage: (file: File | null) => void;
  setSelectedBlockAttachments: React.Dispatch<
    React.SetStateAction<SelectedBlockAttachment[]>
  >;
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
  sendVisitorMessage: (input: {
    text: string;
    replyToName?: string;
    mentionedAgents?: string[];
  }) => Promise<void>;
  livePinned: boolean;
  setLivePinned: React.Dispatch<React.SetStateAction<boolean>>;
  liveReplyTarget: LiveReplyTarget | null;
  setLiveReplyTarget: React.Dispatch<
    React.SetStateAction<LiveReplyTarget | null>
  >;
  currentPost?: PageContext["article"];
};

export function useChatActions({
  canSend,
  input,
  setInput,
  attachedImage,
  selectedBlockAttachments,
  setAttachedImage,
  setSelectedBlockAttachments,
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
  livePinned,
  setLivePinned,
  liveReplyTarget,
  setLiveReplyTarget,
  currentPost,
}: UseChatActionsProps) {
  const redactSelectedBlockAttachments = useCallback(
    (attachments: SelectedBlockAttachment[]): ChatMessageAttachment[] =>
      attachments.map(
        ({
          id,
          name,
          contentType,
          textPreview,
          sizeBytes,
          source,
          truncated,
        }) => ({
          kind: "selected-block",
          id,
          name,
          contentType,
          textPreview,
          sizeBytes,
          source,
          truncated,
        }),
      ),
    [],
  );

  const buildLiveReplyMeta = useCallback(() => {
    if (!liveReplyTarget) {
      return {
        replyToName: undefined,
        mentionedAgents: undefined,
      };
    }

    return {
      replyToName: liveReplyTarget.name,
      mentionedAgents:
        liveReplyTarget.senderType === "agent"
          ? [liveReplyTarget.name.toLowerCase()]
          : undefined,
    };
  }, [liveReplyTarget]);

  const getOutgoingLiveLabel = useCallback(
    (text: string) =>
      liveReplyTarget
        ? `[Live → ${liveReplyTarget.name}] ${text}`
        : `[Live] ${text}`,
    [liveReplyTarget],
  );

  const sendDirectLiveMessage = useCallback(
    async (text: string) => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const liveMeta = buildLiveReplyMeta();

      setInput("");
      push({
        id,
        role: "user",
        text: getOutgoingLiveLabel(text),
      });

      try {
        await sendVisitorMessage({
          text,
          replyToName: liveMeta.replyToName,
          mentionedAgents: liveMeta.mentionedAgents,
        });
        setLiveReplyTarget(null);
      } catch (e) {
        push({
          id: `${id}_live_err`,
          role: "system",
          text: getErrorMessage(e, "Live message delivery failed"),
          systemLevel: "error",
        });
      }
    },
    [
      buildLiveReplyMeta,
      getOutgoingLiveLabel,
      push,
      sendVisitorMessage,
      setInput,
      setLiveReplyTarget,
    ],
  );

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
        statusSource: "command",
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
        } catch (e) {
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
              getErrorMessage(e, "[Live] 방 목록을 가져오지 못했습니다."),
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

      await sendDirectLiveMessage(liveText);
      return;
    }

    if (
      liveReplyTarget &&
      trimmed &&
      !trimmed.startsWith("/") &&
      attachedImage === null &&
      selectedBlockAttachments.length === 0
    ) {
      await sendDirectLiveMessage(trimmed);
      return;
    }

    if (
      livePinned &&
      trimmed &&
      !trimmed.startsWith("/") &&
      attachedImage === null &&
      selectedBlockAttachments.length === 0
    ) {
      await sendDirectLiveMessage(trimmed);
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

      const selectedBlocksToSend = [...selectedBlockAttachments];
      const baseText =
        trimmed ||
        (imageToUpload
          ? "첨부한 이미지에 대해 설명해줘."
          : selectedBlocksToSend.length > 0
            ? "이 선택한 블록을 현재 글의 문맥에 맞게 설명해줘."
            : "");

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
      setSelectedBlockAttachments([]);
      setAttachedPreviewUrl(null);
      push({
        id,
        role: "user",
        text: baseText,
        attachments: redactSelectedBlockAttachments(selectedBlocksToSend),
      });
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
        } catch (error) {
          push({
            id: `${aiId}_memory_search_warn`,
            role: "system",
            text: `저장된 사용자 메모리를 불러오지 못해 개인화 없이 답변합니다: ${getErrorMessage(error, "memory subsystem unavailable")}`,
            systemLevel: "warn",
            systemKind: "status",
            statusSource: "memory",
          });
        }

        let acc = "";
        let finalSources: ChatMessage["sources"] | undefined;
        let finalFollowups: ChatMessage["followups"] | undefined;
        const idempotencyKey = createChatIdempotencyKey();

        push({
          id: aiId,
          role: "assistant",
          text: "",
          pending: true,
          typingLabel: "AI가 작성 중...",
        });
        for await (const ev of streamChatEvents({
          text: baseText,
          signal: controller.signal,
          idempotencyKey,
          onFirstToken: (ms) => setFirstTokenMs(ms),
          useArticleContext: questionMode === "article",
          currentPost,
          selectedBlockAttachments: selectedBlocksToSend,
          imageUrl: uploaded?.url,
          imageAnalysis: uploaded?.imageAnalysis,
          memoryContext,
          enableRag: questionMode === "general",
        })) {
          if (ev.type === "text") {
            acc += ev.text;
          } else if (ev.type === "sources") {
            finalSources = ev.sources;
          } else if (ev.type === "followups") {
            finalFollowups = ev.questions;
          }
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiId
              ? {
                  ...m,
                  text: acc,
                  pending: false,
                  typingLabel: undefined,
                  sources: finalSources,
                  followups: finalFollowups,
                }
              : m,
          ),
        );

        // Extract and save memories from conversation (fire and forget)
        if (acc) {
          extractAndSaveMemories(baseText, acc).catch((error) => {
            push({
              id: `${aiId}_memory_save_warn`,
              role: "system",
              text: `개인화 메모리를 저장하지 못했습니다: ${getErrorMessage(error, "memory subsystem unavailable")}`,
              systemLevel: "warn",
              systemKind: "status",
              statusSource: "memory",
            });
          });
        }
      }
    } catch (e) {
      if (aiId) {
        setMessages((prev) => prev.filter((m) => m.id !== aiId));
      }
      const msg = getErrorMessage(e, "Chat failed");
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
    selectedBlockAttachments,
    setBusy,
    setFirstTokenMs,
    abortRef,
    push,
    setInput,
    setAttachedImage,
    setSelectedBlockAttachments,
    setAttachedPreviewUrl,
    isAggregatePrompt,
    setIsAggregatePrompt,
    questionMode,
    lastPromptRef,
    setUploadedImages,
    setMessages,
    redactSelectedBlockAttachments,
    currentLiveRoom,
    switchLiveRoom,
    livePinned,
    liveReplyTarget,
    setLivePinned,
    currentPost,
    sendDirectLiveMessage,
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
      setSelectedBlockAttachments([]);
      setUploadedImages([]);
      setIsAggregatePrompt(false);
      setLiveReplyTarget(null);

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
      setSelectedBlockAttachments,
      setUploadedImages,
      setIsAggregatePrompt,
      setLiveReplyTarget,
      setSessionKey,
    ],
  );

  return { send, stop, clearAll };
}
