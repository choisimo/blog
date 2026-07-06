import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AdminSubtabs, type AdminSubtabsTab } from '@/components/molecules/AdminSubtabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { adminFetchRaw } from '@/services/admin/apiClient';
import { getApiBaseUrl } from '@/utils/network/apiBase';
import {
  Eye,
  EyeOff,
  Download,
  Save,
  RefreshCw,
  Copy,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface ConfigVariable {
  key: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'password' | 'url' | 'textarea';
  options?: string[];
  default?: string;
  isSecret?: boolean;
  description?: string;
  delimiter?: string;
}

interface ConfigCategory {
  id: string;
  name: string;
  description: string;
  variables: ConfigVariable[];
}

interface ConfigValue {
  value: string;
  isSecret: boolean;
  isSet: boolean;
  default: string;
}

interface ConfigStateResponse {
  config: Record<string, ConfigValue>;
  mutationsEnabled?: boolean;
  mutationGuidance?: string;
}

const EMPTY_CONFIG_VALUES: Record<string, ConfigValue> = {};
const CONFIG_TYPES = new Set<ConfigVariable['type']>([
  'text',
  'number',
  'boolean',
  'select',
  'password',
  'url',
  'textarea',
]);

const CONFIG_ANSI_ESCAPE_RE =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;

export function normalizeSafeConfigText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value
    .replace(CONFIG_ANSI_ESCAPE_RE, '')
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || fallback;
}

function normalizeConfigCategoryId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized || /[\r\n/\\]/.test(normalized) || !/^[a-z0-9-]+$/.test(normalized)) {
    return null;
  }
  return normalized;
}

function normalizeConfigKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || /[\r\n]/.test(normalized) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(normalized)) {
    return null;
  }
  return normalized;
}

function normalizeConfigVariable(value: unknown): ConfigVariable | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const key = normalizeConfigKey(record.key);
  const type = CONFIG_TYPES.has(record.type as ConfigVariable['type'])
    ? (record.type as ConfigVariable['type'])
    : 'text';
  if (!key) return null;

  return {
    key,
    type,
    options: Array.isArray(record.options)
      ? record.options.flatMap(option => {
          const normalized = normalizeSafeConfigText(option);
          return normalized ? [normalized] : [];
        })
      : undefined,
    default: typeof record.default === 'string' ? record.default : undefined,
    isSecret: Boolean(record.isSecret),
    description: normalizeSafeConfigText(record.description) || undefined,
    delimiter: typeof record.delimiter === 'string' ? record.delimiter : undefined,
  };
}

function normalizeConfigCategory(value: unknown): ConfigCategory | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const id = normalizeConfigCategoryId(record.id);
  if (!id) return null;
  const variables = Array.isArray(record.variables)
    ? record.variables.flatMap(variable => {
        const normalized = normalizeConfigVariable(variable);
        return normalized ? [normalized] : [];
      })
    : [];

  return {
    id,
    name: normalizeSafeConfigText(record.name, id),
    description: normalizeSafeConfigText(record.description),
    variables,
  };
}

export function normalizeConfigCategories(value: unknown): ConfigCategory[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(category => {
    const normalized = normalizeConfigCategory(category);
    return normalized ? [normalized] : [];
  });
}

function normalizeConfigValues(
  value: Record<string, ConfigValue> | undefined,
): Record<string, ConfigValue> {
  if (!value || typeof value !== 'object') return EMPTY_CONFIG_VALUES;
  return Object.entries(value).reduce<Record<string, ConfigValue>>((next, [key, configValue]) => {
    const normalizedKey = normalizeConfigKey(key);
    if (!normalizedKey || !configValue || typeof configValue !== 'object') {
      return next;
    }
    const record = configValue as Partial<ConfigValue>;
    next[normalizedKey] = {
      value: typeof record.value === 'string' ? record.value : '',
      isSecret: Boolean(record.isSecret),
      isSet: Boolean(record.isSet),
      default: typeof record.default === 'string' ? record.default : '',
    };
    return next;
  }, {});
}

function normalizeEditedValues(
  values: Record<string, string>,
): Record<string, string> {
  return Object.entries(values).reduce<Record<string, string>>((next, [key, value]) => {
    const normalizedKey = normalizeConfigKey(key);
    if (!normalizedKey) return next;
    next[normalizedKey] = value;
    return next;
  }, {});
}

export function getAdminErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const record = payload as { error?: unknown; message?: unknown };
  const errorText = normalizeSafeConfigText(record.error);
  if (errorText) return errorText;
  if (record.error && typeof record.error === 'object') {
    const nested = record.error as { message?: unknown; code?: unknown };
    const nestedMessage = normalizeSafeConfigText(nested.message);
    if (nestedMessage) return nestedMessage;
    const nestedCode = normalizeSafeConfigText(nested.code);
    if (nestedCode) return nestedCode;
  }
  const message = normalizeSafeConfigText(record.message);
  if (message) return message;
  return fallback;
}

async function readAdminJson<T>(res: Response, fallback: string): Promise<T> {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(getAdminErrorMessage(json, fallback));
  }
  return json as T;
}

export function ConfigManager() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('app');
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  const API_BASE = getApiBaseUrl();

  const {
    data: categoriesData,
    error: categoriesError,
    isLoading: categoriesLoading,
    refetch: refetchCategories,
  } = useQuery({
    queryKey: ['config-categories'],
    queryFn: async () => {
      const res = await adminFetchRaw(`${API_BASE}/api/v1/admin/config/categories`);
      const json = await readAdminJson<{ data: { categories: ConfigCategory[] } }>(
        res,
        'Failed to fetch categories',
      );
      return normalizeConfigCategories(json.data.categories);
    },
  });

  const {
    data: configData,
    error: configError,
    isLoading: configLoading,
    refetch: refetchConfig,
  } = useQuery({
    queryKey: ['config-current'],
    queryFn: async () => {
      const res = await adminFetchRaw(`${API_BASE}/api/v1/admin/config/current`);
      const json = await readAdminJson<{ data: ConfigStateResponse }>(
        res,
        'Failed to fetch config',
      );
      return json.data as ConfigStateResponse;
    },
  });

  const configValues = normalizeConfigValues(configData?.config);
  const mutationsEnabled = configData?.mutationsEnabled !== false;
  const mutationGuidance =
    normalizeSafeConfigText(
      configData?.mutationGuidance,
      'Runtime edits are disabled in this environment. Update the source of truth and redeploy.',
    );

  const exportMutation = useMutation({
    mutationFn: async (format: string) => {
      const res = await adminFetchRaw(`${API_BASE}/api/v1/admin/config/export`, {
        method: 'POST',
        body: JSON.stringify({ format, includeSecrets: false }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(getAdminErrorMessage(payload, 'Export failed'));
      }
      return res.json();
    },
    onSuccess: (data, format) => {
      const content = data.data.content;
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        format === 'env'
          ? '.env.example'
          : format === 'docker-compose'
            ? 'docker-env.yml'
            : 'wrangler-vars.toml';
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Export complete', description: `Downloaded ${format} file` });
    },
    onError: (error: Error) => {
      toast({
        title: 'Export failed',
        description: normalizeSafeConfigText(error.message, 'Export failed'),
        variant: 'destructive',
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (variables: Record<string, string>) => {
      const res = await adminFetchRaw(`${API_BASE}/api/v1/admin/config/save-env`, {
        method: 'POST',
        body: JSON.stringify({ variables, target: 'backend' }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(getAdminErrorMessage(payload, 'Save failed'));
      }

      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Saved',
        description: 'Environment file updated. Restart server to apply changes.',
      });
      setHasChanges(false);
      refetchConfig();
    },
    onError: (error: Error) => {
      toast({
        title: 'Save failed',
        description: normalizeSafeConfigText(error.message, 'Save failed'),
        variant: 'destructive',
      });
    },
  });

  const updateValue = useCallback((key: string, value: string) => {
    if (!mutationsEnabled) return;
    const normalizedKey = normalizeConfigKey(key);
    if (!normalizedKey) return;
    setEditedValues((prev) => ({ ...prev, [normalizedKey]: value }));
    setHasChanges(true);
  }, [mutationsEnabled]);

  const toggleSecretVisibility = useCallback((key: string) => {
    const normalizedKey = normalizeConfigKey(key);
    if (!normalizedKey) return;
    setVisibleSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(normalizedKey)) next.delete(normalizedKey);
      else next.add(normalizedKey);
      return next;
    });
  }, []);

  const copyToClipboard = useCallback(
    async (text: string) => {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied to clipboard' });
    },
    [toast]
  );

  const getValue = useCallback(
    (key: string): string => {
      const normalizedKey = normalizeConfigKey(key);
      if (!normalizedKey) return '';
      if (normalizedKey in editedValues) return editedValues[normalizedKey];
      return configValues[normalizedKey]?.value || '';
    },
    [configValues, editedValues]
  );

  const handleSave = () => {
    if (!mutationsEnabled) {
      toast({
        title: 'Read-only environment',
        description: mutationGuidance,
      });
      return;
    }

    const variables = normalizeEditedValues(editedValues);
    if (!Object.keys(variables).length) {
      toast({
        title: 'No valid config changes',
        description: 'No valid environment variable keys are ready to save.',
      });
      return;
    }

    saveMutation.mutate(variables);
  };

  const renderField = (variable: ConfigVariable) => {
    const value = getValue(variable.key);
    const isVisible = visibleSecrets.has(variable.key);
    const baseInputClass = 'h-9 text-sm rounded-lg border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-400 focus-visible:ring-offset-0 transition-all';
    const iconBtnClass = 'h-9 w-9 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-400 outline-none shrink-0';

    switch (variable.type) {
      case 'select':
        return (
          <Select value={value} onValueChange={(v) => updateValue(variable.key, v)} disabled={!mutationsEnabled}>
            <SelectTrigger className={`${baseInputClass} w-full`}>
              <SelectValue placeholder={variable.default || 'Select...'} />
            </SelectTrigger>
            <SelectContent>
              {variable.options?.map((opt) => (
                <SelectItem key={opt} value={opt} className='text-sm'>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'password':
        return (
          <div className='flex gap-2'>
            <Input
              id={variable.key}
              type={isVisible ? 'text' : 'password'}
              value={value}
              onChange={(e) => updateValue(variable.key, e.target.value)}
              placeholder={configValues[variable.key]?.isSet ? '••••••••' : 'Not set'}
              className={`${baseInputClass} flex-1`}
              readOnly={!mutationsEnabled}
              disabled={!mutationsEnabled}
            />
            <button
              type='button'
              onClick={() => toggleSecretVisibility(variable.key)}
              aria-label={`${isVisible ? 'Hide' : 'Show'} ${variable.key} value`}
              title={`${isVisible ? 'Hide' : 'Show'} ${variable.key} value`}
              className={iconBtnClass}
              disabled={!mutationsEnabled}
            >
              {isVisible ? <EyeOff className='h-3.5 w-3.5' aria-hidden='true' /> : <Eye className='h-3.5 w-3.5' aria-hidden='true' />}
            </button>
          </div>
        );

      case 'textarea':
        return (
          <Textarea
            id={variable.key}
            value={value}
            onChange={(e) => updateValue(variable.key, e.target.value)}
            placeholder={variable.default || ''}
            rows={3}
            className='text-sm rounded-lg border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-400 focus-visible:ring-offset-0 transition-all resize-none'
            readOnly={!mutationsEnabled}
            disabled={!mutationsEnabled}
          />
        );

      case 'url':
        return (
          <div className='flex gap-2'>
            <Input
              id={variable.key}
              type='url'
              value={value}
              onChange={(e) => updateValue(variable.key, e.target.value)}
              placeholder={variable.default || 'https://…'}
              className={`${baseInputClass} flex-1`}
              readOnly={!mutationsEnabled}
              disabled={!mutationsEnabled}
            />
            {value && (
              <button
                type='button'
                onClick={() => copyToClipboard(value)}
                aria-label={`Copy ${variable.key} URL`}
                title={`Copy ${variable.key} URL`}
                className={iconBtnClass}
              >
                <Copy className='h-3.5 w-3.5' aria-hidden='true' />
              </button>
            )}
          </div>
        );

      case 'number':
        return (
          <Input
            id={variable.key}
            type='number'
            value={value}
            onChange={(e) => updateValue(variable.key, e.target.value)}
            placeholder={variable.default || '0'}
            className={baseInputClass}
            readOnly={!mutationsEnabled}
            disabled={!mutationsEnabled}
          />
        );

      default:
        return (
          <Input
            id={variable.key}
            type='text'
            value={value}
            onChange={(e) => updateValue(variable.key, e.target.value)}
            placeholder={variable.default || ''}
            className={baseInputClass}
            readOnly={!mutationsEnabled}
            disabled={!mutationsEnabled}
          />
        );
    }
  };

  if (categoriesLoading || configLoading) {
    return (
      <div className='rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 flex items-center gap-3 text-sm text-zinc-400'>
        <RefreshCw className='h-4 w-4 animate-spin shrink-0' aria-hidden='true' />
        <span>Loading configuration…</span>
      </div>
    );
  }

  const loadError = categoriesError ?? configError;
  if (loadError) {
    const message =
      loadError instanceof Error
        ? normalizeSafeConfigText(loadError.message, 'Failed to load configuration')
        : 'Failed to load configuration';

    return (
      <div className='rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300'>
        <div className='flex items-start justify-between gap-3'>
          <div className='flex min-w-0 items-start gap-2'>
            <AlertCircle className='mt-0.5 h-4 w-4 shrink-0' aria-hidden='true' />
            <div className='min-w-0'>
              <p className='font-medium'>Unable to load configuration</p>
              <p className='mt-1 text-xs'>{message}</p>
            </div>
          </div>
          <button
            type='button'
            onClick={() => {
              void refetchCategories();
              void refetchConfig();
            }}
            className='inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200 dark:hover:bg-red-900/30'
          >
            <RefreshCw className='h-3 w-3' aria-hidden='true' />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const categories = categoriesData || [];
  const activeCategory = categories.find((c) => c.id === activeTab) ?? categories[0];
  const configTabs: AdminSubtabsTab[] = categories.map(cat => ({ id: cat.id, label: cat.name }));

  return (
    <div className='space-y-3'>
      <div className='rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 flex items-center justify-between gap-3'>
        <div className='flex items-center gap-2 min-w-0'>
          {!mutationsEnabled ? (
            <>
              <AlertCircle className='h-3.5 w-3.5 text-amber-500 shrink-0' aria-hidden='true' />
              <span className='text-xs text-amber-600 dark:text-amber-400 font-medium'>Read-only runtime config</span>
            </>
          ) : hasChanges ? (
            <>
              <AlertCircle className='h-3.5 w-3.5 text-amber-500 shrink-0' aria-hidden='true' />
              <span className='text-xs text-amber-600 dark:text-amber-400 font-medium'>Unsaved changes</span>
            </>
          ) : (
            <span className='text-xs text-zinc-400 dark:text-zinc-500'>Environment config</span>
          )}
        </div>
        <div className='flex flex-wrap items-center justify-end gap-1.5 shrink-0'>
          <button
            type='button'
            onClick={() => exportMutation.mutate('env')}
            disabled={exportMutation.isPending}
            className='flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-400 outline-none'
          >
            <Download className='h-3 w-3' aria-hidden='true' />
            .env
          </button>
          <button
            type='button'
            onClick={() => exportMutation.mutate('docker-compose')}
            disabled={exportMutation.isPending}
            className='flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-400 outline-none'
          >
            <Download className='h-3 w-3' aria-hidden='true' />
            Docker
          </button>
          <button
            type='button'
            onClick={() => exportMutation.mutate('wrangler')}
            disabled={exportMutation.isPending}
            className='flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-400 outline-none'
          >
            <Download className='h-3 w-3' aria-hidden='true' />
            Wrangler
          </button>
          {mutationsEnabled ? (
            <button
              type='button'
              onClick={handleSave}
              disabled={!hasChanges || saveMutation.isPending}
              className='flex items-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 text-white shadow-sm transition-all active:scale-95 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-400 outline-none'
            >
              <Save className='h-3 w-3' aria-hidden='true' />
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </button>
          ) : (
            <span className='inline-flex h-8 items-center rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-medium text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/20 dark:text-amber-300'>
              GitOps only
            </span>
          )}
        </div>
      </div>

      {!mutationsEnabled && (
        <div className='rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/20 dark:text-amber-200'>
          {mutationGuidance}
        </div>
      )}

        <div className='rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden'>
          <AdminSubtabs
            tabs={configTabs}
            activeTab={activeTab}
            onTabChange={nextTab => {
              const normalizedTab = normalizeConfigCategoryId(nextTab);
              if (normalizedTab) setActiveTab(normalizedTab);
            }}
            renderTab={(tab, isActive) => (
              <>
                {tab.label}
                <span className={`font-mono text-xs px-1 py-0.5 rounded ${
                  isActive
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500'
                }`}>
                  {categories.find(c => c.id === tab.id)?.variables.length ?? 0}
                </span>
              </>
            )}
          />

        {activeCategory && (
          <div className='divide-y divide-zinc-50 dark:divide-zinc-800/50'>
            {activeCategory.variables.map((variable) => {
              const configValue = configValues[variable.key];
              return (
                <div key={variable.key} className='px-4 py-3.5 space-y-2 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors'>
                  <div className='flex items-center gap-2 flex-wrap'>
                    <Label
                      htmlFor={variable.key}
                      className='font-mono text-xs text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded cursor-default border border-zinc-200/80 dark:border-zinc-700/80'
                    >
                      {variable.key}
                    </Label>
                    {variable.isSecret && (
                      <span className='text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 px-1.5 py-0.5 rounded font-medium'>
                        secret
                      </span>
                    )}
                    {configValue?.isSet && (
                      <span className='flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400'>
                        <CheckCircle2 className='h-3 w-3' aria-hidden='true' />
                        Set
                      </span>
                    )}
                  </div>
                  {variable.description && (
                    <p className='text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed'>{variable.description}</p>
                  )}
                  {renderField(variable)}
                  {variable.default && !variable.isSecret && (
                    <p className='text-xs text-zinc-400 dark:text-zinc-500'>
                      Default:{' '}
                      <code className='font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded'>
                        {variable.default}
                      </code>
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default ConfigManager;
