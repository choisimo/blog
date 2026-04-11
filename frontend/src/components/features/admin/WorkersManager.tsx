import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { AdminSubtabs } from '@/components/molecules/AdminSubtabs';
import { adminFetchRaw } from '@/services/admin/apiClient';
import { getApiBaseUrl } from '@/utils/network/apiBase';
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
} from 'lucide-react';

interface WorkerConfig {
  id: string;
  name: string;
  description: string;
  path: string;
  wranglerPath: string;
  hasProduction: boolean;
  mutationsEnabled?: boolean;
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

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'string' && error) return error;
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message
  ) {
    return error.message;
  }
  return fallback;
}

const TABS = [
  { id: 'workers' as const, label: 'Workers', icon: <Cloud className="h-3.5 w-3.5" /> },
  { id: 'secrets' as const, label: 'Secrets', icon: <Key className="h-3.5 w-3.5" /> },
  { id: 'resources' as const, label: 'Resources', icon: <Database className="h-3.5 w-3.5" /> },
] as const;

type TabId = (typeof TABS)[number]['id'];

interface WorkersManagerProps {
  subtab?: string;
  onSubtabChange?: (subtab: string) => void;
}

export function WorkersManager({ subtab, onSubtabChange }: WorkersManagerProps) {
  const { toast } = useToast();
  const validTabs = TABS.map(t => t.id) as string[];
  const activeTab: TabId = subtab && validTabs.includes(subtab) ? (subtab as TabId) : 'workers';
  const [deployEnv, setDeployEnv] = useState<'development' | 'production'>('production');
  const [secretInputs, setSecretInputs] = useState<Record<string, string>>({});
  const [selectedWorkers, setSelectedWorkers] = useState<Record<string, string>>({});
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());
  const [expandedWorkers, setExpandedWorkers] = useState<Set<string>>(new Set());
  const [expandedSection, setExpandedSection] = useState<Record<string, string | null>>({});

  const API_BASE = getApiBaseUrl();

  const { data: workersData, isLoading: workersLoading } = useQuery({
    queryKey: ['workers-list'],
    queryFn: async () => {
      const res = await adminFetchRaw(`${API_BASE}/api/v1/admin/workers/list`);
      if (!res.ok) throw new Error('Failed to fetch workers');
      const json = await res.json();
      return json.data.workers as WorkerConfig[];
    },
  });

  const { data: secretsData } = useQuery({
    queryKey: ['workers-secrets'],
    queryFn: async () => {
      const res = await adminFetchRaw(`${API_BASE}/api/v1/admin/workers/secrets`);
      if (!res.ok) throw new Error('Failed to fetch secrets');
      const json = await res.json();
      return json.data.secrets as SecretInfo[];
    },
  });

  const { data: d1Data } = useQuery({
    queryKey: ['workers-d1'],
    queryFn: async () => {
      const res = await adminFetchRaw(`${API_BASE}/api/v1/admin/workers/d1/databases`);
      const json = await res.json();
      return json.data.databases || [];
    },
  });

  const { data: kvData } = useQuery({
    queryKey: ['workers-kv'],
    queryFn: async () => {
      const res = await adminFetchRaw(`${API_BASE}/api/v1/admin/workers/kv/namespaces`);
      const json = await res.json();
      return json.data.namespaces || [];
    },
  });

  const { data: r2Data } = useQuery({
    queryKey: ['workers-r2'],
    queryFn: async () => {
      const res = await adminFetchRaw(`${API_BASE}/api/v1/admin/workers/r2/buckets`);
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
      const res = await adminFetchRaw(`${API_BASE}/api/v1/admin/workers/${workerId}/deploy`, {
        method: 'POST',
        body: JSON.stringify({ env, dryRun }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(getApiErrorMessage(err.error, 'Deploy failed'));
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
      const res = await adminFetchRaw(`${API_BASE}/api/v1/admin/workers/${workerId}/secret`, {
        method: 'POST',
        body: JSON.stringify({ key, value, env }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(getApiErrorMessage(err.error, 'Failed to set secret'));
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
      <div className='rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 flex items-center gap-3 text-sm text-zinc-400'>
        <RefreshCw className='h-4 w-4 animate-spin shrink-0' aria-hidden='true' />
        <span>Loading workers…</span>
      </div>
    );
  }

  const workers = workersData || [];
  const secrets = secretsData || [];
  const mutationsEnabled = workers[0]?.mutationsEnabled !== false;
  const deploymentRunbook = '.github/workflows/deploy-blog-workflow.yml';
  const gitOpsManifests = 'k3s/ + ArgoCD overlays';

  return (
    <div className='rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden'>
      <AdminSubtabs tabs={TABS} activeTab={activeTab} onTabChange={(id) => onSubtabChange?.(id)} />

      {!mutationsEnabled && (
        <div className='px-4 py-3 border-b border-amber-100 dark:border-amber-900/30 bg-amber-50/70 dark:bg-amber-950/20 text-xs text-amber-700 dark:text-amber-300'>
          이 환경에서는 Worker 배포/비밀값 변경이 비활성화되어 있습니다. 실제 변경은 GitHub Actions와 GitOps 경로로만 수행됩니다.
        </div>
      )}

      {activeTab === 'workers' && (
        <div className='divide-y divide-zinc-50 dark:divide-zinc-800/50'>
          {workers.length === 0 && (
            <p className='px-4 py-6 text-sm text-zinc-400 dark:text-zinc-500'>No workers found</p>
          )}
          {workers.map((worker) => {
            const expanded = expandedWorkers.has(worker.id);
            return (
              <div key={worker.id} className={!worker.exists ? 'opacity-50' : ''}>
                <button
                  type='button'
                  disabled={!worker.exists}
                  onClick={() => worker.exists && toggleWorkerExpanded(worker.id)}
                  className='w-full flex items-center justify-between px-4 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors disabled:cursor-default text-left group'
                >
                  <div className='flex items-center gap-3'>
                    <div className='flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 shrink-0'>
                      <Cloud className='h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400' aria-hidden='true' />
                    </div>
                    <div>
                      <p className='text-sm font-medium text-zinc-800 dark:text-zinc-200'>{worker.name}</p>
                      <p className='text-xs text-zinc-400 dark:text-zinc-500'>{worker.description}</p>
                    </div>
                  </div>
                  <div className='flex items-center gap-2'>
                    {worker.exists ? (
                      <span className='flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 px-1.5 py-0.5 rounded-md'>
                        <CheckCircle2 className='h-3 w-3' aria-hidden='true' />
                        Configured
                      </span>
                    ) : (
                      <span className='flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 px-1.5 py-0.5 rounded-md'>
                        <AlertCircle className='h-3 w-3' aria-hidden='true' />
                        Missing
                      </span>
                    )}
                    {worker.hasProduction && (
                      <span className='font-mono text-xs text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700'>
                        prod
                      </span>
                    )}
                    {worker.exists &&
                      (expanded ? (
                        <ChevronDown className='h-3.5 w-3.5 text-zinc-400 transition-transform duration-200 rotate-180' aria-hidden='true' />
                      ) : (
                        <ChevronDown className='h-3.5 w-3.5 text-zinc-400 transition-transform duration-200' aria-hidden='true' />
                      ))}
                  </div>
                </button>

                {expanded && worker.config && (
                  <div className='border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20'>
                    <div className='grid grid-cols-2 md:grid-cols-4 gap-px border-b border-zinc-100 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800'>
                      {[
                        { label: 'Name', value: worker.config.name },
                        { label: 'Entry', value: worker.config.main },
                        { label: 'Compat', value: worker.config.compatibility_date },
                        {
                          label: 'Account',
                          value: `${worker.config.account_id.slice(0, 8)}…`,
                          copyValue: worker.config.account_id,
                        },
                      ].map(({ label, value, copyValue }) => (
                        <div key={label} className='px-4 py-2.5 bg-white dark:bg-zinc-900'>
                          <p className='text-xs text-zinc-400 dark:text-zinc-500 mb-0.5'>{label}</p>
                          <div className='flex items-center gap-1'>
                            <span className='font-mono text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded truncate max-w-[120px]'>
                              {value}
                            </span>
                            {copyValue && (
                              <button
                                type='button'
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(copyValue);
                                }}
                                aria-label={`Copy ${label}`}
                                className='h-5 w-5 flex items-center justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors focus-visible:ring-1 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-400 outline-none'
                              >
                                <Copy className='h-3 w-3 text-zinc-400' aria-hidden='true' />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className='divide-y divide-zinc-100 dark:divide-zinc-800'>
                      {(['vars', 'bindings'] as const).map((section) => {
                        const isOpen = expandedSection[worker.id] === section;
                        return (
                          <div key={section}>
                            <button
                              type='button'
                              onClick={() => toggleSection(worker.id, section)}
                              className='w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-400'
                            >
                              <span>{section === 'vars' ? 'Env Variables' : 'Resource Bindings'}</span>
                              <ChevronDown className={`h-3.5 w-3.5 text-zinc-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} aria-hidden='true' />
                            </button>

                            {isOpen && section === 'vars' && (
                              <div className='px-4 pb-4 space-y-3'>
                                <div>
                                  <p className='text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 flex items-center gap-1.5'>
                                    <span className='inline-block h-1.5 w-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600' aria-hidden='true' />
                                    Development
                                  </p>
                                  <div className='space-y-1.5'>
                                    {Object.entries(worker.config.vars).map(([key, value]) => (
                                      <div key={key} className='flex items-center gap-2 text-xs'>
                                        <span className='font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded min-w-[160px] border border-zinc-200 dark:border-zinc-700'>
                                          {key}
                                        </span>
                                        <span className='font-mono text-zinc-400 dark:text-zinc-500 truncate'>{value}</span>
                                      </div>
                                    ))}
                                    {Object.keys(worker.config.vars).length === 0 && (
                                      <p className='text-xs text-zinc-400 dark:text-zinc-500 italic'>No variables configured</p>
                                    )}
                                  </div>
                                </div>
                                {worker.hasProduction &&
                                  Object.keys(worker.config.production.vars).length > 0 && (
                                    <div>
                                      <p className='text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 flex items-center gap-1.5'>
                                        <span className='inline-block h-1.5 w-1.5 rounded-full bg-emerald-400' aria-hidden='true' />
                                        Production
                                      </p>
                                      <div className='space-y-1.5'>
                                        {Object.entries(worker.config.production.vars).map(
                                          ([key, value]) => (
                                            <div key={key} className='flex items-center gap-2 text-xs'>
                                              <span className='font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded min-w-[160px] border border-zinc-200 dark:border-zinc-700'>
                                                {key}
                                              </span>
                                              <span className='font-mono text-zinc-400 dark:text-zinc-500 truncate'>
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
                              <div className='px-4 pb-4 space-y-2'>
                                {worker.config.d1_databases.map((db) => (
                                  <div key={db.binding} className='flex items-center gap-2 text-xs'>
                                    <span className='font-mono text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/50 px-1.5 py-0.5 rounded shrink-0'>
                                      D1
                                    </span>
                                    <span className='font-mono text-zinc-600 dark:text-zinc-400'>{db.binding}</span>
                                    <span className='text-zinc-300 dark:text-zinc-600' aria-hidden='true'>→</span>
                                    <span className='font-mono text-zinc-500 dark:text-zinc-400'>{db.database_name}</span>
                                  </div>
                                ))}
                                {worker.config.r2_buckets.map((bucket) => (
                                  <div key={bucket.binding} className='flex items-center gap-2 text-xs'>
                                    <span className='font-mono text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800/50 px-1.5 py-0.5 rounded shrink-0'>
                                      R2
                                    </span>
                                    <span className='font-mono text-zinc-600 dark:text-zinc-400'>{bucket.binding}</span>
                                    <span className='text-zinc-300 dark:text-zinc-600' aria-hidden='true'>→</span>
                                    <span className='font-mono text-zinc-500 dark:text-zinc-400'>{bucket.bucket_name}</span>
                                  </div>
                                ))}
                                {worker.config.kv_namespaces.map((kv) => (
                                  <div key={kv.binding} className='flex items-center gap-2 text-xs'>
                                    <span className='font-mono text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 px-1.5 py-0.5 rounded shrink-0'>
                                      KV
                                    </span>
                                    <span className='font-mono text-zinc-600 dark:text-zinc-400'>{kv.binding}</span>
                                    <span className='text-zinc-300 dark:text-zinc-600' aria-hidden='true'>→</span>
                                    <span className='font-mono text-zinc-400 dark:text-zinc-500'>
                                      {kv.id.slice(0, 16)}…
                                    </span>
                                  </div>
                                ))}
                                {worker.config.d1_databases.length === 0 &&
                                  worker.config.r2_buckets.length === 0 &&
                                  worker.config.kv_namespaces.length === 0 && (
                                    <p className='text-xs text-zinc-400 dark:text-zinc-500 italic'>No resource bindings</p>
                                  )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {mutationsEnabled ? (
                      <div className='flex items-center gap-2 px-4 py-3 border-t border-zinc-100 dark:border-zinc-800'>
                        <Select
                          value={deployEnv}
                          onValueChange={(v) => setDeployEnv(v as 'development' | 'production')}
                        >
                          <SelectTrigger className='h-9 text-xs w-[140px] border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg'>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='development' className='text-xs'>
                              Development
                            </SelectItem>
                            {worker.hasProduction && (
                              <SelectItem value='production' className='text-xs'>
                                Production
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <button
                          type='button'
                          onClick={() =>
                            deployMutation.mutate({ workerId: worker.id, env: deployEnv, dryRun: true })
                          }
                          disabled={deployMutation.isPending}
                          className='flex items-center gap-1.5 h-9 px-3 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-400'
                        >
                          <Terminal className='h-3 w-3' aria-hidden='true' />
                          Dry Run
                        </button>
                        <button
                          type='button'
                          onClick={() =>
                            deployMutation.mutate({ workerId: worker.id, env: deployEnv, dryRun: false })
                          }
                          disabled={deployMutation.isPending}
                          className='flex items-center gap-1.5 h-9 px-3 text-xs font-semibold rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 text-white shadow-sm transition-all active:scale-95 disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-400'
                        >
                          <Rocket className='h-3 w-3' aria-hidden='true' />
                          {deployMutation.isPending ? 'Deploying…' : 'Deploy'}
                        </button>
                      </div>
                    ) : (
                      <div className='px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/20 text-xs text-zinc-600 dark:text-zinc-400 space-y-2'>
                        <p>Production deploys are read-only here. Use the operational path below instead.</p>
                        <div className='flex flex-wrap gap-2'>
                          <span className='font-mono rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1'>
                            {deploymentRunbook}
                          </span>
                          <span className='font-mono rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1'>
                            {gitOpsManifests}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'secrets' && (
        <div className='divide-y divide-zinc-50 dark:divide-zinc-800/50'>
          <div className='px-4 py-2.5 bg-amber-50/50 dark:bg-amber-950/10 border-b border-amber-100 dark:border-amber-900/20'>
            <p className='text-xs text-amber-700 dark:text-amber-400'>
              {mutationsEnabled
                ? 'Secrets are encrypted and stored securely. Set secrets per worker.'
                : `Secret rotation is read-only here. Update ${deploymentRunbook} and your GitOps secret source instead.`}
            </p>
          </div>
          {secrets.length === 0 && (
            <p className='px-4 py-6 text-sm text-zinc-400 dark:text-zinc-500'>No secrets defined</p>
          )}
          {secrets.map((secret) => (
            <div key={secret.key} className='px-4 py-3.5 space-y-2.5'>
              <div className='flex items-start justify-between gap-3'>
                <div className='min-w-0'>
                  <span className='font-mono text-xs text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 rounded'>
                    {secret.key}
                  </span>
                  <p className='text-xs text-zinc-400 dark:text-zinc-500 mt-1'>{secret.description}</p>
                </div>
                <div className='flex items-center gap-1 flex-wrap justify-end shrink-0'>
                  {secret.workers.map((w) => (
                    <span
                      key={w}
                      className='font-mono text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 rounded'
                    >
                      {w}
                    </span>
                  ))}
                </div>
              </div>
              {mutationsEnabled ? (
                <div className='flex gap-2'>
                  <Input
                    type={visibleSecrets.has(secret.key) ? 'text' : 'password'}
                    placeholder='Enter new secret value…'
                    value={secretInputs[secret.key] || ''}
                    onChange={(e) =>
                      setSecretInputs((prev) => ({ ...prev, [secret.key]: e.target.value }))
                    }
                    className='h-9 text-sm rounded-lg border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-200 focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-400 focus-visible:ring-offset-0 flex-1'
                  />
                  <button
                    type='button'
                    onClick={() => toggleSecretVisibility(secret.key)}
                    aria-label={visibleSecrets.has(secret.key) ? 'Hide secret' : 'Show secret'}
                    className='h-9 w-9 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-400 shrink-0'
                  >
                    {visibleSecrets.has(secret.key) ? (
                      <EyeOff className='h-3.5 w-3.5' aria-hidden='true' />
                    ) : (
                      <Eye className='h-3.5 w-3.5' aria-hidden='true' />
                    )}
                  </button>
                  <Select
                    value={selectedWorkers[secret.key] ?? secret.workers[0]}
                    onValueChange={(v) =>
                      setSelectedWorkers((prev) => ({ ...prev, [secret.key]: v }))
                    }
                  >
                    <SelectTrigger className='h-9 text-xs w-[150px] border-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg'>
                      <SelectValue placeholder='Select worker' />
                    </SelectTrigger>
                    <SelectContent>
                      {secret.workers.map((w) => (
                        <SelectItem key={w} value={w} className='text-xs'>
                          {w}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    type='button'
                    onClick={() => {
                      const value = secretInputs[secret.key];
                      if (value) {
                        secretMutation.mutate({
                          workerId: selectedWorkers[secret.key] ?? secret.workers[0],
                          key: secret.key,
                          value,
                          env: 'production',
                        });
                      }
                    }}
                    disabled={!secretInputs[secret.key] || secretMutation.isPending}
                    className='h-9 px-3 text-xs font-semibold rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 text-white shadow-sm transition-all active:scale-95 disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-400 shrink-0'
                  >
                    Set
                  </button>
                </div>
              ) : (
                <p className='text-xs text-zinc-500 dark:text-zinc-400'>
                  Update this secret through GitHub Actions/GitOps secret management. UI writes are disabled in this environment.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'resources' && (
        <div className='grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-100 dark:divide-zinc-800'>
          {[
            {
              label: 'D1 Databases',
              icon: <Database className='h-3.5 w-3.5' aria-hidden='true' />,
              badge: 'D1',
              badgeClass: 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800/50',
              items: Array.isArray(d1Data) ? d1Data : [],
              renderItem: (db: { uuid: string; name: string }) => (
                <div key={db.uuid} className='flex items-center justify-between gap-2'>
                  <span className='text-sm text-zinc-700 dark:text-zinc-300 truncate'>{db.name}</span>
                  <span className='font-mono text-xs text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded shrink-0'>
                    {db.uuid?.slice(0, 8)}
                  </span>
                </div>
              ),
              empty: 'No databases found',
            },
            {
              label: 'KV Namespaces',
              icon: <HardDrive className='h-3.5 w-3.5' aria-hidden='true' />,
              badge: 'KV',
              badgeClass: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50',
              items: Array.isArray(kvData) ? kvData : [],
              renderItem: (kv: { id: string; title: string }) => (
                <div key={kv.id} className='flex items-center justify-between gap-2'>
                  <span className='text-sm text-zinc-700 dark:text-zinc-300 truncate'>{kv.title}</span>
                  <span className='font-mono text-xs text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded shrink-0'>
                    {kv.id?.slice(0, 8)}
                  </span>
                </div>
              ),
              empty: 'No KV namespaces found',
            },
            {
              label: 'R2 Buckets',
              icon: <HardDrive className='h-3.5 w-3.5' aria-hidden='true' />,
              badge: 'R2',
              badgeClass: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800/50',
              items: Array.isArray(r2Data) ? r2Data : [],
              renderItem: (bucket: { name: string; creation_date: string }) => (
                <div key={bucket.name} className='flex items-center justify-between gap-2'>
                  <span className='text-sm text-zinc-700 dark:text-zinc-300 truncate'>{bucket.name}</span>
                  <span className='text-xs text-zinc-400 dark:text-zinc-500 shrink-0'>
                    {new Date(bucket.creation_date).toLocaleDateString()}
                  </span>
                </div>
              ),
              empty: 'No R2 buckets found',
            },
          ].map((section) => (
            <div key={section.label} className='p-4 space-y-3'>
              <div className='flex items-center gap-2'>
                <span className={`font-mono text-xs px-1.5 py-0.5 rounded border ${section.badgeClass}`}>
                  {section.badge}
                </span>
                <span className='text-xs font-semibold text-zinc-700 dark:text-zinc-300'>{section.label}</span>
                {section.items.length > 0 && (
                  <span className='ml-auto font-mono text-xs text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded'>
                    {section.items.length}
                  </span>
                )}
              </div>
              {section.items.length === 0 ? (
                <p className='text-xs text-zinc-400 dark:text-zinc-500 italic'>{section.empty}</p>
              ) : (
                <div className='space-y-2'>{section.items.map(section.renderItem)}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default WorkersManager;
