import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'fieldnotes.reading.v1';
const DEFAULTS = { size: 18, leading: 1.98, width: 720, font: 'sans', paper: 'neutral' } as const;
type Preferences = { size: number; leading: number; width: number; font: 'sans' | 'serif'; paper: 'neutral' | 'warm' };

function readPreferences(): Preferences {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    const data = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const number = (key: 'size' | 'leading' | 'width', min: number, max: number) =>
      typeof data[key] === 'number' && Number.isFinite(data[key])
        ? Math.min(max, Math.max(min, data[key])) : DEFAULTS[key];
    return { size: number('size', 16, 24), leading: number('leading', 1.6, 2.3), width: number('width', 640, 900), font: data.font === 'serif' ? 'serif' : 'sans', paper: data.paper === 'warm' ? 'warm' : 'neutral' };
  } catch { return { ...DEFAULTS }; }
}

/** Presentation only: reading preferences never modify a post, session, or server data. */
export function ReadingPreferences() {
  const [preferences, setPreferences] = useState<Preferences>(readPreferences);
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(false);
  const [saved, setSaved] = useState(true);
  const trigger = useRef<HTMLElement | null>(null);
  const { theme, setTheme } = useTheme();
  const { pathname } = useLocation();

  useEffect(() => {
    const show = (event?: Event) => {
      if (document.querySelector('.fn-reading-settings[data-state="open"]')) return;
      const requestedTrigger: unknown = event instanceof CustomEvent ? event.detail?.trigger : null;
      trigger.current = requestedTrigger instanceof HTMLElement ? requestedTrigger : document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setOpen(true);
    };
    const toggle = () => { if (document.querySelector('.fn-post-page')) setFocus(value => !value); };
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && document.querySelector('.fn-reading-settings[data-state="open"]')) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest('input,textarea,select,[contenteditable=true]') || event.ctrlKey || event.metaKey) return;
      if (event.key === 'Escape' && !document.querySelector('[role="dialog"]')) setFocus(false);
      if (event.altKey && event.key.toLowerCase() === 'a') { event.preventDefault(); show(); }
      if (event.altKey && event.key.toLowerCase() === 'z') { event.preventDefault(); toggle(); }
    };
    window.addEventListener('fieldnotes:reading-settings', show);
    window.addEventListener('fieldnotes:toggle-focus', toggle);
    window.addEventListener('keydown', keys, true);
    return () => {
      window.removeEventListener('fieldnotes:reading-settings', show);
      window.removeEventListener('fieldnotes:toggle-focus', toggle);
      window.removeEventListener('keydown', keys, true);
    };
  }, []);

  useEffect(() => { setFocus(false); setOpen(false); }, [pathname]);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.readingPaper = preferences.paper;
    root.style.setProperty('--fn-reading-size', `${preferences.size}px`);
    root.style.setProperty('--fn-reading-leading', String(preferences.leading));
    root.style.setProperty('--fn-reading-font', `var(--fn-${preferences.font})`);
    root.style.setProperty('--fn-reading-width', `${preferences.width}px`);
    root.style.setProperty('--rd-prose', `${preferences.width}px`);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)); setSaved(true); }
    catch { setSaved(false); }
  }, [preferences]);
  useEffect(() => { document.documentElement.dataset.readingFocus = String(focus); }, [focus]);
  useEffect(() => () => {
    const root = document.documentElement;
    delete root.dataset.readingPaper;
    delete root.dataset.readingFocus;
    ['--fn-reading-size', '--fn-reading-leading', '--fn-reading-font', '--fn-reading-width', '--rd-prose'].forEach(key => root.style.removeProperty(key));
  }, []);

  const set = <K extends keyof Preferences>(key: K, value: Preferences[K]) => setPreferences(previous => ({ ...previous, [key]: value }));
  return <>
    {focus && <Button className="fn-focus-exit" variant="outline" onClick={() => setFocus(false)}>집중 모드 종료</Button>}
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="fn-reading-settings" onCloseAutoFocus={event => {
        event.preventDefault();
        if (trigger.current?.isConnected) trigger.current.focus({ preventScroll: true });
        else document.getElementById('main-content')?.focus({ preventScroll: true });
      }}>
        <DialogHeader>
          <p className="fn-eyebrow">YOUR READING ROOM</p>
          <DialogTitle className="fn-dialog-title">읽는 방식도, 나답게.</DialogTitle>
          <DialogDescription>글꼴과 여백을 편안하게 맞춰보세요.</DialogDescription>
        </DialogHeader>
        <div className="fn-reading-sample">한 번의 질문이,<br /><span>다음 생각의 출발점이 됩니다.</span></div>
        <fieldset className="fn-setting-row"><legend>종이와 빛</legend><div className="fn-segmented">
          <button type="button" aria-pressed={theme === 'light' && preferences.paper === 'neutral'} onClick={() => { set('paper', 'neutral'); setTheme('light'); }}>밝은 종이</button>
          <button type="button" aria-pressed={theme === 'light' && preferences.paper === 'warm'} onClick={() => { set('paper', 'warm'); setTheme('light'); }}>따뜻한 종이</button>
          <button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>밤의 종이</button>
        </div></fieldset>
        <fieldset className="fn-setting-row"><legend>본문 글꼴</legend><div className="fn-segmented">
          <button type="button" aria-pressed={preferences.font === 'sans'} onClick={() => set('font', 'sans')}>고딕</button>
          <button type="button" aria-pressed={preferences.font === 'serif'} onClick={() => set('font', 'serif')} className="fn-serif">명조</button>
        </div></fieldset>
        {([{ key: 'size', label: '글자 크기', min: 16, max: 24, step: 1, unit: 'px' }, { key: 'leading', label: '줄 간격', min: 1.6, max: 2.3, step: .02, unit: '' }, { key: 'width', label: '본문 너비', min: 640, max: 900, step: 20, unit: 'px' }] as const).map(control => <div className="fn-setting-row" key={control.key}>
          <label htmlFor={`fn-reading-${control.key}`}>{control.label}<output>{preferences[control.key]}{control.unit}</output></label>
          <input id={`fn-reading-${control.key}`} type="range" min={control.min} max={control.max} step={control.step} value={preferences[control.key]} onChange={event => set(control.key, Number(event.target.value))} />
        </div>)}
        <label className="fn-setting-toggle"><span>시스템 테마 사용</span><input type="checkbox" checked={theme === 'system'} onChange={event => setTheme(event.target.checked ? 'system' : 'light')} /></label>
        <div className="fn-settings-footer"><p role="status">{saved ? '설정은 이 브라우저에 저장됩니다.' : '브라우저 저장이 제한되어 현재 화면에만 적용됩니다.'}</p><Button variant="outline" onClick={() => { setPreferences({ ...DEFAULTS }); setFocus(false); }}>기본값</Button></div>
      </DialogContent>
    </Dialog>
  </>;
}
