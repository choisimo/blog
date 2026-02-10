import React from "react";
import { cn } from "@/lib/utils";
import type { DockAction } from "../types";

type TerminalDockProps = {
  dockActions: DockAction[];
  isMobile: boolean;
};

export function TerminalDock({ dockActions, isMobile }: TerminalDockProps) {
  if (isMobile) {
    // Mobile TUI is handled by MobileShellBar component
    return null;
  }

  // PC Terminal Dock
  return (
    <div className="flex w-full items-center gap-0.5 border border-border bg-[hsl(var(--terminal-code-bg))] backdrop-blur-sm lg:flex-col lg:items-stretch lg:gap-0 lg:overflow-hidden">
      {/* Terminal window controls - macOS style traffic lights */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-r border-border/50 lg:border-r-0 lg:border-b lg:border-border/50">
        <span className="w-3 h-3 rounded-full bg-[hsl(var(--terminal-window-btn-close))]" />
        <span className="w-3 h-3 rounded-full bg-[hsl(var(--terminal-window-btn-minimize))]" />
        <span className="w-3 h-3 rounded-full bg-[hsl(var(--terminal-window-btn-maximize))]" />
      </div>

      {/* Terminal path */}
      <div className="hidden sm:flex items-center gap-1 px-3 text-[11px] font-mono text-muted-foreground border-r border-border/50 lg:border-r-0 lg:border-b lg:border-border/40 lg:py-2">
        <span className="text-primary/60">~/</span>
        <span>actions</span>
      </div>

      {/* Action buttons - centered with proper spacing */}
      <div className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 lg:flex-col lg:items-stretch lg:justify-start lg:gap-1.5 lg:px-2.5 lg:py-2">
        {dockActions.map((action) => {
          const Icon = action.icon;
          const displayLabel = action.desktopLabel || action.label;
          return (
            <button
              key={action.key}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              aria-label={displayLabel}
              aria-disabled={action.disabled}
              title={action.title || displayLabel}
              className={cn(
                "group relative flex items-center gap-1.5 px-4 py-2.5 font-mono text-xs transition-all disabled:cursor-not-allowed disabled:opacity-50 lg:w-full lg:justify-start lg:px-3",
                action.primary
                  ? "bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30"
                  : "text-foreground/75 hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/30",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4",
                  action.primary && "terminal-glow",
                )}
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
      <div className="hidden sm:flex items-center gap-2 px-3 text-[10px] font-mono text-foreground/70 border-l border-border/50 lg:border-l-0 lg:border-t lg:border-border/40 lg:py-2">
        <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse" />
        <span>READY</span>
      </div>
    </div>
  );
}
