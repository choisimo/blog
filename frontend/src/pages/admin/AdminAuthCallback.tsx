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
          setTokens(response.accessToken, response.refreshToken, response.user);
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

      setTokensFromOAuth(token, refreshToken);
      navigate(consumeAdminReturnPath(), { replace: true });
    };

    void complete();

    return () => {
      cancelled = true;
    };
  }, [navigate, setTokens, setTokensFromOAuth]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
        <p className="text-destructive text-center">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );
}
