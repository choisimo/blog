import React, { useEffect, useState } from "react";
import { Users, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLiveRooms } from "@/services/chat";
import type { LiveRoom } from "@/services/chat";

interface LiveRoomPanelProps {
  isTerminal: boolean;
  isMobile: boolean;
  currentRoom?: string;
  onRoomSelect?: (room: string) => void;
  onStartDebate?: () => void;
  currentRoomLabel?: string;
}

function formatRoomName(room: string): string {
  return room.replace(/^room:/, "").replace(/:/g, "/");
}

export function LiveRoomPanel({
  isTerminal,
  isMobile,
  currentRoom,
  onRoomSelect,
  onStartDebate,
  currentRoomLabel,
}: LiveRoomPanelProps) {
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchRooms = async () => {
      try {
        const data = await getLiveRooms();
        if (!cancelled) {
          setRooms(data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRooms();
    const interval = setInterval(fetchRooms, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (loading || rooms.length === 0) return null;

  const sortedRooms = [...rooms].sort((a, b) => {
    if (b.onlineCount !== a.onlineCount) return b.onlineCount - a.onlineCount;
    return a.room.localeCompare(b.room);
  });

  if (isMobile) {
    return (
      <div
        className={cn(
          "border-b shrink-0",
          isTerminal
            ? "bg-[hsl(var(--terminal-code-bg))] border-border"
            : "bg-muted/40 border-border/50",
        )}
      >
        <div className="flex items-center justify-between gap-2 px-3 pt-2 pb-1.5">
          <p
            className={cn(
              "text-[11px] font-semibold tracking-wide uppercase",
              isTerminal ? "text-primary/70 font-mono" : "text-muted-foreground",
            )}
          >
            Live rooms ({sortedRooms.length})
          </p>
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
              currentRoomLabel
                ? `현재 방 AI 토론 (${currentRoomLabel})`
                : "현재 방 AI 토론"
            }
          >
            AI 토론
          </button>
        </div>
        <div className="px-3 pb-2.5">
          <div className="max-h-36 overflow-y-auto overscroll-contain pr-1">
            <div className="grid grid-cols-2 gap-2">
              {sortedRooms.map((r) => {
                const name = formatRoomName(r.room);
                const isCurrent = currentRoom === r.room;
                const isEmpty = r.onlineCount === 0;

                return (
                  <button
                    key={r.room}
                    type="button"
                    onClick={() => onRoomSelect?.(r.room)}
                    className={cn(
                      "flex w-full min-w-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs text-left transition-colors",
                      isCurrent
                        ? isTerminal
                          ? "bg-primary/20 text-primary border-primary/40"
                          : "bg-primary/10 text-primary border-primary/30"
                        : isTerminal
                          ? "text-muted-foreground hover:text-foreground hover:bg-white/5 border-border/40"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted border-border/50",
                      isEmpty && "opacity-50",
                    )}
                  >
                    <MessageCircle className="w-3 h-3 shrink-0" />
                    <span className="truncate flex-1">{name}</span>
                    <span className="flex items-center gap-0.5 text-[10px] opacity-75 shrink-0">
                      <Users className="w-2.5 h-2.5" />
                      {r.onlineCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border-b shrink-0",
        isTerminal
          ? "bg-[hsl(var(--terminal-code-bg))] border-border"
          : "bg-muted/40",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3 pt-2 pb-1">
        <p
          className={cn(
            "text-[11px] font-semibold tracking-wide uppercase",
            isTerminal ? "text-primary/70 font-mono" : "text-muted-foreground",
          )}
        >
          Live rooms ({sortedRooms.length})
        </p>
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
            currentRoomLabel
              ? `현재 방 AI 토론 (${currentRoomLabel})`
              : "현재 방 AI 토론"
          }
        >
          AI 토론
        </button>
      </div>
      <div className="flex gap-1 px-3 pb-2 min-w-0 overflow-x-auto">
        {sortedRooms.map((r) => {
          const name = formatRoomName(r.room);
          const isCurrent = currentRoom === r.room;
          const isEmpty = r.onlineCount === 0;

          return (
            <button
              key={r.room}
              type="button"
              onClick={() => onRoomSelect?.(r.room)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs whitespace-nowrap transition-colors shrink-0",
                isCurrent
                  ? isTerminal
                    ? "bg-primary/20 text-primary border border-primary/40"
                    : "bg-primary/10 text-primary border border-primary/30"
                  : isTerminal
                    ? "text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent",
                isEmpty && "opacity-40",
              )}
            >
              <MessageCircle className="w-3 h-3" />
              <span className="max-w-[16rem] truncate">{name}</span>
              <span className="flex items-center gap-0.5 text-[10px] opacity-70">
                <Users className="w-2.5 h-2.5" />
                {r.onlineCount}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
