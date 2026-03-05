import React from "react";
import { Sparkles, MoreVertical, X, Loader2, Menu } from "lucide-react";
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
  onStartDebate?: () => void;
  currentLiveRoomLabel?: string;
  livePinned?: boolean;
  onClearAll: () => void;
  onClose?: () => void;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
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
  onStartDebate,
  currentLiveRoomLabel,
  livePinned = false,
  onClearAll,
  onClose,
  sidebarOpen,
  onToggleSidebar,
}: ChatHeaderProps) {
  const liveStatus = livePinned
    ? `LIVE 고정 ON (${currentLiveRoomLabel || "room"})`
    : null;

  return (
    <div
      className={cn(
        "flex items-center justify-between border-b shrink-0",
        isMobile ? "px-4 py-3 safe-area-top" : "px-3 py-2.5",
        isTerminal
          ? "bg-[hsl(var(--terminal-titlebar))] border-border"
          : isMobile
            ? "bg-white dark:bg-[#0A0A0A] border-[#EAEAEA] dark:border-[#222222]"
            : "bg-white dark:bg-[#0A0A0A] border-[#EAEAEA] dark:border-[#222222]",
      )}
    >
      {/* Left: Hamburger + Icon + Title */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {/* Hamburger sidebar toggle (PC only) */}
        {!isMobile && (
          <button
            type="button"
            aria-label={sidebarOpen ? "사이드바 닫기" : "사이드바 열기"}
            aria-pressed={sidebarOpen}
            className={cn(
              "h-7 w-7 shrink-0 flex items-center justify-center rounded-md transition-colors",
              isTerminal
                ? "text-primary hover:bg-primary/10"
                : "text-[#888888] dark:text-[#666666] hover:text-[#111111] dark:hover:text-[#EEEEEE] hover:bg-[#F5F5F5] dark:hover:bg-[#1A1A1A]",
            )}
            onClick={onToggleSidebar}
          >
            <Menu className="h-3.5 w-3.5" />
          </button>
        )}
        {/* Terminal window controls (PC only) */}
        {isTerminal && !isMobile && (
          <div className="flex items-center gap-1.5 mr-2">
            <span className="w-3 h-3 rounded-full bg-[hsl(var(--terminal-window-btn-close))]" />
            <span className="w-3 h-3 rounded-full bg-[hsl(var(--terminal-window-btn-minimize))]" />
            <span className="w-3 h-3 rounded-full bg-[hsl(var(--terminal-window-btn-maximize))]" />
          </div>
        )}
        {/* Icon */}
        <div
          className={cn(
            "flex items-center justify-center shrink-0",
            isTerminal
              ? cn(
                  "rounded-lg bg-primary/20",
                  isMobile ? "h-9 w-9" : "h-8 w-8",
                )
              : cn(
                  "rounded-md bg-[#F5F5F5] dark:bg-[#1A1A1A]",
                  isMobile ? "h-8 w-8" : "h-7 w-7",
                ),
          )}
        >
          <Sparkles
            className={cn(
              isTerminal
                ? cn("text-primary terminal-glow", isMobile ? "h-4 w-4" : "h-4 w-4")
                : cn(
                    "text-[#111111] dark:text-[#EEEEEE]",
                    isMobile ? "h-4 w-4" : "h-3.5 w-3.5",
                  ),
            )}
          />
        </div>
        {/* Title + subtitle */}
        <div className="min-w-0">
          <p
            className={cn(
              "truncate leading-tight",
              isTerminal
                ? cn("font-mono text-primary", isMobile ? "text-sm" : "text-[13px] font-semibold")
                : cn(
                    "font-semibold tracking-tight text-[#111111] dark:text-[#EEEEEE]",
                    isMobile ? "text-[13px]" : "text-[13px]",
                  ),
            )}
          >
            {isTerminal ? ">_ AI Chat" : "AI Chat"}
          </p>
          <p
            className={cn(
              "truncate leading-tight",
              isTerminal
                ? "text-xs text-muted-foreground font-mono"
                : "text-[11px] text-[#888888] dark:text-[#666666]",
            )}
          >
            {busy ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="h-2.5 w-2.5 animate-spin" /> 생성 중…
              </span>
            ) : liveStatus ? (
              liveStatus
            ) : persistOptIn ? (
              "기록 저장 ON"
            ) : (
              "기록 저장 OFF"
            )}
          </p>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-0.5 shrink-0">
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
              <button
                type="button"
                aria-label="대화 옵션"
                className={cn(
                  "h-7 w-7 flex items-center justify-center rounded-md transition-colors",
                  isTerminal
                    ? "text-primary hover:bg-primary/10"
                    : "text-[#888888] dark:text-[#666666] hover:text-[#111111] dark:hover:text-[#EEEEEE] hover:bg-[#F5F5F5] dark:hover:bg-[#1A1A1A]",
                )}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 text-sm">
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
              <DropdownMenuItem
                disabled={!onStartDebate}
                onSelect={() => onStartDebate?.()}
                className="max-w-[18rem]"
              >
                <span className="truncate">
                  {currentLiveRoomLabel
                    ? `현재 방 AI 토론 시작 (${currentLiveRoomLabel})`
                    : "현재 방 AI 토론 시작"}
                </span>
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
          <button
            type="button"
            aria-label="창 닫기"
            onClick={onClose}
            className={cn(
              "flex items-center justify-center rounded-md transition-colors",
              isMobile ? "h-10 w-10" : "h-7 w-7",
              isTerminal
                ? "text-primary hover:bg-primary/10"
                : "text-[#888888] dark:text-[#666666] hover:text-[#111111] dark:hover:text-[#EEEEEE] hover:bg-[#F5F5F5] dark:hover:bg-[#1A1A1A]",
            )}
          >
            <X className={isMobile ? "h-5 w-5" : "h-3.5 w-3.5"} />
          </button>
        )}
      </div>
    </div>
  );
}
