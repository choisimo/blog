import { useEffect, useRef, useState } from 'react';
import { Check, RotateCcw, Settings2, X } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { DEFAULT_AGENT_PREFERENCES, getAgentPreferences, loadAccountPreferences, openAgentPreferences,
  preferenceScope, startPreferenceBootstrap, saveAccountPreferences, saveAgentPreferences, type AgentPreferences } from '@/services/personal/agentPreferences';
import { getImagePolicy, type ImagePolicy } from '@/services/personal/readerImages';
import '@/styles/reader-assistant.css';

export function AgentSettingsButton() {
  return <button type="button" className="reader-icon-button" onClick={openAgentPreferences} title="AI 설정" aria-label="AI 설정 열기"><Settings2 size={17} aria-hidden="true" /></button>;
}
export default function AgentPreferencesDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const openRef = useRef(false);
  useEffect(startPreferenceBootstrap, []);
  const [draft, setDraft] = useState<AgentPreferences>({ ...DEFAULT_AGENT_PREFERENCES });
  const [quota, setQuota] = useState<ImagePolicy | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accountVersion, setAccountVersion] = useState<number | null>(null);
  const scope = useRef('guest');
  const generation = useRef(0);
  const opener = useRef<HTMLElement | null>(null);
  function close() { generation.current++; openRef.current = false; setIsOpen(false); }
  useEffect(() => {
    const requestGeneration = generation;
    const open = () => {
      if (openRef.current) return;
      const runId = ++generation.current;
      scope.current = preferenceScope();
      opener.current = document.activeElement as HTMLElement | null;
      setDraft({ ...getAgentPreferences() }); setMessage(''); setAccountVersion(null); setQuota(null); setSaving(false);
      openRef.current = true; setIsOpen(true);
      const member = scope.current.startsWith('account:');
      setLoading(member);
      void getImagePolicy().then(policy => { if (generation.current === runId) setQuota(policy); }).catch(() => {
        if (generation.current === runId) setMessage('이미지 사용량을 확인하지 못했습니다.');
      });
      if (member) void loadAccountPreferences().then(result => {
        if (generation.current !== runId || scope.current !== preferenceScope()) return;
        setAccountVersion(result.version); setDraft(result.preferences);
        saveAgentPreferences(result.preferences, scope.current);
      }).catch(e => { if (generation.current === runId) setMessage(e instanceof Error ? e.message : '계정 설정을 불러오지 못했습니다.'); })
        .finally(() => { if (generation.current === runId) setLoading(false); });
    };
    window.addEventListener('reader:agent-settings', open);
    return () => { window.removeEventListener('reader:agent-settings', open); requestGeneration.current++; };
  }, []);
  const change = <K extends keyof AgentPreferences>(key: K, value: AgentPreferences[K]) => setDraft(p => ({ ...p, [key]: value }));
  const save = async () => {
    if (scope.current !== preferenceScope()) { setMessage('계정이 변경되었습니다. 설정을 다시 여세요.'); return; }
    const runId = generation.current;
    setSaving(true); setMessage('');
    try {
      if (accountVersion !== null) {
        const result = await saveAccountPreferences(draft, accountVersion);
        if (runId !== generation.current) return;
        setAccountVersion(result.version);
      }
      saveAgentPreferences(draft, scope.current);
      setMessage(accountVersion !== null ? '계정에 저장됨' : '이 기기에 저장됨');
    } catch (e) { if (runId === generation.current) setMessage(e instanceof Error ? e.message : '설정을 저장하지 못했습니다.'); }
    finally { if (runId === generation.current) setSaving(false); }
  };
  const select = <K extends keyof AgentPreferences>(key: K, label: string, options: [string,string][]) => <label className="reader-setting-field">
    <span>{label}</span><select value={String(draft[key])} onChange={e => change(key, e.target.value as AgentPreferences[K])}>
      {options.map(([value, text]) => <option value={value} key={value}>{text}</option>)}
    </select></label>;
  return <Sheet open={isOpen} onOpenChange={open => { if (!open) close(); }}>
    <SheetContent side="right" hideClose className="reader-settings" aria-describedby={undefined}
      onInteractOutside={event => event.preventDefault()}
      onCloseAutoFocus={event => {
        event.preventDefault();
        if (!openRef.current && opener.current?.isConnected) opener.current.focus({ preventScroll: true });
      }}>
    <div className="reader-settings-shell">
      <header><SheetTitle>AI 설정</SheetTitle><button type="button" className="reader-icon-button" onClick={close} aria-label="AI 설정 닫기"><X size={20} /></button></header>
      <fieldset className="reader-settings-body" aria-busy={loading} disabled={loading || saving}>
        <section><h3>대화</h3><div className="reader-settings-grid">
          {select('role','역할',[['assistant','대화 상대'],['researcher','연구자'],['critic','비평가'],['coach','학습 코치'],['custom','직접 작성']])}
          {select('tone','말투',[['natural','자연스럽게'],['formal','격식 있게'],['friendly','친근하게'],['direct','직접적으로']])}
          {select('length','답변 길이',[['brief','짧게'],['balanced','적당히'],['detailed','상세하게']])}
          {select('language','언어',[['ko','한국어'],['en','English'],['ja','日本語']])}
          {select('tables','표 사용',[['auto','필요할 때'],['prefer','적극 사용'],['avoid','가급적 피하기']])}
        </div>
        {draft.role === 'custom' && <label className="reader-setting-field reader-custom-role"><span>역할 설명</span><textarea value={draft.customRole} maxLength={1000} rows={4} onChange={e => change('customRole', e.target.value)} placeholder="예: 가정을 점검하고 반례를 함께 찾아주는 기술 검토자" /><small>{draft.customRole.length}/1000</small></label>}
        <label className="reader-setting-toggle"><span>근거와 불확실성 표시</span><input type="checkbox" checked={draft.evidence} onChange={e => change('evidence', e.target.checked)} /></label>
        </section>
        <section><h3>이미지</h3><div className="reader-settings-grid">
          {select('imageMode','답변에 이미지',[['auto','관련 주제에 자동'],['always','답변마다'],['manual','직접 눌러 생성'],['off','사용 안 함']])}
          {select('imageStyle','표현',[['editorial','일러스트'],['diagram','개념도'],['photographic','사진풍']])}
          {select('imageSize','비율',[['1536x1024','가로 3:2'],['1024x1024','정사각형'],['1024x1536','세로 2:3']])}
        </div>
        {quota && <div className="reader-quota" aria-live="polite"><span>{quota.tier === 'guest' ? '비회원' : '회원'} · 오늘 {quota.remaining}/{quota.dailyLimit}장 남음</span><meter value={quota.remaining} min={0} max={quota.dailyLimit} aria-label="남은 이미지 수" /><small>{quota.enabled ? '한국 시간 00:00 갱신 · 이미지 7일 보관' : '이미지 생성 준비 중'}{quota.networkLimited ? ' · 동일 네트워크 한도 도달' : ''}</small></div>}
        </section>
      </fieldset>
      <footer><div className="reader-settings-status" role="status">{loading ? '계정 설정 불러오는 중' : message || (accountVersion !== null ? '계정에 동기화' : '이 기기에만 저장')}</div>
        <div className="reader-settings-actions"><button type="button" className="reader-inline-action" onClick={() => setDraft({ ...DEFAULT_AGENT_PREFERENCES })} disabled={loading || saving}><RotateCcw size={14} />초기값</button><button type="button" className="reader-save" onClick={() => void save()} disabled={loading || saving}><Check size={16} />{saving ? '저장 중' : '저장'}</button></div>
      </footer>
    </div>
    </SheetContent>
  </Sheet>;
}
