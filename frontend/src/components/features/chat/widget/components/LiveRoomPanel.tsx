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
}

function formatRoomName(room: string): string {
  return room.replace(/^room:/, "").replace(/:/g, "/");
}

export function LiveRoomPanel({
  isTerminal,
  currentRoom,
  onRoomSelect,
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

  return (
    <div
      className={cn(
        "border-b shrink-0 overflow-x-auto",
        isTerminal
          ? "bg-[hsl(var(--terminal-code-bg))] border-border"
          : "bg-muted/40",
      )}
    >
      <div className="flex gap-1 px-3 py-1.5 min-w-0">
        {rooms.map((r) => {
          const name = formatRoomName(r.room);
          const isCurrent = currentRoom === r.room;
          const isEmpty = r.onlineCount === 0;

          return (
            <button
              key={r.room}
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
              <span>{name}</span>
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
