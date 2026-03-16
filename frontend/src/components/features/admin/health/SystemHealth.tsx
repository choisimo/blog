import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Server,
  Database,
  Brain,
  ToggleRight,
  ToggleLeft,
} from "lucide-react";
import { getApiBaseUrl } from "@/utils/network/apiBase";
import { useAuthStore } from "@/stores/session/useAuthStore";
import {
  useFeatureFlagsStore,
  type FeatureFlags,
} from "@/stores/runtime/useFeatureFlagsStore";

interface ServiceStatus {
  name: string;
  displayName: string;
  status: "healthy" | "down" | "unknown" | "checking";
  latencyMs?: number;
  error?: string;
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

async function checkBackendHealth(): Promise<{
  ok: boolean;
  latencyMs: number;
}> {
  const base = getApiBaseUrl();
  const start = Date.now();
  try {
    const res = await fetch(`${base}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    return { ok: res.ok, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: 0 };
  }
}

async function checkRAGHealth(): Promise<{
  embedding: boolean;
  chroma: boolean;
  latencyMs: number;
}> {
  const base = getApiBaseUrl();
  const start = Date.now();
  try {
    const res = await fetch(`${base}/api/v1/rag/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) return { embedding: false, chroma: false, latencyMs };
    const data = await res.json();
    return {
      embedding: data.services?.embedding?.ok ?? data.data?.embedding ?? false,
      chroma: data.services?.chroma?.ok ?? data.data?.chromadb ?? false,
      latencyMs,
    };
  } catch {
    return { embedding: false, chroma: false, latencyMs: 0 };
  }
}

async function getProviders(token: string): Promise<ProviderHealth[]> {
  const base = getApiBaseUrl();
  try {
    const res = await fetch(`${base}/api/v1/admin/ai/providers`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data?.providers ?? [];
  } catch {
    return [];
  }
}

async function checkProviderHealth(
  providerId: string,
  token: string,
): Promise<{ status: string; latencyMs?: number; error?: string }> {
  const base = getApiBaseUrl();
  try {
    const res = await fetch(
      `${base}/api/v1/admin/ai/providers/${providerId}/health`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15000),
      },
    );
    const data = await res.json();
    return {
      status: data.data?.status ?? "unknown",
      latencyMs: data.data?.latencyMs,
      error: data.data?.error,
    };
  } catch (err) {
    return {
      status: "down",
      error: err instanceof Error ? err.message : "Check failed",
    };
  }
}

function StatusDot({ status }: { status: ServiceStatus["status"] }) {
  if (status === "checking") {
    return <RefreshCw className="h-3 w-3 text-zinc-400 animate-spin" />;
  }
  if (status === "healthy") {
    return <CheckCircle className="h-3 w-3 text-emerald-600" />;
  }
  if (status === "down") {
    return <XCircle className="h-3 w-3 text-red-600" />;
  }
  return <AlertCircle className="h-3 w-3 text-zinc-400" />;
}

const FEATURE_LABELS: Record<keyof FeatureFlags, string> = {
  aiEnabled: "AI Service",
  ragEnabled: "RAG Search",
  terminalEnabled: "Terminal",
  aiInline: "Inline AI",
  commentsEnabled: "Comments",
};

export function SystemHealth() {
  const { getValidAccessToken } = useAuthStore();

  const [coreServices, setCoreServices] = useState<ServiceStatus[]>([
    { name: "backend", displayName: "Backend API", status: "unknown" },
  ]);
  const [coreLoading, setCoreLoading] = useState(false);

  const [ragServices, setRagServices] = useState<ServiceStatus[]>([
    { name: "embedding", displayName: "Embedding", status: "unknown" },
    { name: "chroma", displayName: "ChromaDB", status: "unknown" },
  ]);
  const [ragLoading, setRagLoading] = useState(false);

  const [providers, setProviders] = useState<ProviderHealth[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [checkingProvider, setCheckingProvider] = useState<string | null>(null);

  const { flags, isLoading: flagsLoading, fetchFlags } = useFeatureFlagsStore();

  const checkCoreServices = useCallback(async () => {
    setCoreLoading(true);
    setCoreServices((prev) =>
      prev.map((s) => ({ ...s, status: "checking" as const })),
    );
    const result = await checkBackendHealth();
    setCoreServices([
      {
        name: "backend",
        displayName: "Backend API",
        status: result.ok ? "healthy" : "down",
        latencyMs: result.latencyMs,
      },
    ]);
    setCoreLoading(false);
  }, []);

  const checkRagServices = useCallback(async () => {
    setRagLoading(true);
    setRagServices((prev) =>
      prev.map((s) => ({ ...s, status: "checking" as const })),
    );
    const result = await checkRAGHealth();
    setRagServices([
      {
        name: "embedding",
        displayName: "Embedding",
        status: result.embedding ? "healthy" : "down",
        latencyMs: result.latencyMs,
      },
      {
        name: "chroma",
        displayName: "ChromaDB",
        status: result.chroma ? "healthy" : "down",
      },
    ]);
    setRagLoading(false);
  }, []);

  const fetchProviders = useCallback(async () => {
    setProvidersLoading(true);
    const token = await getValidAccessToken();
    if (token) {
      const result = await getProviders(token);
      setProviders(result);
    }
    setProvidersLoading(false);
  }, [getValidAccessToken]);

  const handleCheckProviderHealth = useCallback(
    async (providerId: string) => {
      setCheckingProvider(providerId);
      const token = await getValidAccessToken();
      if (token) {
        const result = await checkProviderHealth(providerId, token);
        setProviders((prev) =>
          prev.map((p) =>
            p.id === providerId
              ? {
                  ...p,
                  healthStatus: result.status,
                  lastHealthCheck: new Date().toISOString(),
                }
              : p,
          ),
        );
      }
      setCheckingProvider(null);
    },
    [getValidAccessToken],
  );

  const refreshFlags = useCallback(() => {
    useFeatureFlagsStore.setState({ lastFetched: null });
    fetchFlags();
  }, [fetchFlags]);

  const refreshAll = useCallback(() => {
    checkCoreServices();
    checkRagServices();
    fetchProviders();
    refreshFlags();
  }, [checkCoreServices, checkRagServices, fetchProviders, refreshFlags]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const allLoading = coreLoading || ragLoading || providersLoading;
  const allHealthy =
    coreServices.every((s) => s.status === "healthy") &&
    ragServices.every((s) => s.status === "healthy");

  return (
    <div className="space-y-4">
      <div className="bg-white border border-zinc-200 rounded-lg px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {allHealthy ? (
            <CheckCircle className="h-4 w-4 text-emerald-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-amber-500" />
          )}
          <span className="text-sm font-medium text-zinc-800">
            {allHealthy ? "All systems operational" : "Degraded — check below"}
          </span>
          <span className="font-mono text-xs text-zinc-400 bg-zinc-100 px-1 py-0.5 rounded">
            {new Date().toLocaleTimeString()}
          </span>
        </div>
        <button
          type="button"
          onClick={refreshAll}
          disabled={allLoading}
          className="flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3 w-3 ${allLoading ? "animate-spin" : ""}`}
          />
          Refresh all
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="bg-white border border-zinc-200 rounded-lg">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100">
            <div className="flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5 text-zinc-500" />
              <span className="text-xs font-semibold text-zinc-700">Core</span>
            </div>
            <button
              type="button"
              onClick={checkCoreServices}
              disabled={coreLoading}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-zinc-100 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3 w-3 text-zinc-400 ${coreLoading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
          <div className="divide-y divide-zinc-100">
            {coreServices.map((s) => (
              <div
                key={s.name}
                className="flex items-center justify-between px-4 py-2.5"
              >
                <span className="text-sm text-zinc-700">{s.displayName}</span>
                <div className="flex items-center gap-2">
                  {s.latencyMs !== undefined && s.status === "healthy" && (
                    <span className="font-mono text-xs text-zinc-400">
                      {s.latencyMs}ms
                    </span>
                  )}
                  {s.error && (
                    <span className="text-xs text-red-600 truncate max-w-[100px]">
                      {s.error}
                    </span>
                  )}
                  <StatusDot status={s.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-lg">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100">
            <div className="flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-zinc-500" />
              <span className="text-xs font-semibold text-zinc-700">RAG</span>
            </div>
            <button
              type="button"
              onClick={checkRagServices}
              disabled={ragLoading}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-zinc-100 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3 w-3 text-zinc-400 ${ragLoading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
          <div className="divide-y divide-zinc-100">
            {ragServices.map((s) => (
              <div
                key={s.name}
                className="flex items-center justify-between px-4 py-2.5"
              >
                <span className="text-sm text-zinc-700">{s.displayName}</span>
                <div className="flex items-center gap-2">
                  {s.latencyMs !== undefined && s.status === "healthy" && (
                    <span className="font-mono text-xs text-zinc-400">
                      {s.latencyMs}ms
                    </span>
                  )}
                  <StatusDot status={s.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-lg">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100">
            <div className="flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5 text-zinc-500" />
              <span className="text-xs font-semibold text-zinc-700">
                AI Providers
              </span>
            </div>
            <button
              type="button"
              onClick={fetchProviders}
              disabled={providersLoading}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-zinc-100 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3 w-3 text-zinc-400 ${providersLoading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
          <div className="divide-y divide-zinc-100">
            {providers.length === 0 ? (
              <p className="px-4 py-2.5 text-xs text-zinc-400">
                {providersLoading ? "Loading..." : "No providers"}
              </p>
            ) : (
              providers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={!p.isEnabled || checkingProvider === p.id}
                  onClick={() => p.isEnabled && handleCheckProviderHealth(p.id)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-zinc-50 transition-colors disabled:cursor-default"
                >
                  <div className="text-left">
                    <p className="text-sm text-zinc-700">{p.displayName}</p>
                    <p className="font-mono text-xs text-zinc-400">
                      {p.enabledModelCount}/{p.modelCount} models
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {checkingProvider === p.id ? (
                      <RefreshCw className="h-3 w-3 text-zinc-400 animate-spin" />
                    ) : !p.isEnabled ? (
                      <span className="font-mono text-xs text-zinc-400">
                        off
                      </span>
                    ) : p.healthStatus === "healthy" ? (
                      <CheckCircle className="h-3 w-3 text-emerald-600" />
                    ) : p.healthStatus === "down" ? (
                      <XCircle className="h-3 w-3 text-red-600" />
                    ) : (
                      <AlertCircle className="h-3 w-3 text-zinc-400" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-lg">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100">
            <div className="flex items-center gap-1.5">
              <ToggleRight className="h-3.5 w-3.5 text-zinc-500" />
              <span className="text-xs font-semibold text-zinc-700">
                Feature Flags
              </span>
            </div>
            <button
              type="button"
              onClick={refreshFlags}
              disabled={flagsLoading}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-zinc-100 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3 w-3 text-zinc-400 ${flagsLoading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
          <div className="divide-y divide-zinc-100">
            {(Object.entries(flags) as [keyof FeatureFlags, boolean][]).map(
              ([key, enabled]) => (
                <div
                  key={key}
                  className="flex items-center justify-between px-4 py-2.5"
                >
                  <span className="text-sm text-zinc-700">
                    {FEATURE_LABELS[key]}
                  </span>
                  {enabled ? (
                    <ToggleRight className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <ToggleLeft className="h-3.5 w-3.5 text-zinc-400" />
                  )}
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
