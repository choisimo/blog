import React, { useEffect, useState } from "react";
import { MessageCircle, Radio, History, Settings, Users } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
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

  const labelClass = cn(
    "flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mb-2",
    isTerminal ? "text-primary/50 font-mono" : "text-muted-foreground/70",
  );

  const itemClass = (active: boolean) =>
    cn(
      "flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm transition-colors text-left",
      active
        ? isTerminal
          ? "bg-primary/20 text-primary"
          : "bg-primary/10 text-primary font-medium"
        : isTerminal
          ? "text-muted-foreground hover:text-foreground hover:bg-white/5"
          : "text-muted-foreground hover:text-foreground hover:bg-muted",
    );

  return (
    <div
      className={cn(
        "flex h-full w-72 shrink-0 flex-col overflow-hidden border-r",
        isTerminal
          ? "bg-[hsl(var(--terminal-code-bg))] border-border font-mono"
          : "bg-muted/20",
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

        <Separator className={cn(isTerminal && "bg-border/40")} />

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
                  : "border-border/70 text-muted-foreground hover:bg-muted hover:text-foreground",
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
            <p className="text-xs text-muted-foreground/50 px-2 py-1">
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

        <Separator className={cn(isTerminal && "bg-border/40")} />

        {/* 대화 기록 */}
        <div className={sectionClass}>
          <div className={labelClass}>
            <History className="w-3 h-3" />
            대화 기록
          </div>
          {sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground/50 px-2 py-1">
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
                        : "text-muted-foreground hover:text-foreground hover:bg-muted",
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

        <Separator className={cn(isTerminal && "bg-border/40")} />

        {/* 설정 */}
        <div className={sectionClass}>
          <div className={labelClass}>
            <Settings className="w-3 h-3" />
            설정
          </div>
          <div className="grid grid-cols-2 gap-2 px-1">
            <div
              className={cn(
                "rounded-xl border px-2.5 py-2",
                livePinned
                  ? "border-primary/40 bg-primary/10"
                  : "border-border/60 bg-background/70",
              )}
            >
              <div className="mb-1 text-[11px] font-medium text-muted-foreground">
                LIVE 고정
              </div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] text-muted-foreground/90">
                  {livePinned ? "ON" : "OFF"}
                </span>
                <Switch
                  checked={livePinned}
                  onCheckedChange={() => onToggleLivePinned?.()}
                  disabled={!onToggleLivePinned}
                  className="scale-95"
                />
              </div>
            </div>
            <div
              className={cn(
                "rounded-xl border px-2.5 py-2",
                persistOptIn
                  ? "border-primary/40 bg-primary/10"
                  : "border-border/60 bg-background/70",
              )}
            >
              <div className="mb-1 text-[11px] font-medium text-muted-foreground">
                기록 저장
              </div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] text-muted-foreground/90">
                  {persistOptIn ? "ON" : "OFF"}
                </span>
                <Switch
                  checked={persistOptIn}
                  onCheckedChange={onTogglePersist}
                  className="scale-95"
                />
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
