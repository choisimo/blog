/**
 * AI Admin API Hooks
 */

import { useState, useCallback } from 'react';
import type {
  AIProvider,
  AIModel,
  AIRoute,
  AIUsageData,
  ProviderFormData,
  ModelFormData,
  RouteFormData,
} from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const getAuthHeaders = () => {
  const token = localStorage.getItem('adminToken');
  return {
    'Content-Type': 'application/json',
    Authorization: token ? `Bearer ${token}` : '',
  };
};

// Generic fetch wrapper
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/admin/ai${endpoint}`, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...(options.headers || {}),
      },
    });

    const json = await res.json();

    if (!res.ok || !json.ok) {
      return { ok: false, error: json.error || `HTTP ${res.status}` };
    }

    return { ok: true, data: json.data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
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
    const result = await apiFetch<{ providers: AIProvider[] }>('/providers');
    if (result.ok && result.data) {
      setProviders(result.data.providers);
    } else {
      setError(result.error || 'Failed to fetch providers');
    }
    setLoading(false);
  }, []);

  const createProvider = useCallback(async (data: ProviderFormData) => {
    const result = await apiFetch<AIProvider>('/providers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (result.ok) {
      await fetchProviders();
    }
    return result;
  }, [fetchProviders]);

  const updateProvider = useCallback(
    async (id: string, data: Partial<ProviderFormData & { isEnabled: boolean }>) => {
      const result = await apiFetch<AIProvider>(`/providers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
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
      const result = await apiFetch<{ deleted: string }>(`/providers/${id}`, {
        method: 'DELETE',
      });
      if (result.ok) {
        await fetchProviders();
      }
      return result;
    },
    [fetchProviders]
  );

  const checkHealth = useCallback(async (id: string) => {
    const result = await apiFetch<{
      providerId: string;
      status: string;
      latencyMs: number | null;
      error: string | null;
    }>(`/providers/${id}/health`, { method: 'POST' });
    if (result.ok) {
      await fetchProviders();
    }
    return result;
  }, [fetchProviders]);

  return {
    providers,
    loading,
    error,
    fetchProviders,
    createProvider,
    updateProvider,
    deleteProvider,
    checkHealth,
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
    if (providerId) params.set('providerId', providerId);
    if (enabled !== undefined) params.set('enabled', String(enabled));
    const query = params.toString() ? `?${params}` : '';
    
    const result = await apiFetch<{ models: AIModel[] }>(`/models${query}`);
    if (result.ok && result.data) {
      setModels(result.data.models);
    } else {
      setError(result.error || 'Failed to fetch models');
    }
    setLoading(false);
  }, []);

  const createModel = useCallback(async (data: ModelFormData) => {
    const result = await apiFetch<AIModel>('/models', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (result.ok) {
      await fetchModels();
    }
    return result;
  }, [fetchModels]);

  const updateModel = useCallback(
    async (id: string, data: Partial<ModelFormData & { isEnabled: boolean }>) => {
      const result = await apiFetch<AIModel>(`/models/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
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
      const result = await apiFetch<{ deleted: string }>(`/models/${id}`, {
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
      success: boolean;
      modelId: string;
      modelName: string;
      latencyMs?: number;
      response?: string;
      error?: string;
    }>(`/models/${id}/test`, {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
    return result;
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
    const result = await apiFetch<{ routes: AIRoute[] }>('/routes');
    if (result.ok && result.data) {
      setRoutes(result.data.routes);
    } else {
      setError(result.error || 'Failed to fetch routes');
    }
    setLoading(false);
  }, []);

  const createRoute = useCallback(async (data: RouteFormData) => {
    const result = await apiFetch<AIRoute>('/routes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (result.ok) {
      await fetchRoutes();
    }
    return result;
  }, [fetchRoutes]);

  const updateRoute = useCallback(
    async (id: string, data: Partial<RouteFormData & { isEnabled: boolean }>) => {
      const result = await apiFetch<AIRoute>(`/routes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
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
      const result = await apiFetch<{ deleted: string }>(`/routes/${id}`, {
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
      if (options?.startDate) params.set('startDate', options.startDate);
      if (options?.endDate) params.set('endDate', options.endDate);
      if (options?.modelId) params.set('modelId', options.modelId);
      if (options?.groupBy) params.set('groupBy', options.groupBy);
      const query = params.toString() ? `?${params}` : '';

      const result = await apiFetch<AIUsageData>(`/usage${query}`);
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
  const [loading, setLoading] = useState(false);

  const reloadConfig = useCallback(async () => {
    setLoading(true);
    const result = await apiFetch<{
      config: unknown;
      modelCount: number;
      message: string;
    }>('/reload', { method: 'POST' });
    setLoading(false);
    return result;
  }, []);

  const exportConfig = useCallback(async () => {
    const result = await apiFetch<{
      exportedAt: string;
      providers: AIProvider[];
      models: AIModel[];
      routes: AIRoute[];
    }>('/config/export');
    return result;
  }, []);

  return {
    loading,
    reloadConfig,
    exportConfig,
  };
}
