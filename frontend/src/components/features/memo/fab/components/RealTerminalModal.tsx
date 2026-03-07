/**
 * RealTerminalModal - Real Linux terminal UI with xterm.js
 *
 * Full-screen terminal modal that connects to a real Docker container
 * via the terminal gateway WebSocket.
 */

import React, { useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Terminal, X, Wifi, WifiOff, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRealTerminal, type TerminalStatus } from "../hooks/useRealTerminal";

// Dynamic imports for xterm to avoid SSR issues
let XTerm: typeof import("@xterm/xterm").Terminal | null = null;
let FitAddon: typeof import("@xterm/addon-fit").FitAddon | null = null;
let WebLinksAddon: typeof import("@xterm/addon-web-links").WebLinksAddon | null = null;

// Load xterm modules dynamically
const loadXterm = async () => {
  if (!XTerm) {
    const [xtermModule, fitModule, webLinksModule] = await Promise.all([
      import("@xterm/xterm"),
      import("@xterm/addon-fit"),
      import("@xterm/addon-web-links"),
    ]);
    XTerm = xtermModule.Terminal;
    FitAddon = fitModule.FitAddon;
    WebLinksAddon = webLinksModule.WebLinksAddon;
    
    // Import CSS
    await import("@xterm/xterm/css/xterm.css");
  }
  return { XTerm, FitAddon, WebLinksAddon };
};

type RealTerminalModalProps = {
  isOpen: boolean;
  onClose: () => void;
  viewportHeight: string;
  onSwitchToVirtual?: () => void;
};

const StatusIndicator = ({ status }: { status: TerminalStatus }) => {
  const statusConfig = {
    disconnected: {
      icon: WifiOff,
      text: "Disconnected",
      className: "text-muted-foreground",
    },
    connecting: {
      icon: Loader2,
      text: "Connecting...",
      className: "text-yellow-500 animate-spin",
    },
    connected: {
      icon: Wifi,
      text: "Connected",
      className: "text-primary",
    },
    error: {
      icon: WifiOff,
      text: "Error",
      className: "text-destructive",
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={cn("flex items-center gap-1.5", config.className)}>
      <Icon className={cn("h-3.5 w-3.5", status === "connecting" && "animate-spin")} />
      <span className="text-xs font-mono">{config.text}</span>
    </div>
  );
};

export function RealTerminalModal({
  isOpen,
  onClose,
  viewportHeight,
  onSwitchToVirtual,
}: RealTerminalModalProps) {
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<InstanceType<typeof import("@xterm/xterm").Terminal> | null>(null);
  const fitAddonRef = useRef<InstanceType<typeof import("@xterm/addon-fit").FitAddon> | null>(null);
  const xtermLoadedRef = useRef(false);

  const handleData = useCallback((data: string) => {
    if (terminalInstanceRef.current) {
      terminalInstanceRef.current.write(data);
    }
  }, []);

  const {
    status,
    error,
    isAvailable,
    connect,
    disconnect,
    send,
    resize,
  } = useRealTerminal({
    cols: 80,
    rows: 24,
    onData: handleData,
  });

  // Initialize xterm when modal opens
  useEffect(() => {
    if (!isOpen || !terminalContainerRef.current || xtermLoadedRef.current) {
      return;
    }

    let mounted = true;

    const initTerminal = async () => {
      const { XTerm: TerminalClass, FitAddon: FitAddonClass, WebLinksAddon: WebLinksAddonClass } =
        await loadXterm();

      if (!mounted || !terminalContainerRef.current || !TerminalClass || !FitAddonClass) {
        return;
      }

      // Create terminal instance
      const term = new TerminalClass({
        theme: {
          background: "hsl(224 71.4% 4.1%)", // Match terminal theme
          foreground: "#e4e4e7",
          cursor: "hsl(142.1 70.6% 45.3%)", // Primary color
          cursorAccent: "#000",
          selectionBackground: "rgba(142, 255, 142, 0.3)",
          black: "#18181b",
          red: "#f87171",
          green: "#4ade80",
          yellow: "#facc15",
          blue: "#60a5fa",
          magenta: "#c084fc",
          cyan: "#22d3ee",
          white: "#e4e4e7",
          brightBlack: "#52525b",
          brightRed: "#fca5a5",
          brightGreen: "#86efac",
          brightYellow: "#fde047",
          brightBlue: "#93c5fd",
          brightMagenta: "#d8b4fe",
          brightCyan: "#67e8f9",
          brightWhite: "#fafafa",
        },
        fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Menlo, Monaco, monospace',
        fontSize: 13,
        lineHeight: 1.3,
        cursorBlink: true,
        cursorStyle: "block",
        scrollback: 5000,
        tabStopWidth: 4,
        allowTransparency: true,
      });

      // Add fit addon
      const fitAddon = new FitAddonClass();
      term.loadAddon(fitAddon);
      fitAddonRef.current = fitAddon;

      // Add web links addon
      if (WebLinksAddonClass) {
        const webLinksAddon = new WebLinksAddonClass();
        term.loadAddon(webLinksAddon);
      }

      // Open terminal in container
      term.open(terminalContainerRef.current);

      // Fit to container
      setTimeout(() => {
        fitAddon.fit();
      }, 0);

      // Handle user input
      term.onData((data) => {
        send(data);
      });

      // Handle resize
      term.onResize(({ cols, rows }) => {
        resize(cols, rows);
      });

      terminalInstanceRef.current = term;
      xtermLoadedRef.current = true;

      // Auto-connect if available
      if (isAvailable) {
        connect();
      } else {
        term.writeln("\x1b[33m터미널 서비스에 연결할 수 없습니다.\x1b[0m");
        term.writeln("\x1b[90m로그인이 필요하거나 서비스가 준비되지 않았습니다.\x1b[0m");
        term.writeln("");
        term.writeln('\x1b[90m"Virtual Shell" 버튼을 눌러 가상 쉘을 사용하세요.\x1b[0m');
      }
    };

    initTerminal();

    return () => {
      mounted = false;
    };
  }, [isOpen, isAvailable, connect, send, resize]);

  // Handle window resize
  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isOpen]);

  // Cleanup on unmount or close
  useEffect(() => {
    if (!isOpen) {
      if (terminalInstanceRef.current) {
        terminalInstanceRef.current.dispose();
        terminalInstanceRef.current = null;
      }
      fitAddonRef.current = null;
      xtermLoadedRef.current = false;
      disconnect();
    }
  }, [isOpen, disconnect]);

  // Handle reconnect
  const handleReconnect = useCallback(() => {
    if (terminalInstanceRef.current) {
      terminalInstanceRef.current.clear();
      terminalInstanceRef.current.writeln("\x1b[33m재연결 중...\x1b[0m");
    }
    disconnect();
    setTimeout(connect, 500);
  }, [connect, disconnect]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[var(--z-terminal-modal)] flex flex-col bg-background/95 backdrop-blur-sm animate-in fade-in-0 duration-200"
      style={{ height: viewportHeight }}
    >
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-border/50 bg-[hsl(var(--terminal-code-bg))]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" />
            <span className="font-mono text-xs text-primary font-medium">
              LINUX SHELL
            </span>
          </div>
          <StatusIndicator status={status} />
        </div>

        <div className="flex items-center gap-2">
          {/* Reconnect button */}
          {status !== "connecting" && (
            <button
              type="button"
              onClick={handleReconnect}
              className="p-1.5 text-muted-foreground hover:text-primary transition-colors rounded"
              title="Reconnect"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Switch to virtual shell */}
          {onSwitchToVirtual && (
            <button
              type="button"
              onClick={onSwitchToVirtual}
              className={cn(
                "px-2 py-1 font-mono text-[10px] uppercase tracking-wider",
                "bg-primary/10 border border-primary/30 rounded",
                "text-primary/80 hover:text-primary hover:bg-primary/20",
                "transition-colors"
              )}
            >
              Virtual Shell
            </button>
          )}

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-primary transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex-shrink-0 px-3 py-2 bg-destructive/10 border-b border-destructive/30 text-destructive text-xs font-mono">
          {error}
        </div>
      )}

      {/* Terminal container */}
      <div
        ref={terminalContainerRef}
        className="flex-1 min-h-0 p-2 bg-[hsl(224_71.4%_4.1%)]"
      />

      {/* Footer hints */}
      <div className="flex-shrink-0 px-3 py-1.5 border-t border-border/30 bg-[hsl(var(--terminal-code-bg))]">
        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground/60">
          <span>Ctrl+C: interrupt | Ctrl+D: exit | Ctrl+L: clear</span>
          <span>Docker sandbox environment</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
