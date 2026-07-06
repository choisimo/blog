import { cn } from "@/lib/utils";
import type { DockAction } from "../types";

type TerminalDockProps = {
  dockActions: DockAction[];
  isMobile: boolean;
  isLeft?: boolean;
};

const ANSI_ESCAPE_PATTERN = /\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
const TERMINAL_DOCK_CONTROL_TEXT_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function normalizeTerminalDockLabel(value: unknown, fallback = "Action"): string {
  if (typeof value !== "string") return fallback;
  const normalized = value
    .replace(ANSI_ESCAPE_PATTERN, "")
    .replace(TERMINAL_DOCK_CONTROL_TEXT_PATTERN, "")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || fallback;
}

export function TerminalDock({ dockActions, isMobile, isLeft }: TerminalDockProps) {
  if (isMobile) {
    // Mobile TUI is handled by MobileShellBar component
    return null;
  }

  // PC Terminal Dock
  if (isLeft) {
    return (
      <div className="flex flex-col items-center gap-0.5 border border-border bg-[hsl(var(--terminal-code-bg))] py-2 px-1 backdrop-blur-sm">
        {dockActions.map((action) => {
          const Icon = action.icon;
          const displayLabel = normalizeTerminalDockLabel(action.desktopLabel || action.label, action.key);
          const title = normalizeTerminalDockLabel(action.title || action.desktopLabel || action.label, displayLabel);
          return (
            <button
              key={action.key}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              aria-disabled={action.disabled}
              aria-label={displayLabel}
              title={title}
              className={cn(
                "group relative flex items-center justify-center p-3 font-mono text-xs transition-all disabled:cursor-not-allowed disabled:opacity-50",
                action.primary
                  ? "bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30"
                  : "text-foreground/75 hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/30",
              )}
            >
              <Icon
                aria-hidden="true"
                className={cn(
                  "h-4 w-4",
                  action.primary && "terminal-glow",
                )}
                focusable="false"
              />
              {action.badge && (
                <span
                  className="absolute -top-0.5 -right-0.5 inline-flex h-2 w-2 rounded-full bg-primary animate-pulse"
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex w-auto max-w-full items-center gap-0.5 overflow-hidden border border-border bg-[hsl(var(--terminal-code-bg))] backdrop-blur-sm">
      {/* Terminal window controls - macOS style traffic lights */}
      <div aria-hidden="true" className="flex items-center gap-2 border-r border-border/50 px-3 py-2.5">
        <span className="w-3 h-3 rounded-full bg-[hsl(var(--terminal-window-btn-close))]" />
        <span className="w-3 h-3 rounded-full bg-[hsl(var(--terminal-window-btn-minimize))]" />
        <span className="w-3 h-3 rounded-full bg-[hsl(var(--terminal-window-btn-maximize))]" />
      </div>

      {/* Terminal path */}
      <div aria-hidden="true" className="hidden items-center gap-1 border-r border-border/50 px-3 text-[11px] font-mono text-muted-foreground sm:flex">
        <span className="text-primary/60">~/</span>
        <span>actions</span>
      </div>

      {/* Action buttons - centered with proper spacing */}
      <div className="flex flex-1 flex-wrap items-center justify-center gap-2 px-3 py-1.5">
        {dockActions.map((action) => {
          const Icon = action.icon;
          const displayLabel = normalizeTerminalDockLabel(action.desktopLabel || action.label, action.key);
          const title = normalizeTerminalDockLabel(action.title || action.desktopLabel || action.label, displayLabel);
          return (
            <button
              key={action.key}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              aria-label={displayLabel}
              aria-disabled={action.disabled}
              title={title}
              className={cn(
                "group relative flex items-center gap-1.5 px-4 py-2.5 font-mono text-xs transition-all disabled:cursor-not-allowed disabled:opacity-50",
                action.primary
                  ? "bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30"
                  : "text-foreground/75 hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/30",
              )}
            >
              <Icon
                aria-hidden="true"
                className={cn(
                  "h-4 w-4",
                  action.primary && "terminal-glow",
                )}
                focusable="false"
              />
              <span className="text-[10px] uppercase tracking-wider">
                {displayLabel}
              </span>
              {action.badge && (
                <span
                  className="absolute -top-0.5 -right-0.5 inline-flex h-2 w-2 rounded-full bg-primary animate-pulse"
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Terminal status */}
      <div aria-hidden="true" className="hidden items-center gap-2 border-l border-border/50 px-3 text-[10px] font-mono text-foreground/70 sm:flex">
        <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse" />
        <span>READY</span>
      </div>
    </div>
  );
}
