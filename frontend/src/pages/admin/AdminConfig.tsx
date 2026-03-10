import { useState, useEffect, useCallback } from 'react';
import { ConfigManager } from '@/components/features/admin/ConfigManager';
import { WorkersManager } from '@/components/features/admin/WorkersManager';
import { AIManager } from '@/components/features/admin/ai';
import { SecretsManager } from '@/components/features/admin/secrets';
import { RAGManager } from '@/components/features/admin/rag';
import { SystemHealth } from '@/components/features/admin/health';
import { AnalyticsManager } from '@/components/features/admin/analytics';
import { LogViewer } from '@/components/features/admin/logs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Lock,
  Settings,
  Cloud,
  Bot,
  Key,
  RefreshCw,
  Database,
  Activity,
  BarChart3,
  LogOut,
  ShieldCheck,
  Server,
  ScrollText,
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

type AuthStep = 'initial-gate' | 'totp-login' | 'totp-setup' | 'authenticated';

type NavTab =
  | 'health'
  | 'rag'
  | 'analytics'
  | 'logs'
  | 'ai'
  | 'config'
  | 'secrets'
  | 'workers';

function ErrorMsg({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p className='mt-3 text-xs text-red-600 font-mono bg-red-50 border border-red-200 rounded-md px-3 py-2'>
      {message}
    </p>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className='min-h-screen bg-zinc-50 flex items-center justify-center p-4'>
      <div className='w-full max-w-sm'>
        <div className='flex items-center gap-2 justify-center mb-6'>
          <Server className='h-4 w-4 text-zinc-500' />
          <span className='text-sm font-semibold text-zinc-700 tracking-tight'>
            noblog admin
          </span>
        </div>
        {children}
      </div>
    </div>
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
    if (!key.trim()) return;
    await onServerKeySubmit(key.trim());
  };

  return (
    <AuthShell>
      <div className='bg-white border border-zinc-200 rounded-lg p-6'>
        <div className='mb-5'>
          <div className='flex items-center gap-2 mb-1'>
            <ShieldCheck className='h-4 w-4 text-zinc-500' />
            <h1 className='text-sm font-semibold text-zinc-900'>
              Server Access Key
            </h1>
          </div>
          <p className='text-xs text-zinc-500 leading-relaxed'>
            TOTP is not configured yet. Enter the{' '}
            <code className='font-mono text-xs text-zinc-600 bg-zinc-100 px-1 py-0.5 rounded'>
              ADMIN_SETUP_TOKEN
            </code>{' '}
            configured for the API gateway to unlock first-time setup.
          </p>
        </div>
        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='space-y-1.5'>
            <Label
              htmlFor='server-key'
              className='text-xs font-medium text-zinc-700'
            >
              Access key
            </Label>
            <Input
              id='server-key'
              type='password'
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder='Paste token from server console'
              autoFocus
              autoComplete='off'
              className='h-8 text-sm rounded-md border-zinc-200 focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1 font-mono'
            />
          </div>
          <Button
            type='submit'
            className='w-full h-8 text-xs font-medium rounded-md bg-zinc-900 hover:bg-zinc-800 text-white'
            disabled={!key.trim() || loading}
          >
            {loading ? (
              <>
                <RefreshCw className='mr-1.5 h-3 w-3 animate-spin' />
                Verifying...
              </>
            ) : (
              'Continue'
            )}
          </Button>
        </form>
        <ErrorMsg message={error} />
      </div>
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

  const handleGetChallenge = async () => {
    setLoading(true);
    try {
      const result = await initiateTotpChallenge();
      setChallengeId(result.challengeId);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to get challenge');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeId || code.length !== 6) return;
    setLoading(true);
    try {
      const response = await verifyTotpCode(challengeId, code);
      onSuccess(response);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className='bg-white border border-zinc-200 rounded-lg p-6'>
        <div className='mb-5'>
          <div className='flex items-center gap-2 mb-1'>
            <Lock className='h-4 w-4 text-zinc-500' />
            <h1 className='text-sm font-semibold text-zinc-900'>
              Authenticator
            </h1>
          </div>
          <p className='text-xs text-zinc-500'>
            {challengeId
              ? 'Enter the 6-digit code from your authenticator app.'
              : 'Generate a challenge to continue.'}
          </p>
        </div>

        {!challengeId ? (
          <Button
            className='w-full h-8 text-xs font-medium rounded-md bg-zinc-900 hover:bg-zinc-800 text-white'
            onClick={handleGetChallenge}
            disabled={loading}
          >
            {loading ? (
              <>
                <RefreshCw className='mr-1.5 h-3 w-3 animate-spin' />
                Loading...
              </>
            ) : (
              'Get Challenge'
            )}
          </Button>
        ) : (
          <form onSubmit={handleVerify} className='space-y-4'>
            <div className='space-y-1.5'>
              <Label
                htmlFor='totp-code'
                className='text-xs font-medium text-zinc-700'
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
                placeholder='000000'
                autoFocus
                className='h-8 text-sm text-center font-mono tracking-[0.3em] rounded-md border-zinc-200 focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1'
              />
            </div>
            <Button
              type='submit'
              className='w-full h-8 text-xs font-medium rounded-md bg-zinc-900 hover:bg-zinc-800 text-white'
              disabled={code.length !== 6 || loading}
            >
              {loading ? (
                <>
                  <RefreshCw className='mr-1.5 h-3 w-3 animate-spin' />
                  Verifying...
                </>
              ) : (
                'Verify'
              )}
            </Button>
            <button
              type='button'
              className='w-full text-xs text-zinc-400 hover:text-zinc-600 transition-colors py-1'
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
      </div>
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
    setLoadingSetup(true);
    getTotpSetup(setupToken)
      .then(setSetup)
      .catch((err: unknown) =>
        onError(err instanceof Error ? err.message : 'Failed to load setup')
      )
      .finally(() => setLoadingSetup(false));
  }, [setupToken, onError]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6 || !setup) return;
    setLoading(true);
    try {
      await verifyTotpSetup(code, setupToken);
      onComplete();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Setup verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className='bg-white border border-zinc-200 rounded-lg p-6'>
        <div className='mb-5'>
          <div className='flex items-center gap-2 mb-1'>
            <ShieldCheck className='h-4 w-4 text-zinc-500' />
            <h1 className='text-sm font-semibold text-zinc-900'>
              Setup Authenticator
            </h1>
          </div>
          <p className='text-xs text-zinc-500 leading-relaxed'>
            Scan the QR code if available, or use the manual key below, then
            enter the code to confirm.
          </p>
        </div>

        {loadingSetup ? (
          <div className='flex items-center justify-center py-8'>
            <RefreshCw className='h-5 w-5 animate-spin text-zinc-400' />
          </div>
        ) : setup ? (
          <div className='space-y-4'>
            {setup.qrDataUrl && (
              <div className='flex justify-center py-2'>
                <div className='border border-zinc-200 rounded-md p-2 bg-white'>
                  <img
                    src={setup.qrDataUrl}
                    alt='TOTP QR Code'
                    className='w-40 h-40'
                  />
                </div>
              </div>
            )}
            {setup.secret && (
              <div className='space-y-1'>
                <p className='text-xs text-zinc-500'>Manual entry key</p>
                <p className='font-mono text-xs text-zinc-600 bg-zinc-100 px-2 py-1.5 rounded-md break-all select-all'>
                  {setup.secret}
                </p>
              </div>
            )}
            <form onSubmit={handleVerify} className='space-y-3'>
              <div className='space-y-1.5'>
                <Label
                  htmlFor='setup-code'
                  className='text-xs font-medium text-zinc-700'
                >
                  Verify code
                </Label>
                <Input
                  id='setup-code'
                  type='text'
                  inputMode='numeric'
                  pattern='[0-9]*'
                  maxLength={6}
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder='000000'
                  autoFocus
                  className='h-8 text-sm text-center font-mono tracking-[0.3em] rounded-md border-zinc-200 focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1'
                />
              </div>
              <Button
                type='submit'
                className='w-full h-8 text-xs font-medium rounded-md bg-zinc-900 hover:bg-zinc-800 text-white'
                disabled={code.length !== 6 || loading}
              >
                {loading ? (
                  <>
                    <RefreshCw className='mr-1.5 h-3 w-3 animate-spin' />
                    Verifying...
                  </>
                ) : (
                  'Complete Setup'
                )}
              </Button>
            </form>
          </div>
        ) : null}

        <ErrorMsg message={error} />
      </div>
    </AuthShell>
  );
}

const NAV_TABS: { id: NavTab; label: string; icon: React.ReactNode }[] = [
  { id: 'health', label: 'Health', icon: <Activity className='h-3.5 w-3.5' /> },
  { id: 'rag', label: 'RAG', icon: <Database className='h-3.5 w-3.5' /> },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: <BarChart3 className='h-3.5 w-3.5' />,
  },
  { id: 'logs', label: 'Logs', icon: <ScrollText className='h-3.5 w-3.5' /> },
  { id: 'ai', label: 'AI', icon: <Bot className='h-3.5 w-3.5' /> },
  { id: 'config', label: 'Env', icon: <Settings className='h-3.5 w-3.5' /> },
  { id: 'secrets', label: 'Secrets', icon: <Key className='h-3.5 w-3.5' /> },
  { id: 'workers', label: 'Workers', icon: <Cloud className='h-3.5 w-3.5' /> },
];

interface AdminDashboardProps {
  userEmail?: string;
  onLogout: () => void;
}

function AdminDashboard({ userEmail, onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<NavTab>('health');

  return (
    <div className='min-h-screen bg-zinc-50'>
      {/* Top bar */}
      <header className='bg-white border-b border-zinc-200 sticky top-0 z-10'>
        <div className='flex items-center justify-between px-4 h-10'>
          <div className='flex items-center gap-3'>
            <div className='flex items-center gap-1.5'>
              <Server className='h-3.5 w-3.5 text-zinc-500' />
              <span className='text-xs font-semibold text-zinc-800 tracking-tight'>
                noblog admin
              </span>
            </div>
            <span className='text-zinc-200 text-sm'>|</span>
            {/* Nav tabs */}
            <nav className='flex items-center gap-0.5'>
              {NAV_TABS.map(tab => (
                <button
                  key={tab.id}
                  type='button'
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-colors ${
                    activeTab === tab.id
                      ? 'bg-zinc-900 text-white font-medium'
                      : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
          <div className='flex items-center gap-2'>
            {userEmail && (
              <span className='font-mono text-xs text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded'>
                {userEmail}
              </span>
            )}
            <button
              type='button'
              onClick={onLogout}
              className='flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 transition-colors px-1.5 py-0.5 rounded hover:bg-zinc-100'
            >
              <LogOut className='h-3 w-3' />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className='p-4'>
        {activeTab === 'health' && <SystemHealth />}
        {activeTab === 'rag' && <RAGManager />}
        {activeTab === 'analytics' && <AnalyticsManager />}
        {activeTab === 'logs' && <LogViewer />}
        {activeTab === 'ai' && <AIManager />}
        {activeTab === 'config' && <ConfigManager />}
        {activeTab === 'secrets' && <SecretsManager />}
        {activeTab === 'workers' && <WorkersManager />}
      </main>
    </div>
  );
}

export default function AdminConfig() {
  const [step, setStep] = useState<AuthStep>('initial-gate');
  const [error, setError] = useState('');
  const [pageLoading, setPageLoading] = useState(true);
  const [gateLoading, setGateLoading] = useState(false);
  const [setupToken, setSetupToken] = useState('');

  const { isAuthenticated, getValidAccessToken, logout, user, setTokens } =
    useAuthStore();

  const resolveEntryStep = useCallback(async () => {
    const status = await getTotpSetupStatus();
    setSetupToken('');
    setError('');
    setStep(status.setupComplete ? 'totp-login' : 'initial-gate');
  }, []);

  useEffect(() => {
    migrateFromLegacyStorage();

    const checkAuth = async () => {
      if (isAuthenticated()) {
        const token = await getValidAccessToken();
        if (token) {
          try {
            await getMe(token);
            setStep('authenticated');
            scheduleTokenRefresh();
            setPageLoading(false);
            return;
          } catch {
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
    };

    void checkAuth();
  }, [getValidAccessToken, isAuthenticated, logout, resolveEntryStep]);

  const handleServerKeySubmit = useCallback(async (key: string) => {
    setGateLoading(true);
    setError('');
    try {
      const setup = await getTotpSetup(key);
      if (setup.setupComplete) {
        setSetupToken('');
        setStep('totp-login');
      } else {
        setSetupToken(key);
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
      setTokens(response.accessToken, response.refreshToken, userInfo);
      scheduleTokenRefresh();
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

  if (pageLoading) {
    return (
      <div className='min-h-screen bg-zinc-50 flex items-center justify-center'>
        <RefreshCw className='h-5 w-5 animate-spin text-zinc-400' />
      </div>
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

  // authenticated
  return <AdminDashboard userEmail={user?.email} onLogout={handleLogout} />;
}
