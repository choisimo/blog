import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { getApiBaseUrl } from '@/utils/network/apiBase';
import { useAuthStore } from '@/stores/session/useAuthStore';
import {
  Cloud,
  Database,
  HardDrive,
  Key,
  Rocket,
  RefreshCw,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Copy,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface WorkerConfig {
  id: string;
  name: string;
  description: string;
  path: string;
  wranglerPath: string;
  hasProduction: boolean;
  exists: boolean;
  config: {
    name: string;
    main: string;
    compatibility_date: string;
    account_id: string;
    vars: Record<string, string>;
    production: {
      name: string;
      vars: Record<string, string>;
    };
    d1_databases: Array<{ binding: string; database_name: string; database_id: string }>;
    r2_buckets: Array<{ binding: string; bucket_name: string }>;
    kv_namespaces: Array<{ binding: string; id: string }>;
  } | null;
}

interface SecretInfo {
  key: string;
  description: string;
  workers: string[];
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

const TABS = [
  { id: 'workers' as const, label: 'Workers', icon: <Cloud className="h-3.5 w-3.5" /> },
  { id: 'secrets' as const, label: 'Secrets', icon: <Key className="h-3.5 w-3.5" /> },
  { id: 'resources' as const, label: 'Resources', icon: <Database className="h-3.5 w-3.5" /> },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function WorkersManager() {
  const { toast } = useToast();
  const { getValidAccessToken } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabId>('workers');
  const [deployEnv, setDeployEnv] = useState<'development' | 'production'>('production');
  const [secretInputs, setSecretInputs] = useState<Record<string, string>>({});
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());
  const [expandedWorkers, setExpandedWorkers] = useState<Set<string>>(new Set());
  const [expandedSection, setExpandedSection] = useState<Record<string, string | null>>({});

  const API_BASE = getApiBaseUrl();

  const { data: workersData, isLoading: workersLoading } = useQuery({
    queryKey: ['workers-list'],
    queryFn: async () => {
      const res = await fetchWithAuth(`${API_BASE}/api/v1/admin/workers/list`, getValidAccessToken);
      if (!res.ok) throw new Error('Failed to fetch workers');
      const json = await res.json();
      return json.data.workers as WorkerConfig[];
    },
  });

  const { data: secretsData } = useQuery({
    queryKey: ['workers-secrets'],
    queryFn: async () => {
      const res = await fetchWithAuth(`${API_BASE}/api/v1/admin/workers/secrets`, getValidAccessToken);
      if (!res.ok) throw new Error('Failed to fetch secrets');
      const json = await res.json();
      return json.data.secrets as SecretInfo[];
    },
  });

  const { data: d1Data } = useQuery({
    queryKey: ['workers-d1'],
    queryFn: async () => {
      const res = await fetchWithAuth(
        `${API_BASE}/api/v1/admin/workers/d1/databases`,
        getValidAccessToken
      );
      const json = await res.json();
      return json.data.databases || [];
    },
  });

  const { data: kvData } = useQuery({
    queryKey: ['workers-kv'],
    queryFn: async () => {
      const res = await fetchWithAuth(
        `${API_BASE}/api/v1/admin/workers/kv/namespaces`,
        getValidAccessToken
      );
      const json = await res.json();
      return json.data.namespaces || [];
    },
  });

  const { data: r2Data } = useQuery({
    queryKey: ['workers-r2'],
    queryFn: async () => {
      const res = await fetchWithAuth(
        `${API_BASE}/api/v1/admin/workers/r2/buckets`,
        getValidAccessToken
      );
      const json = await res.json();
      return json.data.buckets || [];
    },
  });

  const deployMutation = useMutation({
    mutationFn: async ({
      workerId,
      env,
      dryRun,
    }: {
      workerId: string;
      env: string;
      dryRun: boolean;
    }) => {
      const res = await fetchWithAuth(
        `${API_BASE}/api/v1/admin/workers/${workerId}/deploy`,
        getValidAccessToken,
        { method: 'POST', body: JSON.stringify({ env, dryRun }) }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Deploy failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Deployment', description: data.data.message });
    },
    onError: (err: Error) => {
      toast({ title: 'Deployment failed', description: err.message, variant: 'destructive' });
    },
  });

  const secretMutation = useMutation({
    mutationFn: async ({
      workerId,
      key,
      value,
      env,
    }: {
      workerId: string;
      key: string;
      value: string;
      env: string;
    }) => {
      const res = await fetchWithAuth(
        `${API_BASE}/api/v1/admin/workers/${workerId}/secret`,
        getValidAccessToken,
        { method: 'POST', body: JSON.stringify({ key, value, env }) }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to set secret');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Secret Updated', description: data.data.message });
      setSecretInputs({});
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to set secret', description: err.message, variant: 'destructive' });
    },
  });

  const copyToClipboard = useCallback(
    async (text: string) => {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied to clipboard' });
    },
    [toast]
  );

  const toggleSecretVisibility = useCallback((key: string) => {
    setVisibleSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleWorkerExpanded = useCallback((id: string) => {
    setExpandedWorkers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSection = useCallback((workerId: string, section: string) => {
    setExpandedSection((prev) => ({
      ...prev,
      [workerId]: prev[workerId] === section ? null : section,
    }));
  }, []);

  if (workersLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-zinc-500">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        Loading workers...
      </div>
    );
  }

  const workers = workersData || [];
  const secrets = secretsData || [];

  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-0.5 border-b border-zinc-200 px-2 pt-1">
        {TABS.map((tab) => (
          <button
            type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-zinc-900 text-zinc-900'
                : 'border-transparent text-zinc-400 hover:text-zinc-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'workers' && (
        <div className="divide-y divide-zinc-100">
          {workers.length === 0 && (
            <p className="px-4 py-3 text-sm text-zinc-400">No workers found</p>
          )}
          {workers.map((worker) => {
            const expanded = expandedWorkers.has(worker.id);
            return (
              <div key={worker.id} className={!worker.exists ? 'opacity-60' : ''}>
                <button
                  type="button"
                  disabled={!worker.exists}
                  onClick={() => worker.exists && toggleWorkerExpanded(worker.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition-colors disabled:cursor-default text-left"
                >
                  <div className="flex items-center gap-3">
                    <Cloud className="h-3.5 w-3.5 text-zinc-500" />
                    <div>
                      <p className="text-sm font-medium text-zinc-800">{worker.name}</p>
                      <p className="text-xs text-zinc-400">{worker.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {worker.exists ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" />
                        Configured
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-amber-600">
                        <AlertCircle className="h-3 w-3" />
                        Missing
                      </span>
                    )}
                    {worker.hasProduction && (
                      <span className="font-mono text-xs text-zinc-400 bg-zinc-100 px-1 py-0.5 rounded">
                        prod
                      </span>
                    )}
                    {worker.exists &&
                      (expanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
                      ))}
                  </div>
                </button>

                {expanded && worker.config && (
                  <div className="border-t border-zinc-100 bg-zinc-50">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-px border-b border-zinc-100">
                      {[
                        { label: 'Name', value: worker.config.name },
                        { label: 'Entry', value: worker.config.main },
                        { label: 'Compat', value: worker.config.compatibility_date },
                        {
                          label: 'Account',
                          value: worker.config.account_id.slice(0, 8) + '...',
                          copyValue: worker.config.account_id,
                        },
                      ].map(({ label, value, copyValue }) => (
                        <div key={label} className="px-4 py-2.5 bg-white">
                          <p className="text-xs text-zinc-400">{label}</p>
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-xs text-zinc-600 bg-zinc-100 px-1 py-0.5 rounded truncate">
                              {value}
                            </span>
                            {copyValue && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(copyValue);
                                }}
                                className="h-5 w-5 flex items-center justify-center rounded hover:bg-zinc-100 transition-colors"
                              >
                                <Copy className="h-3 w-3 text-zinc-400" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="divide-y divide-zinc-100">
                      {(['vars', 'bindings'] as const).map((section) => {
                        const isOpen = expandedSection[worker.id] === section;
                        return (
                          <div key={section}>
                            <button
                              type="button"
                              onClick={() => toggleSection(worker.id, section)}
                              className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 transition-colors"
                            >
                              <span>{section === 'vars' ? 'Env Variables' : 'Resource Bindings'}</span>
                              {isOpen ? (
                                <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
                              )}
                            </button>

                            {isOpen && section === 'vars' && (
                              <div className="px-4 pb-3 space-y-3">
                                <div>
                                  <p className="text-xs text-zinc-500 mb-1.5">Development</p>
                                  <div className="space-y-1">
                                    {Object.entries(worker.config.vars).map(([key, value]) => (
                                      <div key={key} className="flex items-center gap-2 text-xs">
                                        <span className="font-mono text-zinc-600 bg-zinc-100 px-1 py-0.5 rounded min-w-[160px]">
                                          {key}
                                        </span>
                                        <span className="font-mono text-zinc-400 truncate">{value}</span>
                                      </div>
                                    ))}
                                    {Object.keys(worker.config.vars).length === 0 && (
                                      <p className="text-xs text-zinc-400">No variables configured</p>
                                    )}
                                  </div>
                                </div>
                                {worker.hasProduction &&
                                  Object.keys(worker.config.production.vars).length > 0 && (
                                    <div>
                                      <p className="text-xs text-zinc-500 mb-1.5">Production</p>
                                      <div className="space-y-1">
                                        {Object.entries(worker.config.production.vars).map(
                                          ([key, value]) => (
                                            <div key={key} className="flex items-center gap-2 text-xs">
                                              <span className="font-mono text-zinc-600 bg-zinc-100 px-1 py-0.5 rounded min-w-[160px]">
                                                {key}
                                              </span>
                                              <span className="font-mono text-zinc-400 truncate">
                                                {value}
                                              </span>
                                            </div>
                                          )
                                        )}
                                      </div>
                                    </div>
                                  )}
                              </div>
                            )}

                            {isOpen && section === 'bindings' && (
                              <div className="px-4 pb-3 space-y-2">
                                 {worker.config.d1_databases.map((db) => (
                                   <div key={db.binding} className="flex items-center gap-2 text-xs">
                                    <span className="font-mono text-zinc-400 bg-zinc-100 px-1 py-0.5 rounded">
                                      D1
                                    </span>
                                    <span className="font-mono text-zinc-600">{db.binding}</span>
                                    <span className="text-zinc-400">→</span>
                                    <span className="font-mono text-zinc-600">{db.database_name}</span>
                                  </div>
                                ))}
                                 {worker.config.r2_buckets.map((bucket) => (
                                   <div key={bucket.binding} className="flex items-center gap-2 text-xs">
                                    <span className="font-mono text-zinc-400 bg-zinc-100 px-1 py-0.5 rounded">
                                      R2
                                    </span>
                                    <span className="font-mono text-zinc-600">{bucket.binding}</span>
                                    <span className="text-zinc-400">→</span>
                                    <span className="font-mono text-zinc-600">{bucket.bucket_name}</span>
                                  </div>
                                ))}
                                 {worker.config.kv_namespaces.map((kv) => (
                                   <div key={kv.binding} className="flex items-center gap-2 text-xs">
                                    <span className="font-mono text-zinc-400 bg-zinc-100 px-1 py-0.5 rounded">
                                      KV
                                    </span>
                                    <span className="font-mono text-zinc-600">{kv.binding}</span>
                                    <span className="text-zinc-400">→</span>
                                    <span className="font-mono text-zinc-400">
                                      {kv.id.slice(0, 16)}...
                                    </span>
                                  </div>
                                ))}
                                {worker.config.d1_databases.length === 0 &&
                                  worker.config.r2_buckets.length === 0 &&
                                  worker.config.kv_namespaces.length === 0 && (
                                    <p className="text-xs text-zinc-400">No resource bindings</p>
                                  )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-2 px-4 py-3 border-t border-zinc-100">
                      <Select
                        value={deployEnv}
                        onValueChange={(v) => setDeployEnv(v as 'development' | 'production')}
                      >
                        <SelectTrigger className="h-8 text-xs w-[130px] border-zinc-200 rounded-md">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="development" className="text-xs">
                            Development
                          </SelectItem>
                          {worker.hasProduction && (
                            <SelectItem value="production" className="text-xs">
                              Production
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <button
                        type="button"
                        onClick={() =>
                          deployMutation.mutate({ workerId: worker.id, env: deployEnv, dryRun: true })
                        }
                        disabled={deployMutation.isPending}
                        className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-50"
                      >
                        <Terminal className="h-3 w-3" />
                        Dry Run
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          deployMutation.mutate({ workerId: worker.id, env: deployEnv, dryRun: false })
                        }
                        disabled={deployMutation.isPending}
                        className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md bg-zinc-900 hover:bg-zinc-800 text-white transition-colors disabled:opacity-50"
                      >
                        <Rocket className="h-3 w-3" />
                        {deployMutation.isPending ? 'Deploying...' : 'Deploy'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'secrets' && (
        <div className="divide-y divide-zinc-100">
          <div className="px-4 py-2.5 bg-zinc-50 border-b border-zinc-100">
            <p className="text-xs text-zinc-500">
              Secrets are encrypted and stored securely. Set secrets per worker.
            </p>
          </div>
          {secrets.length === 0 && (
            <p className="px-4 py-3 text-sm text-zinc-400">No secrets defined</p>
          )}
          {secrets.map((secret) => (
            <div key={secret.key} className="px-4 py-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-xs text-zinc-600 bg-zinc-100 px-1 py-0.5 rounded">
                    {secret.key}
                  </span>
                  <p className="text-xs text-zinc-400 mt-1">{secret.description}</p>
                </div>
                <div className="flex items-center gap-1">
                  {secret.workers.map((w) => (
                    <span
                      key={w}
                      className="font-mono text-xs text-zinc-400 bg-zinc-100 px-1 py-0.5 rounded"
                    >
                      {w}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Input
                  type={visibleSecrets.has(secret.key) ? 'text' : 'password'}
                  placeholder="Enter new secret value..."
                  value={secretInputs[secret.key] || ''}
                  onChange={(e) =>
                    setSecretInputs((prev) => ({ ...prev, [secret.key]: e.target.value }))
                  }
                  className="h-8 text-sm rounded-md border-zinc-200 flex-1"
                />
                <button
                  type="button"
                  onClick={() => toggleSecretVisibility(secret.key)}
                  className="h-8 w-8 flex items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 transition-colors"
                >
                  {visibleSecrets.has(secret.key) ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
                <Select defaultValue={secret.workers[0]}>
                  <SelectTrigger className="h-8 text-xs w-[150px] border-zinc-200 rounded-md">
                    <SelectValue placeholder="Select worker" />
                  </SelectTrigger>
                  <SelectContent>
                    {secret.workers.map((w) => (
                      <SelectItem key={w} value={w} className="text-xs">
                        {w}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  onClick={() => {
                    const value = secretInputs[secret.key];
                    if (value) {
                      secretMutation.mutate({
                        workerId: secret.workers[0],
                        key: secret.key,
                        value,
                        env: 'production',
                      });
                    }
                  }}
                  disabled={!secretInputs[secret.key] || secretMutation.isPending}
                  className="h-8 px-3 text-xs font-medium rounded-md bg-zinc-900 hover:bg-zinc-800 text-white transition-colors disabled:opacity-50"
                >
                  Set
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'resources' && (
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-100">
          {[
            {
              label: 'D1 Databases',
              icon: <Database className="h-3.5 w-3.5" />,
              items: Array.isArray(d1Data) ? d1Data : [],
              renderItem: (db: { uuid: string; name: string }) => (
                <div key={db.uuid} className="flex items-start justify-between">
                  <span className="text-sm text-zinc-700">{db.name}</span>
                  <span className="font-mono text-xs text-zinc-400 bg-zinc-100 px-1 py-0.5 rounded">
                    {db.uuid?.slice(0, 8)}
                  </span>
                </div>
              ),
              empty: 'No databases found',
            },
            {
              label: 'KV Namespaces',
              icon: <HardDrive className="h-3.5 w-3.5" />,
              items: Array.isArray(kvData) ? kvData : [],
              renderItem: (kv: { id: string; title: string }) => (
                <div key={kv.id} className="flex items-start justify-between">
                  <span className="text-sm text-zinc-700">{kv.title}</span>
                  <span className="font-mono text-xs text-zinc-400 bg-zinc-100 px-1 py-0.5 rounded">
                    {kv.id?.slice(0, 8)}
                  </span>
                </div>
              ),
              empty: 'No KV namespaces found',
            },
            {
              label: 'R2 Buckets',
              icon: <HardDrive className="h-3.5 w-3.5" />,
              items: Array.isArray(r2Data) ? r2Data : [],
              renderItem: (bucket: { name: string; creation_date: string }) => (
                <div key={bucket.name} className="flex items-start justify-between">
                  <span className="text-sm text-zinc-700">{bucket.name}</span>
                  <span className="text-xs text-zinc-400">
                    {new Date(bucket.creation_date).toLocaleDateString()}
                  </span>
                </div>
              ),
              empty: 'No R2 buckets found',
            },
          ].map((section) => (
            <div key={section.label} className="p-4 space-y-3">
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-500">{section.icon}</span>
                <span className="text-xs font-semibold text-zinc-700">{section.label}</span>
              </div>
              {section.items.length === 0 ? (
                <p className="text-xs text-zinc-400">{section.empty}</p>
              ) : (
                <div className="space-y-2">{section.items.map(section.renderItem)}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default WorkersManager;
