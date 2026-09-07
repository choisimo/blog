import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/session/useAuthStore';
import { consumeAdminReturnPath } from '@/services/session/adminReturnTo';
import { consumeOAuthHandoff } from '@/services/session/auth';

function normalizeCallbackCredential(value: string | null): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || /[\u0000-\u001F\u007F]/.test(normalized)) return null;
  return normalized;
}

const MAX_CALLBACK_ERROR_LENGTH = 240;
const CALLBACK_ERROR_ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\)|[@-Z\\-_])/g;
const CALLBACK_UNTERMINATED_OSC_PATTERN = /\u001b\][^\u0007]*$/g;
const CALLBACK_TEXT_CONTROL_PATTERN = /[\u0000-\u001F\u007F]+/g;

function normalizeCallbackError(value: unknown, fallback = 'unknown error'): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value
    .replace(CALLBACK_ERROR_ANSI_ESCAPE_PATTERN, ' ')
    .replace(CALLBACK_UNTERMINATED_OSC_PATTERN, ' ')
    .replace(CALLBACK_TEXT_CONTROL_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized ? normalized.slice(0, MAX_CALLBACK_ERROR_LENGTH) : fallback;
}

export default function AdminAuthCallback() {
  const navigate = useNavigate();
  const { setTokens, setTokensFromOAuth } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (window.location.hash) {
      window.history.replaceState(
        null,
        document.title,
        `${window.location.pathname}${window.location.search}`
      );
    }
    const params = new URLSearchParams(hash);
    const rawHandoff = params.get('handoff');
    const rawToken = params.get('token');
    const rawRefreshToken = params.get('refreshToken');
    const handoff = normalizeCallbackCredential(rawHandoff);
    const token = normalizeCallbackCredential(rawToken);
    const refreshToken = normalizeCallbackCredential(rawRefreshToken);
    const err = params.get('error');
    let cancelled = false;

    const complete = async () => {
      if (err) {
        setError(`Authentication failed: ${normalizeCallbackError(err)}`);
        return;
      }

      if (rawHandoff && !handoff) {
        setError('Authentication failed: invalid handoff');
        return;
      }

      if (handoff) {
        try {
          const response = await consumeOAuthHandoff(handoff);
          if (cancelled) {
            return;
          }
          const accepted = setTokens(
            response.accessToken,
            response.refreshToken,
            response.user,
          );
          if (!accepted) {
            setError('Authentication failed: invalid credentials');
            return;
          }
          navigate(consumeAdminReturnPath(), { replace: true });
        } catch (exchangeError) {
          if (!cancelled) {
            const message = normalizeCallbackError(
              exchangeError instanceof Error ? exchangeError.message : null,
              'OAuth handoff failed',
            );
            setError(`Authentication failed: ${message}`);
          }
        }
        return;
      }

      if ((rawToken && !token) || (rawRefreshToken && !refreshToken)) {
        setError('Authentication failed: invalid tokens');
        return;
      }

      if (!token || !refreshToken) {
        setError('Authentication failed: missing tokens');
        return;
      }

      const accepted = setTokensFromOAuth(token, refreshToken);
      if (!accepted) {
        setError('Authentication failed: invalid credentials');
        return;
      }
      navigate(consumeAdminReturnPath(), { replace: true });
    };

    void complete();

    return () => {
      cancelled = true;
    };
  }, [navigate, setTokens, setTokensFromOAuth]);

  return (
    <div className="ui-page ui-auth-page" data-ui-page="admin-auth-callback">
      <section className="ui-auth-card" aria-labelledby="callback-title">
        <Link className="ui-auth-brand" to="/">noblog</Link>
        <h1 id="callback-title">{error ? '인증을 완료하지 못했습니다' : '로그인 확인 중'}</h1>
        {error ? <>
          <p role="alert" className="ui-inline-error">인증 응답을 확인하지 못했습니다. 로그인을 다시 시작해 주세요.</p>
          <p className="ui-description">일회성 인증 정보를 다시 전송하지 않습니다.</p>
          <Link className="ui-text-action" to="/admin/login">관리자 로그인으로 돌아가기</Link>
        </> : <div role="status" aria-live="polite" className="ui-status-line">
          <span className="ui-spinner" aria-hidden="true" />
          <p>인증 응답을 확인하고 있습니다. 확인이 끝나면 관리자 화면으로 이동합니다.</p>
        </div>}
      </section>
    </div>
  );
}
