/**
 * Secrets Management Types
 */

// Category
export interface SecretCategory {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  secret_count?: number;
}

// Secret (public view - no encrypted values)
export interface SecretPublic {
  id: string;
  category_id: string;
  key_name: string;
  display_name: string;
  description: string | null;
  is_required: number;
  is_sensitive: number;
  value_type: 'string' | 'number' | 'boolean' | 'json' | 'url';
  validation_pattern: string | null;
  default_value: string | null;
  env_fallback: string | null;
  last_rotated_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  has_value: boolean;
  masked_value?: string;
  category_name?: string;
}

// Audit log entry
export interface SecretAuditLog {
  id: number;
  secret_id: string;
  action: 'created' | 'updated' | 'deleted' | 'rotated' | 'accessed';
  old_value_hash: string | null;
  new_value_hash: string | null;
  changed_by: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: string | null;
  created_at: string;
  key_name?: string | null;
}

// Form data for creating/updating secrets
export interface SecretFormData {
  categoryId: string;
  keyName: string;
  displayName: string;
  description?: string;
  value?: string;
  isRequired?: boolean;
  isSensitive?: boolean;
  valueType?: 'string' | 'number' | 'boolean' | 'json' | 'url';
  validationPattern?: string;
  defaultValue?: string;
  envFallback?: string;
  expiresAt?: string;
}

// Overview data
export interface SecretsOverview {
  categories: (SecretCategory & { secret_count: number })[];
  stats: {
    total: number;
    configured: number;
    missing_required: number;
    expiring_soon: number;
  };
  recentActivity: SecretAuditLog[];
}

// Health status
export interface SecretsHealth {
  status: 'healthy' | 'unhealthy';
  encryption: 'ok' | 'failed';
  stats: {
    totalSecrets: number;
    withValue: number;
    expired: number;
  };
}
