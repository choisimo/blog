import { useCallback, useRef } from "react";
import type { ChatMessage, UploadedChatImage } from "../types";
import {
  streamChatEvents,
  uploadChatImage,
  invokeChatAggregate,
} from "@/services/chat";
import { getRAGContextForChat } from "@/services/rag";
import { getMemoryContextForChat, extractAndSaveMemories } from "@/services/memory";
import { CURRENT_SESSION_KEY, generateSessionKey } from "../constants";

type UseChatActionsProps = {
  canSend: boolean;
  input: string;
  setInput: (input: string) => void;
  attachedImage: File | null;
  setAttachedImage: (file: File | null) => void;
  setAttachedPreviewUrl: (url: string | null) => void;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  setFirstTokenMs: (ms: number | null) => void;
  abortRef: React.MutableRefObject<AbortController | null>;
  push: (msg: ChatMessage) => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  isAggregatePrompt: boolean;
  setIsAggregatePrompt: (value: boolean) => void;
  questionMode: "article" | "general";
  lastPromptRef: React.MutableRefObject<string>;
  uploadedImages: UploadedChatImage[];
  setUploadedImages: React.Dispatch<React.SetStateAction<UploadedChatImage[]>>;
  messages: ChatMessage[];
  setSessionKey: (key: string) => void;
  selectedModel?: string;
};

export function useChatActions({
  canSend,
  input,
  setInput,
  attachedImage,
  setAttachedImage,
  setAttachedPreviewUrl,
  busy,
  setBusy,
  setFirstTokenMs,
  abortRef,
  push,
  setMessages,
  isAggregatePrompt,
  setIsAggregatePrompt,
  questionMode,
  lastPromptRef,
  uploadedImages,
  setUploadedImages,
  messages,
  setSessionKey,
  selectedModel,
}: UseChatActionsProps) {
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
          lines.push(
            "",
            "📷 **AI 이미지 분석:**",
            uploaded.imageAnalysis,
          );
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
        // Fetch RAG context and memory context in parallel
        let ragContext: string | null = null;
        let memoryContext: string | null = null;

        const contextPromises: Promise<void>[] = [];

        // RAG context for general (blog-wide) questions
        if (questionMode === "general") {
          contextPromises.push(
            getRAGContextForChat(baseText, 2000)
              .then((ctx) => {
                ragContext = ctx;
              })
              .catch(() => {
                // RAG search failed, continue without context
              }),
          );
        }

        // User memory context (always fetch when available)
        contextPromises.push(
          getMemoryContextForChat(baseText, 5)
            .then((ctx) => {
              memoryContext = ctx;
            })
            .catch(() => {
              // Memory search failed, continue without context
            }),
        );

        // Wait for all context fetches
        await Promise.all(contextPromises);

        let acc = "";
        push({ id: aiId, role: "assistant", text: "" });
        for await (const ev of streamChatEvents({
          text: baseText,
          signal: controller.signal,
          onFirstToken: (ms) => setFirstTokenMs(ms),
          useArticleContext: questionMode === "article",
          imageUrl: uploaded?.url,
          imageAnalysis: uploaded?.imageAnalysis,
          ragContext,
          memoryContext,
          model: selectedModel,
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
          }
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
      push({ id: errId, role: "system", text: msg });
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
    selectedModel,
  ]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, [abortRef]);

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
    const nextKey = generateSessionKey();
    setSessionKey(nextKey);
    try {
      localStorage.setItem(CURRENT_SESSION_KEY, nextKey);
    } catch {}
  }, [
    messages.length,
    setMessages,
    setFirstTokenMs,
    setAttachedImage,
    setAttachedPreviewUrl,
    setUploadedImages,
    setIsAggregatePrompt,
    setSessionKey,
  ]);

  return { send, stop, clearAll };
}
