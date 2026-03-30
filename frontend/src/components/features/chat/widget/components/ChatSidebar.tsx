import React, { useEffect, useState } from "react";
import { MessageCircle, Radio, History, Settings, Users } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getLiveRooms } from "@/services/chat";
import type { LiveRoom } from "@/services/chat";
import type { ChatSessionMeta, QuestionMode } from "../types";

export function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.3s]" />
      <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.15s]" />
      <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" />
    </div>
  );
}

type SettingToggleCardProps = {
  label: string;
  checked: boolean;
  isTerminal: boolean;
  disabled?: boolean;
  onToggle?: () => void;
};

function SettingToggleCard({
  label,
  checked,
  isTerminal,
  disabled = false,
  onToggle,
}: SettingToggleCardProps) {
  if (isTerminal) {
    // Terminal mode: keep original style
    const thumbSize = "calc(clamp(2.1rem,4.3vw,2.45rem) - 0.4rem)";
    const thumbInset = "0.2rem";
    const thumbLeft = checked
      ? `calc(100% - ${thumbSize} - ${thumbInset})`
      : thumbInset;
    return (
      <div
        className={cn(
          "min-h-[5.6rem] rounded-2xl border px-3 py-2.5",
          checked
            ? "border-primary/35 bg-primary/10"
            : "border-border/70 bg-background/40",
        )}
      >
        <div className="mb-1 text-[0.72rem] font-semibold text-muted-foreground">
          {label}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[clamp(0.95rem,1.9vw,1.1rem)] font-medium text-muted-foreground">
            {checked ? "ON" : "OFF"}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            disabled={disabled}
            onClick={() => onToggle?.()}
            className={cn(
              "relative min-h-[2.1rem] min-w-[3.75rem] rounded-full border transition-colors duration-200",
              "h-[clamp(2.1rem,4.3vw,2.45rem)] w-[clamp(3.75rem,7.8vw,4.7rem)]",
              checked
                ? "border-primary/60 bg-primary"
                : "border-border/70 bg-muted",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1",
              disabled && "cursor-not-allowed opacity-50",
            )}
            style={{ minHeight: "2.1rem", minWidth: "3.75rem" }}
          >
            <span
              className="absolute top-1/2 rounded-full bg-background shadow-md transition-all duration-200 -translate-y-1/2"
              style={{ width: thumbSize, height: thumbSize, left: thumbLeft }}
            />
          </button>
        </div>
      </div>
    );
  }

  // Default mode: slim inline toggle row (Vercel style)
  return (
    <div className="flex items-center justify-between py-1.5 px-2">
      <span className="text-xs text-[#666666] font-medium dark:text-[#999999]">
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onToggle?.()}
        style={{
          height: "18px",
          width: "32px",
          minWidth: "unset",
          minHeight: "unset",
        }}
        className={cn(
          "relative rounded-full transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0070F3] focus-visible:ring-offset-1",
          checked
            ? "bg-[#111111] dark:bg-[#EEEEEE]"
            : "bg-[#E5E5E5] dark:bg-[#333333]",
          disabled && "opacity-40 cursor-not-allowed",
        )}
      >
        <span
          style={{
            position: "absolute",
            top: "2px",
            left: checked ? "16px" : "2px",
            height: "14px",
            width: "14px",
          }}
          className="rounded-full bg-white shadow-sm transition-all duration-150"
        />
      </button>
    </div>
  );
}

function formatRoomName(room: string): string {
  return room.replace(/^room:/, "").replace(/:/g, "/");
}

export type ChatSidebarProps = {
  isTerminal: boolean;
  questionMode: QuestionMode;
  onModeChange: (mode: QuestionMode) => void;
  currentRoom?: string;
  onRoomSelect?: (room: string) => void;
  onStartDebate?: () => void;
  currentLiveRoomLabel?: string;
  sessions: ChatSessionMeta[];
  selectedSessionIds: string[];
  onToggleSession: (id: string) => void;
  onLoadSession: (id: string) => void;
  onAggregateSelected: () => void;
  persistOptIn: boolean;
  onTogglePersist: () => void;
  livePinned?: boolean;
  onToggleLivePinned?: () => void;
};

export function ChatSidebar({
  isTerminal,
  questionMode,
  onModeChange,
  currentRoom,
  onRoomSelect,
  onStartDebate,
  currentLiveRoomLabel,
  sessions,
  selectedSessionIds,
  onToggleSession,
  onLoadSession,
  onAggregateSelected,
  persistOptIn,
  onTogglePersist,
  livePinned = false,
  onToggleLivePinned,
}: ChatSidebarProps) {
  const [rooms, setRooms] = useState<LiveRoom[]>([]);

  useEffect(() => {
    let cancelled = false;
    const fetchRooms = async () => {
      try {
        const data = await getLiveRooms();
        if (!cancelled) setRooms(data);
      } catch {
        // ignore
      }
    };
    void fetchRooms();
    const interval = setInterval(fetchRooms, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const sectionClass = "px-3 py-2";

  // Vercel-style section labels: tiny, uppercase, airy
  const labelClass = cn(
    "flex items-center gap-1.5 mb-2",
    isTerminal
      ? "text-xs font-semibold uppercase tracking-wider text-primary/50 font-mono"
      : "text-[10px] font-semibold uppercase tracking-[0.08em] text-[#999999] dark:text-[#666666]",
  );

  // Vercel-style active: left border indicator + bold text, no filled background
  const itemClass = (active: boolean) =>
    cn(
      "relative flex items-center gap-2 w-full px-3 py-1.5 text-sm transition-colors text-left rounded-sm",
      active
        ? isTerminal
          ? "bg-primary/20 text-primary"
          : "text-[#111111] dark:text-[#EEEEEE] font-semibold before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-4 before:w-0.5 before:bg-[#111111] dark:before:bg-[#EEEEEE] before:rounded-full"
        : isTerminal
          ? "text-muted-foreground hover:text-foreground hover:bg-white/5"
          : "text-[#666666] dark:text-[#888888] hover:text-[#111111] dark:hover:text-[#EEEEEE] hover:bg-[#F5F5F5] dark:hover:bg-[#1A1A1A]",
    );

  // Hairline divider (Vercel style) vs. Separator for terminal
  const Divider = () =>
    isTerminal ? (
      <div className="h-px bg-border/40 mx-0 my-1" />
    ) : (
      <div className="h-px bg-[#EAEAEA] dark:bg-[#222222] mx-3 my-1" />
    );

  return (
    <div
      className={cn(
        "flex h-full w-72 shrink-0 flex-col overflow-hidden border-r",
        isTerminal
          ? "bg-[hsl(var(--terminal-code-bg))] border-border font-mono"
          : "bg-[#FAFAFA] dark:bg-[#0A0A0A] border-[#EAEAEA] dark:border-[#222222]",
      )}
    >
      <ScrollArea className="flex-1">
        {/* 대화 모드 */}
        <div className={sectionClass}>
          <div className={labelClass}>
            <MessageCircle className="w-3 h-3" />
            대화
          </div>
          <button
            type="button"
            className={itemClass(questionMode === "article")}
            onClick={() => onModeChange("article")}
          >
            현재 글
          </button>
          <button
            type="button"
            className={itemClass(questionMode === "general")}
            onClick={() => onModeChange("general")}
          >
            일반
          </button>
        </div>

        <Divider />

        {/* 실시간 채팅 */}
        <div className={sectionClass}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className={labelClass}>
              <Radio className="w-3 h-3" />
              실시간
            </div>
            <button
              type="button"
              disabled={!onStartDebate}
              onClick={() => onStartDebate?.()}
              className={cn(
                "shrink-0 rounded border px-2 py-1 text-[10px] leading-none transition-colors",
                isTerminal
                  ? "border-primary/40 text-primary hover:bg-primary/10"
                  : "border-[#EAEAEA] dark:border-[#333333] text-[#666666] dark:text-[#888888] hover:bg-[#F5F5F5] dark:hover:bg-[#1A1A1A] hover:text-[#111111] dark:hover:text-[#EEEEEE]",
                !onStartDebate && "opacity-50 cursor-not-allowed",
              )}
              title={
                currentLiveRoomLabel
                  ? `현재 방 AI 토론 (${currentLiveRoomLabel})`
                  : "현재 방 AI 토론"
              }
            >
              AI 토론
            </button>
          </div>
          {rooms.length === 0 ? (
            <p
              className={cn(
                "text-xs px-2 py-1",
                isTerminal
                  ? "text-muted-foreground/50"
                  : "text-[#AAAAAA] dark:text-[#555555]",
              )}
            >
              활성 방 없음
            </p>
          ) : (
            rooms.map((r) => {
              const name = formatRoomName(r.room);
              const isCurrent = currentRoom === r.room;
              return (
                <button
                  key={r.room}
                  type="button"
                  className={itemClass(isCurrent)}
                  onClick={() => onRoomSelect?.(r.room)}
                >
                  <MessageCircle className="w-3 h-3 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-left">
                    {name}
                  </span>
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1 py-0 h-4 shrink-0"
                  >
                    <Users className="w-2.5 h-2.5 mr-0.5" />
                    {r.onlineCount}
                  </Badge>
                </button>
              );
            })
          )}
        </div>

        <Divider />

        {/* 대화 기록 */}
        <div className={sectionClass}>
          <div className={labelClass}>
            <History className="w-3 h-3" />
            대화 기록
          </div>
          {sessions.length === 0 ? (
            <p
              className={cn(
                "text-xs px-2 py-1",
                isTerminal
                  ? "text-muted-foreground/50"
                  : "text-[#AAAAAA] dark:text-[#555555]",
              )}
            >
              저장된 대화 없음
            </p>
          ) : (
            sessions.slice(0, 10).map((s) => {
              const checked = selectedSessionIds.includes(s.id);
              return (
                <div
                  key={s.id}
                  className="mb-1.5 grid grid-cols-[auto_1fr] items-start gap-1.5"
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-3 w-3 shrink-0 rounded"
                    checked={checked}
                    onChange={() => onToggleSession(s.id)}
                  />
                  <button
                    type="button"
                    className={cn(
                      "min-w-0 rounded px-2 py-1.5 text-left text-sm transition-colors",
                      isTerminal
                        ? "text-muted-foreground hover:text-foreground hover:bg-white/5"
                        : "text-[#666666] dark:text-[#888888] hover:text-[#111111] dark:hover:text-[#EEEEEE] hover:bg-[#F5F5F5] dark:hover:bg-[#1A1A1A]",
                    )}
                    onClick={() => onLoadSession(s.id)}
                    title={s.title ?? "제목 없음"}
                  >
                    <span className="block break-words text-xs leading-4 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                      {s.title ?? "제목 없음"}
                    </span>
                  </button>
                </div>
              );
            })
          )}
          {selectedSessionIds.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full mt-2 h-7 text-xs"
              onClick={onAggregateSelected}
            >
              통합 질문 ({selectedSessionIds.length})
            </Button>
          )}
        </div>

        <Divider />
      </ScrollArea>
      <div
        className={cn(
          "shrink-0 border-t px-3 py-3",
          isTerminal
            ? "border-border bg-[hsl(var(--terminal-titlebar))]"
            : "border-[#EAEAEA] bg-[#FCFCFC] dark:border-[#222222] dark:bg-[#050505]",
        )}
      >
        <div className={labelClass}>
          <Settings className="w-3 h-3" />
          설정
        </div>
        {isTerminal ? (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-2 px-1">
            <SettingToggleCard
              label="LIVE 고정"
              checked={livePinned}
              onToggle={onToggleLivePinned}
              disabled={!onToggleLivePinned}
              isTerminal={isTerminal}
            />
            <SettingToggleCard
              label="기록 저장"
              checked={persistOptIn}
              onToggle={onTogglePersist}
              isTerminal={isTerminal}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 px-1">
            <SettingToggleCard
              label="LIVE 고정"
              checked={livePinned}
              onToggle={onToggleLivePinned}
              disabled={!onToggleLivePinned}
              isTerminal={isTerminal}
            />
            <SettingToggleCard
              label="기록 저장"
              checked={persistOptIn}
              onToggle={onTogglePersist}
              isTerminal={isTerminal}
            />
          </div>
        )}
      </div>
    </div>
  );
}
