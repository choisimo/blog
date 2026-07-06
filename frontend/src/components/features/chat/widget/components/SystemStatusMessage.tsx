import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const ANSI_ESCAPE_PATTERN = /\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
const SYSTEM_STATUS_CONTROL_TEXT_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function stripUnsafeSystemStatusControls(value: string): string {
  return value
    .replace(ANSI_ESCAPE_PATTERN, "")
    .replace(SYSTEM_STATUS_CONTROL_TEXT_PATTERN, "");
}

function normalizeSystemStatusText(value: unknown, fallback = "상태 업데이트"): string {
  if (typeof value !== "string") return fallback;
  const normalized = stripUnsafeSystemStatusControls(value)
    .replace(/\s+/g, " ")
    .trim();
  return normalized || fallback;
}

export function SystemStatusMessage({
  text,
  isTerminal,
  transient: isTransient,
  delay = 4000,
  onExpire,
}: {
  text: string;
  isTerminal: boolean;
  transient?: boolean;
  delay?: number;
  onExpire?: () => void;
}) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<number | null>(null);
  const expireRef = useRef<number | null>(null);
  const displayText = normalizeSystemStatusText(text);

  const prefersReduced =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!isTransient) return;
    timerRef.current = window.setTimeout(() => {
      if (!prefersReduced) {
        setVisible(false);
        expireRef.current = window.setTimeout(() => {
          onExpire?.();
        }, 300);
      } else {
        onExpire?.();
      }
    }, delay);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      if (expireRef.current !== null) window.clearTimeout(expireRef.current);
    };
  }, [isTransient, delay, onExpire, prefersReduced]);

  if (isTerminal) {
    return (
      <div
        aria-atomic="true"
        aria-label={displayText}
        aria-live="polite"
        className={cn(
          "flex items-center gap-2 my-1 px-2 transition-opacity duration-300",
          !visible && "opacity-0",
        )}
        role="status"
      >
        <div aria-hidden="true" className="h-px flex-1 bg-primary/20" />
        <span className="text-[11px] font-mono text-primary/40 break-words [overflow-wrap:anywhere] text-center px-1">
          {displayText}
        </span>
        <div aria-hidden="true" className="h-px flex-1 bg-primary/20" />
      </div>
    );
  }

  return (
    <div
      aria-atomic="true"
      aria-label={displayText}
      aria-live="polite"
      className={cn(
        "flex items-center gap-2 my-1 px-2 transition-opacity duration-300",
        !visible && "opacity-0",
      )}
      role="status"
    >
      <div aria-hidden="true" className="h-px flex-1 bg-border/50" />
      <span className="text-[11px] text-muted-foreground/70 break-words [overflow-wrap:anywhere] text-center px-1">
        {displayText}
      </span>
      <div aria-hidden="true" className="h-px flex-1 bg-border/50" />
    </div>
  );
}
