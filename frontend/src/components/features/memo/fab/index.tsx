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

import type { DockAction } from "./types";
import {
  usePostsManifest,
  useVirtualFS,
  isFabEnabled,
  useAIMemoElement,
  useMemoOpen,
  useHistoryOverlayOpen,
  useModalPresence,
  useHistoryBadge,
  useScrollHide,
  useFabPinned,
  hideLegacyLaunchers,
  useFabAnalytics,
} from "./hooks";
import { useShellCommander } from "./hooks/useShellCommander";
import {
  ShellModal,
  ShellOutputOverlay,
  MobileShellBar,
  TerminalDock,
  DefaultDock,
} from "./components";

export default function FloatingActionBar() {
  const enabled = isFabEnabled();
  const aiMemoEl = useAIMemoElement();
  const memoOpen = useMemoOpen(aiMemoEl);
  const overlayOpen = useHistoryOverlayOpen(aiMemoEl);
  const modalOpen = useModalPresence();
  const [hasNew, clearBadge] = useHistoryBadge();
  const { items: visitedPosts, storageAvailable } = useVisitedPostsState();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInitialMessage, setChatInitialMessage] = useState<string | undefined>(undefined);
  const scrollHidden = useScrollHide();
  const [fabPinned] = useFabPinned();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { isTerminal } = useTheme();
  const { send, sendImpression, sendMemoContextChange } = useFabAnalytics();

  // Shell Commander state (for terminal theme mobile)
  const [shellOpen, setShellOpen] = useState(false);

  // Scroll to top button visibility (for mobile terminal shell bar)
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial check
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Add viewport height management for mobile keyboard
  const [viewportHeight, setViewportHeight] = useState("100dvh");

  useEffect(() => {
    // Only lock scroll when shell is open AND on mobile AND terminal theme
    if (!isMobile || !shellOpen || !isTerminal) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";

    const handleResize = () => {
      const vh = window.visualViewport?.height || window.innerHeight;
      setViewportHeight(`${vh}px`);
    };

    window.addEventListener("resize", handleResize);
    window.visualViewport?.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("resize", handleResize);
    };
  }, [isMobile, shellOpen, isTerminal]);

  // Virtual filesystem for Linux-like navigation
  const posts = usePostsManifest();
  const vfs = useVirtualFS(posts);

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
      if (typeof anyEl?.openHistory === "function") {
        anyEl.openHistory();
        opened = true;
      } else if (aiMemoEl) {
        const shadow = anyEl?.shadowRoot as ShadowRoot | undefined;
        const historyLauncher = shadow?.getElementById(
          "historyLauncher",
        ) as HTMLElement | null;
        if (historyLauncher) {
          const prevDisplay = historyLauncher.style.display;
          historyLauncher.style.display = "flex";
          historyLauncher.click();
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

  // Shell Commander hook
  const shell = useShellCommander({
    vfs,
    posts,
    onChatOpen: () => setChatOpen(true),
    onChatOpenWithMessage: (message: string) => {
      setChatInitialMessage(message);
      setChatOpen(true);
    },
    onMemoToggle: toggleMemo,
    onStackClick: handleStackClick,
    onShellClose: () => setShellOpen(false),
    send,
  });

  // Auto-focus shell input when opened
  useEffect(() => {
    if (shellOpen && shell.shellInputRef.current) {
      shell.shellInputRef.current.focus();
    }
  }, [shellOpen, shell.shellInputRef]);

  // prevent duplicates while flag is on + watch shadow subtree
  useEffect(() => {
    if (!enabled) return;
    let i = 0;
    const tick = () => {
      i += 1;
      hideLegacyLaunchers(aiMemoEl);
      if (i < 15) setTimeout(tick, 200);
    };
    tick();

    let mo: MutationObserver | null = null;
    const shadow = (aiMemoEl as any)?.shadowRoot as ShadowRoot | undefined;
    if (shadow) {
      mo = new MutationObserver(() => hideLegacyLaunchers(aiMemoEl));
      mo.observe(shadow, { childList: true, subtree: true });
    }
    return () => mo?.disconnect();
  }, [enabled, aiMemoEl]);

  useEffect(() => {
    if (aiMemoEl) {
      const primaryColor = getComputedStyle(
        document.documentElement,
      ).getPropertyValue("--primary");
      aiMemoEl.style.setProperty("--primary-color", primaryColor);
    }
  }, [aiMemoEl, isTerminal]);

  // impression once
  useEffect(() => {
    sendImpression(enabled, modalOpen);
  }, [enabled, modalOpen, sendImpression]);

  // memo contextual visibility change
  useEffect(() => {
    sendMemoContextChange(memoOpen);
  }, [memoOpen, sendMemoContextChange]);

  // Mobile terminal shell bar should always be visible
  const shouldAlwaysShow = isMobile && isTerminal;

  const containerClasses = cn(
    "fixed inset-x-0 z-[var(--z-fab-bar)] px-3 sm:px-4 print:hidden",
    isMobile
      ? "bottom-0 pb-[calc(env(safe-area-inset-bottom,0px))]"
      : "bottom-[calc(16px+env(safe-area-inset-bottom,0px))]",
    "transition-transform transition-opacity duration-200 ease-out",
    shouldAlwaysShow || fabPinned
      ? "translate-y-0 opacity-100"
      : scrollHidden
        ? "translate-y-6 opacity-0 pointer-events-none"
        : "translate-y-0 opacity-100",
  );

  const dockActions: DockAction[] = [
    {
      key: "chat",
      label: "Chat",
      icon: Sparkles,
      onClick: () => {
        setChatOpen(true);
        send("fab_ai_chat_open");
      },
      primary: true,
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
      onClick: () => {
        send("fab_insight_click");
        clearBadge();
        vfs.navigate("/insight");
      },
      badge: hasNew,
    },
  ];

  if (!enabled) {
    return null;
  }

  const stackSheet = <VisitedPostsMinimap mode="fab" />;
  const toolbarDisabled = modalOpen || overlayOpen;

  return (
    <>
      {stackSheet}

      {/* Mobile Shell Modal - Portal */}
      {isTerminal && isMobile && (
        <ShellModal
          isOpen={shellOpen}
          onClose={() => {
            setShellOpen(false);
            shell.setShellOutput(null);
          }}
          displayPath={vfs.displayPath}
          viewportHeight={viewportHeight}
          shellInput={shell.shellInput}
          setShellInput={shell.setShellInput}
          shellInputRef={shell.shellInputRef}
          onKeyDown={shell.handleShellKeyDownWithSuggestions}
          suggestions={shell.suggestions}
          selectedSuggestionIndex={shell.selectedSuggestionIndex}
          selectSuggestion={shell.selectSuggestion}
          shellLogs={shell.shellLogs}
          shellOutput={shell.shellOutput}
          consoleEndRef={shell.consoleEndRef}
          executeCommand={shell.executeShellCommandWithLog}
          commandHistory={shell.commandHistory}
        />
      )}

      {/* Shell output overlay for terminal mobile - Portal */}
      {isTerminal && isMobile && !shellOpen && (
        <ShellOutputOverlay
          output={shell.shellOutput}
          onExpand={() => setShellOpen(true)}
          onClose={() => shell.setShellOutput(null)}
        />
      )}

      {!toolbarDisabled && (
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
              isMobile ? (
                // Mobile TUI: Shell Bar
                !shellOpen && (
                  <MobileShellBar
                    displayPath={vfs.displayPath}
                    onShellOpen={() => setShellOpen(true)}
                    showScrollTop={showScrollTop}
                    hasNew={hasNew}
                  />
                )
              ) : (
                // PC Terminal Dock
                <TerminalDock dockActions={dockActions} isMobile={isMobile} />
              )
            ) : (
              // Default style dock
              <DefaultDock dockActions={dockActions} isMobile={isMobile} />
            )}
          </nav>
        </div>
      )}

      {chatOpen && (
        <ChatWidget
          initialMessage={chatInitialMessage}
          onClose={() => {
            setChatOpen(false);
            setChatInitialMessage(undefined);
            send("fab_ai_chat_close");
          }}
        />
      )}
    </>
  );
}
