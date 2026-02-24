import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

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

  const prefersReduced =
    typeof window !== "undefined" &&
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
        className={cn(
          "flex items-center gap-2 my-1 px-2 transition-opacity duration-300",
          !visible && "opacity-0",
        )}
      >
        <div className="h-px flex-1 bg-primary/20" />
        <span className="text-[11px] font-mono text-primary/40 whitespace-nowrap px-1">
          {text}
        </span>
        <div className="h-px flex-1 bg-primary/20" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 my-1 px-2 transition-opacity duration-300",
        !visible && "opacity-0",
      )}
    >
      <div className="h-px flex-1 bg-border/50" />
      <span className="text-[11px] text-muted-foreground/70 whitespace-nowrap px-1">
        {text}
      </span>
      <div className="h-px flex-1 bg-border/50" />
    </div>
  );
}
