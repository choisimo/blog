/**
 * Secrets Management API Hooks
 */

import { useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import type {
  SecretCategory,
  SecretPublic,
  SecretAuditLog,
  SecretFormData,
  SecretsOverview,
  SecretsHealth,
} from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// ============================================================================
// API Fetch Wrapper
// ============================================================================

async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; data?: T; error?: string }> {
  const { getValidAccessToken, clearAuth } = useAuthStore.getState();

  try {
    const token = await getValidAccessToken();

    if (!token) {
      return { ok: false, error: 'Not authenticated. Please log in again.' };
    }

    const res = await fetch(`${API_BASE}/api/v1/admin/secrets${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    if (res.status === 401) {
      const newToken = await getValidAccessToken();
      if (!newToken) {
        clearAuth();
        return { ok: false, error: 'Session expired. Please log in again.' };
      }

      const retryRes = await fetch(`${API_BASE}/api/v1/admin/secrets${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newToken}`,
          ...(options.headers || {}),
        },
      });

      if (!retryRes.ok) {
        if (retryRes.status === 401) {
          clearAuth();
          return { ok: false, error: 'Session expired. Please log in again.' };
        }
        const json = await retryRes.json().catch(() => ({}));
        return { ok: false, error: json.error || `HTTP ${retryRes.status}` };
      }

      const json = await retryRes.json();
      return { ok: true, data: json.data };
    }

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
// Categories Hook
// ============================================================================

export function useCategories() {
  const [categories, setCategories] = useState<SecretCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await apiFetch<{ categories: SecretCategory[] }>('/categories');
    if (result.ok && result.data) {
      setCategories(result.data.categories);
    } else {
      setError(result.error || 'Failed to fetch categories');
    }
    setLoading(false);
  }, []);

  const createCategory = useCallback(
    async (data: { name: string; displayName: string; description?: string; icon?: string }) => {
      const result = await apiFetch<{ category: SecretCategory }>('/categories', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (result.ok) {
        await fetchCategories();
      }
      return result;
    },
    [fetchCategories]
  );

  return {
    categories,
    loading,
    error,
    fetchCategories,
    createCategory,
  };
}

// ============================================================================
// Secrets Hook
// ============================================================================

export function useSecrets() {
  const [secrets, setSecrets] = useState<SecretPublic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSecrets = useCallback(async (categoryId?: string) => {
    setLoading(true);
    setError(null);
    const query = categoryId ? `?categoryId=${categoryId}` : '';
    const result = await apiFetch<{ secrets: SecretPublic[] }>(`/${query}`);
    if (result.ok && result.data) {
      setSecrets(result.data.secrets);
    } else {
      setError(result.error || 'Failed to fetch secrets');
    }
    setLoading(false);
  }, []);

  const createSecret = useCallback(
    async (data: SecretFormData) => {
      const result = await apiFetch<{ secret: SecretPublic }>('/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (result.ok) {
        await fetchSecrets();
      }
      return result;
    },
    [fetchSecrets]
  );

  const updateSecret = useCallback(
    async (id: string, data: Partial<SecretFormData>) => {
      const result = await apiFetch<{ secret: SecretPublic }>(`/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      if (result.ok) {
        await fetchSecrets();
      }
      return result;
    },
    [fetchSecrets]
  );

  const deleteSecret = useCallback(
    async (id: string) => {
      const result = await apiFetch<{ deleted: string }>(`/${id}`, {
        method: 'DELETE',
      });
      if (result.ok) {
        await fetchSecrets();
      }
      return result;
    },
    [fetchSecrets]
  );

  const revealSecret = useCallback(async (id: string) => {
    const result = await apiFetch<{ id: string; keyName: string; value: string }>(`/${id}/reveal`, {
      method: 'POST',
    });
    return result;
  }, []);

  const generateValue = useCallback(
    async (type: 'secret' | 'apiKey' | 'uuid' = 'secret', length?: number, prefix?: string) => {
      const result = await apiFetch<{ value: string; type: string }>('/generate', {
        method: 'POST',
        body: JSON.stringify({ type, length, prefix }),
      });
      return result;
    },
    []
  );

  return {
    secrets,
    loading,
    error,
    fetchSecrets,
    createSecret,
    updateSecret,
    deleteSecret,
    revealSecret,
    generateValue,
  };
}

// ============================================================================
// Audit Log Hook
// ============================================================================

export function useAuditLog() {
  const [logs, setLogs] = useState<SecretAuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ total: 0, limit: 50, offset: 0 });

  const fetchLogs = useCallback(
    async (options?: { secretId?: string; action?: string; limit?: number; offset?: number }) => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (options?.secretId) params.set('secretId', options.secretId);
      if (options?.action) params.set('action', options.action);
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.offset) params.set('offset', String(options.offset));

      const query = params.toString() ? `?${params}` : '';
      const result = await apiFetch<{
        logs: SecretAuditLog[];
        pagination: { total: number; limit: number; offset: number };
      }>(`/audit${query}`);

      if (result.ok && result.data) {
        setLogs(result.data.logs);
        setPagination(result.data.pagination);
      } else {
        setError(result.error || 'Failed to fetch audit logs');
      }
      setLoading(false);
    },
    []
  );

  return {
    logs,
    loading,
    error,
    pagination,
    fetchLogs,
  };
}

// ============================================================================
// Overview & Health Hook
// ============================================================================

export function useSecretsOverview() {
  const [overview, setOverview] = useState<SecretsOverview | null>(null);
  const [health, setHealth] = useState<SecretsHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [overviewResult, healthResult] = await Promise.all([
      apiFetch<SecretsOverview>('/overview'),
      apiFetch<SecretsHealth>('/health'),
    ]);

    if (overviewResult.ok && overviewResult.data) {
      setOverview(overviewResult.data);
    }
    if (healthResult.ok && healthResult.data) {
      setHealth(healthResult.data);
    }
    if (!overviewResult.ok && !healthResult.ok) {
      setError(overviewResult.error || healthResult.error || 'Failed to fetch overview');
    }

    setLoading(false);
  }, []);

  return {
    overview,
    health,
    loading,
    error,
    fetchOverview,
  };
}

// ============================================================================
// Import/Export Hook
// ============================================================================

export function useSecretsExport() {
  const [loading, setLoading] = useState(false);

  const exportSecrets = useCallback(async (includeValues = false) => {
    const query = includeValues ? '?includeValues=true' : '';
    const result = await apiFetch<{
      exportedAt: string;
      categories: SecretCategory[];
      secrets: SecretPublic[];
    }>(`/export${query}`);
    return result;
  }, []);

  const importSecrets = useCallback(
    async (
      secrets: Array<{
        categoryId: string;
        keyName: string;
        displayName: string;
        value?: string;
      }>,
      overwrite = false
    ) => {
      setLoading(true);
      const result = await apiFetch<{
        created: number;
        updated: number;
        skipped: number;
        errors: string[];
      }>('/import', {
        method: 'POST',
        body: JSON.stringify({ secrets, overwrite }),
      });
      setLoading(false);
      return result;
    },
    []
  );

  return {
    loading,
    exportSecrets,
    importSecrets,
  };
}
