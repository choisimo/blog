import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Download, Expand, ImagePlus, Loader2, RefreshCw, X } from 'lucide-react';
import { getAgentPreferences, preferenceScope, shouldAutoIllustrate, useAgentPreferences } from '@/services/personal/agentPreferences';
import { generateReaderImage, getReaderImageJob, loadReaderImageBlob, ReaderImageError,
  type ImageInput, type ReaderImage } from '@/services/personal/readerImages';
import '@/styles/reader-assistant.css';

type Entry = { phase: 'idle' | 'loading' | 'ready' | 'error'; image?: ReaderImage;
  message?: string; code?: string; key: string; input?: ImageInput; attempted?: boolean; pollUntil?: number };
const REFUNDED_RETRY_CODES = ['IMAGE_PROVIDER_UNAVAILABLE', 'IMAGE_PROVIDER_RATE_LIMIT'];
const PENDING_CODES = ['IMAGE_IN_PROGRESS', 'IMAGE_OUTCOME_UNKNOWN'];
const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
function readEntry(cacheKey: string, requestKey: string): Entry {
  if (!entries.has(cacheKey)) {
    let stored: Partial<Entry> | null = null;
    try { stored = JSON.parse(sessionStorage.getItem(`reader.visual:${cacheKey}`) || 'null'); } catch { /* optional persistence */ }
    const phase = stored?.image ? 'ready' : stored?.attempted || stored?.phase === 'error' ? 'error' : 'idle';
    entries.set(cacheKey, { phase, key: stored?.key && /^[A-Za-z0-9._:-]{8,128}$/.test(stored.key) ? stored.key : requestKey, image: stored?.image,
      pollUntil: stored?.pollUntil,
      attempted: stored?.attempted === true, code: stored?.code || (stored?.attempted ? 'IMAGE_IN_PROGRESS' : undefined),
      message: stored?.message || (stored?.attempted ? '이전 이미지 요청의 상태를 확인하세요.' : undefined) });
  }
  return entries.get(cacheKey)!;
}
function update(cacheKey: string, entry: Entry) {
  entries.set(cacheKey, entry);
  // Only job/result metadata in tab-scoped storage. Prompts stay in memory, not in a second transcript store.
  try { sessionStorage.setItem(`reader.visual:${cacheKey}`, JSON.stringify({
    key: entry.key, image: entry.image, attempted: entry.attempted,
    phase: entry.phase, code: entry.code, message: entry.message, pollUntil: entry.pollUntil,
  })); } catch { /* server idempotency still prevents duplicate work */ }
  emit();
}
async function run(cacheKey: string, initialKey: string, prompt: string, purpose: 'chat' | 'debate', scope: string) {
  if (scope !== preferenceScope()) return;
  const entry = readEntry(cacheKey, initialKey);
  if (entry.phase === 'loading' || entry.phase === 'ready') return;
  const preferences = getAgentPreferences();
  const input = entry.input || { prompt: `주제 참고 이미지: ${prompt.trim()}`.slice(0, 3000),
    alt: `${prompt.trim().slice(0, 110)} — AI 생성 참고 이미지`,
    size: preferences.imageSize, style: preferences.imageStyle, purpose };
  const pollUntil = entry.pollUntil || Date.now() + 6 * 60 * 1000;
  update(cacheKey, { ...entry, phase: 'loading', input, attempted: true, pollUntil });
  try {
    // Reconnect checks the same job, never resubmits an uncertain paid generation.
    const image = entry.attempted ? await getReaderImageJob(entry.key, scope) : await generateReaderImage(input, entry.key, scope);
    update(cacheKey, { phase: 'ready', key: entry.key, image, attempted: true });
  } catch (error) {
    const code = error instanceof ReaderImageError ? error.code : 'IMAGE_ERROR';
    const unaccepted = ['IMAGE_DAILY_LIMIT','IMAGE_GLOBAL_LIMIT','IMAGE_RATE_LIMIT','IMAGE_DISABLED','IMAGE_UNAVAILABLE',
      'IMAGE_POLICY_UNAVAILABLE','IMAGE_NOT_FOUND','INVALID_IMAGE_INPUT','ACCOUNT_CHANGED'].includes(code);
    update(cacheKey, { phase: 'error', key: entry.key, input, attempted: !unaccepted, pollUntil,
      code, message: error instanceof Error ? error.message : '이미지를 불러오지 못했습니다.' });
  }
}
export function GeneratedImageCard({ requestKey, prompt, purpose = 'chat', automatic = false, expectedScope }: {
  requestKey: string; prompt: string; purpose?: 'chat' | 'debate'; automatic?: boolean; expectedScope?: string;
}) {
  const preferences = useAgentPreferences();
  const scope = preferenceScope();
  const initialScope = useRef(scope);
  const belongsToCurrentAccount = (expectedScope || initialScope.current) === scope;
  const key = `img-${requestKey.replace(/[^A-Za-z0-9._:-]/g, '-').slice(0, 120)}`;
  const cacheKey = `${scope}:${key}`;
  const entry = useSyncExternalStore(subscribe, () => readEntry(cacheKey, key), () => readEntry(cacheKey, key));
  const [src, setSrc] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const eligible = belongsToCurrentAccount && automatic && shouldAutoIllustrate(prompt, preferences.imageMode, purpose);
  useEffect(() => {
    if (eligible && entry.phase === 'idle') void run(cacheKey, key, prompt, purpose, scope);
  }, [eligible, cacheKey, key, prompt, purpose, scope, entry.phase]);
  useEffect(() => {
    if (!belongsToCurrentAccount || entry.phase !== 'error' || !entry.attempted ||
        !PENDING_CODES.includes(entry.code || '') || Date.now() >= (entry.pollUntil || 0)) return;
    // Recover an accepted job automatically; status reads never reserve another image.
    const timer = window.setTimeout(() => void run(cacheKey, key, prompt, purpose, scope), 3000);
    return () => window.clearTimeout(timer);
  }, [belongsToCurrentAccount, entry, cacheKey, key, prompt, purpose, scope]);
  useEffect(() => {
    let disposed = false, objectUrl = '';
    setSrc(''); setLoadError(''); dialog.current?.close();
    if (entry.image && belongsToCurrentAccount) void loadReaderImageBlob(entry.image, scope).then(blob => {
      if (disposed) return;
      objectUrl = URL.createObjectURL(blob); setSrc(objectUrl);
    }).catch(e => { if (!disposed) setLoadError(e instanceof Error ? e.message : '이미지를 열지 못했습니다.'); });
    return () => { disposed = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [entry.image, scope, loadAttempt, belongsToCurrentAccount]);
  if (!belongsToCurrentAccount || (preferences.imageMode === 'off' && !entry.image)) return null;
  const retry = () => {
    // A refunded, terminal reservation is immutable. An explicit retry gets a new key.
    if (REFUNDED_RETRY_CODES.includes(entry.code || '')) {
      update(cacheKey, { phase: 'idle', key: `img-${crypto.randomUUID()}`, input: entry.input });
    }
    void run(cacheKey, key, prompt, purpose, scope);
  };
  const uncertain = entry.attempted;
  const terminalError = ['IMAGE_REJECTED','IMAGE_EXPIRED','IDEMPOTENCY_CONFLICT','INVALID_IMAGE_INPUT','FORBIDDEN_ORIGIN'].includes(entry.code || '');
  return <figure className="reader-visual" data-phase={entry.phase}>
    {entry.phase === 'idle' && <button type="button" className="reader-inline-action" onClick={retry}>
      <ImagePlus size={15} aria-hidden="true" />이미지로 보기</button>}
    {entry.phase === 'loading' && <div className="reader-visual-loading" role="status">
      <Loader2 size={19} className="reader-spin" aria-hidden="true" /><span>{uncertain ? '이미지 처리 중' : '이미지 생성 중'}</span>
    </div>}
    {entry.phase === 'error' && <div className="reader-visual-error" role="status">
      <p>{entry.message}</p>{!terminalError && <button type="button" className="reader-inline-action" onClick={retry}>
        <RefreshCw size={14} aria-hidden="true" />{uncertain && !REFUNDED_RETRY_CODES.includes(entry.code || '') ? '상태 확인' : '다시 시도'}</button>}
    </div>}
    {entry.image && <>
      {src ? <button type="button" className="reader-visual-open" onClick={() => dialog.current?.showModal()} aria-label="생성 이미지 크게 보기">
        <img src={src} width={entry.image.width} height={entry.image.height} alt={entry.image.alt} loading="lazy"
          onError={() => { setSrc(''); setLoadError('생성 이미지를 표시하지 못했습니다. 다시 불러오세요.'); }} />
        <span className="reader-visual-expand"><Expand size={15} aria-hidden="true" /></span>
      </button> : <div className="reader-visual-loading" role="status">{loadError || '이미지 불러오는 중'}
        {loadError && <button type="button" onClick={() => setLoadAttempt(v => v + 1)}>다시 불러오기</button>}</div>}
      <figcaption><span>AI 생성 · 참고 이미지</span>{src && <a href={src} download={`illustration-${entry.image.id.slice(0,8)}.png`} aria-label="생성 이미지 저장"><Download size={15} /></a>}</figcaption>
      <dialog ref={dialog} className="reader-visual-dialog" aria-label="생성 이미지 확대" onClick={e => { if (e.target === e.currentTarget) dialog.current?.close(); }}>
        <button type="button" className="reader-icon-button" onClick={() => dialog.current?.close()} aria-label="확대 이미지 닫기"><X /></button>
        {src && <img src={src} alt={entry.image.alt} />}
      </dialog>
    </>}
  </figure>;
}
