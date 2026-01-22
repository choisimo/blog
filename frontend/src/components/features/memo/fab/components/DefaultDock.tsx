import React from "react";
import { cn } from "@/lib/utils";
import type { DockAction } from "../types";

type DefaultDockProps = {
  dockActions: DockAction[];
  isMobile: boolean;
};

export function DefaultDock({ dockActions, isMobile }: DefaultDockProps) {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-center backdrop-blur-xl",
        isMobile
          ? "rounded-none border-t border-border/30 bg-background/95 px-2 py-1.5 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] dark:bg-background/90 dark:border-white/10"
          : "rounded-[28px] border border-white/20 bg-background/70 px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.08),_0_2px_8px_rgba(0,0,0,0.04)] dark:border-white/10 dark:bg-background/60 dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]",
      )}
    >
      {isMobile ? (
        // Mobile: Flex layout with equal spacing - always single row
        <div className="flex w-full items-center justify-around">
          {dockActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.key}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                aria-label={action.label}
                className={cn(
                  "group relative flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 min-w-0 flex-1 transition-all active:scale-95",
                  action.disabled && "opacity-40",
                )}
              >
                <span
                  className={cn(
                    "flex items-center justify-center rounded-xl transition-all duration-150",
                    "h-10 w-10",
                    action.primary
                      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                      : "bg-muted/60 text-foreground/70 dark:bg-white/10 dark:text-white/70",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-[10px] text-muted-foreground/70 dark:text-white/50">
                  {action.label}
                </span>
                {action.badge && (
                  <span className="absolute top-0.5 right-2 inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      ) : (
        // PC: Premium hover effects and labels
        <div className="flex items-center justify-center gap-2">
          {dockActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.key}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                aria-label={action.label}
                aria-disabled={action.disabled}
                title={action.title}
                className={cn(
                  "group relative flex items-center gap-2.5 rounded-2xl px-4 py-2.5 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
                  action.primary
                    ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 hover:scale-[1.02]"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground dark:hover:bg-white/10 dark:hover:text-white",
                )}
              >
                <Icon
                  className={cn(
                    "h-[18px] w-[18px]",
                    action.primary && "text-primary-foreground",
                  )}
                />
                <span
                  className={cn(
                    "text-sm font-medium tracking-wide",
                    action.primary
                      ? "text-primary-foreground"
                      : "text-foreground/80 dark:text-white/80",
                  )}
                >
                  {action.label}
                </span>
                {action.badge && (
                  <span
                    className="absolute -top-1 -right-1 inline-flex h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background animate-pulse"
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
