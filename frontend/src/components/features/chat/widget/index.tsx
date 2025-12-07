import React, { useCallback } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTheme } from "@/contexts/ThemeContext";

import {
  useChatState,
  useChatSession,
  useChatActions,
  useKeyboardHeight,
  useInputKeyDown,
} from "./hooks";
import {
  ChatHeader,
  ChatSessionPanel,
  ModeSelector,
  ChatMessages,
  ChatInput,
  ImageDrawer,
  MobileActionSheet,
} from "./components";

export default function ChatWidget(props: {
  onClose?: () => void;
  initialMessage?: string;
}) {
  const isMobile = useIsMobile();
  const { isTerminal } = useTheme();
  const keyboardHeight = useKeyboardHeight(isMobile);

  // Main state hook
  const state = useChatState({ initialMessage: props.initialMessage });

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

  // Chat actions
  const actions = useChatActions({
    canSend: state.canSend,
    input: state.input,
    setInput: state.setInput,
    attachedImage: state.attachedImage,
    setAttachedImage: state.setAttachedImage,
    setAttachedPreviewUrl: state.setAttachedPreviewUrl,
    busy: state.busy,
    setBusy: state.setBusy,
    setFirstTokenMs: state.setFirstTokenMs,
    abortRef: state.abortRef,
    push: state.push,
    setMessages: state.setMessages,
    isAggregatePrompt: state.isAggregatePrompt,
    setIsAggregatePrompt: state.setIsAggregatePrompt,
    questionMode: state.questionMode,
    lastPromptRef: state.lastPromptRef,
    uploadedImages: state.uploadedImages,
    setUploadedImages: state.setUploadedImages,
    messages: state.messages,
    setSessionKey: state.setSessionKey,
  });

  // Keyboard handler
  const onKeyDown = useInputKeyDown({
    canSend: state.canSend,
    send: actions.send,
  });

  const handlePromptClick = useCallback(
    (prompt: string) => {
      state.setInput(prompt);
      state.focusInput();
    },
    [state],
  );

  const handleRetry = useCallback(
    (lastPrompt: string) => {
      state.setInput(lastPrompt);
      state.focusInput();
    },
    [state],
  );

  return (
    <>
      <div
        className={cn(
          "fixed z-[var(--z-chat-widget)] flex flex-col overflow-hidden border bg-background shadow-2xl transition-all",
          // Mobile: always fullscreen (adjusted for keyboard)
          isMobile
            ? "inset-0 rounded-none"
            : "bottom-20 left-1/2 w-[min(100%-24px,42rem)] max-h-[80vh] -translate-x-1/2 rounded-2xl",
          // Terminal theme: PC rounded, mobile fullscreen
          isTerminal &&
            !isMobile &&
            "border-border bg-[hsl(var(--terminal-code-bg))] rounded-lg",
          isTerminal &&
            isMobile &&
            "border-0 bg-[hsl(var(--terminal-code-bg))]",
        )}
        style={
          isMobile && keyboardHeight > 0
            ? { height: `calc(100dvh - ${keyboardHeight}px)` }
            : isMobile
              ? { height: "100dvh" }
              : undefined
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
          onClearAll={actions.clearAll}
          onClose={props.onClose}
        />

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

        {/* Mode selector */}
        <ModeSelector
          questionMode={state.questionMode}
          onModeChange={state.setQuestionMode}
          isTerminal={isTerminal}
          isMobile={isMobile}
        />

        {/* Messages area */}
        <div
          ref={state.scrollRef}
          className={cn(
            "flex-1 overflow-auto px-4 py-4 space-y-4",
            isMobile && "px-4",
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
          />
        </div>

        {/* Summary bar */}
        {state.persistOptIn && state.summary && (
          <div
            className={cn(
              "px-4 py-2 border-t text-xs text-muted-foreground truncate shrink-0",
              isTerminal &&
                "font-mono border-border bg-[hsl(var(--terminal-code-bg))]",
            )}
          >
            {isTerminal ? (
              <span>
                <span className="text-primary/60"># Last:</span> {state.summary}
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
          onClearAll={actions.clearAll}
          onFileSelect={state.setAttachedImage}
          attachedImage={state.attachedImage}
          attachedPreviewUrl={state.attachedPreviewUrl}
          busy={state.busy}
          canSend={state.canSend}
          firstTokenMs={state.firstTokenMs}
          questionMode={state.questionMode}
          isTerminal={isTerminal}
          isMobile={isMobile}
          textareaRef={state.textareaRef}
          fileInputRef={state.fileInputRef}
        />
      </div>

      {/* Image drawer dialog */}
      <ImageDrawer
        open={state.showImageDrawer}
        onOpenChange={state.setShowImageDrawer}
        uploadedImages={state.uploadedImages}
      />

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
        onClearAll={actions.clearAll}
        isTerminal={isTerminal}
      />
    </>
  );
}
