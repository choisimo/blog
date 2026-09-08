import { useState, useEffect, useCallback, useRef } from "react";
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
  Bot,
} from "lucide-react";
import { getApiBaseUrl } from "@/utils/network/apiBase";
import { adminFetchRaw } from "@/services/admin/apiClient";
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
  healthError?: string | null;
}

interface ProvidersResult {
  providers: ProviderHealth[];
  errorMessage?: string;
}

const HEALTH_PROVIDER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function normalizeHealthText(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  const normalized = value
    .replace(/\u001B\][^\u0007\u001B]*(?:\u0007|\u001B\\)/g, "")
    .replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || fallback;
}

function normalizeHealthProviderId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const decoded = decodeURIComponent(trimmed);
    if ([trimmed, decoded].some((candidate) => /[\u0000-\u001F\u007F/\\]/.test(candidate))) {
      return null;
    }
  } catch {
    return null;
  }

  return HEALTH_PROVIDER_ID_PATTERN.test(trimmed) ? trimmed : null;
}

function normalizeProviderHealth(value: unknown): ProviderHealth | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<ProviderHealth>;
  const id = normalizeHealthProviderId(record.id);
  if (!id) return null;

  return {
    id,
    name: normalizeHealthText(record.name, id),
    displayName: normalizeHealthText(record.displayName, id),
    healthStatus: normalizeHealthText(record.healthStatus, "unknown"),
    lastHealthCheck: typeof record.lastHealthCheck === "string" ? record.lastHealthCheck : null,
    isEnabled: Boolean(record.isEnabled),
    modelCount:
      typeof record.modelCount === 'number' && Number.isSafeInteger(record.modelCount)
        ? record.modelCount
        : 0,
    enabledModelCount:
      typeof record.enabledModelCount === 'number' &&
      Number.isSafeInteger(record.enabledModelCount)
        ? record.enabledModelCount
        : 0,
    healthError: normalizeHealthText(record.healthError) || null,
  };
}

// eslint-disable-next-line react-refresh/only-export-components
export async function checkBackendHealth(): Promise<{
  ok: boolean;
  latencyMs: number;
}> {
  const base = getApiBaseUrl();
  const start = Date.now();
  try {
    const res = await fetch(`${base}/api/v1/healthz`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    return { ok: res.ok, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: 0 };
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export async function checkRAGHealth(): Promise<{
  embedding: boolean;
  chroma: boolean;
  latencyMs: number;
  error?: string;
}> {
  const base = getApiBaseUrl();
  const start = Date.now();
  try {
    const res = await fetch(`${base}/api/v1/rag/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = Date.now() - start;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        embedding: false,
        chroma: false,
        latencyMs,
        error: getResponseErrorMessage(
          data,
          `RAG health check failed (${res.status})`,
        ),
      };
    }
    return {
      embedding: data.services?.embedding?.ok ?? data.data?.embedding ?? false,
      chroma: data.services?.chroma?.ok ?? data.data?.chromadb ?? false,
      latencyMs,
    };
  } catch (err) {
    return {
      embedding: false,
      chroma: false,
      latencyMs: 0,
      error: err instanceof Error ? err.message : "RAG health check failed",
    };
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export async function getProvidersResult(): Promise<ProvidersResult> {
  const base = getApiBaseUrl();
  try {
    const res = await adminFetchRaw(`${base}/api/v1/admin/ai/providers`, {
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        providers: [],
        errorMessage: getResponseErrorMessage(
          data,
          `Failed to load providers (${res.status})`,
        ),
      };
    }
    return {
      providers: Array.isArray(data.data?.providers)
        ? data.data.providers.flatMap((provider: unknown) => {
            const normalized = normalizeProviderHealth(provider);
            return normalized ? [normalized] : [];
          })
        : [],
    };
  } catch (err) {
    return {
      providers: [],
      errorMessage:
        err instanceof Error ? err.message : "Failed to load providers",
    };
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export async function getProviders(): Promise<ProviderHealth[]> {
  return (await getProvidersResult()).providers;
}

function getResponseErrorMessage(payload: unknown, fallback: string): string {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload
  ) {
    const error = payload.error;
    const errorText = normalizeHealthText(error);
    if (errorText) return errorText;
    if (
      error &&
      typeof error === "object" &&
      "message" in error &&
      typeof error.message === "string"
    ) {
      return normalizeHealthText(error.message, fallback);
    }
  }
  return fallback;
}

// eslint-disable-next-line react-refresh/only-export-components
export async function checkProviderHealth(
  providerId: string,
): Promise<{ status: string; latencyMs?: number; error?: string }> {
  const safeProviderId = normalizeHealthProviderId(providerId);
  if (!safeProviderId) {
    return { status: "down", error: "Invalid provider selector" };
  }

  const base = getApiBaseUrl();
  try {
    const res = await adminFetchRaw(
      `${base}/api/v1/admin/ai/providers/${encodeURIComponent(safeProviderId)}/health`,
      {
        method: "PUT",
        signal: AbortSignal.timeout(15000),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        status: "down",
        error: getResponseErrorMessage(
          data,
          `Provider health check failed (${res.status})`,
        ),
      };
    }
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

interface AgentHealth {
  status: "healthy" | "degraded" | "error" | "unknown";
  llm?: { ok: boolean };
  tools?: { count: number };
  uptime?: number;
  error?: string;
}

// eslint-disable-next-line react-refresh/only-export-components
export async function checkAgentHealthRequest(): Promise<AgentHealth> {
  const base = getApiBaseUrl();
  try {
    const res = await adminFetchRaw(`${base}/api/v1/agent/health`, {
      method: "GET",
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        status: "error",
        error: getResponseErrorMessage(
          data,
          `Agent health check failed (${res.status})`,
        ),
      };
    }
    return {
      status: data.data?.status ?? "unknown",
      llm: data.data?.llm,
      tools: data.data?.tools,
      uptime: data.data?.uptime,
    };
  } catch (err) {
    return {
      status: "error",
      error: err instanceof Error ? err.message : "Agent health check failed",
    };
  }
}

function formatUptime(seconds?: number): string {
  if (seconds == null) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function StatusDot({ status }: { status: ServiceStatus["status"] }) {
  if (status === "checking") {
    return <RefreshCw className="h-3 w-3 text-ui-muted animate-spin" />;
  }
  if (status === "healthy") {
    return <CheckCircle className="h-3 w-3 text-ui-success" />;
  }
  if (status === "down") {
    return <XCircle className="h-3 w-3 text-ui-danger" />;
  }
  return <AlertCircle className="h-3 w-3 text-ui-muted" />;
}

const FEATURE_LABELS: Record<keyof FeatureFlags, string> = {
  aiEnabled: "AI Service",
  ragEnabled: "RAG Search",
  terminalEnabled: "Terminal",
  aiInline: "Inline AI",
  codeExecutionEnabled: "Code Execution",
  commentsEnabled: "Comments",
};

export function SystemHealth() {
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
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [checkingProviderIds, setCheckingProviderIds] = useState<Set<string>>(
    () => new Set(),
  );
  const providerChecksInFlightRef = useRef<Set<string>>(new Set());

  const [agentHealth, setAgentHealth] = useState<AgentHealth | null>(null);
  const [agentLoading, setAgentLoading] = useState(false);

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
        error: result.error,
      },
      {
        name: "chroma",
        displayName: "ChromaDB",
        status: result.chroma ? "healthy" : "down",
        error: result.error,
      },
    ]);
    setRagLoading(false);
  }, []);

  const fetchProviders = useCallback(async () => {
    setProvidersLoading(true);
    setProvidersError(null);
    const result = await getProvidersResult();
    setProviders(result.providers);
    setProvidersError(result.errorMessage ?? null);
    setProvidersLoading(false);
  }, []);

  const handleCheckProviderHealth = useCallback(
    async (providerId: string) => {
      if (providerChecksInFlightRef.current.has(providerId)) {
        return;
      }

      providerChecksInFlightRef.current.add(providerId);
      setCheckingProviderIds((prev) => new Set(prev).add(providerId));

      try {
        const result = await checkProviderHealth(providerId);
        setProviders((prev) =>
          prev.map((p) =>
            p.id === providerId
              ? {
                  ...p,
                  healthStatus: result.status,
                  healthError: result.error ?? null,
                  lastHealthCheck: new Date().toISOString(),
                }
              : p,
          ),
        );
      } finally {
        providerChecksInFlightRef.current.delete(providerId);
        setCheckingProviderIds((prev) => {
          const next = new Set(prev);
          next.delete(providerId);
          return next;
        });
      }
    },
    [],
  );

  const refreshFlags = useCallback(() => {
    useFeatureFlagsStore.setState({ lastFetched: null });
    fetchFlags();
  }, [fetchFlags]);

  const checkAgentHealth = useCallback(async () => {
    setAgentLoading(true);
    const result = await checkAgentHealthRequest();
    setAgentHealth(result);
    setAgentLoading(false);
  }, []);

  const refreshAll = useCallback(() => {
    checkCoreServices();
    checkRagServices();
    fetchProviders();
    checkAgentHealth();
    refreshFlags();
  }, [checkCoreServices, checkRagServices, fetchProviders, checkAgentHealth, refreshFlags]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const allLoading = coreLoading || ragLoading || providersLoading || agentLoading;
  const allHealthy =
    coreServices.every((s) => s.status === "healthy") &&
    ragServices.every((s) => s.status === "healthy") &&
    agentHealth?.status === "healthy";

  return (
    <div className={["ui-admin-section ui-admin-systemhealth", ("space-y-4")].filter(Boolean).join(' ')}>
      <div className="bg-ui-surface border border-ui-line rounded-lg px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {allHealthy ? (
            <CheckCircle className="h-4 w-4 text-ui-success" />
          ) : (
            <AlertCircle className="h-4 w-4 text-ui-warn" />
          )}
          <span className="text-sm font-medium text-ui-text">
            {allHealthy ? "All systems operational" : "Degraded — check below"}
          </span>
          <span className="font-mono text-xs text-ui-muted bg-ui-soft px-1 py-0.5 rounded">
            {new Date().toLocaleTimeString()}
          </span>
        </div>
        <button
          type="button"
          onClick={refreshAll}
          disabled={allLoading}
          className="flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md text-ui-muted hover:text-ui-text hover:bg-ui-soft transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3 w-3 ${allLoading ? "animate-spin" : ""}  `}
          />
          Refresh all
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="bg-ui-surface border border-ui-line rounded-lg">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-ui-line">
            <div className="flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5 text-ui-muted" />
              <span className="text-xs font-semibold text-ui-text">Core</span>
            </div>
            <button
              type="button"
              onClick={checkCoreServices}
              disabled={coreLoading}
              aria-label="Refresh core health"
              title="Refresh core health"
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-ui-soft transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3 w-3 text-ui-muted ${coreLoading ? "animate-spin" : ""}  `}
                aria-hidden="true"
              />
            </button>
          </div>
          <div className="divide-y divide-ui-line">
            {coreServices.map((s) => (
              <div
                key={s.name}
                className="flex items-center justify-between px-4 py-2.5"
              >
                <span className="text-sm text-ui-text">{s.displayName}</span>
                <div className="flex items-center gap-2">
                  {s.latencyMs !== undefined && s.status === "healthy" && (
                    <span className="font-mono text-xs text-ui-muted">
                      {s.latencyMs}ms
                    </span>
                  )}
                  {s.error && (
                    <span className="text-xs text-ui-danger truncate max-w-[100px]">
                      {s.error}
                    </span>
                  )}
                  <StatusDot status={s.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-ui-surface border border-ui-line rounded-lg">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-ui-line">
            <div className="flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-ui-muted" />
              <span className="text-xs font-semibold text-ui-text">RAG</span>
            </div>
            <button
              type="button"
              onClick={checkRagServices}
              disabled={ragLoading}
              aria-label="Refresh RAG health"
              title="Refresh RAG health"
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-ui-soft transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3 w-3 text-ui-muted ${ragLoading ? "animate-spin" : ""}  `}
                aria-hidden="true"
              />
            </button>
          </div>
          <div className="divide-y divide-ui-line">
            {ragServices.map((s) => (
              <div
                key={s.name}
                className="flex items-center justify-between px-4 py-2.5"
              >
                <span className="text-sm text-ui-text">{s.displayName}</span>
                <div className="flex items-center gap-2">
                  {s.latencyMs !== undefined && s.status === "healthy" && (
                    <span className="font-mono text-xs text-ui-muted">
                      {s.latencyMs}ms
                    </span>
                  )}
                  {s.error && (
                    <span className="text-xs text-ui-danger truncate max-w-[100px]">
                      {s.error}
                    </span>
                  )}
                  <StatusDot status={s.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-ui-surface border border-ui-line rounded-lg">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-ui-line">
            <div className="flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5 text-ui-muted" />
              <span className="text-xs font-semibold text-ui-text">
                AI Providers
              </span>
            </div>
            <button
              type="button"
              onClick={fetchProviders}
              disabled={providersLoading}
              aria-label="Refresh AI providers"
              title="Refresh AI providers"
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-ui-soft transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3 w-3 text-ui-muted ${providersLoading ? "animate-spin" : ""}  `}
                aria-hidden="true"
              />
            </button>
          </div>
          <div className="divide-y divide-ui-line">
            {providersError ? (
              <div className="px-4 py-2.5 text-xs text-red-700 bg-ui-danger-soft">
                <p className="font-medium">Unable to load providers</p>
                <p>{providersError}</p>
                <button
                  type="button"
                  onClick={fetchProviders}
                  className="mt-2 inline-flex h-7 items-center gap-1.5 rounded-md border border-ui-danger bg-ui-surface px-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                >
                  <RefreshCw className="h-3 w-3" />
                  Retry
                </button>
              </div>
            ) : providers.length === 0 ? (
              <p className="px-4 py-2.5 text-xs text-ui-muted">
                {providersLoading ? "Loading..." : "No providers"}
              </p>
            ) : (
              providers.map((p) => {
                const isCheckingProvider = checkingProviderIds.has(p.id);

                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!p.isEnabled || isCheckingProvider}
                    onClick={() => p.isEnabled && handleCheckProviderHealth(p.id)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-ui-soft transition-colors disabled:cursor-default"
                  >
                    <div className="text-left">
                      <p className="text-sm text-ui-text">{p.displayName}</p>
                      <p
                        className={`font-mono text-xs max-w-[140px] truncate ${
                          p.healthError ? "text-ui-danger" : "text-ui-muted"
                        }  `}
                      >
                        {p.healthError ?? `${p.enabledModelCount}/${p.modelCount} models`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isCheckingProvider ? (
                        <RefreshCw className="h-3 w-3 text-ui-muted animate-spin" />
                      ) : !p.isEnabled ? (
                        <span className="font-mono text-xs text-ui-muted">
                          off
                        </span>
                      ) : p.healthStatus === "healthy" ? (
                        <CheckCircle className="h-3 w-3 text-ui-success" />
                      ) : p.healthStatus === "down" ? (
                        <XCircle className="h-3 w-3 text-ui-danger" />
                      ) : (
                        <AlertCircle className="h-3 w-3 text-ui-muted" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-ui-surface border border-ui-line rounded-lg">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-ui-line">
            <div className="flex items-center gap-1.5">
              <ToggleRight className="h-3.5 w-3.5 text-ui-muted" />
              <span className="text-xs font-semibold text-ui-text">
                Feature Flags
              </span>
            </div>
            <button
              type="button"
              onClick={refreshFlags}
              disabled={flagsLoading}
              aria-label="Refresh feature flags"
              title="Refresh feature flags"
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-ui-soft transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3 w-3 text-ui-muted ${flagsLoading ? "animate-spin" : ""}  `}
                aria-hidden="true"
              />
            </button>
          </div>
          <div className="divide-y divide-ui-line">
            {(Object.entries(flags) as [keyof FeatureFlags, boolean][]).map(
              ([key, enabled]) => (
                <div
                  key={key}
                  className="flex items-center justify-between px-4 py-2.5"
                >
                  <span className="text-sm text-ui-text">
                    {FEATURE_LABELS[key]}
                  </span>
                  {enabled ? (
                    <ToggleRight className="h-3.5 w-3.5 text-ui-success" />
                  ) : (
                    <ToggleLeft className="h-3.5 w-3.5 text-ui-muted" />
                  )}
                </div>
              ),
            )}
          </div>
        </div>

        <div className="bg-ui-surface border border-ui-line rounded-lg">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-ui-line">
            <div className="flex items-center gap-1.5">
              <Bot className="h-3.5 w-3.5 text-ui-muted" />
              <span className="text-xs font-semibold text-ui-text">Agent</span>
            </div>
            <button
              type="button"
              onClick={checkAgentHealth}
              disabled={agentLoading}
              aria-label="Refresh agent health"
              title="Refresh agent health"
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-ui-soft transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3 w-3 text-ui-muted ${agentLoading ? "animate-spin" : ""}  `}
                aria-hidden="true"
              />
            </button>
          </div>
          <div className="divide-y divide-ui-line">
            {agentHealth == null ? (
              <p className="px-4 py-2.5 text-xs text-ui-muted">
                {agentLoading ? "Checking…" : "Not checked"}
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-ui-text">Status</span>
                  <div className="flex items-center gap-1.5">
                    {agentHealth.status === "healthy" ? (
                      <CheckCircle className="h-3 w-3 text-ui-success" />
                    ) : agentHealth.status === "error" ? (
                      <XCircle className="h-3 w-3 text-ui-danger" />
                    ) : (
                      <AlertCircle className="h-3 w-3 text-ui-warn" />
                    )}
                    <span className="font-mono text-xs text-ui-muted capitalize">
                      {agentHealth.status}
                    </span>
                  </div>
                </div>
                {agentHealth.error && (
                  <div className="flex items-start justify-between gap-3 px-4 py-2.5">
                    <span className="text-sm text-ui-text">Error</span>
                    <span className="max-w-[160px] text-right text-xs text-ui-danger">
                      {agentHealth.error}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-ui-text">Uptime</span>
                  <span className="font-mono text-xs text-ui-muted">
                    {formatUptime(agentHealth.uptime)}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-ui-text">Tools</span>
                  <span className="font-mono text-xs text-ui-muted">
                    {agentHealth.tools?.count ?? "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-ui-text">LLM</span>
                  {agentHealth.llm?.ok === true ? (
                    <CheckCircle className="h-3 w-3 text-ui-success" />
                  ) : agentHealth.llm?.ok === false ? (
                    <XCircle className="h-3 w-3 text-ui-danger" />
                  ) : (
                    <AlertCircle className="h-3 w-3 text-ui-muted" />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
