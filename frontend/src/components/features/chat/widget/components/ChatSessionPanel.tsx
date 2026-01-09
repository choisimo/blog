import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChatSessionMeta, QuestionMode } from "../types";

type ChatSessionPanelProps = {
  sessions: ChatSessionMeta[];
  selectedSessionIds: string[];
  onToggleSession: (id: string) => void;
  onLoadSession: (id: string) => void;
  onClose: () => void;
  onAggregateSelected: () => void;
  isTerminal: boolean;
  isMobile: boolean;
};

export function ChatSessionPanel({
  sessions,
  selectedSessionIds,
  onToggleSession,
  onLoadSession,
  onClose,
  onAggregateSelected,
  isTerminal,
  isMobile,
}: ChatSessionPanelProps) {
  if (sessions.length === 0) return null;

  return (
    <div
      className={cn(
        "border-b shrink-0",
        isTerminal
          ? "bg-[hsl(var(--terminal-code-bg))] border-border"
          : "bg-muted/40",
      )}
    >
      <div
        className={cn(
          "px-4 pt-3 max-h-48 overflow-y-auto space-y-2",
          isMobile && "px-4",
        )}
      >
        {sessions.map((s) => {
          const checked = selectedSessionIds.includes(s.id);
          return (
            <div
              key={s.id}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                isTerminal
                  ? "border border-primary/20 hover:border-primary/40 hover:bg-primary/5"
                  : "border hover:bg-muted",
              )}
            >
              <input
                type="checkbox"
                className={cn("h-4 w-4 rounded", isTerminal && "accent-primary")}
                checked={checked}
                onChange={() => onToggleSession(s.id)}
              />
              <button
                type="button"
                className="flex-1 text-left min-w-0"
                onClick={() => {
                  onLoadSession(s.id);
                  onClose();
                }}
              >
                <div
                  className={cn(
                    "truncate font-medium text-sm",
                    isTerminal && "font-mono text-foreground",
                  )}
                >
                  {s.title || "제목 없음"}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground truncate mt-0.5">
                  {s.articleTitle && (
                    <span className="truncate max-w-[120px]">
                      {s.articleTitle}
                    </span>
                  )}
                  <span className="shrink-0">
                    {new Date(s.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </button>
            </div>
          );
        })}
      </div>
      <div
        className={cn(
          "px-4 py-3 border-t flex items-center justify-between",
          isTerminal && "border-border",
        )}
      >
        <span
          className={cn("text-xs text-muted-foreground", isTerminal && "font-mono")}
        >
          선택: {selectedSessionIds.length}개
        </span>
        <Button
          type="button"
          size="sm"
          className={cn(
            "h-8 px-3 text-xs",
            isTerminal &&
              "bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30",
          )}
          disabled={!selectedSessionIds.length}
          onClick={onAggregateSelected}
        >
          통합 질문하기
        </Button>
      </div>
    </div>
  );
}

type ModeSelectorProps = {
  questionMode: QuestionMode;
  onModeChange: (mode: QuestionMode) => void;
  isTerminal: boolean;
  isMobile: boolean;
};

export function ModeSelector({
  questionMode,
  onModeChange,
  isTerminal,
  isMobile,
}: ModeSelectorProps) {
  if (isTerminal) {
    return (
      <div
        className={cn(
          "flex items-center justify-between border-b px-4 py-2 shrink-0",
          "border-border font-mono bg-[hsl(var(--terminal-code-bg))]",
        )}
      >
        <span className="text-xs text-muted-foreground/60">Mode:</span>
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => onModeChange("article")}
            className={cn(
              "flex items-center gap-1 px-2 py-1.5 border transition-all",
              questionMode === "article"
                ? "border-solid border-primary/60 text-primary bg-primary/10"
                : "border-dotted border-muted-foreground/30 text-muted-foreground hover:border-primary/40 hover:text-primary/70",
            )}
          >
            <span className="text-terminal-amber">[</span>
            <span className={questionMode === "article" ? "text-primary crt-text-glow" : "opacity-0"}>X</span>
            <span className="text-terminal-amber">]</span>
            <span className="ml-1">Article</span>
          </button>
          <button
            type="button"
            onClick={() => onModeChange("general")}
            className={cn(
              "flex items-center gap-1 px-2 py-1.5 border transition-all",
              questionMode === "general"
                ? "border-solid border-primary/60 text-primary bg-primary/10"
                : "border-dotted border-muted-foreground/30 text-muted-foreground hover:border-primary/40 hover:text-primary/70",
            )}
          >
            <span className="text-terminal-amber">[</span>
            <span className={questionMode === "general" ? "text-primary crt-text-glow" : "opacity-0"}>X</span>
            <span className="text-terminal-amber">]</span>
            <span className="ml-1">General</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between border-b px-4 py-2 shrink-0",
        "bg-background/50",
      )}
    >
      <span
        className={cn(
          "text-xs text-muted-foreground truncate max-w-[50%]",
        )}
      >
        {questionMode === "article" ? "현재 글 기반" : "일반 대화"}
      </span>
      <div
        className={cn(
          "inline-flex rounded-full border bg-muted/40 p-0.5 shadow-sm",
          "focus-within:ring-2 focus-within:ring-primary/30 focus-within:ring-offset-2 focus-within:ring-offset-background/30",
        )}
      >
        <Button
          size="sm"
          type="button"
          variant={questionMode === "article" ? "secondary" : "ghost"}
          className={cn(
            "h-7 px-3 text-xs rounded-full transition-colors",
            isMobile && "h-8 px-4",
            questionMode === "article" &&
              "bg-background/80 text-foreground shadow border border-border/60",
            questionMode !== "article" &&
              "bg-transparent text-muted-foreground hover:text-foreground hover:bg-background/30 border border-transparent",
          )}
          onClick={() => onModeChange("article")}
        >
          현재 글
        </Button>
        <Button
          size="sm"
          type="button"
          variant={questionMode === "general" ? "secondary" : "ghost"}
          className={cn(
            "h-7 px-3 text-xs rounded-full transition-colors",
            isMobile && "h-8 px-4",
            questionMode === "general" &&
              "bg-background/80 text-foreground shadow border border-border/60",
            questionMode !== "general" &&
              "bg-transparent text-muted-foreground hover:text-foreground hover:bg-background/30 border border-transparent",
          )}
          onClick={() => onModeChange("general")}
        >
          일반
        </Button>
      </div>
    </div>
  );
}
