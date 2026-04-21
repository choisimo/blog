import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/session/useAuthStore';
import { consumeAdminReturnPath } from '@/services/session/adminReturnTo';
import { consumeOAuthHandoff } from '@/services/session/auth';

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
    const handoff = params.get('handoff');
    const token = params.get('token');
    const refreshToken = params.get('refreshToken');
    const err = params.get('error');
    let cancelled = false;

    const complete = async () => {
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
            const message =
              exchangeError instanceof Error ? exchangeError.message : 'OAuth handoff failed';
            setError(`Authentication failed: ${message}`);
          }
        }
        return;
      }

      if (err) {
        setError(`Authentication failed: ${err}`);
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
