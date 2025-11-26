import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { NotebookPen, Sparkles, Layers, Map } from "lucide-react";
import VisitedPostsMinimap, {
  useVisitedPostsState,
} from "@/components/features/navigation/VisitedPostsMinimap";
import ChatWidget from "@/components/features/chat/ChatWidget";
import { useToast } from "@/components/ui/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

// Feature flag: build-time + runtime override
function isFabEnabled(): boolean {
  let lsValue: boolean | null = null;
  try {
    const stored = localStorage.getItem("aiMemo.fab.enabled");
    if (stored != null) {
      lsValue = JSON.parse(stored);
    }
  } catch {
    lsValue = null;
  }

  if (typeof lsValue === "boolean") {
    return lsValue;
  }

  const envFlag = (import.meta as any).env?.VITE_FEATURE_FAB;
  if (envFlag != null) {
    return envFlag === true || envFlag === "true" || envFlag === "1";
  }

  return true;
}

function useAIMemoElement(): HTMLElement | null {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    let active = true;
    const find = () =>
      document.querySelector("ai-memo-pad") as HTMLElement | null;
    const loop = () => {
      if (!active) return;
      const e = find();
      if (e) setEl(e);
      else setTimeout(loop, 200);
    };
    loop();
    return () => {
      active = false;
    };
  }, []);
  return el;
}

function useMemoOpen(aiMemoEl: HTMLElement | null): boolean {
  const [open, setOpen] = useState<boolean>(() => {
    try {
      return !!JSON.parse(localStorage.getItem("aiMemo.isOpen") || "false");
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === "aiMemo.isOpen") {
        try {
          setOpen(
            !!JSON.parse(localStorage.getItem("aiMemo.isOpen") || "false"),
          );
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);

    let panelObserver: MutationObserver | null = null;
    let shadowObserver: MutationObserver | null = null;
    let pollId: number | null = null;

    const tryAttachPanelObserver = () => {
      const shadow = (aiMemoEl as any)?.shadowRoot as ShadowRoot | undefined;
      const panel = shadow?.getElementById("panel");
      if (!panel) return false;
      const check = () => setOpen(panel.classList.contains("open"));
      check();
      panelObserver?.disconnect();
      panelObserver = new MutationObserver(check);
      panelObserver.observe(panel, {
        attributes: true,
        attributeFilter: ["class"],
      });
      return true;
    };

    // Attempt now; if not present, observe shadowRoot subtree and poll LS briefly
    if (!tryAttachPanelObserver()) {
      const shadow = (aiMemoEl as any)?.shadowRoot as ShadowRoot | undefined;
      if (shadow) {
        shadowObserver = new MutationObserver(() => {
          if (tryAttachPanelObserver()) {
            shadowObserver?.disconnect();
            shadowObserver = null;
          }
        });
        shadowObserver.observe(shadow, { childList: true, subtree: true });
      }
      let tries = 0;
      pollId = window.setInterval(() => {
        tries += 1;
        try {
          setOpen(
            !!JSON.parse(localStorage.getItem("aiMemo.isOpen") || "false"),
          );
        } catch {}
        if (tries > 20) {
          if (pollId) {
            clearInterval(pollId);
            pollId = null;
          }
        }
      }, 250);
    }
    return () => {
      window.removeEventListener("storage", onStorage);
      panelObserver?.disconnect();
      shadowObserver?.disconnect();
      if (pollId) clearInterval(pollId);
    };
  }, [aiMemoEl]);
  return open;
}

function useHistoryOverlayOpen(aiMemoEl: HTMLElement | null): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const shadow = (aiMemoEl as any)?.shadowRoot as ShadowRoot | undefined;
    if (!shadow) {
      setOpen(false);
      return;
    }
    const overlay = shadow.getElementById(
      "historyOverlay",
    ) as HTMLElement | null;
    const compute = () => {
      try {
        if (!overlay) return setOpen(false);
        // visible when style.display !== 'none'
        const visible = overlay.style.display !== "none";
        setOpen(!!visible);
      } catch {
        setOpen(false);
      }
    };
    compute();
    const mo = overlay ? new MutationObserver(compute) : null;
    if (overlay && mo)
      mo.observe(overlay, {
        attributes: true,
        attributeFilter: ["style", "class"],
      });
    return () => {
      if (mo) mo.disconnect();
    };
  }, [aiMemoEl]);
  return open;
}

function useModalPresence(): boolean {
  const [present, setPresent] = useState(false);
  useEffect(() => {
    const sel =
      '[aria-modal="true"], [role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [data-radix-portal] [data-state="open"]';
    const check = () => setPresent(!!document.querySelector(sel));
    const mo = new MutationObserver(check);
    mo.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
    });
    check();
    return () => mo.disconnect();
  }, []);
  return present;
}

function useHistoryBadge(): [boolean, () => void] {
  const [hasNew, setHasNew] = useState(false);
  const recompute = useCallback(() => {
    let count = 0;
    try {
      const arr = JSON.parse(localStorage.getItem("aiMemo.events") || "[]");
      count = Array.isArray(arr) ? arr.length : 0;
    } catch {}
    let last = 0;
    try {
      last =
        parseInt(localStorage.getItem("aiMemo.history.lastCount") || "0", 10) ||
        0;
    } catch {}
    setHasNew(count > last);
  }, []);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === "aiMemo.events") recompute();
    };
    window.addEventListener("storage", onStorage);
    const t = setInterval(recompute, 1500); // local updates within same tab
    recompute();
    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(t);
    };
  }, [recompute]);
  const clear = useCallback(() => {
    try {
      const arr = JSON.parse(localStorage.getItem("aiMemo.events") || "[]");
      const len = Array.isArray(arr) ? arr.length : 0;
      localStorage.setItem("aiMemo.history.lastCount", String(len));
    } catch {}
    setHasNew(false);
  }, []);
  return [hasNew, clear];
}

function useScrollHide(): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let lastY = window.scrollY || 0;
    const handleScroll = () => {
      const y = window.scrollY || 0;
      const delta = y - lastY;
      lastY = y;
      if (Math.abs(delta) < 8) return;
      if (y < 80) {
        setHidden(false);
        return;
      }
      setHidden(delta > 0);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  return hidden;
}

function hideLegacyLaunchers(aiMemoEl: HTMLElement | null) {
  try {
    if (!aiMemoEl) return;
    const shadow = (aiMemoEl as any).shadowRoot as ShadowRoot | undefined;
    // Hide only legacy floating launchers; keep memo UI intact
    const launcher = shadow?.getElementById("launcher") as HTMLElement | null;
    const historyLauncher = shadow?.getElementById(
      "historyLauncher",
    ) as HTMLElement | null;
    if (launcher) launcher.style.display = "none";
    if (historyLauncher) historyLauncher.style.display = "none";
  } catch {}
}

export default function FloatingActionBar() {
  const enabled = isFabEnabled();
  const aiMemoEl = useAIMemoElement();
  const memoOpen = useMemoOpen(aiMemoEl);
  const overlayOpen = useHistoryOverlayOpen(aiMemoEl);
  const modalOpen = useModalPresence();
  const [hasNew, clearBadge] = useHistoryBadge();
  const { items: visitedPosts, storageAvailable } = useVisitedPostsState();
  const impressionSent = useRef(false);
  const [chatOpen, setChatOpen] = useState(false);
  const scrollHidden = useScrollHide();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { isTerminal } = useTheme();

  const send = useCallback((type: string, detail?: Record<string, any>) => {
    try {
      const evt = new CustomEvent("fab:event", {
        detail: { type, ts: Date.now(), ...(detail || {}) },
      });
      window.dispatchEvent(evt);
      // Fallback console for environments without an analytics bridge
      if (
        (import.meta as any).env?.DEV ||
        (typeof localStorage !== "undefined" &&
          localStorage.getItem("aiMemo.fab.debug") === "true")
      ) {
        // eslint-disable-next-line no-console
        console.log("[FAB]", type, detail || "");
      }
    } catch {}
  }, []);

  // prevent duplicates while flag is on (re-apply briefly in case shadow re-renders) + watch shadow subtree
  useEffect(() => {
    if (!enabled) return;
    let i = 0;
    const tick = () => {
      i += 1;
      hideLegacyLaunchers(aiMemoEl);
      if (i < 15) setTimeout(tick, 200); // ~3s window
    };
    tick();

    // Observe shadow additions to hide newly added launchers
    let mo: MutationObserver | null = null;
    const shadow = (aiMemoEl as any)?.shadowRoot as ShadowRoot | undefined;
    if (shadow) {
      mo = new MutationObserver(() => hideLegacyLaunchers(aiMemoEl));
      mo.observe(shadow, { childList: true, subtree: true });
    }
    return () => mo?.disconnect();
  }, [enabled, aiMemoEl]);

  // Allow memo panel to function normally; do not force-close when FAB is enabled
  // We still hide only the legacy launchers via hideLegacyLaunchers()

  // impression once
  useEffect(() => {
    if (!enabled || impressionSent.current || modalOpen) return;
    impressionSent.current = true;
    send("fab_impression");
  }, [enabled, modalOpen, send]);

  // memo contextual visibility change
  const prevMemoOpen = useRef<boolean | null>(null);
  useEffect(() => {
    if (prevMemoOpen.current === null) {
      prevMemoOpen.current = memoOpen;
      return;
    }
    if (prevMemoOpen.current !== memoOpen) {
      send(memoOpen ? "fab_context_show" : "fab_context_hide");
      prevMemoOpen.current = memoOpen;
    }
  }, [memoOpen, send]);

  const clickShadowBtn = useCallback(
    (id: string) => {
      try {
        const shadow = (aiMemoEl as any)?.shadowRoot as ShadowRoot | undefined;
        const btn = shadow?.getElementById(id) as HTMLButtonElement | null;
        btn?.click();
      } catch {}
    },
    [aiMemoEl],
  );

  const toggleMemo = useCallback(
    () => clickShadowBtn("launcher"),
    [clickShadowBtn],
  );

  const openHistory = useCallback(() => {
    let opened = false;
    try {
      const anyEl = aiMemoEl as any;
      // Try calling openHistory method directly on the custom element instance
      if (typeof anyEl?.openHistory === "function") {
        anyEl.openHistory();
        opened = true;
      } else if (aiMemoEl) {
        // Fallback: temporarily show the hidden launcher, click it, then hide again
        const shadow = anyEl?.shadowRoot as ShadowRoot | undefined;
        const historyLauncher = shadow?.getElementById(
          "historyLauncher",
        ) as HTMLElement | null;
        if (historyLauncher) {
          const prevDisplay = historyLauncher.style.display;
          historyLauncher.style.display = "flex";
          historyLauncher.click();
          // Restore hidden state after a tick (the click event should have fired)
          setTimeout(() => {
            historyLauncher.style.display = prevDisplay || "none";
          }, 50);
          opened = true;
        }
      }
    } catch {}
    if (!opened) {
      try {
        window.dispatchEvent(new CustomEvent("visitedposts:open"));
      } catch {}
    }
    clearBadge();
    send("fab_history_click");
  }, [aiMemoEl, clearBadge, send]);

  const openStackView = useCallback(() => {
    try {
      window.dispatchEvent(new CustomEvent("visitedposts:open"));
      send("fab_stack_click");
    } catch {}
  }, [send]);

  const stackDisabledReason = useMemo(() => {
    if (!storageAvailable)
      return "이 브라우저에서는 Stack 기능을 사용할 수 없습니다.";
    if (!visitedPosts.length) return "최근 방문한 글이 없습니다.";
    return null;
  }, [storageAvailable, visitedPosts.length]);

  const handleStackClick = useCallback(() => {
    if (stackDisabledReason) {
      toast({ title: "Stack 사용 불가", description: stackDisabledReason });
      return;
    }
    openStackView();
  }, [openStackView, stackDisabledReason, toast]);

  if (!enabled) return null;

  const stackSheet = <VisitedPostsMinimap mode="fab" />;

  if (modalOpen || overlayOpen) return <>{stackSheet}</>;

  const containerClasses = [
    "fixed inset-x-0 z-[9999] px-3 sm:px-4 print:hidden",
    isMobile
      ? "bottom-0 pb-[calc(env(safe-area-inset-bottom,0px))]"
      : "bottom-[calc(10px+env(safe-area-inset-bottom,0px))]",
    "transition-transform transition-opacity duration-200 ease-out",
    scrollHidden
      ? "translate-y-6 opacity-0 pointer-events-none"
      : "translate-y-0 opacity-100",
  ].join(" ");

  type DockAction = {
    key: "chat" | "memo" | "stack" | "insight";
    label: string;
    icon: typeof Sparkles;
    onClick: () => void;
    disabled?: boolean;
    title?: string;
    badge?: boolean;
  };

  const dockActions: DockAction[] = [
    {
      key: "chat",
      label: "Chat",
      icon: Sparkles,
      onClick: () => {
        setChatOpen(true);
        send("fab_ai_chat_open");
      },
    },
    {
      key: "memo",
      label: "Memo",
      icon: NotebookPen,
      onClick: () => {
        send("fab_memo_toggle");
        toggleMemo();
      },
    },
    {
      key: "stack",
      label: "Stack",
      icon: Layers,
      onClick: handleStackClick,
      disabled: !!stackDisabledReason,
      title: stackDisabledReason || undefined,
    },
    {
      key: "insight",
      label: "Insight",
      icon: Map,
      onClick: openHistory,
      badge: hasNew,
    },
  ];

  return (
    <>
      {stackSheet}
      <div
        role="toolbar"
        aria-label="Floating actions"
        className={containerClasses}
      >
        <nav
          className={cn(
            "mx-auto flex w-full justify-center",
            isMobile ? "max-w-none" : "max-w-md sm:max-w-2xl",
          )}
        >
          {/* Terminal style dock */}
          {isTerminal ? (
            <div className="flex w-full items-center justify-between gap-0.5 border border-border bg-[hsl(var(--terminal-code-bg))] backdrop-blur-sm">
              {/* Terminal window controls */}
              <div className="flex items-center gap-1.5 px-3 py-2 border-r border-border/50">
                <span className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--terminal-window-btn-close))]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--terminal-window-btn-minimize))]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--terminal-window-btn-maximize))]" />
              </div>

              {/* Terminal path */}
              <div className="hidden sm:flex items-center gap-1 px-3 text-[11px] font-mono text-muted-foreground border-r border-border/50">
                <span className="text-primary/60">~/</span>
                <span>actions</span>
              </div>

              {/* Action buttons */}
              <div className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5">
                {dockActions.map((action) => {
                  const Icon = action.icon;
                  const primary = action.key === "chat";
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
                        "group relative flex items-center gap-1.5 px-3 py-2 font-mono text-xs transition-all disabled:cursor-not-allowed disabled:opacity-50",
                        primary
                          ? "bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30"
                          : "text-muted-foreground hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/30",
                        isMobile && "flex-1 flex-col gap-0.5 px-2",
                      )}
                    >
                      <Icon
                        className={cn(
                          isMobile ? "h-5 w-5" : "h-4 w-4",
                          primary && "terminal-glow",
                        )}
                      />
                      <span
                        className={cn(
                          "text-[10px] uppercase tracking-wider",
                          isMobile && "text-[9px]",
                        )}
                      >
                        {action.label}
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
              <div className="hidden sm:flex items-center gap-2 px-3 text-[10px] font-mono text-muted-foreground/60 border-l border-border/50">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse" />
                <span>READY</span>
              </div>
            </div>
          ) : (
            /* Default style dock */
            <div
              className={cn(
                "flex w-full items-center justify-between gap-1 backdrop-blur-md",
                isMobile
                  ? "rounded-none border-t border-border/40 bg-background/95 px-1.5 py-1.5 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]"
                  : "rounded-[22px] border border-border/40 bg-background/80 px-2 py-2 shadow-lg sm:px-4",
              )}
            >
              {dockActions.map((action) => {
                const Icon = action.icon;
                const primary = action.key === "chat";
                const iconSize = isMobile ? "h-6 w-6" : "h-4 w-4";
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
                      "group relative flex flex-1 items-center justify-center text-muted-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                      isMobile && "flex-col gap-0.5 text-[11px]",
                    )}
                  >
                    <span
                      className={cn(
                        "flex items-center justify-center rounded-[18px] transition-all duration-150 shadow-sm",
                        isMobile ? "h-10 w-10" : "h-11 w-11",
                        primary
                          ? "bg-primary text-primary-foreground shadow-primary/40"
                          : "bg-muted/50 text-foreground/80 group-hover:bg-muted/70",
                      )}
                    >
                      <Icon className={iconSize} />
                    </span>
                    {isMobile && <span>{action.label}</span>}
                    {action.badge && (
                      <span
                        className="absolute top-1 right-6 inline-flex h-2 w-2 rounded-full bg-primary"
                        aria-hidden
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </nav>
      </div>
      {chatOpen && (
        <ChatWidget
          onClose={() => {
            setChatOpen(false);
            send("fab_ai_chat_close");
          }}
        />
      )}
    </>
  );
}
