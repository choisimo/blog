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
    const find = () => document.querySelector('ai-memo-pad') as HTMLElement | null;
    let t: number | undefined;
    const tryAttach = () => {
      const e = find();
      if (e) setEl(e);
      else t = window.setTimeout(tryAttach, 200);
    };
    tryAttach();
    return () => t && clearTimeout(t);
  }, []);
  return el;
}

function useMemoOpen(aiMemoEl: HTMLElement | null): boolean {
  const [open, setOpen] = useState<boolean>(() => {
    try { return !!JSON.parse(localStorage.getItem('aiMemo.isOpen') || 'false'); } catch { return false; }
  });
  useEffect(() => {
    // Storage (cross-tab) + shadow panel mutation
    const onStorage = (e: StorageEvent) => { if (!e.key || e.key === 'aiMemo.isOpen') {
      try { setOpen(!!JSON.parse(localStorage.getItem('aiMemo.isOpen') || 'false')); } catch {}
    } };
    window.addEventListener('storage', onStorage);

    let mo: MutationObserver | null = null;
    const attachObserver = () => {
      if (!aiMemoEl) return;
      const shadow = (aiMemoEl as any).shadowRoot as ShadowRoot | undefined;
      const panel = shadow?.getElementById('panel');
      if (!panel) return;
      const check = () => setOpen(panel.classList.contains('open'));
      check();
      mo = new MutationObserver(check);
      mo.observe(panel, { attributes: true, attributeFilter: ['class'] });
    };
    attachObserver();
    return () => {
      window.removeEventListener('storage', onStorage);
      mo?.disconnect();
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
    const launcher = shadow?.getElementById('launcher');
    const historyLauncher = shadow?.getElementById('historyLauncher');
    if (launcher) (launcher as HTMLElement).style.display = 'none';
    if (historyLauncher) (historyLauncher as HTMLElement).style.display = 'none';
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
      if ((import.meta as any).env?.DEV) {
        // eslint-disable-next-line no-console
        console.debug('[FAB]', type, detail || '');
      }
    } catch {}
  }, []);

  // prevent duplicates while flag is on
  useEffect(() => { if (enabled) hideLegacyLaunchers(aiMemoEl); }, [enabled, aiMemoEl]);

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

  return (
    <div
      role="toolbar"
      aria-label="Floating actions"
      className="fixed left-1/2 -translate-x-1/2 bottom-[max(16px,env(safe-area-inset-bottom))] z-50 w-[calc(100%-24px)] max-w-3xl border border-border/60 rounded-xl shadow-lg px-2 py-2 md:px-3 md:py-3 bg-background/70 supports-[backdrop-filter]:backdrop-blur-md motion-reduce:transition-none print:hidden"
    >
      <div className="flex items-center justify-between gap-2">
        {/* Contextual (memo) actions */}
        <div
          className={[
            'flex items-center gap-1 md:gap-2 transition-all duration-200 motion-reduce:transition-none',
            memoOpen ? 'opacity-100 translate-y-0' : 'opacity-0 pointer-events-none translate-y-1',
          ].join(' ')}
          role="group"
          aria-label="Memo actions"
        >
          <Button variant="secondary" size="sm" onClick={() => { send('fab_memo_add_selection'); addSelection(); }} aria-label="선택 추가">
            <Plus className="h-4 w-4" />
            <span className="hidden md:inline ml-1">선택 추가</span>
          </Button>
          <Button variant="secondary" size="sm" onClick={() => { send('fab_memo_add_graph'); addToGraph(); }} aria-label="그래프에 추가">
            <Share2 className="h-4 w-4" />
            <span className="hidden md:inline ml-1">그래프에 추가</span>
          </Button>
          <Button variant="default" size="sm" onClick={() => { send('fab_memo_ai_summary'); aiSummary(); }} aria-label="AI 요약">
            <Sparkles className="h-4 w-4" />
            <span className="hidden md:inline ml-1">AI 요약</span>
          </Button>
          <Button variant="default" size="sm" onClick={() => { send('fab_memo_catalyst'); catalyst(); }} aria-label="Catalyst">
            <Sparkles className="h-4 w-4" />
            <span className="hidden md:inline ml-1">Catalyst ✨</span>
          </Button>
          <Button variant="secondary" size="sm" onClick={() => { send('fab_memo_download'); download(); }} aria-label="메모 다운로드">
            <Download className="h-4 w-4" />
            <span className="hidden md:inline ml-1">다운로드</span>
          </Button>
        </div>

        {/* Right-aligned persistent controls */}
        <div className="ml-auto flex items-center gap-1 md:gap-2" role="group" aria-label="Global actions">
          {/* Memo toggle to ensure there is a way to open/close the panel when legacy launcher is hidden */}
          <Button variant="ghost" size="sm" onClick={() => { send('fab_memo_toggle'); toggleMemo(); }} aria-label="메모">
            <NotebookPen className="h-4 w-4" />
            <span className="hidden md:inline ml-1">Memo</span>
          </Button>
          <div className="relative">
            <Button variant="secondary" size="sm" onClick={openHistory} aria-label="History" aria-haspopup="dialog">
              <Map className="h-4 w-4" />
              <span className="hidden md:inline ml-1">History</span>
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
