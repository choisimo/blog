import React, { useRef } from "react";
import { createPortal } from "react-dom";
import { Terminal, X, MonitorUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ShellLog } from "../types";
import { hasAuthToken } from "@/services/terminal";

type ShellModalProps = {
  isOpen: boolean;
  onClose: () => void;
  displayPath: string;
  viewportHeight: string;
  shellInput: string;
  setShellInput: (value: string) => void;
  shellInputRef: React.RefObject<HTMLInputElement>;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  suggestions: string[];
  selectedSuggestionIndex: number;
  selectSuggestion: (suggestion: string) => void;
  shellLogs: ShellLog[];
  shellOutput: string | null;
  consoleEndRef: React.RefObject<HTMLDivElement>;
  executeCommand: (cmd: string) => void;
  commandHistory: string[];
  onSwitchToRealTerminal?: () => void;
};

export function ShellModal({
  isOpen,
  onClose,
  displayPath,
  viewportHeight,
  shellInput,
  setShellInput,
  shellInputRef,
  onKeyDown,
  suggestions,
  selectedSuggestionIndex,
  selectSuggestion,
  shellLogs,
  shellOutput,
  consoleEndRef,
  executeCommand,
  commandHistory,
  onSwitchToRealTerminal,
}: ShellModalProps) {
  const shellContentRef = useRef<HTMLDivElement>(null);
  const canSwitchToReal = onSwitchToRealTerminal && hasAuthToken();

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={shellContentRef}
      className="fixed inset-0 z-[9999] flex flex-col bg-background/95 backdrop-blur-sm animate-in fade-in-0 duration-200"
      style={{ height: viewportHeight }}
    >
      {/* Backdrop - clicking closes the shell */}
      <div
        className="absolute inset-0 z-0"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Content container - must be above backdrop */}
      <div
        className="relative z-10 flex flex-col bg-[hsl(var(--terminal-code-bg))] border-t border-primary/20 w-full max-w-full overflow-x-hidden"
        style={{ height: viewportHeight }}
      >
        {/* Input field at the top - redesigned for long paths */}
        <div className="flex-shrink-0 flex flex-col border-b border-border/50 bg-black/20">
          {/* Path display - separate row */}
          <div className="flex items-center justify-between px-3 pt-2 pb-1">
            <span
              className="text-primary/60 font-mono text-[10px] truncate max-w-[50%]"
              title={displayPath}
            >
              {displayPath}
            </span>
            <div className="flex items-center gap-2">
              {/* Switch to Real Terminal button */}
              {canSwitchToReal && (
                <button
                  type="button"
                  onClick={onSwitchToRealTerminal}
                  className={cn(
                    "flex items-center gap-1 px-2 py-0.5",
                    "text-[10px] font-mono uppercase tracking-wider",
                    "bg-primary/10 border border-primary/30 rounded",
                    "text-primary/70 hover:text-primary hover:bg-primary/20",
                    "transition-colors"
                  )}
                  title="Switch to real Linux terminal"
                >
                  <MonitorUp className="h-3 w-3" />
                  <span>Real Shell</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1 text-muted-foreground hover:text-primary transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          {/* Input row */}
          <div className="relative flex items-center gap-1.5 px-3 pb-2.5">
            <span className="text-primary font-mono text-sm font-bold shrink-0">
              $
            </span>
            <input
              ref={shellInputRef}
              type="text"
              value={shellInput}
              onChange={(e) => setShellInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Type a command or 'help'"
              className="flex-1 min-w-0 bg-transparent border-none outline-none font-mono text-sm text-foreground placeholder:text-muted-foreground/40"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </div>

          {/* Autocomplete suggestions dropdown */}
          {suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-50 mx-3 mb-2 bg-[hsl(var(--terminal-code-bg))] border border-primary/30 rounded-[4px] shadow-lg overflow-hidden">
              <div className="text-[9px] font-mono text-primary/50 uppercase tracking-wider px-2 py-1 border-b border-border/30">
                // Suggestions (Tab/Enter to select)
              </div>
              <div className="max-h-40 overflow-y-auto">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => selectSuggestion(suggestion)}
                    className={cn(
                      "w-full text-left px-3 py-1.5 font-mono text-xs transition-colors",
                      index === selectedSuggestionIndex
                        ? "bg-primary/20 text-primary"
                        : "text-foreground/80 hover:bg-primary/10 hover:text-primary",
                    )}
                  >
                    <span className="text-primary/60">$ </span>
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Console Output Window */}
        <div className="flex-1 min-h-0 relative">
          <div className="absolute inset-0 overflow-y-auto p-3 bg-black/30">
            {/* Empty state */}
            {shellLogs.length === 0 && !shellOutput && (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50 text-center">
                <Terminal className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-xs font-mono">
                  Run a command to see output here...
                </p>
                <p className="text-[10px] mt-1 opacity-70">
                  Type 'help' for available commands
                </p>
              </div>
            )}

            {/* Execution logs */}
            {shellLogs.map((log, index) => (
              <div
                key={index}
                className={cn(
                  "mb-1 font-mono text-xs whitespace-pre-wrap break-all leading-relaxed",
                  log.type === "input"
                    ? "text-primary/90 font-medium"
                    : "text-foreground/80 pl-2 border-l-2 border-primary/20",
                )}
              >
                {log.text}
              </div>
            ))}

            {/* Scroll anchor */}
            <div ref={consoleEndRef} />
          </div>
        </div>

        {/* Quick Actions Bar */}
        <div className="flex-shrink-0 border-t border-border/30 bg-black/20 p-2.5">
          <div className="text-[10px] font-mono text-primary/60 uppercase tracking-wider mb-2">
            // Quick Commands
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {["ls", "find", "help", "clear"].map((cmd) => (
              <button
                key={cmd}
                type="button"
                onClick={() => executeCommand(cmd)}
                className={cn(
                  "py-2 px-1 font-mono text-xs uppercase tracking-wider",
                  "bg-primary/15 border border-primary/40",
                  "text-primary rounded-[4px]",
                  "hover:bg-primary/25 hover:border-primary/60 hover:text-primary",
                  "hover:shadow-[0_0_8px_hsl(var(--primary)/0.3)]",
                  "active:scale-95 transition-all duration-200",
                )}
              >
                {cmd}
              </button>
            ))}
          </div>
          {commandHistory.length > 0 && (
            <div className="mt-2 pt-2 border-t border-border/20">
              <div className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider mb-1.5">
                // History
              </div>
              <div className="flex flex-wrap gap-1">
                {commandHistory
                  .slice(-4)
                  .reverse()
                  .map((cmd, idx) => (
                    <button
                      key={`${cmd}-${idx}`}
                      type="button"
                      onClick={() => executeCommand(cmd)}
                      className={cn(
                        "py-1 px-2 rounded-[4px] text-[10px] font-mono",
                        "bg-primary/10 border border-primary/30",
                        "text-primary/80",
                        "hover:bg-primary/20 hover:text-primary hover:border-primary/50",
                        "transition-colors truncate max-w-[80px]",
                      )}
                    >
                      {cmd}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
