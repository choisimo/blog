/**
 * AI Admin API Hooks
 *
 * Uses new auth store with automatic token refresh
 */

import { useState, useCallback } from 'react';
import { adminApiFetch } from '@/services/admin/apiClient';
import type {
  AIProvider,
  AIModel,
  AIRoute,
  AIUsageData,
  ProviderFormData,
  ModelFormData,
  RouteFormData,
} from './types';

const ADMIN_SELECTOR_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const ROUTING_STRATEGIES: Array<NonNullable<RouteFormData['routingStrategy']>> = [
  'simple',
  'latency-based-routing',
  'cost-based-routing',
];
const TRACE_STATUSES = ['pending', 'success', 'error', 'timeout'] as const;
const HISTORY_STATUSES = ['pending', 'success', 'error'] as const;

type AdminHookResult<T> =
  | { ok: true; data: T; error?: undefined }
  | { ok: false; error: string; data?: undefined };

function invalidResult<T>(error: string): Promise<AdminHookResult<T>> {
  return Promise.resolve({ ok: false, error });
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

function decodeSelector(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function normalizeAdminSelector(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const decoded = decodeSelector(trimmed);
  if (!decoded) return null;

  if ([trimmed, decoded].some((candidate) => /[\r\n\\/]/.test(candidate))) {
    return null;
  }

  return ADMIN_SELECTOR_PATTERN.test(trimmed) ? trimmed : null;
}

function encodeSelector(value: string): string {
  return encodeURIComponent(value);
}

function normalizeSelectorList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map(normalizeAdminSelector).filter(isPresent)));
}

function normalizeProviderData<T extends Partial<ProviderFormData & { isEnabled: boolean }>>(
  data: T,
  requireName = false
): T | null {
  const next = { ...data };

  if (next.name !== undefined || requireName) {
    const name = normalizeAdminSelector(next.name);
    if (!name) return null;
    next.name = name;
  }

  if (next.apiKeyEnv !== undefined && next.apiKeyEnv !== '') {
    const apiKeyEnv = normalizeAdminSelector(next.apiKeyEnv);
    if (!apiKeyEnv) return null;
    next.apiKeyEnv = apiKeyEnv;
  }

  return next;
}

function normalizeModelData<T extends Partial<ModelFormData & { isEnabled: boolean }>>(
  data: T,
  requireProvider = false
): T | null {
  const next = { ...data };

  if (next.providerId !== undefined || requireProvider) {
    const providerId = normalizeAdminSelector(next.providerId);
    if (!providerId) return null;
    next.providerId = providerId;
  }

  return next;
}

function normalizeRouteData<T extends Partial<RouteFormData & { isEnabled: boolean }>>(
  data: T,
  requireName = false
): T | null {
  const next = { ...data };

  if (next.name !== undefined || requireName) {
    const name = normalizeAdminSelector(next.name);
    if (!name) return null;
    next.name = name;
  }

  if (next.primaryModelId !== undefined && next.primaryModelId !== '') {
    const primaryModelId = normalizeAdminSelector(next.primaryModelId);
    if (!primaryModelId) return null;
    next.primaryModelId = primaryModelId;
  }

  if (next.fallbackModelIds !== undefined) {
    const primaryModelId = normalizeAdminSelector(next.primaryModelId);
    next.fallbackModelIds = normalizeSelectorList(next.fallbackModelIds).filter(
      (id) => id !== primaryModelId
    );
  }

  if (next.contextWindowFallbackIds !== undefined) {
    next.contextWindowFallbackIds = normalizeSelectorList(
      next.contextWindowFallbackIds
    );
  }

  if (
    next.routingStrategy !== undefined &&
    !ROUTING_STRATEGIES.includes(next.routingStrategy)
  ) {
    return null;
  }

  return next;
}

function normalizePositiveInteger(value: unknown, fallback: number, max: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.min(Math.floor(numeric), max);
}

function normalizeNonNegativeInteger(value: unknown, fallback: number, max: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return Math.min(Math.floor(numeric), max);
}

function normalizeDateQueryValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || /[\u0000-\u001F\u007F]/.test(trimmed)) return null;
  return trimmed;
}

// ============================================================================
// Providers
// ============================================================================

export function useProviders() {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await adminApiFetch<{ providers: AIProvider[] }>('/providers', { pathPrefix: '/api/v1/admin/ai' });
    if (result.ok && result.data) {
      setProviders(result.data.providers);
    } else {
      setError(result.error || 'Failed to fetch providers');
    }
    setLoading(false);
  }, []);

  const createProvider = useCallback(
    async (data: ProviderFormData) => {
      const safeData = normalizeProviderData(data, true);
      if (!safeData) return invalidResult<AIProvider>('Invalid provider payload');
      const result = await adminApiFetch<AIProvider>('/providers', { pathPrefix: '/api/v1/admin/ai',
        method: 'POST',
        body: safeData,
      });
      if (result.ok) {
        await fetchProviders();
      }
      return result;
    },
    [fetchProviders]
  );

  const updateProvider = useCallback(
    async (id: string, data: Partial<ProviderFormData & { isEnabled: boolean }>) => {
      const providerId = normalizeAdminSelector(id);
      const safeData = normalizeProviderData(data);
      if (!providerId || !safeData) {
        return invalidResult<AIProvider>('Invalid provider selector');
      }
      const result = await adminApiFetch<AIProvider>(`/providers/${encodeSelector(providerId)}`, { pathPrefix: '/api/v1/admin/ai',
        method: 'PUT',
        body: safeData,
      });
      if (result.ok) {
        await fetchProviders();
      }
      return result;
    },
    [fetchProviders]
  );

  const deleteProvider = useCallback(
    async (id: string) => {
      const providerId = normalizeAdminSelector(id);
      if (!providerId) return invalidResult<{ deleted: string }>('Invalid provider selector');
      const result = await adminApiFetch<{ deleted: string }>(`/providers/${encodeSelector(providerId)}`, { pathPrefix: '/api/v1/admin/ai',
        method: 'DELETE',
      });
      if (result.ok) {
        await fetchProviders();
      }
      return result;
    },
    [fetchProviders]
  );

  const checkHealth = useCallback(
    async (id: string) => {
      const providerId = normalizeAdminSelector(id);
      if (!providerId) {
        return invalidResult<{
          providerId: string;
          status: string;
          latencyMs: number | null;
          error: string | null;
        }>('Invalid provider selector');
      }
      const result = await adminApiFetch<{
        providerId: string;
        status: string;
        latencyMs: number | null;
        error: string | null;
      }>(`/providers/${encodeSelector(providerId)}/health`, { pathPrefix: '/api/v1/admin/ai', method: 'PUT' });
      if (result.ok) {
        await fetchProviders();
      }
      return result;
    },
    [fetchProviders]
  );

  const killSwitchProvider = useCallback(
    async (id: string) => {
      const providerId = normalizeAdminSelector(id);
      if (!providerId) {
        return invalidResult<{
          killed: boolean;
          id: string;
          provider_name: string;
        }>('Invalid provider selector');
      }
      const result = await adminApiFetch<{
        killed: boolean;
        id: string;
        provider_name: string;
      }>(`/providers/${encodeSelector(providerId)}/kill-switch`, { pathPrefix: '/api/v1/admin/ai', method: 'POST' });
      if (result.ok) {
        await fetchProviders();
      }
      return result;
    },
    [fetchProviders]
  );

  const enableProvider = useCallback(
    async (id: string) => {
      const providerId = normalizeAdminSelector(id);
      if (!providerId) {
        return invalidResult<{
          enabled: boolean;
          id: string;
          provider_name: string;
        }>('Invalid provider selector');
      }
      const result = await adminApiFetch<{
        enabled: boolean;
        id: string;
        provider_name: string;
      }>(`/providers/${encodeSelector(providerId)}/enable`, { pathPrefix: '/api/v1/admin/ai', method: 'POST' });
      if (result.ok) {
        await fetchProviders();
      }
      return result;
    },
    [fetchProviders]
  );

  return {
    providers,
    loading,
    error,
    fetchProviders,
    createProvider,
    updateProvider,
    deleteProvider,
    checkHealth,
    killSwitchProvider,
    enableProvider,
  };
}

// ============================================================================
// Models
// ============================================================================

export function useModels() {
  const [models, setModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchModels = useCallback(async (providerId?: string, enabled?: boolean) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (providerId) {
      const safeProviderId = normalizeAdminSelector(providerId);
      if (!safeProviderId) {
        setError('Invalid provider selector');
        setLoading(false);
        return;
      }
      params.set('provider_id', safeProviderId);
    }
    if (enabled !== undefined) params.set('enabled', String(enabled));
    const query = params.toString() ? `?${params}` : '';

    const result = await adminApiFetch<{ models: AIModel[] }>(`/models${query}`, { pathPrefix: '/api/v1/admin/ai' });
    if (result.ok && result.data) {
      setModels(result.data.models);
    } else {
      setError(result.error || 'Failed to fetch models');
    }
    setLoading(false);
  }, []);

  const createModel = useCallback(
    async (data: ModelFormData) => {
      const safeData = normalizeModelData(data, true);
      if (!safeData) return invalidResult<AIModel>('Invalid model payload');
      const result = await adminApiFetch<AIModel>('/models', { pathPrefix: '/api/v1/admin/ai',
        method: 'POST',
        body: safeData,
      });
      if (result.ok) {
        await fetchModels();
      }
      return result;
    },
    [fetchModels]
  );

  const updateModel = useCallback(
    async (id: string, data: Partial<ModelFormData & { isEnabled: boolean }>) => {
      const modelId = normalizeAdminSelector(id);
      const safeData = normalizeModelData(data);
      if (!modelId || !safeData) return invalidResult<AIModel>('Invalid model selector');
      const result = await adminApiFetch<AIModel>(`/models/${encodeSelector(modelId)}`, { pathPrefix: '/api/v1/admin/ai',
        method: 'PUT',
        body: safeData,
      });
      if (result.ok) {
        await fetchModels();
      }
      return result;
    },
    [fetchModels]
  );

  const deleteModel = useCallback(
    async (id: string) => {
      const modelId = normalizeAdminSelector(id);
      if (!modelId) return invalidResult<{ deleted: string }>('Invalid model selector');
      const result = await adminApiFetch<{ deleted: string }>(`/models/${encodeSelector(modelId)}`, { pathPrefix: '/api/v1/admin/ai',
        method: 'DELETE',
      });
      if (result.ok) {
        await fetchModels();
      }
      return result;
    },
    [fetchModels]
  );

  const testModel = useCallback(async (id: string, prompt?: string) => {
    const modelId = normalizeAdminSelector(id);
    if (!modelId) {
      return {
        ok: false,
        error: 'Invalid model selector',
      };
    }
    const result = await adminApiFetch<{
      results: Array<{
        model_id: string;
        model_name: string;
        response: string | null;
        latency_ms: number;
        status: 'success' | 'error';
        error_message: string | null;
      }>;
    }>('/playground/run', { pathPrefix: '/api/v1/admin/ai',
      method: 'POST',
      body: {
        model_ids: [modelId],
        user_prompt: prompt || 'Return a short health-check response for this model.',
      },
    });

    if (!result.ok || !result.data?.results?.[0]) {
      return {
        ok: false,
        error: result.error || 'Model test failed',
      };
    }

    const testResult = result.data.results[0];
    return {
      ok: true,
      data: {
        success: testResult.status === 'success',
        modelId: testResult.model_id,
        modelName: testResult.model_name,
        latencyMs: testResult.latency_ms,
        response: testResult.response || undefined,
        error: testResult.error_message || undefined,
      },
    };
  }, []);

  return {
    models,
    loading,
    error,
    fetchModels,
    createModel,
    updateModel,
    deleteModel,
    testModel,
  };
}

// ============================================================================
// Routes
// ============================================================================

export function useRoutes() {
  const [routes, setRoutes] = useState<AIRoute[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRoutes = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await adminApiFetch<{ routes: AIRoute[] }>('/routes', { pathPrefix: '/api/v1/admin/ai' });
    if (result.ok && result.data) {
      setRoutes(result.data.routes);
    } else {
      setError(result.error || 'Failed to fetch routes');
    }
    setLoading(false);
  }, []);

  const createRoute = useCallback(
    async (data: RouteFormData) => {
      const safeData = normalizeRouteData(data, true);
      if (!safeData) return invalidResult<AIRoute>('Invalid route payload');
      const result = await adminApiFetch<AIRoute>('/routes', { pathPrefix: '/api/v1/admin/ai',
        method: 'POST',
        body: safeData,
      });
      if (result.ok) {
        await fetchRoutes();
      }
      return result;
    },
    [fetchRoutes]
  );

  const updateRoute = useCallback(
    async (id: string, data: Partial<RouteFormData & { isEnabled: boolean }>) => {
      const routeId = normalizeAdminSelector(id);
      const safeData = normalizeRouteData(data);
      if (!routeId || !safeData) return invalidResult<AIRoute>('Invalid route selector');
      const result = await adminApiFetch<AIRoute>(`/routes/${encodeSelector(routeId)}`, { pathPrefix: '/api/v1/admin/ai',
        method: 'PUT',
        body: safeData,
      });
      if (result.ok) {
        await fetchRoutes();
      }
      return result;
    },
    [fetchRoutes]
  );

  const deleteRoute = useCallback(
    async (id: string) => {
      const routeId = normalizeAdminSelector(id);
      if (!routeId) return invalidResult<{ deleted: string }>('Invalid route selector');
      const result = await adminApiFetch<{ deleted: string }>(`/routes/${encodeSelector(routeId)}`, { pathPrefix: '/api/v1/admin/ai',
        method: 'DELETE',
      });
      if (result.ok) {
        await fetchRoutes();
      }
      return result;
    },
    [fetchRoutes]
  );

  return {
    routes,
    loading,
    error,
    fetchRoutes,
    createRoute,
    updateRoute,
    deleteRoute,
  };
}

// ============================================================================
// Usage
// ============================================================================

export function useUsage() {
  const [usage, setUsage] = useState<AIUsageData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = useCallback(
    async (options?: {
      startDate?: string;
      endDate?: string;
      modelId?: string;
      groupBy?: 'day' | 'model';
    }) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      const startDate = normalizeDateQueryValue(options?.startDate);
      const endDate = normalizeDateQueryValue(options?.endDate);
      if (options?.startDate && !startDate) {
        setError('Invalid usage start date');
        setLoading(false);
        return;
      }
      if (options?.endDate && !endDate) {
        setError('Invalid usage end date');
        setLoading(false);
        return;
      }
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      if (options?.modelId) {
        const modelId = normalizeAdminSelector(options.modelId);
        if (!modelId) {
          setError('Invalid model selector');
          setLoading(false);
          return;
        }
        params.set('model_id', modelId);
      }
      if (options?.groupBy) {
        if (options.groupBy !== 'day' && options.groupBy !== 'model') {
          setError('Invalid usage grouping');
          setLoading(false);
          return;
        }
        params.set('group_by', options.groupBy);
      }
      const query = params.toString() ? `?${params}` : '';

      const result = await adminApiFetch<AIUsageData>(`/usage${query}`, { pathPrefix: '/api/v1/admin/ai' });
      if (result.ok && result.data) {
        setUsage(result.data);
      } else {
        setError(result.error || 'Failed to fetch usage');
      }
      setLoading(false);
    },
    []
  );

  return {
    usage,
    loading,
    error,
    fetchUsage,
  };
}

// ============================================================================
// Config
// ============================================================================

export function useAIConfig() {
  const exportConfig = useCallback(async () => {
    const result = await adminApiFetch<{
      exportedAt: string;
      providers: AIProvider[];
      models: AIModel[];
      routes: AIRoute[];
    }>('/config/export', { pathPrefix: '/api/v1/admin/ai' });
    return result;
  }, []);

  return {
    exportConfig,
  };
}

export interface AITraceSummary {
  trace_id: string;
  total_spans: number;
  total_latency_ms: number | null;
  status: 'pending' | 'success' | 'error' | 'timeout';
  root_span_type: string | null;
  model_id: string | null;
  provider_id: string | null;
  user_id: string | null;
  request_path: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface AITraceSpan {
  id: string;
  trace_id: string;
  span_id: string;
  parent_span_id: string | null;
  span_type: string;
  start_time_ms: number;
  end_time_ms: number | null;
  latency_ms: number | null;
  status: string;
  model_id: string | null;
  provider_id: string | null;
  request_path: string | null;
  request_method: string | null;
  response_status: number | null;
  error_message: string | null;
  tokens_used: number | null;
  estimated_cost: number | null;
  metadata: string | null;
  created_at: string;
}

export interface TraceStats {
  total_traces: number;
  success_count: number;
  error_count: number;
  timeout_count: number;
  avg_latency_ms: number | null;
  max_latency_ms: number | null;
  min_latency_ms: number | null;
}

export function useTraces() {
  const [traces, setTraces] = useState<AITraceSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const fetchTraces = useCallback(
    async (options?: {
      limit?: number;
      offset?: number;
      status?: string;
      traceId?: string;
      startDate?: string;
      endDate?: string;
    }) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (options?.limit) params.set('limit', String(normalizePositiveInteger(options.limit, 50, 500)));
      if (options?.offset) params.set('offset', String(normalizeNonNegativeInteger(options.offset, 0, 100000)));
      if (options?.status) {
        if (!TRACE_STATUSES.includes(options.status as typeof TRACE_STATUSES[number])) {
          setError('Invalid trace status');
          setLoading(false);
          return;
        }
        params.set('status', options.status);
      }
      if (options?.traceId) {
        const traceId = normalizeAdminSelector(options.traceId);
        if (!traceId) {
          setError('Invalid trace selector');
          setLoading(false);
          return;
        }
        params.set('trace_id', traceId);
      }
      const startDate = normalizeDateQueryValue(options?.startDate);
      const endDate = normalizeDateQueryValue(options?.endDate);
      if (options?.startDate && !startDate) {
        setError('Invalid trace start date');
        setLoading(false);
        return;
      }
      if (options?.endDate && !endDate) {
        setError('Invalid trace end date');
        setLoading(false);
        return;
      }
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      const query = params.toString() ? `?${params}` : '';

      const result = await adminApiFetch<{
        traces: AITraceSummary[];
        total: number;
        limit: number;
        offset: number;
      }>(`/traces${query}`, { pathPrefix: '/api/v1/admin/ai' });
      if (result.ok && result.data) {
        setTraces(result.data.traces);
        setTotal(result.data.total);
      } else {
        setError(result.error || 'Failed to fetch traces');
      }
      setLoading(false);
    },
    []
  );

  const fetchTraceDetail = useCallback(async (traceId: string) => {
    const safeTraceId = normalizeAdminSelector(traceId);
    if (!safeTraceId) {
      return invalidResult<{
        summary: AITraceSummary;
        spans: AITraceSpan[];
      }>('Invalid trace selector');
    }
    const result = await adminApiFetch<{
      summary: AITraceSummary;
      spans: AITraceSpan[];
    }>(`/traces/${encodeSelector(safeTraceId)}`, { pathPrefix: '/api/v1/admin/ai' });
    return result;
  }, []);

  const fetchTraceStats = useCallback(async (hours = 24) => {
    const safeHours = normalizePositiveInteger(hours, 24, 24 * 31);
    const result = await adminApiFetch<{
      period_hours: number;
      since: string;
      stats: TraceStats;
      by_span_type: Array<{ span_type: string; count: number; avg_latency: number }>;
    }>(`/traces/stats/summary?hours=${safeHours}`, { pathPrefix: '/api/v1/admin/ai' });
    return result;
  }, []);

  return {
    traces,
    loading,
    error,
    total,
    fetchTraces,
    fetchTraceDetail,
    fetchTraceStats,
  };
}

export interface PlaygroundHistory {
  id: string;
  user_id: string | null;
  title: string | null;
  system_prompt: string | null;
  user_prompt: string;
  model_id: string | null;
  model_name: string | null;
  provider_id: string | null;
  provider_name: string | null;
  response: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  latency_ms: number | null;
  estimated_cost: number | null;
  temperature: number;
  max_tokens: number | null;
  status: 'pending' | 'success' | 'error';
  error_message: string | null;
  metadata: string | null;
  created_at: string;
}

export interface PlaygroundRunResult {
  model_id: string;
  model_name: string;
  provider_name: string;
  response: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  latency_ms: number;
  estimated_cost: number | null;
  status: 'success' | 'error';
  error_message: string | null;
  history_id: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  system_prompt: string | null;
  user_prompt_template: string;
  variables: string | null;
  default_model_id: string | null;
  default_temperature: number;
  default_max_tokens: number | null;
  is_public: number;
  usage_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function usePlayground() {
  const [history, setHistory] = useState<PlaygroundHistory[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const runPlayground = useCallback(
    async (params: {
      system_prompt?: string;
      user_prompt: string;
      model_ids: string[];
      temperature?: number;
      max_tokens?: number;
      title?: string;
    }) => {
      setRunning(true);
      setError(null);
      const modelIds = normalizeSelectorList(params.model_ids);
      if (modelIds.length === 0) {
        setRunning(false);
        setError('Invalid model selector');
        return invalidResult<{
          results: PlaygroundRunResult[];
          input: {
            system_prompt?: string;
            user_prompt: string;
            temperature: number;
            max_tokens?: number;
          };
        }>('Invalid model selector');
      }
      const result = await adminApiFetch<{
        results: PlaygroundRunResult[];
        input: {
          system_prompt?: string;
          user_prompt: string;
          temperature: number;
          max_tokens?: number;
        };
      }>('/playground/run', { pathPrefix: '/api/v1/admin/ai',
        method: 'POST',
        body: { ...params, model_ids: modelIds },
      });
      setRunning(false);
      if (!result.ok) {
        setError(result.error || 'Failed to run playground');
      }
      return result;
    },
    []
  );

  const fetchHistory = useCallback(
    async (options?: { limit?: number; offset?: number; modelId?: string; status?: string }) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (options?.limit) params.set('limit', String(normalizePositiveInteger(options.limit, 50, 500)));
      if (options?.offset) params.set('offset', String(normalizeNonNegativeInteger(options.offset, 0, 100000)));
      if (options?.modelId) {
        const modelId = normalizeAdminSelector(options.modelId);
        if (!modelId) {
          setError('Invalid model selector');
          setLoading(false);
          return;
        }
        params.set('model_id', modelId);
      }
      if (options?.status) {
        if (!HISTORY_STATUSES.includes(options.status as typeof HISTORY_STATUSES[number])) {
          setError('Invalid history status');
          setLoading(false);
          return;
        }
        params.set('status', options.status);
      }
      const query = params.toString() ? `?${params}` : '';

      const result = await adminApiFetch<{
        history: PlaygroundHistory[];
        total: number;
        limit: number;
        offset: number;
      }>(`/playground/history${query}`, { pathPrefix: '/api/v1/admin/ai' });
      if (result.ok && result.data) {
        setHistory(result.data.history);
        setTotal(result.data.total);
      } else {
        setError(result.error || 'Failed to fetch history');
      }
      setLoading(false);
    },
    []
  );

  const fetchHistoryDetail = useCallback(async (id: string) => {
    const historyId = normalizeAdminSelector(id);
    if (!historyId) return invalidResult<{ history: PlaygroundHistory }>('Invalid history selector');
    const result = await adminApiFetch<{ history: PlaygroundHistory }>(`/playground/history/${encodeSelector(historyId)}`, { pathPrefix: '/api/v1/admin/ai' });
    return result;
  }, []);

  const deleteHistory = useCallback(
    async (id: string) => {
      const historyId = normalizeAdminSelector(id);
      if (!historyId) {
        return invalidResult<{ deleted: boolean; id: string }>('Invalid history selector');
      }
      const result = await adminApiFetch<{ deleted: boolean; id: string }>(
        `/playground/history/${encodeSelector(historyId)}`,
        { pathPrefix: '/api/v1/admin/ai', method: 'DELETE' }
      );
      if (result.ok) {
        await fetchHistory();
      }
      return result;
    },
    [fetchHistory]
  );

  const clearHistory = useCallback(
    async (olderThanDays?: number) => {
      const safeOlderThanDays =
        olderThanDays === undefined
          ? null
          : normalizePositiveInteger(olderThanDays, 30, 3650);
      const query = safeOlderThanDays ? `?older_than_days=${safeOlderThanDays}` : '';
      const result = await adminApiFetch<{ deleted: boolean; rows_affected: number }>(
        `/playground/history${query}`,
        { pathPrefix: '/api/v1/admin/ai', method: 'DELETE' }
      );
      if (result.ok) {
        await fetchHistory();
      }
      return result;
    },
    [fetchHistory]
  );

  const fetchTemplates = useCallback(async (category?: string) => {
    setTemplatesError(null);
    if (category && !normalizeAdminSelector(category)) {
      setTemplatesError('Invalid template category');
      return invalidResult<{ templates: PromptTemplate[]; total: number }>(
        'Invalid template category'
      );
    }
    const query = category ? `?category=${normalizeAdminSelector(category)}` : '';
    const result = await adminApiFetch<{ templates: PromptTemplate[]; total: number }>(
      `/prompt-templates${query}`
    , { pathPrefix: '/api/v1/admin/ai' });
    if (result.ok && result.data) {
      setTemplates(result.data.templates);
    } else {
      setTemplatesError(result.error || 'Failed to fetch templates');
    }
    return result;
  }, []);

  const createTemplate = useCallback(
    async (data: {
      name: string;
      description?: string;
      category?: string;
      system_prompt?: string;
      user_prompt_template: string;
      variables?: string[];
      default_model_id?: string;
      default_temperature?: number;
      default_max_tokens?: number;
      is_public?: boolean;
    }) => {
      const category = data.category
        ? normalizeAdminSelector(data.category)
        : undefined;
      const defaultModelId = data.default_model_id
        ? normalizeAdminSelector(data.default_model_id)
        : undefined;
      if ((data.category && !category) || (data.default_model_id && !defaultModelId)) {
        return invalidResult<{ template: PromptTemplate }>('Invalid template selector');
      }
      const result = await adminApiFetch<{ template: PromptTemplate }>('/prompt-templates', { pathPrefix: '/api/v1/admin/ai',
        method: 'POST',
        body: {
          ...data,
          ...(category ? { category } : {}),
          ...(defaultModelId ? { default_model_id: defaultModelId } : {}),
        },
      });
      if (result.ok) {
        await fetchTemplates();
      }
      return result;
    },
    [fetchTemplates]
  );

  const updateTemplate = useCallback(
    async (
      id: string,
      data: Partial<{
        name: string;
        description: string;
        category: string;
        system_prompt: string;
        user_prompt_template: string;
        variables: string[];
        default_model_id: string;
        default_temperature: number;
        default_max_tokens: number;
        is_public: boolean;
      }>
    ) => {
      const templateId = normalizeAdminSelector(id);
      const category = data.category
        ? normalizeAdminSelector(data.category)
        : undefined;
      const defaultModelId = data.default_model_id
        ? normalizeAdminSelector(data.default_model_id)
        : undefined;
      if (
        !templateId ||
        (data.category && !category) ||
        (data.default_model_id && !defaultModelId)
      ) {
        return invalidResult<{ template: PromptTemplate }>('Invalid template selector');
      }
      const result = await adminApiFetch<{ template: PromptTemplate }>(`/prompt-templates/${encodeSelector(templateId)}`, { pathPrefix: '/api/v1/admin/ai',
        method: 'PUT',
        body: {
          ...data,
          ...(category ? { category } : {}),
          ...(defaultModelId ? { default_model_id: defaultModelId } : {}),
        },
      });
      if (result.ok) {
        await fetchTemplates();
      }
      return result;
    },
    [fetchTemplates]
  );

  const deleteTemplate = useCallback(
    async (id: string) => {
      const templateId = normalizeAdminSelector(id);
      if (!templateId) {
        return invalidResult<{ deleted: boolean; id: string }>('Invalid template selector');
      }
      const result = await adminApiFetch<{ deleted: boolean; id: string }>(
        `/prompt-templates/${encodeSelector(templateId)}`,
        { pathPrefix: '/api/v1/admin/ai', method: 'DELETE' }
      );
      if (result.ok) {
        await fetchTemplates();
      }
      return result;
    },
    [fetchTemplates]
  );

  const applyTemplate = useCallback(async (id: string) => {
    const templateId = normalizeAdminSelector(id);
    if (!templateId) return invalidResult<{ template: PromptTemplate }>('Invalid template selector');
    const result = await adminApiFetch<{ template: PromptTemplate }>(`/prompt-templates/${encodeSelector(templateId)}/use`, { pathPrefix: '/api/v1/admin/ai',
      method: 'POST',
    });
    return result;
  }, []);

  return {
    history,
    templates,
    loading,
    running,
    error,
    templatesError,
    total,
    runPlayground,
    fetchHistory,
    fetchHistoryDetail,
    deleteHistory,
    clearHistory,
    fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    applyTemplate,
  };
}
