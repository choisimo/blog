import { useState, useEffect, useCallback } from 'react';
import { ConfigManager } from '@/components/features/admin/ConfigManager';
import { WorkersManager } from '@/components/features/admin/WorkersManager';
import { AIManager } from '@/components/features/admin/ai';
import { SecretsManager } from '@/components/features/admin/secrets';
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
import { Lock, Settings, Cloud, Bot, Key, Mail, ArrowLeft, RefreshCw } from 'lucide-react';
import {
  login,
  verifyOtp,
  resendOtp,
  getMe,
  type LoginResponse,
} from '@/services/auth';
import {
  useAuthStore,
  migrateFromLegacyStorage,
  scheduleTokenRefresh,
} from '@/stores/useAuthStore';

// ============================================================================
// Auth Step Types
// ============================================================================

type AuthStep = 'credentials' | 'otp' | 'authenticated';

// ============================================================================
// Credentials Form Component
// ============================================================================

interface CredentialsFormProps {
  onSuccess: (response: LoginResponse) => void;
  onError: (error: string) => void;
}

function CredentialsForm({ onSuccess, onError }: CredentialsFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setLoading(true);
    try {
      const response = await login(username, password);
      onSuccess(response);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Login failed');
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
        <CardDescription>Enter your admin credentials to continue</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              autoFocus
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={!username || !password || loading}
          >
            {loading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Continue'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// OTP Form Component
// ============================================================================

interface OtpFormProps {
  sessionId: string;
  message: string;
  expiresAt: string;
  devOtp?: string;
  onSuccess: () => void;
  onError: (error: string) => void;
  onBack: () => void;
}

function OtpForm({
  sessionId,
  message,
  expiresAt,
  devOtp,
  onSuccess,
  onError,
  onBack,
}: OtpFormProps) {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [currentMessage, setCurrentMessage] = useState(message);
  const [currentExpiresAt, setCurrentExpiresAt] = useState(expiresAt);
  const [currentDevOtp, setCurrentDevOtp] = useState(devOtp);
  const { setTokens } = useAuthStore();

  // Calculate time remaining
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  useEffect(() => {
    const updateTimer = () => {
      const expires = new Date(currentExpiresAt).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expires - now) / 1000));
      setTimeRemaining(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [currentExpiresAt]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) return;

    setLoading(true);
    try {
      const response = await verifyOtp(sessionId, otp);
      setTokens(response.accessToken, response.refreshToken, response.user);
      scheduleTokenRefresh();
      onSuccess();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const response = await resendOtp(sessionId);
      setCurrentMessage(response.message);
      setCurrentExpiresAt(response.expiresAt);
      setCurrentDevOtp(response._dev_otp);
      setOtp('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to resend code');
    } finally {
      setResending(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isExpired = timeRemaining === 0;

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>Verify Your Identity</CardTitle>
        <CardDescription>{currentMessage}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="otp">Verification Code</Label>
            <Input
              id="otp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              autoFocus
              className="text-center text-2xl tracking-widest"
            />
            {currentDevOtp && (
              <p className="text-xs text-muted-foreground text-center">
                Dev mode OTP: <code className="font-mono bg-muted px-1">{currentDevOtp}</code>
              </p>
            )}
          </div>

          {timeRemaining !== null && (
            <p
              className={`text-sm text-center ${
                isExpired ? 'text-destructive' : 'text-muted-foreground'
              }`}
            >
              {isExpired
                ? 'Code expired. Please request a new one.'
                : `Code expires in ${formatTime(timeRemaining)}`}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={otp.length !== 6 || loading || isExpired}
          >
            {loading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify Code'
            )}
          </Button>

          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-muted-foreground"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResend}
              disabled={resending}
              className="text-muted-foreground"
            >
              {resending ? (
                <>
                  <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Resend Code'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function AdminConfig() {
  const [step, setStep] = useState<AuthStep>('credentials');
  const [loginResponse, setLoginResponse] = useState<LoginResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const { isAuthenticated, getValidAccessToken, logout, user } = useAuthStore();

  // Check authentication on mount
  useEffect(() => {
    migrateFromLegacyStorage();

    const checkAuth = async () => {
      if (isAuthenticated()) {
        // Verify token is still valid
        const token = await getValidAccessToken();
        if (token) {
          try {
            await getMe(token);
            setStep('authenticated');
            scheduleTokenRefresh();
          } catch {
            // Token invalid, clear and show login
            await logout();
            setStep('credentials');
          }
        } else {
          setStep('credentials');
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, [isAuthenticated, getValidAccessToken, logout]);

  const handleLoginSuccess = useCallback((response: LoginResponse) => {
    setLoginResponse(response);
    setError('');
    setStep('otp');
  }, []);

  const handleOtpSuccess = useCallback(() => {
    setError('');
    setStep('authenticated');
  }, []);

  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage);
  }, []);

  const handleBack = useCallback(() => {
    setStep('credentials');
    setLoginResponse(null);
    setError('');
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    setStep('credentials');
    setLoginResponse(null);
    setError('');
  }, [logout]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Credentials step
  if (step === 'credentials') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
        <CredentialsForm onSuccess={handleLoginSuccess} onError={handleError} />
        {error && (
          <p className="mt-4 text-sm text-destructive text-center">{error}</p>
        )}
      </div>
    );
  }

  // OTP step
  if (step === 'otp' && loginResponse) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
        <OtpForm
          sessionId={loginResponse.sessionId}
          message={loginResponse.message}
          expiresAt={loginResponse.expiresAt}
          devOtp={loginResponse._dev_otp}
          onSuccess={handleOtpSuccess}
          onError={handleError}
          onBack={handleBack}
        />
        {error && (
          <p className="mt-4 text-sm text-destructive text-center">{error}</p>
        )}
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

      <Tabs defaultValue="config" className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
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
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            AI Models
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config">
          <ConfigManager />
        </TabsContent>

        <TabsContent value="secrets">
          <SecretsManager />
        </TabsContent>

        <TabsContent value="workers">
          <WorkersManager />
        </TabsContent>

        <TabsContent value="ai">
          <AIManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
