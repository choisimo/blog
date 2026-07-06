/**
 * Secrets Management API Hooks
 */

import { useState, useCallback } from "react";
import { adminApiFetch } from "@/services/admin/apiClient";
import type {
  SecretCategory,
  SecretPublic,
  SecretAuditLog,
  SecretFormData,
  SecretsOverview,
  SecretsHealth,
} from "./types";

const SECRET_ACTIONS = new Set<SecretAuditLog["action"]>([
  "created",
  "updated",
  "deleted",
  "rotated",
  "accessed",
]);
const SECRET_GENERATE_TYPES = new Set(["secret", "apiKey", "uuid"] as const);

function normalizeSelector(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || /[\r\n/\\]/.test(normalized) || !/^[A-Za-z0-9_-]+$/.test(normalized)) {
    return null;
  }
  return normalized;
}

function normalizeCategoryId(value: unknown): string | null {
  const normalized = normalizeSelector(value);
  return normalized ? normalized.toLowerCase() : null;
}

function normalizeKeyName(value: unknown): string | null {
  const normalized = normalizeSelector(value);
  return normalized ? normalized.toUpperCase() : null;
}

function normalizeHeaderText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .trim()
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .replace(/\s+/g, " ");
  return normalized || null;
}

function normalizeGenerateType(
  value: unknown,
): "secret" | "apiKey" | "uuid" | null {
  return typeof value === "string" &&
    SECRET_GENERATE_TYPES.has(value as "secret" | "apiKey" | "uuid")
    ? (value as "secret" | "apiKey" | "uuid")
    : null;
}

function normalizeAction(value: unknown): SecretAuditLog["action"] | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return SECRET_ACTIONS.has(normalized as SecretAuditLog["action"])
    ? (normalized as SecretAuditLog["action"])
    : null;
}

function normalizeNonNegativeInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    return null;
  }
  return value;
}

function normalizeSecretFormData(data: SecretFormData): SecretFormData | null {
  const categoryId = normalizeCategoryId(data.categoryId);
  const keyName = normalizeKeyName(data.keyName);
  if (!categoryId || !keyName) return null;

  return {
    ...data,
    categoryId,
    keyName,
    displayName: normalizeHeaderText(data.displayName) ?? keyName,
    description: normalizeHeaderText(data.description) ?? undefined,
    envFallback: normalizeHeaderText(data.envFallback) ?? undefined,
  };
}

function invalidResult(error: string) {
  return { ok: false, error };
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
    const result = await adminApiFetch<{ categories: SecretCategory[] }>(
      "/categories",
      { pathPrefix: "/api/v1/admin/secrets" },
    );
    if (result.ok && result.data) {
      setCategories(result.data.categories);
    } else {
      setError(result.error || "Failed to fetch categories");
    }
    setLoading(false);
  }, []);

  const createCategory = useCallback(
    async (data: {
      name: string;
      displayName: string;
      description?: string;
      icon?: string;
    }) => {
      const result = await adminApiFetch<{ category: SecretCategory }>(
        "/categories",
        {
          pathPrefix: "/api/v1/admin/secrets",
          method: "POST",
          body: data,
        },
      );
      if (result.ok) {
        await fetchCategories();
      }
      return result;
    },
    [fetchCategories],
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
    const normalizedCategoryId = categoryId
      ? normalizeCategoryId(categoryId)
      : null;
    if (categoryId && !normalizedCategoryId) {
      setSecrets([]);
      setError("Invalid secret category filter");
      setLoading(false);
      return;
    }

    const query = normalizedCategoryId
      ? `?categoryId=${encodeURIComponent(normalizedCategoryId)}`
      : "";
    const result = await adminApiFetch<{ secrets: SecretPublic[] }>(query, {
      pathPrefix: "/api/v1/admin/secrets",
    });
    if (result.ok && result.data) {
      setSecrets(result.data.secrets);
    } else {
      setError(result.error || "Failed to fetch secrets");
    }
    setLoading(false);
  }, []);

  const createSecret = useCallback(
    async (data: SecretFormData) => {
      const normalizedData = normalizeSecretFormData(data);
      if (!normalizedData) return invalidResult("Invalid secret payload");

      const result = await adminApiFetch<{ secret: SecretPublic }>("/", {
        pathPrefix: "/api/v1/admin/secrets",
        method: "POST",
        body: normalizedData,
      });
      if (result.ok) {
        await fetchSecrets();
      }
      return result;
    },
    [fetchSecrets],
  );

  const updateSecret = useCallback(
    async (id: string, data: Partial<SecretFormData>) => {
      const normalizedId = normalizeSelector(id);
      if (!normalizedId) return invalidResult("Invalid secret identifier");

      const result = await adminApiFetch<{ secret: SecretPublic }>(`/${normalizedId}`, {
        pathPrefix: "/api/v1/admin/secrets",
        method: "PUT",
        body: {
          ...data,
          displayName: normalizeHeaderText(data.displayName) ?? data.displayName,
          description: normalizeHeaderText(data.description) ?? data.description,
          envFallback: normalizeHeaderText(data.envFallback) ?? data.envFallback,
        },
      });
      if (result.ok) {
        await fetchSecrets();
      }
      return result;
    },
    [fetchSecrets],
  );

  const deleteSecret = useCallback(
    async (id: string) => {
      const normalizedId = normalizeSelector(id);
      if (!normalizedId) return invalidResult("Invalid secret identifier");

      const result = await adminApiFetch<{ deleted: string }>(`/${normalizedId}`, {
        pathPrefix: "/api/v1/admin/secrets",
        method: "DELETE",
      });
      if (result.ok) {
        await fetchSecrets();
      }
      return result;
    },
    [fetchSecrets],
  );

  const revealSecret = useCallback(async (id: string, reason?: string) => {
    const normalizedId = normalizeSelector(id);
    if (!normalizedId) return invalidResult("Invalid secret identifier");

    const trimmedReason = normalizeHeaderText(reason);
    const result = await adminApiFetch<{
      id: string;
      keyName: string;
      value: string;
    }>(`/${normalizedId}/reveal`, {
      pathPrefix: "/api/v1/admin/secrets",
      method: "POST",
      ...(trimmedReason ? { body: { reason: trimmedReason } } : {}),
    });
    return result;
  }, []);

  const generateValue = useCallback(
    async (
      type: "secret" | "apiKey" | "uuid" = "secret",
      length?: number,
      prefix?: string,
    ) => {
      const normalizedType = normalizeGenerateType(type);
      const normalizedLength = length !== undefined
        ? normalizeNonNegativeInteger(length)
        : undefined;
      const normalizedPrefix = normalizeHeaderText(prefix);
      if (!normalizedType || normalizedLength === null) {
        return invalidResult("Invalid secret generator payload");
      }

      const result = await adminApiFetch<{ value: string; type: string }>(
        "/generate",
        {
          pathPrefix: "/api/v1/admin/secrets",
          method: "POST",
          body: {
            type: normalizedType,
            ...(normalizedLength !== undefined ? { length: normalizedLength } : {}),
            ...(normalizedPrefix ? { prefix: normalizedPrefix } : {}),
          },
        },
      );
      return result;
    },
    [],
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
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
  });

  const fetchLogs = useCallback(
    async (options?: {
      secretId?: string;
      action?: string;
      limit?: number;
      offset?: number;
    }) => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      const secretId = options?.secretId
        ? normalizeSelector(options.secretId)
        : null;
      const action = options?.action ? normalizeAction(options.action) : null;
      const limit = options?.limit !== undefined
        ? normalizeNonNegativeInteger(options.limit)
        : null;
      const offset = options?.offset !== undefined
        ? normalizeNonNegativeInteger(options.offset)
        : null;

      if (
        (options?.secretId && !secretId) ||
        (options?.action && !action) ||
        (options?.limit !== undefined && limit === null) ||
        (options?.offset !== undefined && offset === null)
      ) {
        setLogs([]);
        setError("Invalid audit log filter");
        setLoading(false);
        return;
      }

      if (secretId) params.set("secretId", secretId);
      if (action) params.set("action", action);
      if (limit !== null) params.set("limit", String(limit));
      if (offset !== null) params.set("offset", String(offset));

      const query = params.toString() ? `?${params}` : "";
      const result = await adminApiFetch<{
        logs: SecretAuditLog[];
        pagination: { total: number; limit: number; offset: number };
      }>(`/audit${query}`, { pathPrefix: "/api/v1/admin/secrets" });

      if (result.ok && result.data) {
        setLogs(result.data.logs);
        setPagination(result.data.pagination);
      } else {
        setError(result.error || "Failed to fetch audit logs");
      }
      setLoading(false);
    },
    [],
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
      adminApiFetch<SecretsOverview>("/overview", {
        pathPrefix: "/api/v1/admin/secrets",
      }),
      adminApiFetch<SecretsHealth>("/health", {
        pathPrefix: "/api/v1/admin/secrets",
      }),
    ]);

    if (overviewResult.ok && overviewResult.data) {
      setOverview(overviewResult.data);
    }
    if (healthResult.ok && healthResult.data) {
      setHealth(healthResult.data);
    }
    if (!overviewResult.ok && !healthResult.ok) {
      setError(
        overviewResult.error ||
          healthResult.error ||
          "Failed to fetch overview",
      );
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

  const exportSecrets = useCallback(async (includeValues = false, reason?: string) => {
    const query = includeValues ? "?includeValues=true" : "";
    const trimmedReason = normalizeHeaderText(reason);
    const result = await adminApiFetch<{
      exportedAt: string;
      categories: SecretCategory[];
      secrets: SecretPublic[];
    }>(`/export${query}`, {
      pathPrefix: "/api/v1/admin/secrets",
      ...(trimmedReason
        ? { headers: { "X-Break-Glass-Reason": trimmedReason } }
        : {}),
    });
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
      overwrite = false,
    ) => {
      setLoading(true);
      const normalizedSecrets = secrets.flatMap((secret) => {
        const categoryId = normalizeCategoryId(secret.categoryId);
        const keyName = normalizeKeyName(secret.keyName);
        if (!categoryId || !keyName) return [];

        return [{
          ...secret,
          categoryId,
          keyName,
          displayName: normalizeHeaderText(secret.displayName) ?? keyName,
        }];
      });
      if (normalizedSecrets.length !== secrets.length) {
        setLoading(false);
        return invalidResult("Invalid secret import payload");
      }

      const result = await adminApiFetch<{
        created: number;
        updated: number;
        skipped: number;
        errors: string[];
      }>("/import", {
        pathPrefix: "/api/v1/admin/secrets",
        method: "POST",
        body: { secrets: normalizedSecrets, overwrite },
      });
      setLoading(false);
      return result;
    },
    [],
  );

  return {
    loading,
    exportSecrets,
    importSecrets,
  };
}
