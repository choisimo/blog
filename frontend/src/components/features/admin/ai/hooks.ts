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
      const result = await adminApiFetch<AIProvider>('/providers', { pathPrefix: '/api/v1/admin/ai',
        method: 'POST',
        body: data,
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
      const result = await adminApiFetch<AIProvider>(`/providers/${id}`, { pathPrefix: '/api/v1/admin/ai',
        method: 'PUT',
        body: data,
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
      const result = await adminApiFetch<{ deleted: string }>(`/providers/${id}`, { pathPrefix: '/api/v1/admin/ai',
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
      const result = await adminApiFetch<{
        providerId: string;
        status: string;
        latencyMs: number | null;
        error: string | null;
      }>(`/providers/${id}/health`, { pathPrefix: '/api/v1/admin/ai', method: 'PUT' });
      if (result.ok) {
        await fetchProviders();
      }
      return result;
    },
    [fetchProviders]
  );

  const killSwitchProvider = useCallback(
    async (id: string) => {
      const result = await adminApiFetch<{
        killed: boolean;
        id: string;
        provider_name: string;
      }>(`/providers/${id}/kill-switch`, { pathPrefix: '/api/v1/admin/ai', method: 'POST' });
      if (result.ok) {
        await fetchProviders();
      }
      return result;
    },
    [fetchProviders]
  );

  const enableProvider = useCallback(
    async (id: string) => {
      const result = await adminApiFetch<{
        enabled: boolean;
        id: string;
        provider_name: string;
      }>(`/providers/${id}/enable`, { pathPrefix: '/api/v1/admin/ai', method: 'POST' });
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
    if (providerId) params.set('provider_id', providerId);
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
      const result = await adminApiFetch<AIModel>('/models', { pathPrefix: '/api/v1/admin/ai',
        method: 'POST',
        body: data,
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
      const result = await adminApiFetch<AIModel>(`/models/${id}`, { pathPrefix: '/api/v1/admin/ai',
        method: 'PUT',
        body: data,
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
      const result = await adminApiFetch<{ deleted: string }>(`/models/${id}`, { pathPrefix: '/api/v1/admin/ai',
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
    const result = await apiFetch<{
      results: Array<{
        model_id: string;
        model_name: string;
        response: string | null;
        latency_ms: number;
        status: 'success' | 'error';
        error_message: string | null;
      }>;
    }>('/playground/run', {
      method: 'POST',
      body: JSON.stringify({
        model_ids: [id],
        user_prompt: prompt || 'Return a short health-check response for this model.',
      }),
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
      const result = await adminApiFetch<AIRoute>('/routes', { pathPrefix: '/api/v1/admin/ai',
        method: 'POST',
        body: data,
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
      const result = await adminApiFetch<AIRoute>(`/routes/${id}`, { pathPrefix: '/api/v1/admin/ai',
        method: 'PUT',
        body: data,
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
      const result = await adminApiFetch<{ deleted: string }>(`/routes/${id}`, { pathPrefix: '/api/v1/admin/ai',
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
      if (options?.startDate) params.set('start_date', options.startDate);
      if (options?.endDate) params.set('end_date', options.endDate);
      if (options?.modelId) params.set('model_id', options.modelId);
      if (options?.groupBy) params.set('group_by', options.groupBy);
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
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.offset) params.set('offset', String(options.offset));
      if (options?.status) params.set('status', options.status);
      if (options?.traceId) params.set('trace_id', options.traceId);
      if (options?.startDate) params.set('start_date', options.startDate);
      if (options?.endDate) params.set('end_date', options.endDate);
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
    const result = await adminApiFetch<{
      summary: AITraceSummary;
      spans: AITraceSpan[];
    }>(`/traces/${traceId}`, { pathPrefix: '/api/v1/admin/ai' });
    return result;
  }, []);

  const fetchTraceStats = useCallback(async (hours = 24) => {
    const result = await adminApiFetch<{
      period_hours: number;
      since: string;
      stats: TraceStats;
      by_span_type: Array<{ span_type: string; count: number; avg_latency: number }>;
    }>(`/traces/stats/summary?hours=${hours}`, { pathPrefix: '/api/v1/admin/ai' });
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
        body: params,
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
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.offset) params.set('offset', String(options.offset));
      if (options?.modelId) params.set('model_id', options.modelId);
      if (options?.status) params.set('status', options.status);
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
    const result = await adminApiFetch<{ history: PlaygroundHistory }>(`/playground/history/${id}`, { pathPrefix: '/api/v1/admin/ai' });
    return result;
  }, []);

  const deleteHistory = useCallback(
    async (id: string) => {
      const result = await adminApiFetch<{ deleted: boolean; id: string }>(
        `/playground/history/${id}`,
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
      const query = olderThanDays ? `?older_than_days=${olderThanDays}` : '';
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
    const query = category ? `?category=${category}` : '';
    const result = await adminApiFetch<{ templates: PromptTemplate[]; total: number }>(
      `/prompt-templates${query}`
    , { pathPrefix: '/api/v1/admin/ai' });
    if (result.ok && result.data) {
      setTemplates(result.data.templates);
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
      const result = await adminApiFetch<{ template: PromptTemplate }>('/prompt-templates', { pathPrefix: '/api/v1/admin/ai',
        method: 'POST',
        body: data,
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
      const result = await adminApiFetch<{ template: PromptTemplate }>(`/prompt-templates/${id}`, { pathPrefix: '/api/v1/admin/ai',
        method: 'PUT',
        body: data,
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
      const result = await adminApiFetch<{ deleted: boolean; id: string }>(
        `/prompt-templates/${id}`,
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
    const result = await adminApiFetch<{ template: PromptTemplate }>(`/prompt-templates/${id}/use`, { pathPrefix: '/api/v1/admin/ai',
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
