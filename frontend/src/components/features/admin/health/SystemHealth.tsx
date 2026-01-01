/**
 * System Health Dashboard
 * 
 * AI 제공자, RAG 서비스, 백엔드 상태를 한눈에 보여주는 대시보드
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Server,
  Database,
  Brain,
  Zap,
} from 'lucide-react';
import { getApiBaseUrl } from '@/utils/apiBase';
import { useAuthStore } from '@/stores/useAuthStore';

// ============================================================================
// Types
// ============================================================================

interface ServiceStatus {
  name: string;
  displayName: string;
  status: 'healthy' | 'down' | 'unknown' | 'checking';
  latencyMs?: number;
  error?: string;
  lastCheck?: string;
}

interface ProviderHealth {
  id: string;
  name: string;
  displayName: string;
  healthStatus: string;
  lastHealthCheck: string | null;
  isEnabled: boolean;
  modelCount: number;
  enabledModelCount: number;
}

// ============================================================================
// API Functions
// ============================================================================

async function checkBackendHealth(): Promise<{ ok: boolean; latencyMs: number }> {
  const base = getApiBaseUrl();
  const start = Date.now();
  
  try {
    const res = await fetch(`${base}/health`, { 
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = Date.now() - start;
    return { ok: res.ok, latencyMs };
  } catch {
    return { ok: false, latencyMs: 0 };
  }
}

async function checkRAGHealth(): Promise<{ tei: boolean; chroma: boolean; latencyMs: number }> {
  const base = getApiBaseUrl();
  const start = Date.now();
  
  try {
    const res = await fetch(`${base}/api/v1/rag/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = Date.now() - start;
    
    if (!res.ok) {
      return { tei: false, chroma: false, latencyMs };
    }
    
    const data = await res.json();
    return {
      tei: data.services?.tei?.ok ?? data.data?.tei ?? false,
      chroma: data.services?.chroma?.ok ?? data.data?.chromadb ?? false,
      latencyMs,
    };
  } catch {
    return { tei: false, chroma: false, latencyMs: 0 };
  }
}

async function getProviders(token: string): Promise<ProviderHealth[]> {
  const base = getApiBaseUrl();
  
  try {
    const res = await fetch(`${base}/api/v1/admin/ai/providers`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!res.ok) {
      return [];
    }
    
    const data = await res.json();
    return data.data?.providers ?? [];
  } catch {
    return [];
  }
}

async function checkProviderHealth(providerId: string, token: string): Promise<{
  status: string;
  latencyMs?: number;
  error?: string;
}> {
  const base = getApiBaseUrl();
  
  try {
    const res = await fetch(`${base}/api/v1/admin/ai/providers/${providerId}/health`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(15000),
    });
    
    const data = await res.json();
    return {
      status: data.data?.status ?? 'unknown',
      latencyMs: data.data?.latencyMs,
      error: data.data?.error,
    };
  } catch (err) {
    return {
      status: 'down',
      error: err instanceof Error ? err.message : 'Check failed',
    };
  }
}

// ============================================================================
// Status Badge Component
// ============================================================================

function StatusBadge({ status }: { status: ServiceStatus['status'] }) {
  switch (status) {
    case 'healthy':
      return (
        <Badge variant="default" className="bg-green-500 hover:bg-green-600">
          <CheckCircle className="h-3 w-3 mr-1" />
          정상
        </Badge>
      );
    case 'down':
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          오류
        </Badge>
      );
    case 'checking':
      return (
        <Badge variant="secondary">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          확인 중
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          <AlertCircle className="h-3 w-3 mr-1" />
          알 수 없음
        </Badge>
      );
  }
}

// ============================================================================
// Service Card Component
// ============================================================================

interface ServiceCardProps {
  icon: React.ReactNode;
  title: string;
  services: ServiceStatus[];
  onRefresh: () => void;
  loading: boolean;
}

function ServiceCard({ icon, title, services, onRefresh, loading }: ServiceCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {services.map((service) => (
            <div
              key={service.name}
              className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
            >
              <div>
                <p className="text-sm font-medium">{service.displayName}</p>
                {service.latencyMs !== undefined && service.status === 'healthy' && (
                  <p className="text-xs text-muted-foreground">{service.latencyMs}ms</p>
                )}
                {service.error && (
                  <p className="text-xs text-red-500 truncate max-w-[200px]">{service.error}</p>
                )}
              </div>
              <StatusBadge status={service.status} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// AI Providers Card Component
// ============================================================================

interface AIProvidersCardProps {
  providers: ProviderHealth[];
  onRefresh: () => void;
  onCheckHealth: (providerId: string) => void;
  checkingProvider: string | null;
  loading: boolean;
}

function AIProvidersCard({
  providers,
  onRefresh,
  onCheckHealth,
  checkingProvider,
  loading,
}: AIProvidersCardProps) {
  const getStatusBadge = (provider: ProviderHealth) => {
    if (checkingProvider === provider.id) {
      return (
        <Badge variant="secondary">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          확인 중
        </Badge>
      );
    }

    if (!provider.isEnabled) {
      return <Badge variant="outline">비활성화</Badge>;
    }

    switch (provider.healthStatus) {
      case 'healthy':
        return (
          <Badge variant="default" className="bg-green-500 hover:bg-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            정상
          </Badge>
        );
      case 'down':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            오류
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <AlertCircle className="h-3 w-3 mr-1" />
            미확인
          </Badge>
        );
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            <div>
              <CardTitle className="text-base">AI 제공자</CardTitle>
              <CardDescription className="text-xs">
                클릭하여 개별 상태 확인
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {providers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {loading ? '로딩 중...' : '등록된 제공자가 없습니다.'}
          </p>
        ) : (
          <div className="space-y-2">
            {providers.map((provider) => (
              <div
                key={provider.id}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                onClick={() => provider.isEnabled && onCheckHealth(provider.id)}
              >
                <div>
                  <p className="text-sm font-medium">{provider.displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    모델: {provider.enabledModelCount}/{provider.modelCount}
                    {provider.lastHealthCheck && (
                      <>
                        {' · '}
                        마지막 확인: {new Date(provider.lastHealthCheck).toLocaleTimeString()}
                      </>
                    )}
                  </p>
                </div>
                {getStatusBadge(provider)}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SystemHealth() {
  const { getValidAccessToken } = useAuthStore();
  
  // Core services state
  const [coreServices, setCoreServices] = useState<ServiceStatus[]>([
    { name: 'backend', displayName: 'Backend API', status: 'unknown' },
  ]);
  const [coreLoading, setCoreLoading] = useState(false);

  // RAG services state
  const [ragServices, setRagServices] = useState<ServiceStatus[]>([
    { name: 'tei', displayName: 'TEI (Embedding)', status: 'unknown' },
    { name: 'chroma', displayName: 'ChromaDB', status: 'unknown' },
  ]);
  const [ragLoading, setRagLoading] = useState(false);

  // AI providers state
  const [providers, setProviders] = useState<ProviderHealth[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [checkingProvider, setCheckingProvider] = useState<string | null>(null);

  // Check core services
  const checkCoreServices = useCallback(async () => {
    setCoreLoading(true);
    setCoreServices((prev) =>
      prev.map((s) => ({ ...s, status: 'checking' as const }))
    );

    const backendResult = await checkBackendHealth();
    
    setCoreServices([
      {
        name: 'backend',
        displayName: 'Backend API',
        status: backendResult.ok ? 'healthy' : 'down',
        latencyMs: backendResult.latencyMs,
      },
    ]);
    setCoreLoading(false);
  }, []);

  // Check RAG services
  const checkRagServices = useCallback(async () => {
    setRagLoading(true);
    setRagServices((prev) =>
      prev.map((s) => ({ ...s, status: 'checking' as const }))
    );

    const result = await checkRAGHealth();
    
    setRagServices([
      {
        name: 'tei',
        displayName: 'TEI (Embedding)',
        status: result.tei ? 'healthy' : 'down',
        latencyMs: result.latencyMs,
      },
      {
        name: 'chroma',
        displayName: 'ChromaDB',
        status: result.chroma ? 'healthy' : 'down',
      },
    ]);
    setRagLoading(false);
  }, []);

  // Fetch AI providers
  const fetchProviders = useCallback(async () => {
    setProvidersLoading(true);
    const token = await getValidAccessToken();
    if (token) {
      const result = await getProviders(token);
      setProviders(result);
    }
    setProvidersLoading(false);
  }, [getValidAccessToken]);

  // Check individual provider health
  const handleCheckProviderHealth = useCallback(async (providerId: string) => {
    setCheckingProvider(providerId);
    const token = await getValidAccessToken();
    
    if (token) {
      const result = await checkProviderHealth(providerId, token);
      
      // Update provider in list
      setProviders((prev) =>
        prev.map((p) =>
          p.id === providerId
            ? {
                ...p,
                healthStatus: result.status,
                lastHealthCheck: new Date().toISOString(),
              }
            : p
        )
      );
    }
    
    setCheckingProvider(null);
  }, [getValidAccessToken]);

  // Initial load
  useEffect(() => {
    checkCoreServices();
    checkRagServices();
    fetchProviders();
  }, [checkCoreServices, checkRagServices, fetchProviders]);

  // Calculate overall status
  const allHealthy =
    coreServices.every((s) => s.status === 'healthy') &&
    ragServices.every((s) => s.status === 'healthy');

  return (
    <div className="space-y-6">
      {/* Overall Status Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {allHealthy ? (
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              ) : (
                <div className="h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
              )}
              <div>
                <h2 className="text-lg font-semibold">
                  {allHealthy ? '모든 서비스 정상' : '일부 서비스 점검 필요'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  마지막 확인: {new Date().toLocaleTimeString()}
                </p>
              </div>
            </div>
            <Button
              onClick={() => {
                checkCoreServices();
                checkRagServices();
                fetchProviders();
              }}
              disabled={coreLoading || ragLoading || providersLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${(coreLoading || ragLoading) ? 'animate-spin' : ''}`} />
              전체 새로고침
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Service Cards Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <ServiceCard
          icon={<Server className="h-5 w-5 text-blue-500" />}
          title="Core Services"
          services={coreServices}
          onRefresh={checkCoreServices}
          loading={coreLoading}
        />
        
        <ServiceCard
          icon={<Database className="h-5 w-5 text-green-500" />}
          title="RAG Services"
          services={ragServices}
          onRefresh={checkRagServices}
          loading={ragLoading}
        />

        <AIProvidersCard
          providers={providers}
          onRefresh={fetchProviders}
          onCheckHealth={handleCheckProviderHealth}
          checkingProvider={checkingProvider}
          loading={providersLoading}
        />
      </div>
    </div>
  );
}
