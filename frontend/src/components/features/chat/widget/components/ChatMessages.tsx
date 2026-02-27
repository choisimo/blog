import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Terminal, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ChatMarkdown from "../../ChatMarkdown";
import { cn } from "@/lib/utils";
import type { ChatMessage, SourceLink, SystemMessageLevel } from "../types";
import { extractImageFromMessage, QUICK_PROMPTS } from "../constants";
import { TypingDots } from "./ChatSidebar";
import { SystemStatusMessage } from "./SystemStatusMessage";

type ChatMessagesProps = {
  messages: ChatMessage[];
  isTerminal: boolean;
  isMobile: boolean;
  onPromptClick: (prompt: string) => void;
  onRetry: (lastPrompt: string) => void;
  lastPrompt: string;
  onNavigate?: (path: string) => void;
  onExpireMessage?: (id: string) => void;
};

const MOBILE_RENDER_LIMIT = 80;

function getSystemLevel(message: ChatMessage): SystemMessageLevel {
  return message.systemLevel ?? "error";
}

function getSystemBubbleClass(level: SystemMessageLevel): string {
  switch (level) {
    case "info":
      return "border border-primary/20 bg-primary/10 text-primary";
    case "warn":
      return "border border-amber-500/30 bg-amber-500/10 text-amber-700";
    case "error":
    default:
      return "border border-destructive/30 bg-destructive/10 text-destructive";
  }
}

function getSystemTerminalClass(level: SystemMessageLevel): string {
  switch (level) {
    case "info":
      return "text-primary";
    case "warn":
      return "text-amber-400";
    case "error":
    default:
      return "text-destructive";
  }
}

function getSystemLabel(level: SystemMessageLevel): string {
  switch (level) {
    case "info":
      return "[INFO]";
    case "warn":
      return "[WARN]";
    case "error":
    default:
      return "[ERROR]";
  }
}

export function ChatMessages({
  messages,
  isTerminal,
  isMobile,
  onPromptClick,
  onRetry,
  lastPrompt,
  onNavigate,
  onExpireMessage,
}: ChatMessagesProps) {
  const navigate = useNavigate();
  const [showFullMobileHistory, setShowFullMobileHistory] = useState(false);

  useEffect(() => {
    if (!isMobile || messages.length <= MOBILE_RENDER_LIMIT) {
      setShowFullMobileHistory(false);
    }
  }, [isMobile, messages.length]);

  const hiddenMessageCount =
    isMobile && !showFullMobileHistory && messages.length > MOBILE_RENDER_LIMIT
      ? messages.length - MOBILE_RENDER_LIMIT
      : 0;

  const visibleMessages = useMemo(() => {
    if (hiddenMessageCount <= 0) return messages;
    return messages.slice(-MOBILE_RENDER_LIMIT);
  }, [messages, hiddenMessageCount]);

  // Handle navigation to internal blog links
  const handleSourceClick = useCallback(
    (url: string, e: React.MouseEvent) => {
      // Check if it's an internal blog link
      const currentHost = window.location.host;
      let isInternal = false;
      let internalPath = "";

      try {
        const urlObj = new URL(url, window.location.origin);
        if (urlObj.host === currentHost || url.startsWith("/")) {
          isInternal = true;
          internalPath = urlObj.pathname;
        }
      } catch {
        // If URL parsing fails, check if it's a relative path
        if (url.startsWith("/")) {
          isInternal = true;
          internalPath = url;
        }
      }

      if (isInternal && internalPath) {
        e.preventDefault();
        navigate(internalPath);
        onNavigate?.(internalPath);
      }
    },
    [navigate, onNavigate],
  );

  return (
    <>
      {messages.length === 0 && (
        <EmptyState
          isTerminal={isTerminal}
          isMobile={isMobile}
          onPromptClick={onPromptClick}
        />
      )}

      {hiddenMessageCount > 0 && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setShowFullMobileHistory(true)}
            className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
          >
            이전 메시지 {hiddenMessageCount}개 보기
          </button>
        </div>
      )}

      {visibleMessages.map((m) => {
        const isUser = m.role === "user";
        const isAssistant = m.role === "assistant";
        const isSystem = m.role === "system";
        const systemLevel = getSystemLevel(m);

        // Extract image from user message
        const { imageUrl, cleanText } = isUser
          ? extractImageFromMessage(m.text)
          : { imageUrl: null, cleanText: m.text };

        if (isTerminal) {
          return (
            <TerminalMessage
              key={m.id}
              message={m}
              imageUrl={imageUrl}
              cleanText={cleanText}
              isUser={isUser}
              isAssistant={isAssistant}
              isSystem={isSystem}
              systemLevel={systemLevel}
              isMobile={isMobile}
              onPromptClick={onPromptClick}
              onRetry={onRetry}
              lastPrompt={lastPrompt}
              onSourceClick={handleSourceClick}
              onExpireMessage={onExpireMessage}
            />
          );
        }

        return (
          <DefaultMessage
            key={m.id}
            message={m}
            imageUrl={imageUrl}
            cleanText={cleanText}
            isUser={isUser}
            isAssistant={isAssistant}
            isSystem={isSystem}
            systemLevel={systemLevel}
            isMobile={isMobile}
            onPromptClick={onPromptClick}
            onRetry={onRetry}
            lastPrompt={lastPrompt}
            onSourceClick={handleSourceClick}
            onExpireMessage={onExpireMessage}
          />
        );
      })}
    </>
  );
}

// Empty state component
const EmptyState = React.memo(function EmptyState({
  isTerminal,
  isMobile,
  onPromptClick,
}: {
  isTerminal: boolean;
  isMobile: boolean;
  onPromptClick: (prompt: string) => void;
}) {
  if (isTerminal) {
    const asciiArt = [
      "┌────────────────────────┐",
      "│   ▄▄▄   ▄▄▄▄▄   ▄▄▄    │ ",
      "│  █   █  █   █  █   █   │ ",
      "│         █▄▄▄█          │ ",
      "│                        │ ",
      "└────────────────────────┘ ",
      "",
      " Hello! I'm nodove-bot",
      " Google it yourself. ",
      "(Seriously, don't ask me.)",
    ].join("\n");

    return (
      <div className="terminal-empty-panel">
        <div className="terminal-empty-grid">
          <pre className="terminal-ascii-art" aria-hidden="true">
            {asciiArt}
          </pre>
          <div className="terminal-empty-text">
            <p className="terminal-empty-title">$ ./ai-chat --help</p>
            <div className="terminal-command-grid" aria-label="추천 프롬프트">
              {QUICK_PROMPTS.map((prompt, index) => (
                <button
                  key={prompt}
                  type="button"
                  className="terminal-command-btn crt-cli-btn"
                  onClick={() => onPromptClick(prompt)}
                >
                  <span className="crt-text-amber font-bold">
                    [{index + 1}]
                  </span>
                  <span>{prompt}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
      <p className="text-center">
        빠르게 시작하려면 아래 프롬프트를 눌러보세요.
      </p>
      <div className={cn("flex flex-wrap gap-2", isMobile && "flex-col")}>
        {QUICK_PROMPTS.map((prompt) => (
          <Button
            key={prompt}
            size="sm"
            variant="secondary"
            className={cn(
              "text-xs justify-start",
              isMobile ? "h-12 px-4 w-full text-sm" : "h-10 px-4",
            )}
            onClick={() => onPromptClick(prompt)}
          >
            {prompt}
          </Button>
        ))}
      </div>
    </div>
  );
});

// Terminal-style message
const TerminalMessage = React.memo(function TerminalMessage({
  message: m,
  imageUrl,
  cleanText,
  isUser,
  isAssistant,
  isSystem,
  systemLevel,
  isMobile,
  onPromptClick,
  onRetry,
  lastPrompt,
  onSourceClick,
  onExpireMessage,
}: {
  message: ChatMessage;
  imageUrl: string | null;
  cleanText: string;
  isUser: boolean;
  isAssistant: boolean;
  isSystem: boolean;
  systemLevel: SystemMessageLevel;
  isMobile: boolean;
  onPromptClick: (prompt: string) => void;
  onRetry: (lastPrompt: string) => void;
  lastPrompt: string;
  onSourceClick: (url: string, e: React.MouseEvent) => void;
  onExpireMessage?: (id: string) => void;
}) {
  const isStreaming = isAssistant && !m.sources?.length && !m.followups?.length;

  return (
    <div className="space-y-2">
      {isUser && (
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-primary font-bold select-none shrink-0 text-sm">
              user@blog:~$
            </span>
            <span className="whitespace-pre-wrap text-foreground break-words text-sm">
              {cleanText ||
                (imageUrl ? "첨부한 이미지에 대해 설명해줘." : m.text)}
            </span>
          </div>
          {imageUrl && <UserImage imageUrl={imageUrl} isTerminal />}
        </div>
      )}
      {isAssistant && (
        <div className="ai-response-container">
          <div className="ai-response-header">
            <Terminal className="h-3.5 w-3.5" />
            <span>AI Response</span>
            {!m.text.trim() && (
              <span className="streaming-indicator">
                <span className="streaming-dots">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </span>
                processing
              </span>
            )}
          </div>
          <div className="text-foreground/90 text-sm typewriter-container">
            {m.text.trim() ? (
              <>
                {isMobile && isStreaming ? (
                  <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                    {m.text}
                  </span>
                ) : (
                  <ChatMarkdown content={m.text} isStreaming={isStreaming} />
                )}
                {isStreaming && <span className="typewriter-cursor" />}
              </>
            ) : (
              <span className="crt-block-cursor" aria-label="waiting" />
            )}
          </div>
          <Sources
            sources={m.sources}
            isTerminal
            onSourceClick={onSourceClick}
          />
          <Followups
            followups={m.followups}
            isTerminal
            isMobile={isMobile}
            onPromptClick={onPromptClick}
          />
        </div>
      )}
      {isSystem &&
        (() => {
          const isStatus =
            m.systemKind === "status" ||
            (m.systemKind !== "error" &&
              (m.text.startsWith("[Live]") || m.text.startsWith("[Session]")) &&
              systemLevel !== "error");
          if (isStatus) {
            return (
              <SystemStatusMessage
                text={m.text}
                isTerminal
                transient={m.transient}
                onExpire={() => onExpireMessage?.(m.id)}
              />
            );
          }
          return (
            <SystemMessage
              text={m.text}
              level={systemLevel}
              isTerminal
              lastPrompt={lastPrompt}
              onRetry={() => onRetry(lastPrompt)}
            />
          );
        })()}
    </div>
  );
});

// Default style message
const DefaultMessage = React.memo(function DefaultMessage({
  message: m,
  imageUrl,
  cleanText,
  isUser,
  isAssistant,
  isSystem,
  systemLevel,
  isMobile,
  onPromptClick,
  onRetry,
  lastPrompt,
  onSourceClick,
  onExpireMessage,
}: {
  message: ChatMessage;
  imageUrl: string | null;
  cleanText: string;
  isUser: boolean;
  isAssistant: boolean;
  isSystem: boolean;
  systemLevel: SystemMessageLevel;
  isMobile: boolean;
  onPromptClick: (prompt: string) => void;
  onRetry: (lastPrompt: string) => void;
  lastPrompt: string;
  onSourceClick: (url: string, e: React.MouseEvent) => void;
  onExpireMessage?: (id: string) => void;
}) {
  const isStreaming = isAssistant && !m.sources?.length && !m.followups?.length;
  const isStatus =
    isSystem &&
    (m.systemKind === "status" ||
      (m.systemKind !== "error" &&
        (m.text.startsWith("[Live]") || m.text.startsWith("[Session]")) &&
        systemLevel !== "error"));

  if (isStatus) {
    return (
      <SystemStatusMessage
        text={m.text}
        isTerminal={false}
        transient={m.transient}
        onExpire={() => onExpireMessage?.(m.id)}
      />
    );
  }

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-full text-sm leading-relaxed px-4 py-3 break-words [overflow-wrap:anywhere]",
          isMobile ? "max-w-[90%] rounded-2xl" : "max-w-[85%] rounded-2xl",
          isUser && "bg-primary text-primary-foreground rounded-br-md",
          isAssistant && "bg-secondary text-secondary-foreground rounded-bl-md",
          isSystem && getSystemBubbleClass(systemLevel),
        )}
      >
        {isAssistant ? (
          m.text.trim() ? (
            isMobile && isStreaming ? (
              <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                {m.text}
              </span>
            ) : (
              <ChatMarkdown content={m.text} isStreaming={isStreaming} />
            )
          ) : (
            <TypingDots />
          )
        ) : isUser ? (
          <div className="space-y-2">
            <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              {cleanText ||
                (imageUrl ? "첨부한 이미지에 대해 설명해줘." : m.text)}
            </span>
            {imageUrl && <UserImage imageUrl={imageUrl} isTerminal={false} />}
          </div>
        ) : (
          <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
            {m.text}
          </span>
        )}

        {isAssistant && (
          <Sources
            sources={m.sources}
            isTerminal={false}
            onSourceClick={onSourceClick}
          />
        )}
        {isAssistant && (
          <Followups
            followups={m.followups}
            isTerminal={false}
            isMobile={isMobile}
            onPromptClick={onPromptClick}
          />
        )}

        {isSystem && systemLevel === "error" && lastPrompt && (
          <div className="mt-3">
            <Button
              size="sm"
              variant="ghost"
              className="h-9 text-sm px-3"
              onClick={() => onRetry(lastPrompt)}
            >
              다시 시도하기
            </Button>
          </div>
        )}
      </div>
    </div>
  );
});

// User image attachment
const UserImage = React.memo(function UserImage({
  imageUrl,
  isTerminal,
}: {
  imageUrl: string;
  isTerminal: boolean;
}) {
  if (isTerminal) {
    return (
      <div className="ml-0 mt-2">
        <div className="inline-block rounded border border-primary/30 overflow-hidden max-w-[200px] sm:max-w-[280px]">
          <img
            src={imageUrl}
            alt="첨부 이미지"
            className="w-full h-auto object-contain max-h-[200px]"
            onClick={() => window.open(imageUrl, "_blank")}
            style={{ cursor: "pointer" }}
          />
        </div>
        <div className="text-xs text-primary/60 mt-1 font-mono">
          [img] 클릭하여 원본 보기
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <div className="inline-block rounded-lg overflow-hidden max-w-[200px] sm:max-w-[240px] border border-primary-foreground/20">
        <img
          src={imageUrl}
          alt="첨부 이미지"
          className="w-full h-auto object-contain max-h-[180px]"
          onClick={() => window.open(imageUrl, "_blank")}
          style={{ cursor: "pointer" }}
        />
      </div>
    </div>
  );
});

// Sources component
const Sources = React.memo(function Sources({
  sources,
  isTerminal,
  onSourceClick,
}: {
  sources?: SourceLink[];
  isTerminal: boolean;
  onSourceClick: (url: string, e: React.MouseEvent) => void;
}) {
  if (!Array.isArray(sources) || sources.length === 0) return null;

  if (isTerminal) {
    return (
      <div className="mt-3 pl-3 text-xs">
        <span className="text-primary/60"># Sources:</span>
        <ul className="mt-1 space-y-1">
          {sources.map((s, i) => (
            <li key={i} className="text-muted-foreground">
              <span className="text-primary/50">[{i + 1}]</span>{" "}
              {s.url ? (
                <a
                  className="underline decoration-dotted hover:text-primary cursor-pointer break-all"
                  href={s.url}
                  onClick={(e) => onSourceClick(s.url!, e)}
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
    );
  }

  return (
    <div className="mt-3 space-y-1.5">
      <div className="text-xs text-muted-foreground font-medium">
        참고한 출처
      </div>
      <ul className="text-sm list-disc pl-4 space-y-1">
        {sources.map((s, i) => (
          <li key={i}>
            {s.url ? (
              <a
                className="underline text-primary cursor-pointer break-all"
                href={s.url}
                onClick={(e) => onSourceClick(s.url!, e)}
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
  );
});

// Followups component
const Followups = React.memo(function Followups({
  followups,
  isTerminal,
  isMobile,
  onPromptClick,
}: {
  followups?: string[];
  isTerminal: boolean;
  isMobile: boolean;
  onPromptClick: (prompt: string) => void;
}) {
  if (!Array.isArray(followups) || followups.length === 0) return null;

  if (isTerminal) {
    return (
      <div className="mt-3 pl-3">
        <span className="text-xs text-primary/60"># 연관 질문:</span>
        <div
          className={cn("flex gap-2 mt-2", isMobile ? "flex-col" : "flex-wrap")}
        >
          {followups.map((q, i) => (
            <button
              key={i}
              className={cn(
                "text-xs text-primary/80 hover:text-primary border border-primary/30 hover:bg-primary/10 transition-colors text-left",
                isMobile ? "px-4 py-3" : "px-3 py-2",
              )}
              onClick={() => onPromptClick(q)}
            >
              <ChevronRight className="inline h-3 w-3 -ml-0.5 mr-1" />
              {q}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="text-xs text-muted-foreground font-medium mb-2">
        연관 질문
      </div>
      <div className={cn("flex gap-2", isMobile ? "flex-col" : "flex-wrap")}>
        {followups.map((q, i) => (
          <Button
            key={i}
            size="sm"
            variant="secondary"
            className={cn(
              "text-xs justify-start",
              isMobile ? "h-12 px-4 w-full text-sm" : "h-10 px-4",
            )}
            onClick={() => onPromptClick(q)}
          >
            {q}
          </Button>
        ))}
      </div>
    </div>
  );
});

// System status/error component
const SystemMessage = React.memo(function SystemMessage({
  text,
  level,
  isTerminal,
  lastPrompt,
  onRetry,
}: {
  text: string;
  level: SystemMessageLevel;
  isTerminal: boolean;
  lastPrompt: string;
  onRetry: () => void;
}) {
  if (isTerminal) {
    const toneClass = getSystemTerminalClass(level);
    const label = getSystemLabel(level);

    return (
      <div className={cn("flex items-start gap-2", toneClass)}>
        <span className="font-bold select-none shrink-0">{label}</span>
        <span className="whitespace-pre-wrap break-words text-sm">{text}</span>
        {level === "error" && lastPrompt && (
          <button
            className="text-xs underline ml-2 opacity-80 hover:opacity-100"
            onClick={onRetry}
          >
            retry
          </button>
        )}
      </div>
    );
  }

  return null; // Default style handles this inline
});
