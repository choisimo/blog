import { createPortal } from "react-dom";
import { Terminal, X, ChevronRight, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

type ShellOutputOverlayProps = {
  output: string | null;
  onExpand: () => void;
  onClose: () => void;
};

const ANSI_ESCAPE_PATTERN = /\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
const SHELL_CONTROL_TEXT_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function normalizeShellText(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  const normalized = value
    .replace(ANSI_ESCAPE_PATTERN, "")
    .replace(SHELL_CONTROL_TEXT_PATTERN, "")
    .trim();
  return normalized || fallback;
}

export function ShellOutputOverlay({
  output,
  onExpand,
  onClose,
}: ShellOutputOverlayProps) {
  const safeOutput = normalizeShellText(output);

  if (!safeOutput) return null;

  return createPortal(
    <div
      aria-label="터미널 출력"
      className="fixed inset-x-0 bottom-14 z-[var(--z-terminal-floating)] px-3 pb-2 animate-in slide-in-from-bottom-2 duration-150"
      role="region"
    >
      <div className="bg-[hsl(var(--terminal-code-bg))] border border-primary/30 rounded-[4px] shadow-lg shadow-primary/5 overflow-hidden max-h-[50vh]">
        {/* Terminal header */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-primary/10 border-b border-primary/20">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="w-2 h-2 rounded-full bg-primary/60 animate-pulse" />
            <span className="font-mono text-[10px] text-primary/80 uppercase tracking-wider">
              // Output
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onExpand}
              className="p-1 text-muted-foreground hover:text-primary transition-colors"
              aria-label="터미널 출력 확장"
            >
              <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 rotate-90" focusable="false" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-0.5 text-muted-foreground hover:text-primary transition-colors"
              aria-label="터미널 출력 닫기"
            >
              <X aria-hidden="true" className="h-3.5 w-3.5" focusable="false" />
            </button>
          </div>
        </div>
        {/* Terminal output */}
        <div className="p-3 max-h-48 overflow-auto overscroll-contain">
          <pre className="font-mono text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
            {safeOutput}
          </pre>
        </div>
      </div>
    </div>,
    document.body,
  );
}

type MobileShellBarProps = {
  displayPath: string;
  onShellOpen: () => void;
  showScrollTop: boolean;
  hasNew: boolean;
};

export function MobileShellBar({
  displayPath,
  onShellOpen,
  showScrollTop,
  hasNew,
}: MobileShellBarProps) {
  const safeDisplayPath = normalizeShellText(displayPath, "~/");

  return (
    <div
      aria-label="모바일 터미널 빠른 실행"
      className={cn(
        "flex w-full items-center gap-2.5",
        "bg-[hsl(var(--terminal-code-bg))]",
        "border-t border-primary/30",
        "px-3 py-2.5",
        "pb-[calc(10px+env(safe-area-inset-bottom,0px))]",
        "transition-transform duration-200 ease-out",
        "data-[hidden=true]:translate-y-[110%]",
      )}
      role="region"
    >
      {/* Terminal button - opens shell */}
      <button
        type="button"
        onClick={onShellOpen}
        aria-label="Open command input"
        className="flex items-center justify-center h-10 w-10 rounded-[4px] bg-primary/20 text-primary border border-primary/40 transition-all active:scale-95 hover:bg-primary/30 hover:border-primary/60 hover:shadow-[0_0_12px_hsl(var(--primary)/0.4)]"
      >
        <Terminal aria-hidden="true" className="h-5 w-5" focusable="false" />
      </button>

      {/* Path display - also opens shell */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`명령 입력 열기: ${safeDisplayPath}`}
        onClick={onShellOpen}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          onShellOpen();
        }}
        className="flex-1 flex items-center gap-2 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
      >
        <span className="font-mono text-xs text-primary/70 truncate">
          {safeDisplayPath}
        </span>
        <span className="text-primary/40 font-mono text-xs">$ _</span>
      </div>

      {/* Scroll to top button - only show when scrolled down */}
      {showScrollTop && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          aria-label="맨 위로 스크롤"
          className="flex items-center justify-center h-8 w-8 rounded-[4px] bg-primary/15 text-primary border border-primary/40 transition-all active:scale-95 hover:bg-primary/25 hover:border-primary/60"
        >
          <ArrowUp aria-hidden="true" className="h-4 w-4" focusable="false" />
        </button>
      )}

      {/* New badge indicator */}
      {hasNew && !showScrollTop && (
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-primary animate-pulse shrink-0" />
      )}
    </div>
  );
}
