import { useEffect, useRef, useState } from 'react';
import { startNewAnonymousSession } from '@blog/shared/runtime/anonymous-session';
import { getValidAnonymousToken } from '@/services/session/auth';
import { getApiBaseUrl } from '@/utils/network/apiBase';
import { useAuthStore } from '@/stores/session/useAuthStore';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import '@/styles/reader-assistant.css';

const accountActive = () => {
  const account = useAuthStore.getState();
  return Boolean(account.accessToken || account.refreshToken);
};

export default function AnonymousSessionRecoveryDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const openRef = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  const expectedToken = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const close = () => {
    ++generation.current;
    controller.current?.abort();
    openRef.current = false;
    setIsOpen(false);
  };

  useEffect(() => {
    const open = () => {
      if (openRef.current || accountActive()) return;
      try { expectedToken.current = localStorage.getItem('anon.token'); }
      catch { return; }
      ++generation.current;
      opener.current = document.activeElement as HTMLElement | null;
      setConfirmed(false); setBusy(false); setMessage('');
      openRef.current = true;
      setIsOpen(true);
    };
    window.addEventListener('reader:anonymous-auth-required', open);
    return () => {
      ++generation.current;
      controller.current?.abort();
      window.removeEventListener('reader:anonymous-auth-required', open);
    };
  }, []);

  const act = async (newSession: boolean) => {
    const run = generation.current;
    if (busy || (newSession && !confirmed)) return;
    if (accountActive()) { setMessage('로그인 상태가 변경되었습니다. 창을 닫고 다시 시도하세요.'); return; }
    setBusy(true); setMessage('');
    controller.current = new AbortController();
    try {
      if (newSession) {
        await startNewAnonymousSession({
          apiBase: getApiBaseUrl(), expectedToken: expectedToken.current, confirmed: true,
          signal: controller.current.signal,
          isCurrent: () => generation.current === run && !accountActive(),
        });
      } else {
        await getValidAnonymousToken({ forceRefresh: true });
      }
      if (run !== generation.current) return;
      // Closing does not replay the failed save, chat or generation under a new subject.
      close();
    } catch (error) {
      if (run === generation.current) setMessage(error instanceof Error ? error.message : '인증을 확인하지 못했습니다.');
    } finally {
      if (run === generation.current) setBusy(false);
    }
  };

  return <Sheet open={isOpen} onOpenChange={open => { if (!open) close(); }}>
    <SheetContent side="right" hideClose className="reader-settings reader-auth-recovery"
      onInteractOutside={event => event.preventDefault()}
      onCloseAutoFocus={event => {
        event.preventDefault();
        if (!openRef.current && opener.current?.isConnected) opener.current.focus({ preventScroll: true });
      }}>
    <div className="reader-settings-shell">
      <header><SheetTitle>익명 인증 확인</SheetTitle>
        <button type="button" className="reader-icon-button" onClick={close} aria-label="인증 확인 닫기">×</button>
      </header>
      <div className="reader-settings-body">
        <SheetDescription>현재 메모는 그대로 둡니다. 만료되거나 분실한 자격은 ID만으로 복구할 수 없습니다.</SheetDescription>
        <p>새 익명 세션은 이전 서버 메모·대화·이미지에 접근할 수 없습니다. 이 기기의 메모와 설정은 삭제하거나 자동 업로드하지 않습니다.</p>
        <label className="reader-auth-confirm"><input type="checkbox" checked={confirmed} disabled={busy}
          onChange={event => setConfirmed(event.target.checked)} />이전 서버 자료가 연결되지 않는 것을 확인했습니다.</label>
        {message && <p role="status">{message}</p>}
      </div>
      <footer aria-busy={busy}>
        <button type="button" onClick={() => void act(false)} disabled={busy}>인증 다시 확인</button>
        <button type="button" onClick={() => void act(true)} disabled={busy || !confirmed}>새 익명 세션 시작</button>
      </footer>
    </div>
    </SheetContent>
  </Sheet>;
}
