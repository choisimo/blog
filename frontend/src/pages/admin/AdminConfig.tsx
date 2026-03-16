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
  Terminal,
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

// ─── Design Tokens ────────────────────────────────────────────────────────────
// Easing: spring feel for interactive state transitions
// spring: cubic-bezier(0.34, 1.56, 0.64, 1) — overshoot
// smooth: cubic-bezier(0.4, 0, 0.2, 1)       — material
// All animations use transform/opacity only (no layout thrashing)
// ─────────────────────────────────────────────────────────────────────────────

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

// ─── Error Message ────────────────────────────────────────────────────────────
function ErrorMsg({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      className='admin-error-msg mt-4 flex items-start gap-2 rounded-lg border border-red-200/80 bg-red-50/80 px-3 py-2.5 dark:border-red-900/40 dark:bg-red-950/30'
      role='alert'
      aria-live='polite'
    >
      <div className='mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500' aria-hidden='true'>
        <svg viewBox='0 0 16 16' fill='currentColor' aria-hidden='true'>
          <title>Error</title>
          <path d='M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 3.75a.75.75 0 011.5 0v4a.75.75 0 01-1.5 0v-4zm.75 7a.875.875 0 110-1.75.875.875 0 010 1.75z' />
        </svg>
      </div>
      <p className='text-xs font-mono text-red-700 dark:text-red-400 leading-relaxed break-all'>
        {message}
      </p>
    </div>
  );
}

// ─── Auth Shell ───────────────────────────────────────────────────────────────
function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className='admin-auth-shell min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4'>
      {/* Subtle grid background */}
      <div
        className='pointer-events-none fixed inset-0 opacity-[0.015] dark:opacity-[0.04]'
        style={{
          backgroundImage:
            'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
        aria-hidden='true'
      />
      <div className='admin-auth-card-wrapper w-full max-w-sm'>
        {/* Brand badge */}
        <div className='flex items-center gap-2 justify-center mb-5'>
          <div className='admin-brand-icon flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-100 shadow-sm'>
            <Terminal className='h-3.5 w-3.5 text-white dark:text-zinc-900' />
          </div>
          <span className='text-sm font-bold text-zinc-800 dark:text-zinc-100 tracking-tight'>
            noblog
            <span className='ml-1 text-xs font-semibold text-zinc-400 dark:text-zinc-500'>
              admin
            </span>
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Card Shell (shared between auth forms) ───────────────────────────────────
function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className='admin-auth-card relative overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900'>
      {/* Top edge accent line */}
      <div
        className='absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-400/30 to-transparent dark:via-zinc-600/40'
        aria-hidden='true'
      />
      <div className='px-6 py-5'>{children}</div>
    </div>
  );
}

// ─── Initial Gate Screen ──────────────────────────────────────────────────────
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
      <AuthCard>
        {/* Header */}
        <div className='mb-5'>
          <div className='flex items-center gap-2 mb-1.5'>
            <div className='flex h-6 w-6 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800'>
              <ShieldCheck className='h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400' />
            </div>
            <h1 className='text-sm font-semibold text-zinc-900 dark:text-zinc-100'>
              Server Access Key
            </h1>
          </div>
          <p className='text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed pl-8'>
            Enter the{' '}
            <code className='font-mono text-xs text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded'>
              ADMIN_SETUP_TOKEN
            </code>{' '}
            to unlock first-time setup.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className='space-y-3'>
          <div className='space-y-1.5'>
            <Label
              htmlFor='server-key'
              className='text-xs font-medium text-zinc-600 dark:text-zinc-400'
            >
              Access key
            </Label>
            <div className='relative'>
              <Lock className='pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400' />
              <Input
                id='server-key'
                type='password'
                value={key}
                onChange={e => setKey(e.target.value)}
                placeholder='Paste token from server console'
                autoFocus
                autoComplete='off'
                className='admin-input h-9 pl-8 text-sm font-mono rounded-lg border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-400 focus-visible:ring-offset-0 transition-all'
              />
            </div>
          </div>

          <Button
            type='submit'
            className='admin-btn-primary w-full h-9 text-xs font-semibold rounded-lg bg-zinc-900 hover:bg-zinc-800 active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 text-white shadow-sm transition-all duration-150'
            disabled={!key.trim() || loading}
          >
            {loading ? (
              <span className='flex items-center gap-1.5'>
                <RefreshCw className='h-3 w-3 animate-spin' />
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

// ─── TOTP Login Screen ────────────────────────────────────────────────────────
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
      <AuthCard>
        {/* Header */}
        <div className='mb-5'>
          <div className='flex items-center gap-2 mb-1.5'>
            <div className='flex h-6 w-6 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800'>
              <Lock className='h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400' />
            </div>
            <h1 className='text-sm font-semibold text-zinc-900 dark:text-zinc-100'>
              Authenticator
            </h1>
          </div>
          <p className='text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed pl-8'>
            {challengeId
              ? 'Enter the 6-digit code from your authenticator app.'
              : 'Request a challenge token to continue.'}
          </p>
        </div>

        {!challengeId ? (
          <Button
            className='admin-btn-primary w-full h-9 text-xs font-semibold rounded-lg bg-zinc-900 hover:bg-zinc-800 active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 text-white shadow-sm transition-all duration-150'
            onClick={handleGetChallenge}
            disabled={loading}
          >
            {loading ? (
              <span className='flex items-center gap-1.5'>
                <RefreshCw className='h-3 w-3 animate-spin' />
                Loading…
              </span>
            ) : (
              'Get Challenge'
            )}
          </Button>
        ) : (
          <form onSubmit={handleVerify} className='space-y-3'>
            <div className='space-y-1.5'>
              <Label
                htmlFor='totp-code'
                className='text-xs font-medium text-zinc-600 dark:text-zinc-400'
              >
                TOTP code
              </Label>
              {/* OTP-style segmented look via wide tracking */}
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
                className='admin-otp-input h-12 text-xl text-center font-mono tracking-[0.5em] rounded-lg border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-400 focus-visible:ring-offset-0 transition-all'
              />
              {/* Progress dots */}
              <div className='flex items-center justify-center gap-1.5 pt-0.5' aria-hidden='true'>
                {(['p0', 'p1', 'p2', 'p3', 'p4', 'p5'] as const).map((id, i) => (
                  <div
                    key={id}
                    className={`h-1 w-1 rounded-full transition-all duration-200 ${
                      i < code.length
                        ? 'bg-zinc-900 dark:bg-zinc-200 scale-125'
                        : 'bg-zinc-200 dark:bg-zinc-700'
                    }`}
                  />
                ))}
              </div>
            </div>

            <Button
              type='submit'
              className='admin-btn-primary w-full h-9 text-xs font-semibold rounded-lg bg-zinc-900 hover:bg-zinc-800 active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 text-white shadow-sm transition-all duration-150 disabled:opacity-40'
              disabled={code.length !== 6 || loading}
            >
              {loading ? (
                <span className='flex items-center gap-1.5'>
                  <RefreshCw className='h-3 w-3 animate-spin' />
                  Verifying…
                </span>
              ) : (
                'Verify'
              )}
            </Button>

            <button
              type='button'
              className='w-full text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors py-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
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

// ─── TOTP Setup Screen ────────────────────────────────────────────────────────
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
      <AuthCard>
        {/* Header */}
        <div className='mb-5'>
          <div className='flex items-center gap-2 mb-1.5'>
            <div className='flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 dark:bg-emerald-900/40'>
              <ShieldCheck className='h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400' />
            </div>
            <h1 className='text-sm font-semibold text-zinc-900 dark:text-zinc-100'>
              Setup Authenticator
            </h1>
          </div>
          <p className='text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed pl-8'>
            Scan the QR code or enter the manual key, then confirm with your app.
          </p>
        </div>

        {loadingSetup ? (
          <div className='flex flex-col items-center justify-center py-10 gap-2'>
            <RefreshCw className='h-5 w-5 animate-spin text-zinc-400' />
            <span className='text-xs text-zinc-400'>Loading setup…</span>
          </div>
        ) : setup ? (
          <div className='space-y-4'>
            {/* QR Code */}
            {setup.qrDataUrl && (
              <div className='flex justify-center'>
                <div className='inline-flex flex-col items-center gap-2'>
                  <div className='rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white p-3 shadow-sm'>
                    <img
                      src={setup.qrDataUrl}
                      alt='TOTP QR Code — scan with your authenticator app'
                      className='h-40 w-40'
                    />
                  </div>
                  <span className='text-xs text-zinc-400'>Scan with your app</span>
                </div>
              </div>
            )}

            {/* Manual Key */}
            {setup.secret && (
              <div className='rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2.5'>
                <p className='text-xs text-zinc-500 dark:text-zinc-400 mb-1'>Manual entry key</p>
                <p className='font-mono text-xs text-zinc-700 dark:text-zinc-300 break-all select-all leading-relaxed'>
                  {setup.secret}
                </p>
              </div>
            )}

            {/* Verify Form */}
            <form onSubmit={handleVerify} className='space-y-3'>
              <div className='space-y-1.5'>
                <Label
                  htmlFor='setup-code'
                  className='text-xs font-medium text-zinc-600 dark:text-zinc-400'
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
                  className='admin-otp-input h-12 text-xl text-center font-mono tracking-[0.5em] rounded-lg border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-0 transition-all'
                />
                {/* Progress dots */}
                <div className='flex items-center justify-center gap-1.5 pt-0.5' aria-hidden='true'>
                  {(['p0', 'p1', 'p2', 'p3', 'p4', 'p5'] as const).map((id, i) => (
                    <div
                      key={id}
                      className={`h-1 w-1 rounded-full transition-all duration-200 ${
                        i < code.length
                          ? 'bg-emerald-600 dark:bg-emerald-400 scale-125'
                          : 'bg-zinc-200 dark:bg-zinc-700'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <Button
                type='submit'
                className='w-full h-9 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white shadow-sm transition-all duration-150 disabled:opacity-40'
                disabled={code.length !== 6 || loading}
              >
                {loading ? (
                  <span className='flex items-center gap-1.5'>
                    <RefreshCw className='h-3 w-3 animate-spin' />
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

// ─── Nav Tab Definition ───────────────────────────────────────────────────────
const NAV_TABS: {
  id: NavTab;
  label: string;
  icon: React.ReactNode;
  group?: 'infra' | 'ops' | 'config';
}[] = [
  {
    id: 'health',
    label: 'Health',
    icon: <Activity className='h-3.5 w-3.5' />,
    group: 'infra',
  },
  {
    id: 'rag',
    label: 'RAG',
    icon: <Database className='h-3.5 w-3.5' />,
    group: 'infra',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: <BarChart3 className='h-3.5 w-3.5' />,
    group: 'ops',
  },
  {
    id: 'logs',
    label: 'Logs',
    icon: <ScrollText className='h-3.5 w-3.5' />,
    group: 'ops',
  },
  {
    id: 'ai',
    label: 'AI',
    icon: <Bot className='h-3.5 w-3.5' />,
    group: 'config',
  },
  {
    id: 'config',
    label: 'Env',
    icon: <Settings className='h-3.5 w-3.5' />,
    group: 'config',
  },
  {
    id: 'secrets',
    label: 'Secrets',
    icon: <Key className='h-3.5 w-3.5' />,
    group: 'config',
  },
  {
    id: 'workers',
    label: 'Workers',
    icon: <Cloud className='h-3.5 w-3.5' />,
    group: 'config',
  },
];

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
interface AdminDashboardProps {
  userEmail?: string;
  onLogout: () => void;
}

function AdminDashboard({ userEmail, onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<NavTab>('health');

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-zinc-950'>
      {/* ── Sticky Top Bar ── */}
      <header className='sticky top-0 z-20 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm'>
        <div className='flex items-center justify-between px-3 h-11'>
          {/* Left: Brand + Nav */}
          <div className='flex items-center gap-1 min-w-0'>
            {/* Brand */}
            <div className='flex items-center gap-1.5 mr-2 shrink-0'>
              <div className='flex h-6 w-6 items-center justify-center rounded-md bg-zinc-900 dark:bg-zinc-100'>
                <Server className='h-3 w-3 text-white dark:text-zinc-900' />
              </div>
              <span className='text-xs font-bold text-zinc-800 dark:text-zinc-200 tracking-tight hidden sm:inline'>
                noblog admin
              </span>
            </div>

            {/* Divider */}
            <div className='h-4 w-px bg-zinc-200 dark:bg-zinc-700 shrink-0 hidden sm:block' aria-hidden='true' />

            {/* Nav tabs — scrollable on narrow screens */}
            <nav
              className='flex items-center gap-0.5 overflow-x-auto scrollbar-hide'
              aria-label='Admin navigation'
            >
              {NAV_TABS.map(tab => (
                <button
                  key={tab.id}
                  type='button'
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={activeTab === tab.id ? 'page' : undefined}
                  className={`
                    admin-nav-btn
                    relative flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md
                    whitespace-nowrap min-h-[32px] min-w-[32px]
                    transition-all duration-150
                    outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-400 focus-visible:ring-offset-1
                    ${
                      activeTab === tab.id
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95'
                    }
                  `}
                >
                  {tab.icon}
                  <span className='hidden md:inline'>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Right: User + Logout */}
          <div className='flex items-center gap-1.5 shrink-0 ml-2'>
            {userEmail && (
              <span className='hidden sm:inline font-mono text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700 max-w-[160px] truncate'>
                {userEmail}
              </span>
            )}
            <button
              type='button'
              onClick={onLogout}
              aria-label='Logout'
              className='flex items-center gap-1 text-xs text-zinc-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 transition-colors min-h-[32px] px-2 py-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1 outline-none'
            >
              <LogOut className='h-3.5 w-3.5' />
              <span className='hidden sm:inline'>Logout</span>
            </button>
          </div>
        </div>

        {/* ── Mobile: active tab label indicator ── */}
        <div className='sm:hidden flex items-center gap-1.5 px-3 pb-2'>
          <span className='text-xs text-zinc-400 dark:text-zinc-500'>
            {NAV_TABS.find(t => t.id === activeTab)?.icon}
          </span>
          <span className='text-xs font-medium text-zinc-700 dark:text-zinc-300 capitalize'>
            {NAV_TABS.find(t => t.id === activeTab)?.label}
          </span>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className='p-3 md:p-4 max-w-screen-2xl mx-auto'>
        {/* Tab content with fade-in on switch */}
        <div className='admin-tab-content'>
          {activeTab === 'health' && <SystemHealth />}
          {activeTab === 'rag' && <RAGManager />}
          {activeTab === 'analytics' && <AnalyticsManager />}
          {activeTab === 'logs' && <LogViewer />}
          {activeTab === 'ai' && <AIManager />}
          {activeTab === 'config' && <ConfigManager />}
          {activeTab === 'secrets' && <SecretsManager />}
          {activeTab === 'workers' && <WorkersManager />}
        </div>
      </main>
    </div>
  );
}

// ─── Page Loading Skeleton ────────────────────────────────────────────────────
function PageLoadingState() {
  return (
    <div
      className='min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center'
    >
      <div className='flex flex-col items-center gap-3'>
        <RefreshCw className='h-5 w-5 animate-spin text-zinc-400' />
        <span className='text-xs text-zinc-400 font-mono'>Initializing…</span>
      </div>
    </div>
  );
}

// ─── Root Component ───────────────────────────────────────────────────────────
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

  if (pageLoading) return <PageLoadingState />;

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

  return <AdminDashboard userEmail={user?.email} onLogout={handleLogout} />;
}
