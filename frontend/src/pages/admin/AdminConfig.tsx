import { useState, useEffect, useCallback } from 'react';
import { ConfigManager } from '@/components/features/admin/ConfigManager';
import { WorkersManager } from '@/components/features/admin/WorkersManager';
import { AIManager } from '@/components/features/admin/ai';
import { SecretsManager } from '@/components/features/admin/secrets';
import { RAGManager } from '@/components/features/admin/rag';
import { SystemHealth } from '@/components/features/admin/health';
import { AnalyticsManager } from '@/components/features/admin/analytics';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Lock, Settings, Cloud, Bot, Key, ArrowLeft, RefreshCw, Database, Activity, BarChart3 } from 'lucide-react';
import {
  initiateTotpChallenge,
  verifyTotpCode,
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
import { getApiBaseUrl } from '@/utils/network/apiBase';

// ============================================================================
// Auth Step Types
// ============================================================================

type AuthStep = 'totp-login' | 'totp-setup' | 'authenticated';

// ============================================================================
// TOTP Login Screen
// ============================================================================

interface TotpLoginScreenProps {
  onSuccess: (response: TotpVerifyResponse) => void;
  onError: (error: string) => void;
}

function TotpLoginScreen({ onSuccess, onError }: TotpLoginScreenProps) {
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const apiBase = getApiBaseUrl();

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
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>Admin Authentication</CardTitle>
        <CardDescription>Sign in with TOTP or OAuth</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!challengeId ? (
          <Button className="w-full" onClick={handleGetChallenge} disabled={loading}>
            {loading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Sign in with Authenticator'
            )}
          </Button>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="totp-code">Authenticator Code</Label>
              <Input
                id="totp-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                autoFocus
                className="text-center text-2xl tracking-widest"
              />
            </div>
            <Button type="submit" className="w-full" disabled={code.length !== 6 || loading}>
              {loading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify'
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={() => { setChallengeId(null); setCode(''); }}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          </form>
        )}

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">or continue with</span>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => { window.location.href = `${apiBase}/api/v1/auth/oauth/github`; }}
        >
          Sign in with GitHub
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => { window.location.href = `${apiBase}/api/v1/auth/oauth/google`; }}
        >
          Sign in with Google
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// TOTP Setup Screen
// ============================================================================

interface TotpSetupScreenProps {
  onComplete: () => void;
  onError: (error: string) => void;
}

function TotpSetupScreen({ onComplete, onError }: TotpSetupScreenProps) {
  const [setup, setSetup] = useState<TotpSetupResponse | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getTotpSetup()
      .then(setSetup)
      .catch((err: unknown) => onError(err instanceof Error ? err.message : 'Failed to load setup'));
  }, [onError]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6 || !setup) return;
    setLoading(true);
    try {
      await verifyTotpSetup(code);
      onComplete();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Setup verification failed');
    } finally {
      setLoading(false);
    }
  };

  if (!setup) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>Setup Authenticator</CardTitle>
        <CardDescription>Scan this QR code with your authenticator app</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center">
          <img src={setup.qrDataUrl} alt="TOTP QR Code" className="w-48 h-48" />
        </div>
        <p className="text-xs text-center text-muted-foreground break-all font-mono">{setup.secret}</p>
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="setup-code">Verify Code</Label>
            <Input
              id="setup-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              autoFocus
              className="text-center text-2xl tracking-widest"
            />
          </div>
          <Button type="submit" className="w-full" disabled={code.length !== 6 || loading}>
            {loading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Complete Setup'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function AdminConfig() {
  const [step, setStep] = useState<AuthStep>('totp-login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const { isAuthenticated, getValidAccessToken, logout, user, setTokens } = useAuthStore();

  useEffect(() => {
    migrateFromLegacyStorage();

    const checkTotpSetup = async () => {
      try {
        const setup = await getTotpSetup();
        setStep(setup.setupComplete ? 'totp-login' : 'totp-setup');
      } catch {
        setStep('totp-login');
      }
    };

    const checkAuth = async () => {
      if (isAuthenticated()) {
        const token = await getValidAccessToken();
        if (token) {
          try {
            await getMe(token);
            setStep('authenticated');
            scheduleTokenRefresh();
          } catch {
            await logout();
            await checkTotpSetup();
          }
        } else {
          await checkTotpSetup();
        }
      } else {
        await checkTotpSetup();
      }
      setLoading(false);
    };

    checkAuth();
  }, [isAuthenticated, getValidAccessToken, logout]);

  const handleTotpSuccess = useCallback((response: TotpVerifyResponse) => {
    const userInfo = { ...response.user };
    setTokens(response.accessToken, response.refreshToken, userInfo);
    scheduleTokenRefresh();
    setError('');
    setStep('authenticated');
  }, [setTokens]);

  const handleSetupComplete = useCallback(() => {
    setError('');
    setStep('totp-login');
  }, []);

  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage);
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    setStep('totp-login');
    setError('');
  }, [logout]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (step === 'totp-setup') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
        <TotpSetupScreen onComplete={handleSetupComplete} onError={handleError} />
        {error && <p className="mt-4 text-sm text-destructive text-center">{error}</p>}
      </div>
    );
  }

  if (step === 'totp-login') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
        <TotpLoginScreen onSuccess={handleTotpSuccess} onError={handleError} />
        {error && <p className="mt-4 text-sm text-destructive text-center">{error}</p>}
      </div>
    );
  }

  // Authenticated - show admin dashboard
  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            {user?.email ? `Logged in as ${user.email}` : '환경변수, Workers, AI 모델 관리'}
          </p>
        </div>
        <Button variant="outline" onClick={handleLogout}>
          Logout
        </Button>
      </div>

      <Tabs defaultValue="health" className="space-y-6">
        <TabsList className="grid w-full max-w-4xl grid-cols-7">
          <TabsTrigger value="health" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            상태
          </TabsTrigger>
          <TabsTrigger value="rag" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            RAG
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            통계
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            AI
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            환경변수
          </TabsTrigger>
          <TabsTrigger value="secrets" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Secrets
          </TabsTrigger>
          <TabsTrigger value="workers" className="flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            Workers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="health">
          <SystemHealth />
        </TabsContent>

        <TabsContent value="rag">
          <RAGManager />
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsManager />
        </TabsContent>

        <TabsContent value="ai">
          <AIManager />
        </TabsContent>

        <TabsContent value="config">
          <ConfigManager />
        </TabsContent>

        <TabsContent value="secrets">
          <SecretsManager />
        </TabsContent>

        <TabsContent value="workers">
          <WorkersManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
