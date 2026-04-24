import { useCallback, useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/ui/use-mobile";
import { useTheme } from "@/contexts/ThemeContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { PageContext } from "@/services/chat/types";
import type { LiveReplyTarget } from "./types";

import {
  useChatState,
  useChatSession,
  useChatActions,
  useLiveVisitorChat,
  useKeyboardHeight,
  useInputKeyDown,
  usePreventScrollChaining,
} from "./hooks";
import {
  ChatHeader,
  ChatSessionPanel,
  ModeSelector,
  ChatMessages,
  ChatStatusRail,
  ChatInput,
  ImageDrawer,
  MobileActionSheet,
  LiveRoomPanel,
  ChatSidebar,
} from "./components";
import { streamChatEvents } from "@/services/chat";

function formatLiveRoomName(room: string): string {
  return String(room || "room:lobby")
    .replace(/^room:/, "")
    .replace(/:/g, "/");
}

export default function ChatWidget(props: {
  onClose?: () => void;
  initialMessage?: string;
  currentPost?: PageContext["article"];
}) {
  const isMobile = useIsMobile();
  const { isTerminal } = useTheme();
  const keyboardViewport = useKeyboardHeight(isMobile);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [debateBusy, setDebateBusy] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const debateAbortRef = useRef<AbortController | null>(null);
  const widgetRef = useRef<HTMLDivElement | null>(null);

  // Main state hook
  const state = useChatState({ initialMessage: props.initialMessage });
  const {
    focusInput,
    push,
    setInput,
    setLivePinned,
    setLiveReplyTarget,
    setMessages,
    setShowActionSheet,
  } = state;

  // Dynamic max height calculation for PC
  const [pcMaxHeight, setPcMaxHeight] = useState("80vh");
  usePreventScrollChaining(widgetRef);

  useEffect(() => {
    if (isMobile) return;

    const calculateHeight = () => {
      const vh = window.innerHeight;
      const safeMax = isExpanded
        ? Math.min(vh * 0.94, vh - 32)
        : Math.min(vh * 0.85, vh - 100);
      setPcMaxHeight(`${Math.round(safeMax)}px`);
    };

    calculateHeight();
    window.addEventListener("resize", calculateHeight);
    return () => window.removeEventListener("resize", calculateHeight);
  }, [isExpanded, isMobile]);

  useEffect(() => {
    if (isMobile && isExpanded) {
      setIsExpanded(false);
    }
  }, [isExpanded, isMobile]);

  useEffect(() => {
    if (!isMobile || !keyboardViewport.keyboardVisible) return;
    const scroller = state.scrollRef.current;
    if (!scroller) return;

    const raf = requestAnimationFrame(() => {
      scroller.scrollTop = scroller.scrollHeight;
    });

    return () => cancelAnimationFrame(raf);
  }, [isMobile, keyboardViewport.keyboardVisible, state.scrollRef]);

  // Session management
  const session = useChatSession({
    sessionKey: state.sessionKey,
    setSessionKey: state.setSessionKey,
    sessions: state.sessions,
    setSessions: state.setSessions,
    messages: state.messages,
    setMessages: state.setMessages,
    persistOptIn: state.persistOptIn,
    questionMode: state.questionMode,
    summary: state.summary,
    pageTitle: state.pageTitle,
    setFirstTokenMs: state.setFirstTokenMs,
    setAttachedImage: state.setAttachedImage,
    setIsAggregatePrompt: state.setIsAggregatePrompt,
    setShowSessions: state.setShowSessions,
    selectedSessionIds: state.selectedSessionIds,
    setSelectedSessionIds: state.setSelectedSessionIds,
    setInput: state.setInput,
  });

  const liveVisitorChat = useLiveVisitorChat({
    sessionId: state.sessionKey,
    setMessages: state.setMessages,
  });

  // Chat actions
  const actions = useChatActions({
    canSend: state.canSend,
    input: state.input,
    setInput: state.setInput,
    attachedImage: state.attachedImage,
    setAttachedImage: state.setAttachedImage,
    setAttachedPreviewUrl: state.setAttachedPreviewUrl,
    setBusy: state.setBusy,
    setFirstTokenMs: state.setFirstTokenMs,
    abortRef: state.abortRef,
    push: state.push,
    setMessages: state.setMessages,
    isAggregatePrompt: state.isAggregatePrompt,
    setIsAggregatePrompt: state.setIsAggregatePrompt,
    questionMode: state.questionMode,
    lastPromptRef: state.lastPromptRef,
    setUploadedImages: state.setUploadedImages,
    messages: state.messages,
    setSessionKey: state.setSessionKey,
    currentLiveRoom: liveVisitorChat.room,
    switchLiveRoom: liveVisitorChat.switchRoom,
    sendVisitorMessage: liveVisitorChat.sendVisitorMessage,
    livePinned: state.livePinned,
    setLivePinned: state.setLivePinned,
    liveReplyTarget: state.liveReplyTarget,
    setLiveReplyTarget: state.setLiveReplyTarget,
    currentPost: props.currentPost,
  });

  // Keyboard handler
  const onKeyDown = useInputKeyDown({
    canSend: state.canSend,
    send: actions.send,
  });

  const handlePromptClick = useCallback(
    (prompt: string) => {
      setInput(prompt);
      focusInput();
    },
    [focusInput, setInput],
  );

  const handleRetry = useCallback(
    (lastPrompt: string) => {
      setInput(lastPrompt);
      focusInput();
    },
    [focusInput, setInput],
  );

  const handleClearAll = useCallback(async () => {
    const cleared = await actions.clearAll();
    if (!cleared) {
      setShowClearConfirm(true);
    }
  }, [actions]);

  const handleClearConfirm = useCallback(() => {
    actions.clearAll(true);
    setShowClearConfirm(false);
  }, [actions]);

  const isKeyboardFocusMode = isMobile && keyboardViewport.keyboardVisible;
  const currentLiveRoomLabel = formatLiveRoomName(liveVisitorChat.room);
  const toggleLivePinned = useCallback(() => {
    setLivePinned((prev) => !prev);
  }, [setLivePinned]);
  const handleExpireMessage = useCallback(
    (id: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    },
    [setMessages],
  );
  const handleReplyToLiveMessage = useCallback(
    (target: LiveReplyTarget) => {
      setLiveReplyTarget(target);
      focusInput();
    },
    [focusInput, setLiveReplyTarget],
  );

  useEffect(() => {
    setLiveReplyTarget(null);
  }, [liveVisitorChat.room, setLiveReplyTarget]);

  const handleStartDebate = useCallback(async () => {
    if (debateBusy) return;
    setShowActionSheet(false);

    const roomLabel = formatLiveRoomName(liveVisitorChat.room);
    const topic = `${roomLabel} 방 주제로 AI 토론`;

    // 토론 시작 알림
    push({
      id: `debate_start_${Date.now()}`,
      role: "system",
      text: `[토론 시작] 주제: ${topic}`,
      systemKind: "status",
    });

    setDebateBusy(true);
    const abort = new AbortController();
    debateAbortRef.current = abort;

    const PRO_PROMPT =
      `당신은 논리적이고 설득력 있는 찬성측 토론자입니다. 주어진 주제에 대해 명확한 근거와 사례를 들어 찬성 주장을 펼치세요. ` +
      `3-5문장 이내로 핵심 논거를 제시하세요.\n\n주제: ${topic}`;
    const CON_PROMPT =
      `당신은 날카롭고 비판적인 반대측 토론자입니다. 주어진 주제에 대해 구체적인 반박 근거를 들어 반대 주장을 펼치세요. ` +
      `3-5문장 이내로 핵심 논거를 제시하세요.\n\n주제: ${topic}`;

    const rounds = 2;

    const runDebateTurn = async (params: {
      prompt: string;
      id: string;
      prefix: string;
      signal: AbortSignal;
    }) => {
      let text = "";

      try {
        for await (const ev of streamChatEvents({
          text: params.prompt,
          signal: params.signal,
          useArticleContext: false,
        })) {
          if (ev.type !== "text") continue;
          text += ev.text;
        }
      } finally {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === params.id
              ? {
                  ...m,
                  text: `${params.prefix}${text}`,
                  pending: false,
                  typingLabel: undefined,
                }
              : m,
          ),
        );
      }

      return text;
    };

    try {
      let previousConText = "";
      for (let round = 1; round <= rounds; round++) {
        if (abort.signal.aborted) break;

        // 찬성측 발언
        const proId = `debate_pro_${round}_${Date.now()}`;
        push({
          id: proId,
          role: "assistant",
          text: "",
          pending: true,
          typingLabel: "토론 · 찬성 작성 중...",
        });
        const proText = await runDebateTurn({
          prompt:
            round === 1
              ? PRO_PROMPT
              : `${PRO_PROMPT}\n\n직전 반대측 주장:\n${previousConText}\n위 주장에 반박하며 찬성 논리를 강화하세요.`,
          id: proId,
          prefix: "[토론 · 찬성] ",
          signal: abort.signal,
        });

        if (abort.signal.aborted) break;

        // 반대측 발언
        const conId = `debate_con_${round}_${Date.now()}`;
        push({
          id: conId,
          role: "assistant",
          text: "",
          pending: true,
          typingLabel: "토론 · 반대 작성 중...",
        });
        const conText = await runDebateTurn({
          prompt:
            round === 1
              ? `${CON_PROMPT}\n\n찬성측 주장:\n${proText}`
              : `${CON_PROMPT}\n\n찬성측 최신 주장:\n${proText}\n이를 반박하여 반대 주장을 강화하세요.`,
          id: conId,
          prefix: "[토론 · 반대] ",
          signal: abort.signal,
        });
        previousConText = conText;
      }

      if (!abort.signal.aborted) {
        push({
          id: `debate_end_${Date.now()}`,
          role: "system",
          text: "[토론 종료] AI 토론이 완료되었습니다.",
          systemKind: "status",
        });
      }
    } catch {
      if (!abort.signal.aborted) {
        push({
          id: `debate_err_${Date.now()}`,
          role: "system",
          text: "[토론 오류] 토론 중 문제가 발생했습니다.",
          systemKind: "error",
          systemLevel: "error",
        });
      }
    } finally {
      setDebateBusy(false);
      debateAbortRef.current = null;
    }
  }, [debateBusy, liveVisitorChat.room, push, setMessages, setShowActionSheet]);

  return (
    <>
      <div
        ref={widgetRef}
        className={cn(
          "fixed z-[var(--z-chat-widget)] flex flex-col overflow-hidden border bg-background overscroll-contain",
          isMobile ? "shadow-none" : "shadow-2xl transition-all",
          // Mobile: always fullscreen
          isMobile
            ? "left-0 right-0 rounded-none max-w-full w-full overflow-x-hidden"
            : isExpanded
              ? "left-1/2 top-4 w-[min(calc(100%-24px),88rem)] -translate-x-1/2 rounded-2xl"
              : sidebarOpen
                ? "bottom-20 left-1/2 w-[min(100%-24px,58rem)] -translate-x-1/2 rounded-2xl"
                : "bottom-20 left-1/2 w-[min(100%-24px,42rem)] -translate-x-1/2 rounded-2xl",
          isTerminal &&
            !isMobile &&
            "border-border bg-[hsl(var(--terminal-code-bg))] rounded-lg terminal-crt",
          isTerminal &&
            isMobile &&
            "border-0 bg-[hsl(var(--terminal-code-bg))]",
        )}
        style={
          isMobile
            ? {
                height: keyboardViewport.viewportHeight,
                top: `${keyboardViewport.viewportTop}px`,
                bottom: "auto",
              }
            : isExpanded
              ? { height: pcMaxHeight, maxHeight: pcMaxHeight, bottom: "auto" }
              : { height: pcMaxHeight, maxHeight: pcMaxHeight }
        }
      >
        {/* Header */}
        <ChatHeader
          isMobile={isMobile}
          isTerminal={isTerminal}
          busy={state.busy}
          persistOptIn={state.persistOptIn}
          sessions={state.sessions}
          uploadedImages={state.uploadedImages}
          onShowSessions={() => state.setShowSessions((v) => !v)}
          onShowActionSheet={() => state.setShowActionSheet(true)}
          onShowImageDrawer={() => state.setShowImageDrawer(true)}
          onTogglePersist={state.togglePersistStorage}
          onStartDebate={handleStartDebate}
          currentLiveRoomLabel={currentLiveRoomLabel}
          livePinned={state.livePinned}
          onClearAll={handleClearAll}
          onClose={props.onClose}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          canExpand={!isMobile}
          expanded={isExpanded}
          onToggleExpanded={() => setIsExpanded((prev) => !prev)}
          transportStatus={liveVisitorChat.transportStatus}
        />

        {/* 2-panel layout: sidebar (desktop) + main chat area */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Desktop sidebar (inline) */}
          {!isMobile && sidebarOpen && (
            <ChatSidebar
              isTerminal={isTerminal}
              questionMode={state.questionMode}
              onModeChange={state.setQuestionMode}
              currentRoom={liveVisitorChat.room}
              onRoomSelect={liveVisitorChat.switchRoom}
              sessions={state.sessions}
              selectedSessionIds={state.selectedSessionIds}
              onToggleSession={session.toggleSessionSelected}
              onLoadSession={session.loadSession}
              onAggregateSelected={session.handleAggregateFromSelected}
              persistOptIn={state.persistOptIn}
              onTogglePersist={state.togglePersistStorage}
              livePinned={state.livePinned}
              onToggleLivePinned={toggleLivePinned}
              onStartDebate={handleStartDebate}
              currentLiveRoomLabel={currentLiveRoomLabel}
            />
          )}

          {/* Main chat column */}
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Session panel */}
            {state.showSessions && (
              <ChatSessionPanel
                sessions={state.sessions}
                selectedSessionIds={state.selectedSessionIds}
                onToggleSession={session.toggleSessionSelected}
                onLoadSession={session.loadSession}
                onClose={() => state.setShowSessions(false)}
                onAggregateSelected={session.handleAggregateFromSelected}
                isTerminal={isTerminal}
                isMobile={isMobile}
              />
            )}

            {/* Live room panel (mobile only — desktop uses sidebar) */}
            {isMobile && !isKeyboardFocusMode && (
              <LiveRoomPanel
                isTerminal={isTerminal}
                isMobile={isMobile}
                currentRoom={liveVisitorChat.room}
                onRoomSelect={liveVisitorChat.switchRoom}
                onStartDebate={handleStartDebate}
                currentRoomLabel={currentLiveRoomLabel}
                livePinned={state.livePinned}
                onToggleLivePinned={toggleLivePinned}
              />
            )}

            {/* Mode selector (mobile only — desktop uses sidebar) */}
            {isMobile && !isKeyboardFocusMode && (
              <ModeSelector
                questionMode={state.questionMode}
                onModeChange={state.setQuestionMode}
                isTerminal={isTerminal}
                isMobile={isMobile}
              />
            )}

            {/* Messages area */}
            <ChatStatusRail
              banner={liveVisitorChat.banner}
              isTerminal={isTerminal}
            />
            <div
              ref={state.scrollRef}
              data-testid="chat-messages"
              role="log"
              aria-live="polite"
              className={cn(
                "flex-1 overflow-auto overscroll-contain px-4 py-4 space-y-4 [content-visibility:auto]",
                isKeyboardFocusMode && "py-2",
                isMobile && "px-4",
                !isMobile && isExpanded && "px-5 py-5",
                isTerminal && "space-y-3 font-mono text-sm",
              )}
            >
              <ChatMessages
                messages={state.messages}
                isTerminal={isTerminal}
                isMobile={isMobile}
                onPromptClick={handlePromptClick}
                onRetry={handleRetry}
                lastPrompt={state.lastPromptRef.current}
                onNavigate={props.onClose}
                onExpireMessage={handleExpireMessage}
                activeReplyTargetName={state.liveReplyTarget?.name ?? null}
                onReplyToLiveMessage={handleReplyToLiveMessage}
              />
            </div>

            {/* Summary bar */}
            {state.persistOptIn && state.summary && !isKeyboardFocusMode && (
              <div
                className={cn(
                  "px-4 py-2 border-t text-xs text-muted-foreground truncate shrink-0",
                  isTerminal &&
                    "font-mono border-border bg-[hsl(var(--terminal-code-bg))]",
                )}
              >
                {isTerminal ? (
                  <span>
                    <span className="text-primary/60"># Last:</span>{" "}
                    {state.summary}
                  </span>
                ) : (
                  <>요약: {state.summary}</>
                )}
              </div>
            )}

            {/* Input area */}
            <ChatInput
              input={state.input}
              onInputChange={state.setInput}
              onKeyDown={onKeyDown}
              onSend={actions.send}
              onStop={actions.stop}
              onClearAll={handleClearAll}
              onFileSelect={state.setAttachedImage}
              attachedImage={state.attachedImage}
              attachedPreviewUrl={state.attachedPreviewUrl}
              busy={state.busy}
              canSend={state.canSend}
              firstTokenMs={state.firstTokenMs}
              questionMode={state.questionMode}
              liveReplyTarget={state.liveReplyTarget}
              onClearLiveReplyTarget={() => state.setLiveReplyTarget(null)}
              isTerminal={isTerminal}
              isMobile={isMobile}
              textareaRef={state.textareaRef}
              fileInputRef={state.fileInputRef}
              hasMessages={state.messages.length > 0}
            />
          </div>
        </div>
      </div>

      {/* Image drawer dialog */}
      <ImageDrawer
        open={state.showImageDrawer}
        onOpenChange={state.setShowImageDrawer}
        uploadedImages={state.uploadedImages}
      />

      {/* Mobile sidebar slide-over */}
      <Sheet
        open={isMobile && sidebarOpen}
        onOpenChange={(open) => setSidebarOpen(open)}
      >
        <SheetContent side="left" className="w-72 max-w-[85vw] p-0">
          <ChatSidebar
            isTerminal={isTerminal}
            questionMode={state.questionMode}
            onModeChange={state.setQuestionMode}
            currentRoom={liveVisitorChat.room}
            onRoomSelect={liveVisitorChat.switchRoom}
            sessions={state.sessions}
            selectedSessionIds={state.selectedSessionIds}
            onToggleSession={session.toggleSessionSelected}
            onLoadSession={session.loadSession}
            onAggregateSelected={session.handleAggregateFromSelected}
            persistOptIn={state.persistOptIn}
            onTogglePersist={state.togglePersistStorage}
            livePinned={state.livePinned}
            onToggleLivePinned={toggleLivePinned}
            onStartDebate={handleStartDebate}
            currentLiveRoomLabel={currentLiveRoomLabel}
          />
        </SheetContent>
      </Sheet>

      {/* Mobile action sheet */}
      <MobileActionSheet
        open={state.showActionSheet}
        onOpenChange={state.setShowActionSheet}
        sessions={state.sessions}
        uploadedImages={state.uploadedImages}
        persistOptIn={state.persistOptIn}
        onShowSessions={() => {
          state.setShowActionSheet(false);
          state.setShowSessions((v) => !v);
        }}
        onShowImageDrawer={() => {
          state.setShowActionSheet(false);
          state.setShowImageDrawer(true);
        }}
        onTogglePersist={state.togglePersistStorage}
        livePinned={state.livePinned}
        onToggleLivePinned={toggleLivePinned}
        onStartDebate={handleStartDebate}
        currentLiveRoomLabel={currentLiveRoomLabel}
        onClearAll={handleClearAll}
        isTerminal={isTerminal}
      />

      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>대화 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              대화 내용을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
