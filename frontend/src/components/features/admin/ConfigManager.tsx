import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { getApiBaseUrl } from '@/utils/network/apiBase';
import { useAuthStore } from '@/stores/session/useAuthStore';
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

async function fetchWithAuth(
  url: string,
  getToken: () => Promise<string | null>,
  options: RequestInit = {}
) {
  const token = await getToken();
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}

export function ConfigManager() {
  const { toast } = useToast();
  const { getValidAccessToken } = useAuthStore();
  const [activeTab, setActiveTab] = useState('app');
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  const API_BASE = getApiBaseUrl();

  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ['config-categories'],
    queryFn: async () => {
      const res = await fetchWithAuth(`${API_BASE}/api/v1/admin/config/categories`, getValidAccessToken);
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
      const res = await fetchWithAuth(`${API_BASE}/api/v1/admin/config/current`, getValidAccessToken);
      if (!res.ok) throw new Error('Failed to fetch config');
      const json = await res.json();
      return json.data.config as Record<string, ConfigValue>;
    },
  });

  const exportMutation = useMutation({
    mutationFn: async (format: string) => {
      const res = await fetchWithAuth(`${API_BASE}/api/v1/admin/config/export`, getValidAccessToken, {
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
      const res = await fetchWithAuth(`${API_BASE}/api/v1/admin/config/save-env`, getValidAccessToken, {
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

    switch (variable.type) {
      case 'select':
        return (
          <Select value={value} onValueChange={(v) => updateValue(variable.key, v)}>
            <SelectTrigger className="h-8 text-sm rounded-md border-zinc-200 focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1">
              <SelectValue placeholder={variable.default || 'Select...'} />
            </SelectTrigger>
            <SelectContent>
              {variable.options?.map((opt) => (
                <SelectItem key={opt} value={opt} className="text-sm">
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'password':
        return (
          <div className="flex gap-2">
            <Input
              type={isVisible ? 'text' : 'password'}
              value={value}
              onChange={(e) => updateValue(variable.key, e.target.value)}
              placeholder={configData?.[variable.key]?.isSet ? '••••••••' : 'Not set'}
              className="h-8 text-sm rounded-md border-zinc-200 flex-1"
            />
            <button
              type="button"
              onClick={() => toggleSecretVisibility(variable.key)}
              className="h-8 w-8 flex items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 transition-colors"
            >
              {isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        );

      case 'textarea':
        return (
          <Textarea
            value={value}
            onChange={(e) => updateValue(variable.key, e.target.value)}
            placeholder={variable.default || ''}
            rows={3}
            className="text-sm rounded-md border-zinc-200 focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1"
          />
        );

      case 'url':
        return (
          <div className="flex gap-2">
            <Input
              type="url"
              value={value}
              onChange={(e) => updateValue(variable.key, e.target.value)}
              placeholder={variable.default || 'https://...'}
              className="h-8 text-sm rounded-md border-zinc-200 flex-1"
            />
            {value && (
              <button
                type="button"
                onClick={() => copyToClipboard(value)}
                className="h-8 w-8 flex items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 transition-colors"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );

      case 'number':
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => updateValue(variable.key, e.target.value)}
            placeholder={variable.default || '0'}
            className="h-8 text-sm rounded-md border-zinc-200"
          />
        );

      default:
        return (
          <Input
            type="text"
            value={value}
            onChange={(e) => updateValue(variable.key, e.target.value)}
            placeholder={variable.default || ''}
            className="h-8 text-sm rounded-md border-zinc-200"
          />
        );
    }
  };

  if (categoriesLoading || configLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-zinc-500">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        Loading configuration...
      </div>
    );
  }

  const categories = categoriesData || [];
  const activeCategory = categories.find((c) => c.id === activeTab) ?? categories[0];

  return (
    <div className="space-y-4">
      <div className="bg-white border border-zinc-200 rounded-lg px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasChanges && (
            <>
              <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>
            </>
          )}
          {!hasChanges && (
            <span className="text-xs text-zinc-400">Environment config</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => exportMutation.mutate('env')}
            disabled={exportMutation.isPending}
            className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-50"
          >
            <Download className="h-3 w-3" />
            .env
          </button>
          <button
            type="button"
            onClick={() => exportMutation.mutate('docker-compose')}
            disabled={exportMutation.isPending}
            className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-50"
          >
            <Download className="h-3 w-3" />
            Docker
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
            className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md bg-zinc-900 hover:bg-zinc-800 text-white transition-colors disabled:opacity-50"
          >
            <Save className="h-3 w-3" />
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        <div className="flex items-center gap-0.5 border-b border-zinc-200 px-2 pt-1 overflow-x-auto">
          {categories.map((cat) => (
            <button
              type="button"
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === cat.id
                  ? 'border-zinc-900 text-zinc-900'
                  : 'border-transparent text-zinc-400 hover:text-zinc-700'
              }`}
            >
              {cat.name}
              <span className="font-mono text-zinc-400">{cat.variables.length}</span>
            </button>
          ))}
        </div>

        {activeCategory && (
          <div className="divide-y divide-zinc-100">
            {activeCategory.variables.map((variable) => {
              const configValue = configData?.[variable.key];
              return (
                <div key={variable.key} className="px-4 py-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor={variable.key}
                      className="font-mono text-xs text-zinc-600 bg-zinc-100 px-1 py-0.5 rounded cursor-default"
                    >
                      {variable.key}
                    </Label>
                    {variable.isSecret && (
                      <span className="text-xs text-zinc-400 font-medium">secret</span>
                    )}
                    {configValue?.isSet && (
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    )}
                  </div>
                  {variable.description && (
                    <p className="text-xs text-zinc-400">{variable.description}</p>
                  )}
                  {renderField(variable)}
                  {variable.default && !variable.isSecret && (
                    <p className="text-xs text-zinc-400">
                      Default:{' '}
                      <span className="font-mono text-zinc-600 bg-zinc-100 px-1 py-0.5 rounded">
                        {variable.default}
                      </span>
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
