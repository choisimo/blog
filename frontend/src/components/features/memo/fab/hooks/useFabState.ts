import { useCallback, useEffect, useRef, useState } from "react";

// Feature flag: build-time + runtime override
export function isFabEnabled(): boolean {
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

export function useAIMemoElement(): HTMLElement | null {
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

export function useMemoOpen(aiMemoEl: HTMLElement | null): boolean {
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
        } catch {
          void 0;
        }
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
        } catch {
          void 0;
        }
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

export function useHistoryOverlayOpen(aiMemoEl: HTMLElement | null): boolean {
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

export function useModalPresence(): boolean {
  const [present, setPresent] = useState(false);
  useEffect(() => {
    const sel =
      '[aria-modal="true"], [role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [data-radix-portal] [data-state="open"]';
    const check = () => setPresent(!!document.querySelector(sel));

    let rafId: number | null = null;
    const debouncedCheck = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        check();
      });
    };

    const mo = new MutationObserver(debouncedCheck);
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributeFilter: ["aria-modal", "role", "data-state"],
    });
    check();
    return () => {
      mo.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);
  return present;
}

export function useHistoryBadge(): [boolean, () => void] {
  const [hasNew, setHasNew] = useState(false);
  const recompute = useCallback(() => {
    let count = 0;
    try {
      const arr = JSON.parse(localStorage.getItem("aiMemo.events") || "[]");
      count = Array.isArray(arr) ? arr.length : 0;
    } catch {
      count = 0;
    }
    let last = 0;
    try {
      last =
        parseInt(localStorage.getItem("aiMemo.history.lastCount") || "0", 10) ||
        0;
    } catch {
      void 0;
    }
    setHasNew(count > last);
  }, []);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === "aiMemo.events") recompute();
    };
    const onMemoEvent = () => recompute();
    const onVisibility = () => {
      if (document.visibilityState === "visible") recompute();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("aiMemo:eventsChanged", onMemoEvent);
    document.addEventListener("visibilitychange", onVisibility);

    recompute();
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("aiMemo:eventsChanged", onMemoEvent);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [recompute]);
  const clear = useCallback(() => {
    try {
      const arr = JSON.parse(localStorage.getItem("aiMemo.events") || "[]");
      const len = Array.isArray(arr) ? arr.length : 0;
      localStorage.setItem("aiMemo.history.lastCount", String(len));
    } catch {
      void 0;
    }
    setHasNew(false);
  }, []);
  return [hasNew, clear];
}

export function useScrollHide(): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let lastY = window.scrollY || 0;
    let accumulatedDelta = 0;
    const THRESHOLD = 30; // px to accumulate before toggling (reduced for snappier response)
    let rafId: number | null = null;
    let lastTime = 0;
    const THROTTLE_MS = 40; // Throttle to 40ms for smoother detection

    const isNearBottom = () => {
      const scrollY = window.scrollY || 0;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      // Consider "near bottom" if within 100px of the end
      return scrollY + windowHeight >= documentHeight - 100;
    };

    const updateHideState = () => {
      const y = window.scrollY || 0;
      const delta = y - lastY;
      lastY = y;

      // Near bottom: always show (footer role)
      if (isNearBottom()) {
        setHidden(false);
        accumulatedDelta = 0;
        return;
      }

      // Near top: always show
      if (y < 80) {
        setHidden(false);
        accumulatedDelta = 0;
        return;
      }

      // Ignore tiny movements (prevents jitter)
      if (Math.abs(delta) < 3) return;

      // Accumulate delta in the same direction
      if ((delta > 0 && accumulatedDelta >= 0) || (delta < 0 && accumulatedDelta <= 0)) {
        accumulatedDelta += delta;
      } else {
        // Direction changed, reset
        accumulatedDelta = delta;
      }

      // Trigger hide/show when threshold is reached
      if (accumulatedDelta > THRESHOLD) {
        setHidden(true);
        accumulatedDelta = 0;
      } else if (accumulatedDelta < -THRESHOLD) {
        setHidden(false);
        accumulatedDelta = 0;
      }
    };

    const handleScroll = () => {
      const now = Date.now();
      if (now - lastTime < THROTTLE_MS) return;
      lastTime = now;
      
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateHideState);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);
  return hidden;
}

// FAB pinned/auto-hide setting hook
export function useFabPinned(): [boolean, () => void] {
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("fab.pinned");
      if (saved != null) setPinned(JSON.parse(saved));
    } catch {
      void 0;
    }
  }, []);

  const togglePinned = useCallback(() => {
    setPinned((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("fab.pinned", JSON.stringify(next));
      } catch {
        void 0;
      }
      return next;
    });
  }, []);

  return [pinned, togglePinned];
}

export function hideLegacyLaunchers(aiMemoEl: HTMLElement | null) {
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
  } catch {
    void 0;
  }
}

export function useFabAnalytics() {
  const impressionSent = useRef(false);
  const prevMemoOpen = useRef<boolean | null>(null);

  const send = useCallback((type: string, detail?: Record<string, any>) => {
    try {
      const evt = new CustomEvent("fab:event", {
        detail: { type, ts: Date.now(), ...(detail || {}) },
      });
      window.dispatchEvent(evt);
      if (
        (import.meta as any).env?.DEV ||
        (typeof localStorage !== "undefined" &&
          localStorage.getItem("aiMemo.fab.debug") === "true")
      ) {
        console.log("[FAB]", type, detail || "");
      }
    } catch {
      void 0;
    }
  }, []);

  const sendImpression = useCallback(
    (enabled: boolean, modalOpen: boolean) => {
      if (!enabled || impressionSent.current || modalOpen) return;
      impressionSent.current = true;
      send("fab_impression");
    },
    [send],
  );

  const sendMemoContextChange = useCallback(
    (memoOpen: boolean) => {
      if (prevMemoOpen.current === null) {
        prevMemoOpen.current = memoOpen;
        return;
      }
      if (prevMemoOpen.current !== memoOpen) {
        send(memoOpen ? "fab_context_show" : "fab_context_hide");
        prevMemoOpen.current = memoOpen;
      }
    },
    [send],
  );

  return { send, sendImpression, sendMemoContextChange };
}

export type FabPosition = 'bottom' | 'left';

export function useFabPosition(): [FabPosition, (v: FabPosition) => void] {
  const normalize = (raw: unknown): FabPosition | null => {
    if (raw === 'bottom' || raw === 'left') return raw;
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (parsed === 'bottom' || parsed === 'left') return parsed;
      } catch {
        void 0;
      }
    }
    return null;
  };

  const [position, setPositionState] = useState<FabPosition>(() => {
    try {
      const saved = localStorage.getItem('fab.position');
      const normalized = normalize(saved);
      if (normalized) return normalized;
    } catch { void 0; }
    return 'bottom';
  });

  useEffect(() => {
    const apply = (raw: unknown) => {
      const normalized = normalize(raw);
      if (normalized) {
        setPositionState(normalized);
      }
    };

    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === 'fab.position') {
        apply(e.newValue);
      }
    };

    const onPositionChanged = (e: Event) => {
      const custom = e as CustomEvent<{ position?: FabPosition }>;
      if (custom.detail?.position) {
        apply(custom.detail.position);
        return;
      }
      try {
        apply(localStorage.getItem('fab.position'));
      } catch {
        void 0;
      }
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('fab:position-changed', onPositionChanged as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('fab:position-changed', onPositionChanged as EventListener);
    };
  }, []);

  const setPosition = useCallback((v: FabPosition) => {
    setPositionState(v);
    try { localStorage.setItem('fab.position', v); } catch { void 0; }
    try {
      window.dispatchEvent(new CustomEvent('fab:position-changed', { detail: { position: v } }));
    } catch {
      void 0;
    }
  }, []);
  return [position, setPosition];
}
