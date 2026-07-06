import { useEffect, useState } from "react";
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
  livePinned?: boolean;
  onToggleLivePinned?: () => void;
}

const ANSI_ESCAPE_PATTERN = /\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
const LIVE_PANEL_CONTROL_TEXT_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function stripUnsafeLivePanelControls(value: string): string {
  return value
    .replace(ANSI_ESCAPE_PATTERN, "")
    .replace(LIVE_PANEL_CONTROL_TEXT_PATTERN, "");
}

function normalizeLivePanelLabel(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  const normalized = stripUnsafeLivePanelControls(value)
    .replace(/\s+/g, " ")
    .trim();
  return normalized || fallback;
}

function normalizeLivePanelRoomId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = stripUnsafeLivePanelControls(value).trim();
  if (!normalized || /[\r\n]/.test(normalized)) return null;
  return normalized;
}

function normalizeLivePanelCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

function formatRoomName(room: string): string {
  return normalizeLivePanelLabel(room, "room:lobby")
    .replace(/^room:/, "")
    .replace(/:/g, "/");
}

export function LiveRoomPanel({
  isTerminal,
  isMobile,
  currentRoom,
  onRoomSelect,
  onStartDebate,
  currentRoomLabel,
  livePinned = false,
  onToggleLivePinned,
}: LiveRoomPanelProps) {
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const normalizedCurrentRoom = normalizeLivePanelRoomId(currentRoom);
  const currentRoomTitleLabel = normalizeLivePanelLabel(currentRoomLabel);
  const debateLabel = currentRoomTitleLabel
    ? `현재 방 AI 토론 시작: ${currentRoomTitleLabel}`
    : "현재 방 AI 토론 시작";

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

  const sortedRooms = rooms.flatMap((room) => {
    const roomId = normalizeLivePanelRoomId(room.room);
    return roomId
      ? [{ ...room, room: roomId, onlineCount: normalizeLivePanelCount(room.onlineCount) }]
      : [];
  }).sort((a, b) => {
    if (b.onlineCount !== a.onlineCount) return b.onlineCount - a.onlineCount;
    return a.room.localeCompare(b.room);
  });

  if (sortedRooms.length === 0) return null;

  if (isMobile) {
    return (
      <div
        aria-label="실시간 채팅방"
        className={cn(
          "border-b shrink-0",
          isTerminal
            ? "bg-[hsl(var(--terminal-code-bg))] border-border"
            : "bg-muted/40 border-border/50",
        )}
        role="region"
      >
        <div className="flex items-center justify-between gap-2 px-3 pt-2 pb-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <p
              className={cn(
                "text-[11px] font-semibold tracking-wide uppercase",
                isTerminal
                  ? "text-primary/70 font-mono"
                  : "text-muted-foreground",
              )}
            >
              Live rooms ({sortedRooms.length})
            </p>
            <button
              type="button"
              aria-label={livePinned ? "LIVE 고정 끄기" : "LIVE 고정 켜기"}
              aria-pressed={livePinned}
              onClick={() => onToggleLivePinned?.()}
              className={cn(
                "shrink-0 rounded border px-2 py-1 text-[10px] leading-none transition-colors",
                livePinned
                  ? isTerminal
                    ? "border-primary/60 bg-primary/20 text-primary"
                    : "border-primary/40 bg-primary/10 text-primary"
                  : isTerminal
                    ? "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-primary"
                    : "border-border/70 text-muted-foreground hover:bg-muted hover:text-foreground",
                !onToggleLivePinned && "opacity-50 cursor-not-allowed",
              )}
              disabled={!onToggleLivePinned}
              title="일반 입력을 /live 없이 실시간 방으로 전송"
            >
              LIVE 고정 {livePinned ? "ON" : "OFF"}
            </button>
          </div>
          <button
            type="button"
            aria-label={debateLabel}
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
              currentRoomTitleLabel
                ? `현재 방 AI 토론 (${currentRoomTitleLabel})`
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
                const isCurrent = normalizedCurrentRoom === r.room;
                const isEmpty = r.onlineCount === 0;

                return (
                  <button
                    key={r.room}
                    type="button"
                    aria-current={isCurrent ? "page" : undefined}
                    aria-label={`실시간 방 선택: ${name}, ${r.onlineCount}명 온라인`}
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
                    <MessageCircle aria-hidden="true" className="w-3 h-3 shrink-0" focusable="false" />
                    <span className="truncate flex-1">{name}</span>
                    <span className="flex items-center gap-0.5 text-[10px] opacity-75 shrink-0">
                      <Users aria-hidden="true" className="w-2.5 h-2.5" focusable="false" />
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
      aria-label="실시간 채팅방"
      className={cn(
        "border-b shrink-0",
        isTerminal
          ? "bg-[hsl(var(--terminal-code-bg))] border-border"
          : "bg-muted/40",
      )}
      role="region"
    >
      <div className="flex items-center justify-between gap-2 px-3 pt-2 pb-1">
        <div className="flex min-w-0 items-center gap-2">
          <p
            className={cn(
              "text-[11px] font-semibold tracking-wide uppercase",
              isTerminal
                ? "text-primary/70 font-mono"
                : "text-muted-foreground",
            )}
          >
            Live rooms ({sortedRooms.length})
          </p>
          <button
            type="button"
            aria-label={livePinned ? "LIVE 고정 끄기" : "LIVE 고정 켜기"}
            aria-pressed={livePinned}
            onClick={() => onToggleLivePinned?.()}
            className={cn(
              "shrink-0 rounded border px-2 py-1 text-[10px] leading-none transition-colors",
              livePinned
                ? isTerminal
                  ? "border-primary/60 bg-primary/20 text-primary"
                  : "border-primary/40 bg-primary/10 text-primary"
                : isTerminal
                  ? "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-primary"
                  : "border-border/70 text-muted-foreground hover:bg-muted hover:text-foreground",
              !onToggleLivePinned && "opacity-50 cursor-not-allowed",
            )}
            disabled={!onToggleLivePinned}
            title="일반 입력을 /live 없이 실시간 방으로 전송"
          >
            LIVE 고정 {livePinned ? "ON" : "OFF"}
          </button>
        </div>
        <button
          type="button"
          aria-label={debateLabel}
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
            currentRoomTitleLabel
              ? `현재 방 AI 토론 (${currentRoomTitleLabel})`
              : "현재 방 AI 토론"
          }
        >
          AI 토론
        </button>
      </div>
      <div className="flex gap-1 px-3 pb-2 min-w-0 overflow-x-auto">
        {sortedRooms.map((r) => {
          const name = formatRoomName(r.room);
          const isCurrent = normalizedCurrentRoom === r.room;
          const isEmpty = r.onlineCount === 0;

          return (
            <button
              key={r.room}
              type="button"
              aria-current={isCurrent ? "page" : undefined}
              aria-label={`실시간 방 선택: ${name}, ${r.onlineCount}명 온라인`}
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
              <MessageCircle aria-hidden="true" className="w-3 h-3" focusable="false" />
              <span className="max-w-[16rem] truncate">{name}</span>
              <span className="flex items-center gap-0.5 text-[10px] opacity-70">
                <Users aria-hidden="true" className="w-2.5 h-2.5" focusable="false" />
                {r.onlineCount}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
