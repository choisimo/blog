import React from "react";
import {
  Sparkles,
  MoreVertical,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ChatSessionMeta, UploadedChatImage } from "../types";

type ChatHeaderProps = {
  isMobile: boolean;
  isTerminal: boolean;
  busy: boolean;
  persistOptIn: boolean;
  sessions: ChatSessionMeta[];
  uploadedImages: UploadedChatImage[];
  onShowSessions: () => void;
  onShowActionSheet: () => void;
  onShowImageDrawer: () => void;
  onTogglePersist: () => void;
  onClearAll: () => void;
  onClose?: () => void;
};

export function ChatHeader({
  isMobile,
  isTerminal,
  busy,
  persistOptIn,
  sessions,
  uploadedImages,
  onShowSessions,
  onShowActionSheet,
  onShowImageDrawer,
  onTogglePersist,
  onClearAll,
  onClose,
}: ChatHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b px-4 py-3 shrink-0",
        isMobile && "px-4 py-3 safe-area-top",
        isTerminal
          ? "bg-[hsl(var(--terminal-titlebar))] border-border"
          : "bg-background/95 backdrop-blur-sm",
      )}
    >
      {/* Left: Icon + Title */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Terminal window controls (PC only) */}
        {isTerminal && !isMobile && (
          <div className="flex items-center gap-1.5 mr-2">
            <span className="w-3 h-3 rounded-full bg-[hsl(var(--terminal-window-btn-close))]" />
            <span className="w-3 h-3 rounded-full bg-[hsl(var(--terminal-window-btn-minimize))]" />
            <span className="w-3 h-3 rounded-full bg-[hsl(var(--terminal-window-btn-maximize))]" />
          </div>
        )}
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-primary/10 shrink-0",
            isMobile ? "h-9 w-9" : "h-10 w-10",
            isTerminal && "bg-primary/20 rounded-lg",
          )}
        >
          <Sparkles
            className={cn(
              "text-primary",
              isMobile ? "h-4 w-4" : "h-5 w-5",
              isTerminal && "terminal-glow",
            )}
          />
        </div>
        <div className="min-w-0">
          <p
            className={cn(
              "font-semibold truncate",
              isMobile ? "text-sm" : "text-sm",
              isTerminal && "font-mono text-primary",
            )}
          >
            {isTerminal ? ">_ AI Chat" : "AI Chat"}
          </p>
          <p
            className={cn(
              "text-xs text-muted-foreground truncate",
              isTerminal && "font-mono",
            )}
          >
            {busy ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> 생성 중…
              </span>
            ) : persistOptIn ? (
              "기록 저장 ON"
            ) : (
              "기록 저장 OFF"
            )}
          </p>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Options menu */}
        {isMobile ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="대화 옵션"
            className={cn(
              "h-10 w-10",
              isTerminal && "text-primary hover:bg-primary/10",
            )}
            onClick={onShowActionSheet}
          >
            <MoreVertical className="h-5 w-5" />
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="대화 옵션"
                className={cn(
                  "h-9 w-9",
                  isTerminal && "text-primary hover:bg-primary/10",
                )}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 text-sm z-[9999]">
              <DropdownMenuItem
                disabled={!sessions.length}
                onSelect={onShowSessions}
              >
                최근 대화 보기
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!uploadedImages.length}
                onSelect={onShowImageDrawer}
              >
                이미지 메모 보기
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onTogglePersist}>
                {persistOptIn ? "기록 저장 끄기" : "기록 저장 켜기"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onClearAll}>
                대화 초기화
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Close button */}
        {onClose && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={cn(
              isMobile ? "h-10 w-10" : "h-9 w-9",
              isTerminal && "text-primary hover:bg-primary/10",
            )}
            aria-label="창 닫기"
            onClick={onClose}
          >
            <X className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
          </Button>
        )}
      </div>
    </div>
  );
}
