import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/session/useAuthStore';
import { consumeAdminReturnPath } from '@/services/session/adminReturnTo';

export default function AdminAuthCallback() {
  const navigate = useNavigate();
  const { setTokensFromOAuth } = useAuthStore();
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
    const token = params.get('token');
    const refreshToken = params.get('refreshToken');
    const err = params.get('error');

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
  }, [navigate, setTokensFromOAuth]);

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
