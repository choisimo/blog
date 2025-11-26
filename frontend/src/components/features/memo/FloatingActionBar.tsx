import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { NotebookPen, Sparkles, Layers, Map, Terminal, X, ChevronRight } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import VisitedPostsMinimap, {
  useVisitedPostsState,
} from "@/components/features/navigation/VisitedPostsMinimap";
import ChatWidget from "@/components/features/chat/ChatWidget";
import { useToast } from "@/components/ui/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

// Shell command definitions
type ShellCommand = {
  name: string;
  aliases: string[];
  description: string;
  action: (args?: string) => void;
};

// Virtual filesystem types for blog navigation
type BlogPost = {
  slug: string;
  title: string;
  category: string;
  date: string;
  tags: string[];
  url: string;
};

type VirtualFS = {
  currentPath: string;
  posts: BlogPost[];
};

// Hook to load posts manifest
function usePostsManifest(): BlogPost[] {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  
  useEffect(() => {
    fetch('/posts-manifest.json')
      .then(res => res.json())
      .then(data => {
        if (data.items) {
          setPosts(data.items.filter((p: any) => p.published !== false));
        }
      })
      .catch(() => setPosts([]));
  }, []);
  
  return posts;
}

// Virtual filesystem hook
function useVirtualFS(posts: BlogPost[]) {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Derive current path from URL
  const currentPath = useMemo(() => {
    const path = location.pathname;
    if (path === '/' || path === '') return '/';
    if (path.startsWith('/blog/')) {
      // /blog/2025/post-slug -> /blog/2025
      const parts = path.split('/').filter(Boolean);
      if (parts.length >= 2) {
        return '/' + parts.slice(0, 2).join('/');
      }
    }
    return path;
  }, [location.pathname]);

  // Get available years
  const years = useMemo(() => {
    const yearSet = new Set(posts.map(p => p.url.split('/')[2]));
    return Array.from(yearSet).sort().reverse();
  }, [posts]);

  // Get categories
  const categories = useMemo(() => {
    const catSet = new Set(posts.map(p => p.category));
    return Array.from(catSet).sort();
  }, [posts]);

  // Get posts for current directory
  const getPostsInPath = useCallback((path: string): BlogPost[] => {
    if (path === '/' || path === '/blog') {
      return [];
    }
    const parts = path.split('/').filter(Boolean);
    if (parts[0] === 'blog' && parts.length >= 2) {
      const year = parts[1];
      return posts.filter(p => p.url.includes(`/blog/${year}/`));
    }
    return [];
  }, [posts]);

  // List directory contents
  const ls = useCallback((path?: string): string => {
    const targetPath = path || currentPath;
    
    if (targetPath === '/' || targetPath === '') {
      return 'blog/\n';
    }
    
    if (targetPath === '/blog') {
      return years.map(y => `${y}/`).join('\n') + '\n';
    }
    
    const parts = targetPath.split('/').filter(Boolean);
    if (parts[0] === 'blog' && parts.length >= 2) {
      const year = parts[1];
      const yearPosts = posts.filter(p => p.url.includes(`/blog/${year}/`));
      if (yearPosts.length === 0) {
        return `ls: ${targetPath}: No such directory`;
      }
      return yearPosts.map(p => {
        const slug = p.url.split('/').pop();
        return `${slug}.md`;
      }).join('\n');
    }
    
    return `ls: ${targetPath}: No such directory`;
  }, [currentPath, years, posts]);

  // Change directory
  const cd = useCallback((path: string): string => {
    if (!path || path === '~' || path === '/') {
      navigate('/');
      return '';
    }
    
    if (path === '..') {
      const parts = currentPath.split('/').filter(Boolean);
      if (parts.length <= 1) {
        navigate('/');
        return '';
      }
      const newPath = '/' + parts.slice(0, -1).join('/');
      if (newPath === '/blog') {
        navigate('/');
        return '';
      }
      navigate(newPath);
      return '';
    }
    
    // Handle absolute paths
    let targetPath = path;
    if (!path.startsWith('/')) {
      // Relative path
      if (currentPath === '/') {
        targetPath = '/' + path;
      } else {
        targetPath = currentPath + '/' + path;
      }
    }
    
    // Clean up path
    targetPath = targetPath.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
    
    // Validate path
    if (targetPath === '/blog') {
      navigate('/');
      return '';
    }
    
    const parts = targetPath.split('/').filter(Boolean);
    if (parts[0] === 'blog' && parts.length >= 2) {
      const year = parts[1];
      if (years.includes(year)) {
        // Navigate to year page (which shows filtered posts)
        navigate(`/blog?year=${year}`);
        return '';
      }
      return `cd: ${targetPath}: No such directory`;
    }
    
    if (targetPath === '/') {
      navigate('/');
      return '';
    }
    
    return `cd: ${targetPath}: No such directory`;
  }, [currentPath, years, navigate]);

  // Print working directory
  const pwd = useCallback((): string => {
    return currentPath || '/';
  }, [currentPath]);

  // Cat file (navigate to post)
  const cat = useCallback((filename: string): string => {
    if (!filename) {
      return 'cat: missing file operand';
    }
    
    // Remove .md extension if present
    const slug = filename.replace(/\.md$/, '');
    
    // Find matching post
    const post = posts.find(p => {
      const postSlug = p.url.split('/').pop();
      return postSlug === slug || postSlug?.toLowerCase() === slug.toLowerCase();
    });
    
    if (post) {
      navigate(post.url);
      return `Opening: ${post.title}`;
    }
    
    return `cat: ${filename}: No such file`;
  }, [posts, navigate]);

  // Find posts by keyword
  const find = useCallback((keyword: string): string => {
    if (!keyword) {
      return 'find: missing search term';
    }
    
    const kw = keyword.toLowerCase();
    const matches = posts.filter(p => 
      p.title.toLowerCase().includes(kw) ||
      p.slug?.toLowerCase().includes(kw) ||
      p.tags?.some(t => t.toLowerCase().includes(kw)) ||
      p.category?.toLowerCase().includes(kw)
    );
    
    if (matches.length === 0) {
      return `No posts found matching: ${keyword}`;
    }
    
    return matches.slice(0, 10).map(p => {
      const path = p.url;
      return `${path}  ${p.title.slice(0, 30)}${p.title.length > 30 ? '...' : ''}`;
    }).join('\n') + (matches.length > 10 ? `\n... and ${matches.length - 10} more` : '');
  }, [posts]);

  // Tree view of blog structure
  const tree = useCallback((): string => {
    let output = '/\n└── blog/\n';
    
    years.forEach((year, yi) => {
      const isLast = yi === years.length - 1;
      const prefix = isLast ? '    └── ' : '    ├── ';
      const yearPosts = posts.filter(p => p.url.includes(`/blog/${year}/`));
      output += `${prefix}${year}/ (${yearPosts.length} posts)\n`;
    });
    
    return output;
  }, [years, posts]);

  return {
    currentPath,
    years,
    categories,
    ls,
    cd,
    pwd,
    cat,
    find,
    tree,
    navigate,
  };
}


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
  
  // Shell Commander state (for terminal theme mobile)
  const [shellOpen, setShellOpen] = useState(false);

  // Add viewport height management for mobile keyboard
  const [viewportHeight, setViewportHeight] = useState('100dvh');
  useEffect(() => {
    if (!isMobile || !shellOpen) {
      document.body.style.overflow = '';
      return;
    };

    const handleResize = () => {
      const vh = window.visualViewport?.height || window.innerHeight;
      setViewportHeight(`${vh}px`);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
    };
  }, [isMobile, shellOpen]);
  const [shellInput, setShellInput] = useState("");
  const [shellOutput, setShellOutput] = useState<string | null>(null);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const shellInputRef = useRef<HTMLInputElement>(null);
  
  // Virtual filesystem for Linux-like navigation
  const posts = usePostsManifest();
  const vfs = useVirtualFS(posts);

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

  useEffect(() => {
    if (aiMemoEl) {
      const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary');
      aiMemoEl.style.setProperty('--primary-color', primaryColor);
    }
  }, [aiMemoEl, isTerminal]);

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

  // Shell Commands for terminal theme mobile
  const shellCommands: ShellCommand[] = useMemo(() => [
    // Feature commands
    {
      name: "chat",
      aliases: ["c", "ai"],
      description: "AI 채팅 열기",
      action: () => {
        setChatOpen(true);
        send("fab_ai_chat_open");
        setShellOpen(false);
        setShellOutput(null);
      },
    },
    {
      name: "memo",
      aliases: ["m", "note"],
      description: "메모장 열기/닫기",
      action: () => {
        send("fab_memo_toggle");
        toggleMemo();
        setShellOpen(false);
        setShellOutput(null);
      },
    },
    {
      name: "stack",
      aliases: ["s", "history"],
      description: "방문 기록 스택 보기",
      action: () => {
        handleStackClick();
        setShellOpen(false);
        setShellOutput(null);
      },
    },
    {
      name: "insight",
      aliases: ["i", "map"],
      description: "인사이트 맵 열기",
      action: () => {
        openHistory();
        setShellOpen(false);
        setShellOutput(null);
      },
    },
    // Linux-like filesystem commands
    {
      name: "ls",
      aliases: ["dir", "ll"],
      description: "현재 디렉토리 목록",
      action: (args?: string) => {
        const result = vfs.ls(args);
        setShellOutput(result);
      },
    },
    {
      name: "cd",
      aliases: [],
      description: "디렉토리 이동 (예: cd /blog/2025)",
      action: (args?: string) => {
        const result = vfs.cd(args || '/');
        if (result) {
          setShellOutput(result);
        } else {
          setShellOpen(false);
          setShellOutput(null);
        }
      },
    },
    {
      name: "pwd",
      aliases: [],
      description: "현재 경로 표시",
      action: () => {
        setShellOutput(vfs.pwd());
      },
    },
    {
      name: "cat",
      aliases: ["open", "view"],
      description: "게시글 열기 (예: cat post-slug.md)",
      action: (args?: string) => {
        if (!args) {
          setShellOutput('cat: missing file operand');
          return;
        }
        const result = vfs.cat(args);
        if (result.startsWith('Opening:')) {
          setShellOpen(false);
          setShellOutput(null);
        } else {
          setShellOutput(result);
        }
      },
    },
    {
      name: "find",
      aliases: ["search", "grep"],
      description: "게시글 검색 (예: find kafka)",
      action: (args?: string) => {
        if (!args) {
          setShellOutput('find: missing search term');
          return;
        }
        setShellOutput(vfs.find(args));
      },
    },
    {
      name: "tree",
      aliases: [],
      description: "블로그 디렉토리 구조 표시",
      action: () => {
        setShellOutput(vfs.tree());
      },
    },
    {
      name: "home",
      aliases: ["~"],
      description: "홈으로 이동",
      action: () => {
        vfs.navigate('/');
        setShellOpen(false);
        setShellOutput(null);
      },
    },
    {
      name: "clear",
      aliases: ["cls"],
      description: "출력 지우기",
      action: () => {
        setShellOutput(null);
        setShellInput("");
      },
    },
  ], [send, toggleMemo, handleStackClick, openHistory, vfs]);

  const executeShellCommand = useCallback((input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return;

    // Add to command history
    setCommandHistory(prev => [...prev.slice(-20), trimmed]);
    setHistoryIndex(-1);

    // Parse command and arguments
    const parts = trimmed.split(/\s+/);
    const cmdName = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    if (cmdName === "help" || cmdName === "?") {
      const featureCmds = shellCommands.filter(c => ['chat', 'memo', 'stack', 'insight', 'clear'].includes(c.name));
      const fsCmds = shellCommands.filter(c => ['ls', 'cd', 'pwd', 'cat', 'find', 'tree', 'home'].includes(c.name));
      
      let helpText = "=== Feature Commands ===\n";
      helpText += featureCmds.map(cmd => `  ${cmd.name.padEnd(8)} ${cmd.description}`).join("\n");
      helpText += "\n\n=== Filesystem Commands ===\n";
      helpText += fsCmds.map(cmd => `  ${cmd.name.padEnd(8)} ${cmd.description}`).join("\n");
      helpText += "\n\n예시:\n  ls              현재 위치 파일 목록\n  cd /blog/2025   2025년 글로 이동\n  find kafka      'kafka' 포함 글 검색\n  cat post.md     게시글 열기";
      
      setShellOutput(helpText);
      setShellInput("");
      return;
    }

    const cmd = shellCommands.find(
      c => c.name === cmdName || c.aliases.includes(cmdName)
    );

    if (cmd) {
      cmd.action(args || undefined);
      setShellInput("");
    } else {
      setShellOutput(`bash: ${cmdName}: command not found\nType 'help' for available commands.`);
      setShellInput("");
    }
  }, [shellCommands]);

  const handleShellKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      executeShellCommand(shellInput);
    } else if (e.key === "Escape") {
      setShellOpen(false);
      setShellOutput(null);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setShellInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setShellInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setShellInput('');
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      // Simple tab completion for commands
      const trimmed = shellInput.trim().toLowerCase();
      if (trimmed) {
        const matches = shellCommands.filter(c => 
          c.name.startsWith(trimmed) || c.aliases.some(a => a.startsWith(trimmed))
        );
        if (matches.length === 1) {
          setShellInput(matches[0].name + ' ');
        } else if (matches.length > 1) {
          setShellOutput(matches.map(m => m.name).join('  '));
        }
      }
    }
  }, [shellInput, executeShellCommand, commandHistory, historyIndex, shellCommands]);

  // Auto-focus shell input when opened
  useEffect(() => {
    if (shellOpen && shellInputRef.current) {
      shellInputRef.current.focus();
    }
  }, [shellOpen]);

  if (!enabled) return null;

  const stackSheet = <VisitedPostsMinimap mode="fab" />;

  if (modalOpen || overlayOpen) return <>{stackSheet}</>;

  const containerClasses = cn(
    "fixed inset-x-0 z-[var(--z-fab-bar)] px-3 sm:px-4 print:hidden",
    isMobile
      ? "bottom-0 pb-[calc(env(safe-area-inset-bottom,0px))]"
      : "bottom-[calc(16px+env(safe-area-inset-bottom,0px))]",
    "transition-transform transition-opacity duration-200 ease-out",
    scrollHidden
      ? "translate-y-6 opacity-0 pointer-events-none"
      : "translate-y-0 opacity-100",
  );

  type DockAction = {
    key: "chat" | "memo" | "stack" | "insight";
    label: string;
    icon: typeof Sparkles;
    onClick: () => void;
    disabled?: boolean;
    title?: string;
    badge?: boolean;
    primary?: boolean;
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
      onClick: openHistory,
      badge: hasNew,
    },
  ];

  return (
    <>
      {stackSheet}
      
      {/* Shell output overlay for terminal mobile */}
      {isTerminal && isMobile && shellOutput && (
        <div className="fixed inset-x-0 bottom-14 z-[var(--z-fab-bar)] px-3 pb-2 animate-in slide-in-from-bottom-2 duration-150">
          <div className="bg-[hsl(var(--terminal-code-bg))] border border-primary/30 rounded-lg shadow-lg shadow-primary/5 overflow-hidden">
            {/* Terminal header */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-primary/10 border-b border-primary/20">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary/60 animate-pulse" />
                <span className="font-mono text-[10px] text-primary/80 uppercase tracking-wider">Output</span>
              </div>
              <button
                type="button"
                onClick={() => setShellOutput(null)}
                className="p-0.5 text-muted-foreground hover:text-primary transition-colors"
                aria-label="닫기"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {/* Terminal output */}
            <div className="p-3 max-h-48 overflow-auto">
              <pre className="font-mono text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">{shellOutput}</pre>
            </div>
          </div>
        </div>
      )}
      
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
              // Mobile TUI: Shell Bar and Fullscreen Modal
              <>
                {/* Collapsed Shell Bar */}
                {!shellOpen && (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setShellOpen(true)}
                    onKeyDown={(e) => e.key === 'Enter' && setShellOpen(true)}
                    className="flex w-full items-center gap-2 bg-[hsl(var(--terminal-code-bg))] border-t border-primary/20 px-3 py-2"
                  >
                    <button
                      type="button"
                      aria-label="Open command input"
                      className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/20 text-primary border border-primary/30 transition-all active:scale-95"
                    >
                      <Terminal className="h-5 w-5" />
                    </button>
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <span className="font-mono text-xs text-primary/60 truncate">
                        {vfs.currentPath === '/' ? '~' : vfs.currentPath.replace('/blog/', '~/')}
                      </span>
                      <span className="text-muted-foreground/40 font-mono text-xs">
                        $ _
                      </span>
                    </div>
                    {hasNew && (
                      <span className="h-2 w-2 rounded-full bg-primary animate-pulse shrink-0" />
                    )}
                  </div>
                )}

                {/* Fullscreen Focus Mode Modal */}
                {shellOpen && (
                  <div
                    className="fixed inset-0 z-[var(--z-modal-overlay)] bg-background/80 backdrop-blur-sm animate-in fade-in-0 duration-200"
                    style={{ height: '100dvh' }}
                  >
                    <div
                      className="absolute inset-0"
                      onClick={() => setShellOpen(false)}
                      aria-hidden="true"
                    />
                    <div
                      className="relative flex flex-col bg-[hsl(var(--terminal-code-bg))] border-t border-primary/20"
                      style={{ height: viewportHeight }}
                    >
                      {/* Input field at the top */}
                      <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 border-b border-border/50">
                        <span className="text-primary/70 font-mono text-xs shrink-0">
                          {vfs.currentPath === '/' ? '~' : vfs.currentPath.replace('/blog/', '~/')}
                        </span>
                        <span className="text-primary font-mono text-sm font-bold shrink-0">$</span>
                        <input
                          ref={shellInputRef}
                          type="text"
                          value={shellInput}
                          onChange={(e) => setShellInput(e.target.value)}
                          onKeyDown={handleShellKeyDown}
                          placeholder="Type a command or 'help'"
                          className="flex-1 bg-transparent border-none outline-none font-mono text-sm text-foreground placeholder:text-muted-foreground/40"
                          autoComplete="off"
                          autoCapitalize="off"
                          spellCheck={false}
                        />
                        <button
                          type="button"
                          onClick={() => setShellOpen(false)}
                          className="p-1.5 text-muted-foreground hover:text-primary transition-colors"
                          aria-label="Close"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Command history and suggestions */}
                      <div className="flex-1 overflow-y-auto p-3 space-y-3">
                        <div className="text-xs font-mono text-primary/70 uppercase tracking-wider">
                          Recommended
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-center">
                          {['ls', 'find', 'stack', 'help'].map((cmd) => (
                            <button
                              key={cmd}
                              type="button"
                              onClick={() => executeShellCommand(cmd)}
                              className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 font-mono text-sm text-primary hover:bg-primary/20 transition-colors"
                            >
                              {cmd}
                            </button>
                          ))}
                        </div>
                        {commandHistory.length > 0 && (
                           <>
                             <div className="pt-2 text-xs font-mono text-primary/70 uppercase tracking-wider">
                               History
                             </div>
                             <div className="flex flex-col-reverse items-start text-left gap-1">
                               {commandHistory.slice().reverse().map((cmd, idx) => (
                                 <button
                                   key={`${cmd}-${idx}`}
                                   type="button"
                                   onClick={() => executeShellCommand(cmd)}
                                   className="p-2 rounded-lg font-mono text-sm text-muted-foreground hover:bg-muted/10 hover:text-foreground w-full text-left"
                                 >
                                   {cmd}
                                 </button>
                               ))}
                             </div>
                           </>
                         )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              // PC 터미널: 기존 디자인 유지
              <div className="flex w-full items-center justify-between gap-0.5 border border-border bg-[hsl(var(--terminal-code-bg))] backdrop-blur-sm">
                {/* Terminal window controls */}
                <div className="flex items-center gap-1.5 px-3 py-2.5 border-r border-border/50">
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
                          "group relative flex items-center gap-1.5 px-4 py-2.5 font-mono text-xs transition-all disabled:cursor-not-allowed disabled:opacity-50",
                          action.primary
                            ? "bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30"
                            : "text-muted-foreground hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/30",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4",
                            action.primary && "terminal-glow",
                          )}
                        />
                        <span className="text-[10px] uppercase tracking-wider">
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
            )
          ) : (
            /* Default style dock - Compact 4-button design */
            <div
              className={cn(
                "flex w-full items-center backdrop-blur-xl",
                isMobile
                  ? "rounded-none border-t border-border/30 bg-background/95 px-2 py-1.5 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] dark:bg-background/90 dark:border-white/10"
                  : "rounded-[28px] border border-white/20 bg-background/70 px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.08),_0_2px_8px_rgba(0,0,0,0.04)] dark:border-white/10 dark:bg-background/60 dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]",
              )}
            >
              {isMobile ? (
                // 모바일: 4개 버튼 간결하게 표시
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
                          "group relative flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 transition-all active:scale-95",
                          action.disabled && "opacity-40",
                        )}
                      >
                        <span
                          className={cn(
                            "flex items-center justify-center rounded-xl transition-all duration-150",
                            "h-9 w-9",
                            action.primary
                              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                              : "bg-muted/60 text-foreground/70 dark:bg-white/10 dark:text-white/70",
                          )}
                        >
                          <Icon className="h-4 w-4" />
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
                // PC: 프리미엄 호버 효과와 레이블
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
                        <Icon className={cn(
                          "h-[18px] w-[18px]",
                          action.primary && "text-primary-foreground",
                        )} />
                        <span className={cn(
                          "text-sm font-medium tracking-wide",
                          action.primary ? "text-primary-foreground" : "text-foreground/80 dark:text-white/80",
                        )}>
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
