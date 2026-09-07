import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Lock,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import {
  initiateTotpChallenge,
  verifyTotpCode,
  getTotpSetupStatus,
  getTotpSetup,
  verifyTotpSetup,
  getMe,
  type TotpVerifyResponse,
  type TotpSetupResponse,
} from '@/services/session/auth';
import {
  useAuthStore,
  migrateFromLegacyStorage,
  scheduleTokenRefresh,
} from '@/stores/session/useAuthStore';
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import {
  consumeAdminReturnPath,
  rememberAdminReturnPath,
} from '@/services/session/adminReturnTo';

type AuthStep =
  | 'initial-gate'
  | 'totp-login'
  | 'totp-setup'
  | 'session-validation-error'
  | 'authenticated';

const SESSION_VALIDATION_ERROR_MESSAGE =
  'Unable to verify the current admin session. Your saved session was left unchanged.';

function normalizeAdminCredential(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || /[\u0000-\u001F\u007F]/.test(normalized)) return null;
  return normalized;
}

function isDefinitiveAuthRejection(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('status' in error)) {
    return false;
  }

  const status = (error as { status?: unknown }).status;
  return status === 401 || status === 403;
}

function ErrorMsg({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      className="admin-error-msg mt-4 flex items-start gap-2 rounded-lg border border-red-200/80 bg-red-50/80 px-3 py-2.5 dark:border-red-900/40 dark:bg-red-950/30"
      role='alert'
      aria-live='polite'
    >
      <div className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" aria-hidden='true'>
        <svg viewBox='0 0 16 16' fill='currentColor' aria-hidden='true'>
          <title>Error</title>
          <path d='M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 3.75a.75.75 0 011.5 0v4a.75.75 0 01-1.5 0v-4zm.75 7a.875.875 0 110-1.75.875.875 0 010 1.75z' />
        </svg>
      </div>
      <p className="text-xs font-mono text-red-700 dark:text-red-400 leading-relaxed break-all">
        {message}
      </p>
    </div>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="ui-workspace ui-auth-page admin-auth-shell">
      <div className="ui-auth-container">
        <a href='/' className="ui-wordmark">noblog <span>admin</span></a>
        {children}
      </div>
    </div>
  );
}

function AuthCard({ children }: { children: React.ReactNode }) {
  return <div className="ui-auth-card admin-auth-card">{children}</div>;
}

interface SessionValidationErrorScreenProps {
  loading: boolean;
  onRetry: () => void;
}

function SessionValidationErrorScreen({
  loading,
  onRetry,
}: SessionValidationErrorScreenProps) {
  return (
    <AuthShell>
      <AuthCard>
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-ui-soft dark:bg-ui-surface">
              <ShieldCheck className="h-3.5 w-3.5 text-ui-muted dark:text-ui-muted" />
            </div>
            <h1 className="text-sm font-semibold text-ui-text dark:text-ui-text">
              Session validation unavailable
            </h1>
          </div>
          <p className="text-xs text-ui-muted dark:text-ui-muted leading-relaxed pl-8">
            Authentication could not be confirmed. Retry without discarding the
            saved session.
          </p>
        </div>

        <Button data-ui-variant="default"
          type='button'
          className="ui-control admin-btn-primary w-full h-9 text-xs font-semibold rounded-lg bg-ui-text hover:bg-ui-text dark:bg-ui-soft dark:text-ui-muted dark:hover:bg-ui-soft text-white transition-all duration-150"
          disabled={loading}
          onClick={onRetry}
        >
          {loading ? (
            <span className="flex items-center gap-1.5">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Checking session…
            </span>
          ) : (
            'Retry session validation'
          )}
        </Button>

        <ErrorMsg message={SESSION_VALIDATION_ERROR_MESSAGE} />
      </AuthCard>
    </AuthShell>
  );
}

interface InitialGateScreenProps {
  onServerKeySubmit: (key: string) => Promise<void>;
  loading: boolean;
  error: string;
}

function InitialGateScreen({
  onServerKeySubmit,
  loading,
  error,
}: InitialGateScreenProps) {
  const [key, setKey] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedKey = normalizeAdminCredential(key);
    if (!normalizedKey) return;
    await onServerKeySubmit(normalizedKey);
  };

  return (
    <AuthShell>
      <AuthCard>
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-ui-soft dark:bg-ui-surface">
              <ShieldCheck className="h-3.5 w-3.5 text-ui-muted dark:text-ui-muted" />
            </div>
            <h1 className="text-sm font-semibold text-ui-text dark:text-ui-text">
              Server Access Key
            </h1>
          </div>
          <p className="text-xs text-ui-muted dark:text-ui-muted leading-relaxed pl-8">
            Enter the{' '}
            <code className="font-mono text-xs text-ui-text dark:text-ui-text bg-ui-soft dark:bg-ui-surface px-1 py-0.5 rounded">
              ADMIN_SETUP_TOKEN
            </code>{' '}
            to unlock first-time setup.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label
              htmlFor='server-key'
              className="ui-label text-xs font-medium text-ui-muted dark:text-ui-muted"
            >
              Access key
            </Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ui-muted" />
              <Input
                id='server-key'
                type='password'
                value={key}
                onChange={e => setKey(e.target.value)}
                placeholder='Paste token from server console'
                autoFocus
                autoComplete='off'
                className="ui-input admin-input h-9 pl-8 text-sm font-mono rounded-lg border-ui-line dark:border-ui-line dark:bg-ui-surface dark:text-ui-text focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-400 focus-visible:ring-offset-0 transition-all"
              />
            </div>
          </div>

          <Button data-ui-variant="default"
            type='submit'
            className="ui-control admin-btn-primary w-full h-9 text-xs font-semibold rounded-lg bg-ui-text hover:bg-ui-text dark:bg-ui-soft dark:text-ui-muted dark:hover:bg-ui-soft text-white transition-all duration-150"
            disabled={!key.trim() || loading}
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Verifying…
              </span>
            ) : (
              'Continue →'
            )}
          </Button>
        </form>

        <ErrorMsg message={error} />
      </AuthCard>
    </AuthShell>
  );
}

interface TotpLoginScreenProps {
  onSuccess: (response: TotpVerifyResponse) => void;
  error: string;
  onError: (msg: string) => void;
}

function TotpLoginScreen({ onSuccess, error, onError }: TotpLoginScreenProps) {
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const challengeInFlightRef = useRef(false);

  const handleGetChallenge = async () => {
    if (challengeInFlightRef.current) return;
    challengeInFlightRef.current = true;
    setLoading(true);
    try {
      const result = await initiateTotpChallenge();
      const normalizedChallengeId = normalizeAdminCredential(result.challengeId);
      if (!normalizedChallengeId) {
        onError('Invalid challenge response');
        return;
      }
      setChallengeId(normalizedChallengeId);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to get challenge');
    } finally {
      challengeInFlightRef.current = false;
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedChallengeId = normalizeAdminCredential(challengeId);
    if (!normalizedChallengeId || code.length !== 6) return;
    setLoading(true);
    try {
      const response = await verifyTotpCode(normalizedChallengeId, code);
      onSuccess(response);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <AuthCard>
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-ui-soft dark:bg-ui-surface">
              <Lock className="h-3.5 w-3.5 text-ui-muted dark:text-ui-muted" />
            </div>
            <h1 className="text-sm font-semibold text-ui-text dark:text-ui-text">
              Authenticator
            </h1>
          </div>
          <p className="text-xs text-ui-muted dark:text-ui-muted leading-relaxed pl-8">
            {challengeId
              ? 'Enter the 6-digit code from your authenticator app.'
              : 'Request a challenge token to continue.'}
          </p>
        </div>

        {!challengeId ? (
          <Button data-ui-variant="default"
            className="ui-control admin-btn-primary w-full h-9 text-xs font-semibold rounded-lg bg-ui-text hover:bg-ui-text dark:bg-ui-soft dark:text-ui-muted dark:hover:bg-ui-soft text-white transition-all duration-150"
            onClick={handleGetChallenge}
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Loading…
              </span>
            ) : (
              'Get Challenge'
            )}
          </Button>
        ) : (
          <form onSubmit={handleVerify} className="space-y-3">
            <div className="space-y-1.5">
              <Label
                htmlFor='totp-code'
                className="ui-label text-xs font-medium text-ui-muted dark:text-ui-muted"
              >
                TOTP code
              </Label>
              <Input
                id='totp-code'
                type='text'
                inputMode='numeric'
                pattern='[0-9]*'
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder='· · · · · ·'
                autoFocus
                className="ui-input ui-otp-input admin-otp-input h-12 text-xl text-center font-mono tracking-[0.5em] rounded-lg border-ui-line dark:border-ui-line dark:bg-ui-surface dark:text-ui-text focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-400 focus-visible:ring-offset-0 transition-all"
              />
              <div className="flex items-center justify-center gap-1.5 pt-0.5" aria-hidden='true'>
                {(['p0', 'p1', 'p2', 'p3', 'p4', 'p5'] as const).map((id, i) => (
                  <div
                    key={id}
                    className={`h-1 w-1 rounded-full transition-all duration-200 ${
                      i < code.length
                        ? "bg-ui-text dark:bg-ui-soft scale-125"
                        : "bg-ui-soft dark:bg-ui-soft"
                    }  `}
                  />
                ))}
              </div>
            </div>

            <Button data-ui-variant="default"
              type='submit'
              className="ui-control admin-btn-primary w-full h-9 text-xs font-semibold rounded-lg bg-ui-text hover:bg-ui-text dark:bg-ui-soft dark:text-ui-muted dark:hover:bg-ui-soft text-white transition-all duration-150 disabled:opacity-40"
              disabled={code.length !== 6 || loading}
            >
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Verifying…
                </span>
              ) : (
                'Verify'
              )}
            </Button>

            <button
              type='button'
              className="w-full text-xs text-ui-muted hover:text-ui-text dark:hover:text-ui-text transition-colors py-1.5 rounded-lg hover:bg-ui-soft dark:hover:bg-ui-surface/50"
              onClick={() => {
                setChallengeId(null);
                setCode('');
              }}
            >
              ← Back
            </button>
          </form>
        )}

        <ErrorMsg message={error} />
      </AuthCard>
    </AuthShell>
  );
}

interface TotpSetupScreenProps {
  setupToken: string;
  onComplete: () => void;
  error: string;
  onError: (msg: string) => void;
}

function TotpSetupScreen({
  setupToken,
  onComplete,
  error,
  onError,
}: TotpSetupScreenProps) {
  const [setup, setSetup] = useState<TotpSetupResponse | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingSetup, setLoadingSetup] = useState(true);

  useEffect(() => {
    const normalizedSetupToken = normalizeAdminCredential(setupToken);
    if (!normalizedSetupToken) {
      setSetup(null);
      setLoadingSetup(false);
      onError('Invalid setup token');
      return;
    }

    setLoadingSetup(true);
    getTotpSetup(normalizedSetupToken)
      .then(setSetup)
      .catch((err: unknown) =>
        onError(err instanceof Error ? err.message : 'Failed to load setup')
      )
      .finally(() => setLoadingSetup(false));
  }, [setupToken, onError]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedSetupToken = normalizeAdminCredential(setupToken);
    if (code.length !== 6 || !setup || !normalizedSetupToken) return;
    setLoading(true);
    try {
      await verifyTotpSetup(code, normalizedSetupToken);
      onComplete();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Setup verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <AuthCard>
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 dark:bg-emerald-900/40">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-sm font-semibold text-ui-text dark:text-ui-text">
              Setup Authenticator
            </h1>
          </div>
          <p className="text-xs text-ui-muted dark:text-ui-muted leading-relaxed pl-8">
            Scan the QR code or enter the manual key, then confirm with your app.
          </p>
        </div>

        {loadingSetup ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <RefreshCw className="h-5 w-5 animate-spin text-ui-muted" />
            <span className="text-xs text-ui-muted">Loading setup…</span>
          </div>
        ) : setup ? (
          <div className="space-y-4">
            {setup.qrDataUrl && (
              <div className="flex justify-center">
                <div className="inline-flex flex-col items-center gap-2">
                  <div className="rounded-xl border border-ui-line dark:border-ui-line bg-ui-surface p-3">
                    <img
                      src={setup.qrDataUrl}
                      alt='TOTP QR Code — scan with your authenticator app'
                      className="h-40 w-40"
                    />
                  </div>
                  <span className="text-xs text-ui-muted">Scan with your app</span>
                </div>
              </div>
            )}

            {setup.secret && (
              <div className="rounded-lg border border-ui-line dark:border-ui-line bg-ui-soft dark:bg-ui-surface/50 px-3 py-2.5">
                <p className="text-xs text-ui-muted dark:text-ui-muted mb-1">Manual entry key</p>
                <p className="font-mono text-xs text-ui-text dark:text-ui-text break-all select-all leading-relaxed">
                  {setup.secret}
                </p>
              </div>
            )}

            <form onSubmit={handleVerify} className="space-y-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor='setup-code'
                  className="ui-label text-xs font-medium text-ui-muted dark:text-ui-muted"
                >
                  Confirm code
                </Label>
                <Input
                  id='setup-code'
                  type='text'
                  inputMode='numeric'
                  pattern='[0-9]*'
                  maxLength={6}
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder='· · · · · ·'
                  autoFocus
                  className="ui-input ui-otp-input admin-otp-input h-12 text-xl text-center font-mono tracking-[0.5em] rounded-lg border-ui-line dark:border-ui-line dark:bg-ui-surface dark:text-ui-text focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-0 transition-all"
                />
                <div className="flex items-center justify-center gap-1.5 pt-0.5" aria-hidden='true'>
                  {(['p0', 'p1', 'p2', 'p3', 'p4', 'p5'] as const).map((id, i) => (
                    <div
                      key={id}
                      className={`h-1 w-1 rounded-full transition-all duration-200 ${
                        i < code.length
                          ? 'bg-emerald-600 dark:bg-emerald-400 scale-125'
                          : "bg-ui-soft dark:bg-ui-soft"
                      }  `}
                    />
                  ))}
                </div>
              </div>

              <Button data-ui-variant="default"
                type='submit'
                className="ui-control w-full h-9 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all duration-150 disabled:opacity-40"
                disabled={code.length !== 6 || loading}
              >
                {loading ? (
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Verifying…
                  </span>
                ) : (
                  'Complete Setup'
                )}
              </Button>
            </form>
          </div>
        ) : null}

        <ErrorMsg message={error} />
      </AuthCard>
    </AuthShell>
  );
}

function PageLoadingState() {
  return (
    <AuthShell>
      <AuthCard>
        <h1>관리자 화면 준비</h1>
        <p className="ui-status-line" role="status" aria-live="polite">
          <RefreshCw className="ui-spinner" aria-hidden="true" />
          관리자 세션과 인증 상태를 확인하고 있습니다.
        </p>
      </AuthCard>
    </AuthShell>
  );
}

export default function AdminConfig() {
  const [step, setStep] = useState<AuthStep>('initial-gate');
  const [error, setError] = useState('');
  const [pageLoading, setPageLoading] = useState(true);
  const [gateLoading, setGateLoading] = useState(false);
  const [sessionValidationLoading, setSessionValidationLoading] =
    useState(false);
  const [setupToken, setSetupToken] = useState('');
  const sessionValidationInFlightRef = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isLoginRoute = location.pathname === '/admin/login';
  const locationState = location.state as { from?: string } | null;
  const requestedPath =
    typeof locationState?.from === 'string' ? locationState.from : null;

  const { isAuthenticated, getValidAccessToken, logout, user, setTokens } =
    useAuthStore();

  const resolveEntryStep = useCallback(async () => {
    const status = await getTotpSetupStatus();
    setSetupToken('');
    setError('');
    setStep(status.setupComplete ? 'totp-login' : 'initial-gate');
  }, []);

  useEffect(() => {
    if (isLoginRoute) {
      rememberAdminReturnPath(requestedPath);
    }
  }, [isLoginRoute, requestedPath]);

  const checkAuth = useCallback(
    async (manualRetry = false) => {
      if (sessionValidationInFlightRef.current) return;
      sessionValidationInFlightRef.current = true;
      if (manualRetry) {
        setSessionValidationLoading(true);
      }

      try {
        if (isAuthenticated()) {
          const token = await getValidAccessToken();
          const normalizedToken = normalizeAdminCredential(token);
          if (normalizedToken) {
            try {
              await getMe(normalizedToken);
              setStep('authenticated');
              scheduleTokenRefresh();
              setPageLoading(false);
              return;
            } catch (err) {
              if (!isDefinitiveAuthRejection(err)) {
                setStep('session-validation-error');
                setPageLoading(false);
                return;
              }
              await logout();
            }
          }
        }

        try {
          await resolveEntryStep();
        } catch (err) {
          setStep('initial-gate');
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load admin auth status'
          );
        } finally {
          setPageLoading(false);
        }
      } finally {
        setSessionValidationLoading(false);
        sessionValidationInFlightRef.current = false;
      }
    },
    [getValidAccessToken, isAuthenticated, logout, resolveEntryStep]
  );

  useEffect(() => {
    migrateFromLegacyStorage();

    void checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (step !== 'authenticated' || !isLoginRoute) {
      return;
    }

    navigate(consumeAdminReturnPath(requestedPath), { replace: true });
  }, [isLoginRoute, navigate, requestedPath, step]);

  const handleServerKeySubmit = useCallback(async (key: string) => {
    const normalizedKey = normalizeAdminCredential(key);
    if (!normalizedKey) {
      setError('Invalid setup token');
      return;
    }

    setGateLoading(true);
    setError('');
    try {
      const setup = await getTotpSetup(normalizedKey);
      if (setup.setupComplete) {
        setSetupToken('');
        setStep('totp-login');
      } else {
        setSetupToken(normalizedKey);
        setStep('totp-setup');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate key');
    } finally {
      setGateLoading(false);
    }
  }, []);

  const handleTotpSuccess = useCallback(
    (response: TotpVerifyResponse) => {
      const userInfo = { ...response.user };
      const accepted = setTokens(
        response.accessToken,
        response.refreshToken,
        userInfo
      );
      if (!accepted) {
        setError('Invalid authentication response');
        return;
      }
      setError('');
      setStep('authenticated');
    },
    [setTokens]
  );

  const handleSetupComplete = useCallback(() => {
    setError('');
    setStep('totp-login');
  }, []);

  const handleError = useCallback((msg: string) => {
    setError(msg);
  }, []);

  const handleSessionValidationRetry = useCallback(() => {
    void checkAuth(true);
  }, [checkAuth]);

  const handleLogout = useCallback(async () => {
    await logout();
    try {
      await resolveEntryStep();
    } catch (err) {
      setStep('initial-gate');
      setSetupToken('');
      setError(
        err instanceof Error ? err.message : 'Failed to load admin auth status'
      );
    }
  }, [logout, resolveEntryStep]);

  if (pageLoading) return <PageLoadingState />;

  if (step === 'session-validation-error') {
    return (
      <SessionValidationErrorScreen
        loading={sessionValidationLoading}
        onRetry={handleSessionValidationRetry}
      />
    );
  }

  if (step === 'initial-gate') {
    return (
      <InitialGateScreen
        onServerKeySubmit={handleServerKeySubmit}
        loading={gateLoading}
        error={error}
      />
    );
  }

  if (step === 'totp-setup') {
    return (
      <TotpSetupScreen
        setupToken={setupToken}
        onComplete={handleSetupComplete}
        error={error}
        onError={handleError}
      />
    );
  }

  if (step === 'totp-login') {
    return (
      <TotpLoginScreen
        onSuccess={handleTotpSuccess}
        error={error}
        onError={handleError}
      />
    );
  }

  if (isLoginRoute) {
    return <PageLoadingState />;
  }

  return <AdminDashboard userEmail={user?.email} onLogout={handleLogout} />;
}
