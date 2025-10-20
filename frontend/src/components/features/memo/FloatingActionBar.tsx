import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Map, NotebookPen, Sparkles, Download, Plus, Share2 } from 'lucide-react';

// Feature flag: build-time + runtime override
function isFabEnabled(): boolean {
  const envFlag = (import.meta as any).env?.VITE_FEATURE_FAB;
  const ls = (() => {
    try { const v = localStorage.getItem('aiMemo.fab.enabled'); return v == null ? null : JSON.parse(v); } catch { return null; }
  })();
  const envOn = envFlag === true || envFlag === 'true' || envFlag === '1';
  return typeof ls === 'boolean' ? ls : !!envOn;
}

function useAIMemoElement(): HTMLElement | null {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    let active = true;
    const find = () => document.querySelector('ai-memo-pad') as HTMLElement | null;
    const loop = () => {
      if (!active) return;
      const e = find();
      if (e) setEl(e);
      else setTimeout(loop, 200);
    };
    loop();
    return () => { active = false; };
  }, []);
  return el;
}

function useMemoOpen(aiMemoEl: HTMLElement | null): boolean {
  const [open, setOpen] = useState<boolean>(() => {
    try { return !!JSON.parse(localStorage.getItem('aiMemo.isOpen') || 'false'); } catch { return false; }
  });
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === 'aiMemo.isOpen') {
        try { setOpen(!!JSON.parse(localStorage.getItem('aiMemo.isOpen') || 'false')); } catch {}
      }
    };
    window.addEventListener('storage', onStorage);

    let panelObserver: MutationObserver | null = null;
    let shadowObserver: MutationObserver | null = null;
    let pollId: number | null = null;

    const tryAttachPanelObserver = () => {
      const shadow = (aiMemoEl as any)?.shadowRoot as ShadowRoot | undefined;
      const panel = shadow?.getElementById('panel');
      if (!panel) return false;
      const check = () => setOpen(panel.classList.contains('open'));
      check();
      panelObserver?.disconnect();
      panelObserver = new MutationObserver(check);
      panelObserver.observe(panel, { attributes: true, attributeFilter: ['class'] });
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
        try { setOpen(!!JSON.parse(localStorage.getItem('aiMemo.isOpen') || 'false')); } catch {}
        if (tries > 20) { if (pollId) { clearInterval(pollId); pollId = null; } }
      }, 250);
    }
    return () => {
      window.removeEventListener('storage', onStorage);
      panelObserver?.disconnect();
      shadowObserver?.disconnect();
      if (pollId) clearInterval(pollId);
    };
  }, [aiMemoEl]);
  return open;
}

function useModalPresence(): boolean {
  const [present, setPresent] = useState(false);
  useEffect(() => {
    const sel = '[aria-modal="true"], [role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [data-radix-portal] [data-state="open"]';
    const check = () => setPresent(!!document.querySelector(sel));
    const mo = new MutationObserver(check);
    mo.observe(document.body, { subtree: true, childList: true, attributes: true });
    check();
    return () => mo.disconnect();
  }, []);
  return present;
}

function useHistoryBadge(): [boolean, () => void] {
  const [hasNew, setHasNew] = useState(false);
  const recompute = useCallback(() => {
    let count = 0;
    try { const arr = JSON.parse(localStorage.getItem('aiMemo.events') || '[]'); count = Array.isArray(arr) ? arr.length : 0; } catch {}
    let last = 0;
    try { last = parseInt(localStorage.getItem('aiMemo.history.lastCount') || '0', 10) || 0; } catch {}
    setHasNew(count > last);
  }, []);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (!e.key || e.key === 'aiMemo.events') recompute(); };
    window.addEventListener('storage', onStorage);
    const t = setInterval(recompute, 1500); // local updates within same tab
    recompute();
    return () => { window.removeEventListener('storage', onStorage); clearInterval(t); };
  }, [recompute]);
  const clear = useCallback(() => {
    try {
      const arr = JSON.parse(localStorage.getItem('aiMemo.events') || '[]');
      const len = Array.isArray(arr) ? arr.length : 0;
      localStorage.setItem('aiMemo.history.lastCount', String(len));
    } catch {}
    setHasNew(false);
  }, []);
  return [hasNew, clear];
}

function hideLegacyLaunchers(aiMemoEl: HTMLElement | null) {
  try {
    if (!aiMemoEl) return;
    const shadow = (aiMemoEl as any).shadowRoot as ShadowRoot | undefined;
    // Hide legacy floating launchers
    const launcher = shadow?.getElementById('launcher') as HTMLElement | null;
    const historyLauncher = shadow?.getElementById('historyLauncher') as HTMLElement | null;
    if (launcher) launcher.style.display = 'none';
    if (historyLauncher) historyLauncher.style.display = 'none';

    // Hide legacy footer actions inside memo panel but keep status line
    const footer = shadow?.querySelector('.footer') as HTMLElement | null;
    const footerRow = footer?.querySelector('.row') as HTMLElement | null;
    if (footerRow) footerRow.style.display = 'none';

    // As extra safety, hide individual buttons if present
    const ids = ['addSelection', 'memoToGraph', 'aiSummary', 'catalyst', 'download'];
    ids.forEach((id) => {
      const el = shadow?.getElementById(id) as HTMLElement | null;
      if (el) el.style.display = 'none';
    });
  } catch {}
}

export default function FloatingActionBar() {
  const enabled = isFabEnabled();
  const aiMemoEl = useAIMemoElement();
  const memoOpen = useMemoOpen(aiMemoEl);
  const modalOpen = useModalPresence();
  const [hasNew, clearBadge] = useHistoryBadge();
  const impressionSent = useRef(false);

  const send = useCallback((type: string, detail?: Record<string, any>) => {
    try {
      const evt = new CustomEvent('fab:event', { detail: { type, ts: Date.now(), ...(detail || {}) } });
      window.dispatchEvent(evt);
      // Fallback console for environments without an analytics bridge
      if ((import.meta as any).env?.DEV || (typeof localStorage !== 'undefined' && localStorage.getItem('aiMemo.fab.debug') === 'true')) {
        // eslint-disable-next-line no-console
        console.log('[FAB]', type, detail || '');
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

  // impression once
  useEffect(() => {
    if (!enabled || impressionSent.current || modalOpen) return;
    impressionSent.current = true;
    send('fab_impression');
  }, [enabled, modalOpen, send]);

  // memo contextual visibility change
  const prevMemoOpen = useRef<boolean | null>(null);
  useEffect(() => {
    if (prevMemoOpen.current === null) { prevMemoOpen.current = memoOpen; return; }
    if (prevMemoOpen.current !== memoOpen) {
      send(memoOpen ? 'fab_context_show' : 'fab_context_hide');
      prevMemoOpen.current = memoOpen;
    }
  }, [memoOpen, send]);

  const clickShadowBtn = useCallback((id: string) => {
    try {
      const shadow = (aiMemoEl as any)?.shadowRoot as ShadowRoot | undefined;
      const btn = shadow?.getElementById(id) as HTMLButtonElement | null;
      btn?.click();
    } catch {}
  }, [aiMemoEl]);

  const toggleMemo = useCallback(() => clickShadowBtn('launcher'), [clickShadowBtn]);
  const addSelection = useCallback(() => clickShadowBtn('addSelection'), [clickShadowBtn]);
  const addToGraph = useCallback(() => clickShadowBtn('memoToGraph'), [clickShadowBtn]);
  const aiSummary = useCallback(() => clickShadowBtn('aiSummary'), [clickShadowBtn]);
  const catalyst = useCallback(() => clickShadowBtn('catalyst'), [clickShadowBtn]);
  const download = useCallback(() => clickShadowBtn('download'), [clickShadowBtn]);

  const openHistory = useCallback(() => {
    try {
      const anyEl = aiMemoEl as any;
      if (anyEl?.openHistory) anyEl.openHistory();
      else clickShadowBtn('historyLauncher');
      clearBadge();
      send('fab_history_click');
    } catch {}
  }, [aiMemoEl, clickShadowBtn, clearBadge, send]);

  if (!enabled) return null;
  if (modalOpen) return null; // hide during modal per PRD

  const containerClasses = [
    'fixed left-1/2 -translate-x-1/2 bottom-[max(16px,env(safe-area-inset-bottom))] z-50 inline-block',
    memoOpen ? 'w-fit max-w-[calc(100%-24px)] md:max-w-3xl' : 'w-fit max-w-[min(100%-24px,32rem)]',
    'border border-border/60 rounded-xl shadow-lg px-2 py-2 md:px-3 md:py-3 bg-background/70 backdrop-blur-md backdrop-saturate-150 motion-reduce:transition-none print:hidden',
  ].join(' ');

  return (
    <div
      role="toolbar"
      aria-label="Floating actions"
      className={containerClasses}
    >
      <div className={[
        'flex items-center justify-between gap-2',
        memoOpen ? 'w-full' : 'w-auto',
      ].join(' ')}>
        {/* Contextual (memo) actions */}
        <div
          className={[
            'flex items-center gap-1 md:gap-2 transition-all duration-200 motion-reduce:transition-none overflow-x-auto whitespace-nowrap pr-1',
            memoOpen ? 'flex-1 opacity-100 translate-y-0' : 'hidden',
          ].join(' ')}
          role="group"
          aria-label="Memo actions"
        >
          <Button variant="secondary" size="sm" onClick={() => { send('fab_memo_add_selection'); addSelection(); }} aria-label="선택 추가">
            <Plus className="h-4 w-4" />
            <span className="hidden lg:inline ml-1">선택 추가</span>
          </Button>
          <Button variant="secondary" size="sm" onClick={() => { send('fab_memo_add_graph'); addToGraph(); }} aria-label="그래프에 추가">
            <Share2 className="h-4 w-4" />
            <span className="hidden lg:inline ml-1">그래프에 추가</span>
          </Button>
          <Button variant="default" size="sm" onClick={() => { send('fab_memo_ai_summary'); aiSummary(); }} aria-label="AI 요약">
            <Sparkles className="h-4 w-4" />
            <span className="hidden lg:inline ml-1">AI 요약</span>
          </Button>
          <Button variant="default" size="sm" onClick={() => { send('fab_memo_catalyst'); catalyst(); }} aria-label="Catalyst">
            <Sparkles className="h-4 w-4" />
            <span className="hidden lg:inline ml-1">Catalyst ✨</span>
          </Button>
          <Button variant="secondary" size="sm" onClick={() => { send('fab_memo_download'); download(); }} aria-label="메모 다운로드">
            <Download className="h-4 w-4" />
            <span className="hidden lg:inline ml-1">다운로드</span>
          </Button>
        </div>

        {/* Right-aligned persistent controls */}
        <div className={["flex items-center gap-1 md:gap-2 shrink-0", memoOpen ? "ml-auto" : ""].join(" ")} role="group" aria-label="Global actions">
          {/* Memo toggle to ensure there is a way to open/close the panel when legacy launcher is hidden */}
          <Button variant="ghost" size="sm" onClick={() => { send('fab_memo_toggle'); toggleMemo(); }} aria-label="메모">
            <NotebookPen className="h-4 w-4" />
            <span className="hidden lg:inline ml-1">Memo</span>
          </Button>
          <div className="relative">
            <Button variant="secondary" size="sm" onClick={openHistory} aria-label="History" aria-haspopup="dialog">
              <Map className="h-4 w-4" />
              <span className="hidden lg:inline ml-1">History</span>
            </Button>
            {hasNew && (
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" aria-hidden />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
