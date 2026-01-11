import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { getApiBaseUrl } from '@/utils/apiBase';
import { Eye, EyeOff, Download, Save, RefreshCw, Copy, CheckCircle2, AlertCircle } from 'lucide-react';

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

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('adminToken') || '';
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
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
      const res = await fetchWithAuth(`${API_BASE}/api/v1/admin/config/categories`);
      if (!res.ok) throw new Error('Failed to fetch categories');
      const json = await res.json();
      return json.data.categories as ConfigCategory[];
    },
  });

  const { data: configData, isLoading: configLoading, refetch: refetchConfig } = useQuery({
    queryKey: ['config-current'],
    queryFn: async () => {
      const res = await fetchWithAuth(`${API_BASE}/api/v1/admin/config/current`);
      if (!res.ok) throw new Error('Failed to fetch config');
      const json = await res.json();
      return json.data.config as Record<string, ConfigValue>;
    },
  });

  const exportMutation = useMutation({
    mutationFn: async (format: string) => {
      const res = await fetchWithAuth(`${API_BASE}/api/v1/admin/config/export`, {
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
      a.download = format === 'env' ? '.env.example' : format === 'docker-compose' ? 'docker-env.yml' : 'wrangler-vars.toml';
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
      const res = await fetchWithAuth(`${API_BASE}/api/v1/admin/config/save-env`, {
        method: 'POST',
        body: JSON.stringify({ variables, target: 'backend' }),
      });
      if (!res.ok) throw new Error('Save failed');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Saved', description: 'Environment file updated. Restart server to apply changes.' });
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
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const copyToClipboard = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  }, [toast]);

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
            <SelectTrigger className="w-full">
              <SelectValue placeholder={variable.default || 'Select...'} />
            </SelectTrigger>
            <SelectContent>
              {variable.options?.map((opt) => (
                <SelectItem key={opt} value={opt}>
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
              className="flex-1"
            />
            <Button variant="outline" size="icon" onClick={() => toggleSecretVisibility(variable.key)}>
              {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        );

      case 'textarea':
        return (
          <Textarea
            value={value}
            onChange={(e) => updateValue(variable.key, e.target.value)}
            placeholder={variable.default || ''}
            rows={3}
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
              className="flex-1"
            />
            {value && (
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(value)}>
                <Copy className="h-4 w-4" />
              </Button>
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
          />
        );

      default:
        return (
          <Input
            type="text"
            value={value}
            onChange={(e) => updateValue(variable.key, e.target.value)}
            placeholder={variable.default || ''}
          />
        );
    }
  };

  if (categoriesLoading || configLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading configuration...</span>
      </div>
    );
  }

  const categories = categoriesData || [];

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">환경변수 설정</h1>
          <p className="text-muted-foreground">서버 환경 설정을 관리합니다</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportMutation.mutate('env')}>
            <Download className="h-4 w-4 mr-2" />
            Export .env
          </Button>
          <Button variant="outline" onClick={() => exportMutation.mutate('docker-compose')}>
            <Download className="h-4 w-4 mr-2" />
            Docker
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || saveMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {hasChanges && (
        <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          <span className="text-sm">You have unsaved changes</span>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap gap-1">
          {categories.map((cat) => (
            <TabsTrigger key={cat.id} value={cat.id}>
              {cat.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map((category) => (
          <TabsContent key={category.id} value={category.id}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {category.name}
                  <Badge variant="outline" className="ml-2">
                    {category.variables.length} variables
                  </Badge>
                </CardTitle>
                <CardDescription>{category.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {category.variables.map((variable) => {
                  const configValue = configData?.[variable.key];
                  return (
                    <div key={variable.key} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={variable.key} className="font-mono text-sm">
                          {variable.key}
                        </Label>
                        {variable.isSecret && (
                          <Badge variant="secondary" className="text-xs">
                            Secret
                          </Badge>
                        )}
                        {configValue?.isSet && (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        )}
                      </div>
                      {variable.description && (
                        <p className="text-xs text-muted-foreground">{variable.description}</p>
                      )}
                      {renderField(variable)}
                      {variable.default && !variable.isSecret && (
                        <p className="text-xs text-muted-foreground">
                          Default: <code className="bg-muted px-1 rounded">{variable.default}</code>
                        </p>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

export default ConfigManager;
