import React from "react";
import { Loader2, Terminal, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ChatMarkdown from "../../ChatMarkdown";
import { cn } from "@/lib/utils";
import type { ChatMessage, SourceLink } from "../types";
import { extractImageFromMessage, QUICK_PROMPTS } from "../constants";

type ChatMessagesProps = {
  messages: ChatMessage[];
  isTerminal: boolean;
  isMobile: boolean;
  onPromptClick: (prompt: string) => void;
  onRetry: (lastPrompt: string) => void;
  lastPrompt: string;
  onNavigate?: (path: string) => void;
};

export function ChatMessages({
  messages,
  isTerminal,
  isMobile,
  onPromptClick,
  onRetry,
  lastPrompt,
  onNavigate,
}: ChatMessagesProps) {
  const navigate = useNavigate();

  // Handle navigation to internal blog links
  const handleSourceClick = (url: string, e: React.MouseEvent) => {
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
  };

  return (
    <>
      {messages.length === 0 && (
        <EmptyState
          isTerminal={isTerminal}
          isMobile={isMobile}
          onPromptClick={onPromptClick}
        />
      )}

      {messages.map((m) => {
        const isUser = m.role === "user";
        const isAssistant = m.role === "assistant";
        const isSystem = m.role === "system";

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
              isMobile={isMobile}
              onPromptClick={onPromptClick}
              onRetry={() => onRetry(lastPrompt)}
              lastPrompt={lastPrompt}
              onSourceClick={handleSourceClick}
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
            isMobile={isMobile}
            onPromptClick={onPromptClick}
            onRetry={() => onRetry(lastPrompt)}
            lastPrompt={lastPrompt}
            onSourceClick={handleSourceClick}
          />
        );
      })}
    </>
  );
}

// Empty state component
function EmptyState({
  isTerminal,
  isMobile,
  onPromptClick,
}: {
  isTerminal: boolean;
  isMobile: boolean;
  onPromptClick: (prompt: string) => void;
}) {
  return (
    <div
      className={cn(
        "space-y-4 rounded-2xl border border-dashed px-4 py-6 text-sm text-muted-foreground",
        isTerminal &&
          "rounded-lg border-primary/30 bg-[hsl(var(--terminal-code-bg))]",
      )}
    >
      {isTerminal ? (
        <>
          <p className="font-mono text-primary/80">
            <span className="text-primary">$</span> ./ai-chat --help
          </p>
          <p className="font-mono text-muted-foreground text-xs leading-relaxed">
            질문을 입력하고 Enter를 눌러 실행하세요.
          </p>
        </>
      ) : (
        <p className="text-center">빠르게 시작하려면 아래 프롬프트를 눌러보세요.</p>
      )}
      <div className={cn("flex flex-wrap gap-2", isMobile && "flex-col")}>
        {QUICK_PROMPTS.map((prompt) => (
          <Button
            key={prompt}
            size="sm"
            variant="secondary"
            className={cn(
              "text-xs justify-start",
              isMobile ? "h-12 px-4 w-full text-sm" : "h-10 px-4",
              isTerminal &&
                "rounded-none border border-primary/40 bg-transparent text-primary hover:bg-primary/20 hover:text-primary font-mono",
            )}
            onClick={() => onPromptClick(prompt)}
          >
            {isTerminal ? `> ${prompt}` : prompt}
          </Button>
        ))}
      </div>
    </div>
  );
}

// Terminal-style message
function TerminalMessage({
  message: m,
  imageUrl,
  cleanText,
  isUser,
  isAssistant,
  isSystem,
  isMobile,
  onPromptClick,
  onRetry,
  lastPrompt,
  onSourceClick,
}: {
  message: ChatMessage;
  imageUrl: string | null;
  cleanText: string;
  isUser: boolean;
  isAssistant: boolean;
  isSystem: boolean;
  isMobile: boolean;
  onPromptClick: (prompt: string) => void;
  onRetry: () => void;
  lastPrompt: string;
  onSourceClick: (url: string, e: React.MouseEvent) => void;
}) {
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
        <div className="pl-0 border-l-2 border-primary/30 ml-0">
          <div className="flex items-center gap-2 text-xs text-primary/70 mb-2 pl-3">
            <Terminal className="h-3.5 w-3.5" />
            <span>AI Response</span>
            {!m.text.trim() && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                processing...
              </span>
            )}
          </div>
          <div className="pl-3 text-foreground/90 text-sm">
            {m.text.trim() ? (
              <ChatMarkdown content={m.text} />
            ) : (
              <span className="terminal-cursor" />
            )}
          </div>
          <Sources sources={m.sources} isTerminal onSourceClick={onSourceClick} />
          <Followups
            followups={m.followups}
            isTerminal
            isMobile={isMobile}
            onPromptClick={onPromptClick}
          />
        </div>
      )}
      {isSystem && (
        <SystemError
          text={m.text}
          isTerminal
          lastPrompt={lastPrompt}
          onRetry={onRetry}
        />
      )}
    </div>
  );
}

// Default style message
function DefaultMessage({
  message: m,
  imageUrl,
  cleanText,
  isUser,
  isAssistant,
  isSystem,
  isMobile,
  onPromptClick,
  onRetry,
  lastPrompt,
  onSourceClick,
}: {
  message: ChatMessage;
  imageUrl: string | null;
  cleanText: string;
  isUser: boolean;
  isAssistant: boolean;
  isSystem: boolean;
  isMobile: boolean;
  onPromptClick: (prompt: string) => void;
  onRetry: () => void;
  lastPrompt: string;
  onSourceClick: (url: string, e: React.MouseEvent) => void;
}) {
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-full text-sm leading-relaxed px-4 py-3",
          isMobile ? "max-w-[90%] rounded-2xl" : "max-w-[85%] rounded-2xl",
          isUser && "bg-primary text-primary-foreground rounded-br-md",
          isAssistant && "bg-secondary text-secondary-foreground rounded-bl-md",
          isSystem && "bg-destructive/10 text-destructive",
        )}
      >
        {isAssistant ? (
          m.text.trim() ? (
            <ChatMarkdown content={m.text} />
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              답변을 준비하고 있어요…
            </div>
          )
        ) : isUser ? (
          <div className="space-y-2">
            <span className="whitespace-pre-wrap">
              {cleanText ||
                (imageUrl ? "첨부한 이미지에 대해 설명해줘." : m.text)}
            </span>
            {imageUrl && <UserImage imageUrl={imageUrl} isTerminal={false} />}
          </div>
        ) : (
          <span className="whitespace-pre-wrap">{m.text}</span>
        )}

        {isAssistant && <Sources sources={m.sources} isTerminal={false} onSourceClick={onSourceClick} />}
        {isAssistant && (
          <Followups
            followups={m.followups}
            isTerminal={false}
            isMobile={isMobile}
            onPromptClick={onPromptClick}
          />
        )}

        {isSystem && lastPrompt && (
          <div className="mt-3">
            <Button
              size="sm"
              variant="ghost"
              className="h-9 text-sm px-3"
              onClick={onRetry}
            >
              다시 시도하기
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// User image attachment
function UserImage({
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
}

// Sources component
function Sources({
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
                  className="underline decoration-dotted hover:text-primary cursor-pointer"
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
      <div className="text-xs text-muted-foreground font-medium">참고한 출처</div>
      <ul className="text-sm list-disc pl-4 space-y-1">
        {sources.map((s, i) => (
          <li key={i}>
            {s.url ? (
              <a
                className="underline text-primary cursor-pointer"
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

// Followups component
function Followups({
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
        <div className={cn("flex gap-2 mt-2", isMobile ? "flex-col" : "flex-wrap")}>
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
}

// System error component
function SystemError({
  text,
  isTerminal,
  lastPrompt,
  onRetry,
}: {
  text: string;
  isTerminal: boolean;
  lastPrompt: string;
  onRetry: () => void;
}) {
  if (isTerminal) {
    return (
      <div className="flex items-start gap-2 text-destructive">
        <span className="font-bold select-none shrink-0">[ERROR]</span>
        <span className="whitespace-pre-wrap break-words text-sm">{text}</span>
        {lastPrompt && (
          <button
            className="text-xs underline ml-2 hover:text-destructive/80"
            onClick={onRetry}
          >
            retry
          </button>
        )}
      </div>
    );
  }

  return null; // Default style handles this inline
}
