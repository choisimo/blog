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

export function ConfigManager() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('app');
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  const API_BASE = getApiBaseUrl();

  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ['config-categories'],
    queryFn: async () => {
      const res = await adminFetchRaw(`${API_BASE}/api/v1/admin/config/categories`);
      if (!res.ok) throw new Error('Failed to fetch categories');
      const json = await res.json();
      return json.data.categories as ConfigCategory[];
    },
  });

  const {
    data: configData,
    isLoading: configLoading,
    refetch: refetchConfig,
  } = useQuery({
    queryKey: ['config-current'],
    queryFn: async () => {
      const res = await adminFetchRaw(`${API_BASE}/api/v1/admin/config/current`);
      if (!res.ok) throw new Error('Failed to fetch config');
      const json = await res.json();
      return json.data.config as Record<string, ConfigValue>;
    },
  });

  const exportMutation = useMutation({
    mutationFn: async (format: string) => {
      const res = await adminFetchRaw(`${API_BASE}/api/v1/admin/config/export`, {
        method: 'POST',
        body: JSON.stringify({ format, includeSecrets: false }),
      });
      if (!res.ok) throw new Error('Export failed');
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
    onError: () => {
      toast({ title: 'Export failed', variant: 'destructive' });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (variables: Record<string, string>) => {
      const res = await adminFetchRaw(`${API_BASE}/api/v1/admin/config/save-env`, {
        method: 'POST',
        body: JSON.stringify({ variables, target: 'backend' }),
      });
      if (!res.ok) throw new Error('Save failed');
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
    onError: () => {
      toast({ title: 'Save failed', variant: 'destructive' });
    },
  });

  const updateValue = useCallback((key: string, value: string) => {
    setEditedValues((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }, []);

  const toggleSecretVisibility = useCallback((key: string) => {
    setVisibleSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
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
      if (key in editedValues) return editedValues[key];
      return configData?.[key]?.value || '';
    },
    [editedValues, configData]
  );

  const handleSave = () => {
    saveMutation.mutate(editedValues);
  };

  const renderField = (variable: ConfigVariable) => {
    const value = getValue(variable.key);
    const isVisible = visibleSecrets.has(variable.key);
    const baseInputClass = 'h-9 text-sm rounded-lg border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-400 focus-visible:ring-offset-0 transition-all';
    const iconBtnClass = 'h-9 w-9 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-400 outline-none shrink-0';

    switch (variable.type) {
      case 'select':
        return (
          <Select value={value} onValueChange={(v) => updateValue(variable.key, v)}>
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
              placeholder={configData?.[variable.key]?.isSet ? '••••••••' : 'Not set'}
              className={`${baseInputClass} flex-1`}
            />
            <button
              type='button'
              onClick={() => toggleSecretVisibility(variable.key)}
              aria-label={isVisible ? 'Hide value' : 'Show value'}
              className={iconBtnClass}
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
            />
            {value && (
              <button
                type='button'
                onClick={() => copyToClipboard(value)}
                aria-label='Copy URL'
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

  const categories = categoriesData || [];
  const activeCategory = categories.find((c) => c.id === activeTab) ?? categories[0];
  const configTabs: AdminSubtabsTab[] = categories.map(cat => ({ id: cat.id, label: cat.name }));

  return (
    <div className='space-y-3'>
      <div className='rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 flex items-center justify-between gap-3'>
        <div className='flex items-center gap-2 min-w-0'>
          {hasChanges ? (
            <>
              <AlertCircle className='h-3.5 w-3.5 text-amber-500 shrink-0' aria-hidden='true' />
              <span className='text-xs text-amber-600 dark:text-amber-400 font-medium'>Unsaved changes</span>
            </>
          ) : (
            <span className='text-xs text-zinc-400 dark:text-zinc-500'>Environment config</span>
          )}
        </div>
        <div className='flex items-center gap-1.5 shrink-0'>
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
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
            className='flex items-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 text-white shadow-sm transition-all active:scale-95 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-400 outline-none'
          >
            <Save className='h-3 w-3' aria-hidden='true' />
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

        <div className='rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden'>
          <AdminSubtabs
            tabs={configTabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
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
              const configValue = configData?.[variable.key];
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
