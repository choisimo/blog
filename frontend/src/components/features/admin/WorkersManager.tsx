import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/components/ui/use-toast';
import { getApiBaseUrl } from '@/utils/apiBase';
import {
  Cloud,
  Database,
  HardDrive,
  Key,
  Rocket,
  RefreshCw,
  Settings,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Copy,
  Eye,
  EyeOff,
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

export function WorkersManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);
  const [deployEnv, setDeployEnv] = useState<'development' | 'production'>('production');
  const [secretInputs, setSecretInputs] = useState<Record<string, string>>({});
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());
  
  const API_BASE = getApiBaseUrl();

  const { data: workersData, isLoading: workersLoading } = useQuery({
    queryKey: ['workers-list'],
    queryFn: async () => {
      const res = await fetchWithAuth(`${API_BASE}/api/v1/admin/workers/list`);
      if (!res.ok) throw new Error('Failed to fetch workers');
      const json = await res.json();
      return json.data.workers as WorkerConfig[];
    },
  });

  const { data: secretsData } = useQuery({
    queryKey: ['workers-secrets'],
    queryFn: async () => {
      const res = await fetchWithAuth(`${API_BASE}/api/v1/admin/workers/secrets`);
      if (!res.ok) throw new Error('Failed to fetch secrets');
      const json = await res.json();
      return json.data.secrets as SecretInfo[];
    },
  });

  const { data: d1Data } = useQuery({
    queryKey: ['workers-d1'],
    queryFn: async () => {
      const res = await fetchWithAuth(`${API_BASE}/api/v1/admin/workers/d1/databases`);
      const json = await res.json();
      return json.data.databases || [];
    },
  });

  const { data: kvData } = useQuery({
    queryKey: ['workers-kv'],
    queryFn: async () => {
      const res = await fetchWithAuth(`${API_BASE}/api/v1/admin/workers/kv/namespaces`);
      const json = await res.json();
      return json.data.namespaces || [];
    },
  });

  const { data: r2Data } = useQuery({
    queryKey: ['workers-r2'],
    queryFn: async () => {
      const res = await fetchWithAuth(`${API_BASE}/api/v1/admin/workers/r2/buckets`);
      const json = await res.json();
      return json.data.buckets || [];
    },
  });

  const deployMutation = useMutation({
    mutationFn: async ({ workerId, env, dryRun }: { workerId: string; env: string; dryRun: boolean }) => {
      const res = await fetchWithAuth(`${API_BASE}/api/v1/admin/workers/${workerId}/deploy`, {
        method: 'POST',
        body: JSON.stringify({ env, dryRun }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Deploy failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Deployment',
        description: data.data.message,
      });
    },
    onError: (err: Error) => {
      toast({
        title: 'Deployment failed',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const secretMutation = useMutation({
    mutationFn: async ({ workerId, key, value, env }: { workerId: string; key: string; value: string; env: string }) => {
      const res = await fetchWithAuth(`${API_BASE}/api/v1/admin/workers/${workerId}/secret`, {
        method: 'POST',
        body: JSON.stringify({ key, value, env }),
      });
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

  if (workersLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading workers...</span>
      </div>
    );
  }

  const workers = workersData || [];
  const secrets = secretsData || [];

  return (
    <div className="space-y-6">
      <Tabs defaultValue="workers">
        <TabsList>
          <TabsTrigger value="workers">
            <Cloud className="h-4 w-4 mr-2" />
            Workers
          </TabsTrigger>
          <TabsTrigger value="secrets">
            <Key className="h-4 w-4 mr-2" />
            Secrets
          </TabsTrigger>
          <TabsTrigger value="resources">
            <Database className="h-4 w-4 mr-2" />
            Resources
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workers" className="space-y-4">
          <div className="grid gap-4">
            {workers.map((worker) => (
              <Card key={worker.id} className={!worker.exists ? 'opacity-60' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Cloud className="h-5 w-5 text-primary" />
                      <div>
                        <CardTitle className="text-lg">{worker.name}</CardTitle>
                        <CardDescription>{worker.description}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {worker.exists ? (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Configured
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Missing
                        </Badge>
                      )}
                      {worker.hasProduction && (
                        <Badge variant="secondary">Production</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                {worker.exists && worker.config && (
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Name:</span>
                        <code className="ml-2 bg-muted px-1 rounded">{worker.config.name}</code>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Entry:</span>
                        <code className="ml-2 bg-muted px-1 rounded">{worker.config.main}</code>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Compat:</span>
                        <code className="ml-2 bg-muted px-1 rounded">{worker.config.compatibility_date}</code>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Account:</span>
                        <code className="bg-muted px-1 rounded text-xs truncate max-w-[100px]">
                          {worker.config.account_id.slice(0, 8)}...
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(worker.config!.account_id)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <Accordion type="single" collapsible>
                      <AccordionItem value="vars">
                        <AccordionTrigger className="text-sm">
                          <Settings className="h-4 w-4 mr-2" />
                          Environment Variables
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-4">
                            <div>
                              <h4 className="font-medium text-sm mb-2">Development</h4>
                              <div className="grid gap-2">
                                {Object.entries(worker.config.vars).map(([key, value]) => (
                                  <div key={key} className="flex items-center gap-2 text-sm">
                                    <code className="bg-muted px-2 py-1 rounded min-w-[180px]">{key}</code>
                                    <code className="bg-muted/50 px-2 py-1 rounded flex-1 truncate">{value}</code>
                                  </div>
                                ))}
                                {Object.keys(worker.config.vars).length === 0 && (
                                  <p className="text-muted-foreground text-sm">No variables configured</p>
                                )}
                              </div>
                            </div>
                            {worker.hasProduction && Object.keys(worker.config.production.vars).length > 0 && (
                              <div>
                                <h4 className="font-medium text-sm mb-2">Production</h4>
                                <div className="grid gap-2">
                                  {Object.entries(worker.config.production.vars).map(([key, value]) => (
                                    <div key={key} className="flex items-center gap-2 text-sm">
                                      <code className="bg-muted px-2 py-1 rounded min-w-[180px]">{key}</code>
                                      <code className="bg-muted/50 px-2 py-1 rounded flex-1 truncate">{value}</code>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="bindings">
                        <AccordionTrigger className="text-sm">
                          <Database className="h-4 w-4 mr-2" />
                          Resource Bindings
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-3">
                            {worker.config.d1_databases.length > 0 && (
                              <div>
                                <h4 className="text-sm font-medium mb-1">D1 Databases</h4>
                                {worker.config.d1_databases.map((db, i) => (
                                  <div key={i} className="text-sm flex items-center gap-2">
                                    <Badge variant="outline">D1</Badge>
                                    <code>{db.binding}</code>
                                    <span className="text-muted-foreground">→</span>
                                    <code>{db.database_name}</code>
                                  </div>
                                ))}
                              </div>
                            )}
                            {worker.config.r2_buckets.length > 0 && (
                              <div>
                                <h4 className="text-sm font-medium mb-1">R2 Buckets</h4>
                                {worker.config.r2_buckets.map((bucket, i) => (
                                  <div key={i} className="text-sm flex items-center gap-2">
                                    <Badge variant="outline">R2</Badge>
                                    <code>{bucket.binding}</code>
                                    <span className="text-muted-foreground">→</span>
                                    <code>{bucket.bucket_name}</code>
                                  </div>
                                ))}
                              </div>
                            )}
                            {worker.config.kv_namespaces.length > 0 && (
                              <div>
                                <h4 className="text-sm font-medium mb-1">KV Namespaces</h4>
                                {worker.config.kv_namespaces.map((kv, i) => (
                                  <div key={i} className="text-sm flex items-center gap-2">
                                    <Badge variant="outline">KV</Badge>
                                    <code>{kv.binding}</code>
                                    <span className="text-muted-foreground">→</span>
                                    <code className="text-xs">{kv.id.slice(0, 16)}...</code>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>

                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Select
                        value={deployEnv}
                        onValueChange={(v) => setDeployEnv(v as 'development' | 'production')}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="development">Development</SelectItem>
                          {worker.hasProduction && (
                            <SelectItem value="production">Production</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        onClick={() =>
                          deployMutation.mutate({ workerId: worker.id, env: deployEnv, dryRun: true })
                        }
                        disabled={deployMutation.isPending}
                      >
                        <Terminal className="h-4 w-4 mr-2" />
                        Dry Run
                      </Button>
                      <Button
                        onClick={() =>
                          deployMutation.mutate({ workerId: worker.id, env: deployEnv, dryRun: false })
                        }
                        disabled={deployMutation.isPending}
                      >
                        <Rocket className="h-4 w-4 mr-2" />
                        {deployMutation.isPending ? 'Deploying...' : 'Deploy'}
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="secrets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Worker Secrets
              </CardTitle>
              <CardDescription>
                Secrets are encrypted and stored securely by Cloudflare. Set secrets for each worker.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {secrets.map((secret) => (
                <div key={secret.key} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <code className="font-mono font-bold">{secret.key}</code>
                      <p className="text-sm text-muted-foreground">{secret.description}</p>
                    </div>
                    <div className="flex gap-1">
                      {secret.workers.map((w) => (
                        <Badge key={w} variant="secondary" className="text-xs">
                          {w}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 flex gap-2">
                      <Input
                        type={visibleSecrets.has(secret.key) ? 'text' : 'password'}
                        placeholder="Enter new secret value..."
                        value={secretInputs[secret.key] || ''}
                        onChange={(e) =>
                          setSecretInputs((prev) => ({ ...prev, [secret.key]: e.target.value }))
                        }
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => toggleSecretVisibility(secret.key)}
                      >
                        {visibleSecrets.has(secret.key) ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <Select defaultValue={secret.workers[0]}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Select worker" />
                      </SelectTrigger>
                      <SelectContent>
                        {secret.workers.map((w) => (
                          <SelectItem key={w} value={w}>
                            {w}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
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
                    >
                      Set Secret
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Database className="h-4 w-4" />
                  D1 Databases
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Array.isArray(d1Data) && d1Data.length > 0 ? (
                  <div className="space-y-2">
                    {d1Data.map((db: any) => (
                      <div key={db.uuid} className="text-sm border rounded p-2">
                        <div className="font-medium">{db.name}</div>
                        <code className="text-xs text-muted-foreground">{db.uuid}</code>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No databases found or wrangler not authenticated</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <HardDrive className="h-4 w-4" />
                  KV Namespaces
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Array.isArray(kvData) && kvData.length > 0 ? (
                  <div className="space-y-2">
                    {kvData.map((kv: any) => (
                      <div key={kv.id} className="text-sm border rounded p-2">
                        <div className="font-medium">{kv.title}</div>
                        <code className="text-xs text-muted-foreground">{kv.id}</code>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No KV namespaces found</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <HardDrive className="h-4 w-4" />
                  R2 Buckets
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Array.isArray(r2Data) && r2Data.length > 0 ? (
                  <div className="space-y-2">
                    {r2Data.map((bucket: any) => (
                      <div key={bucket.name} className="text-sm border rounded p-2">
                        <div className="font-medium">{bucket.name}</div>
                        <span className="text-xs text-muted-foreground">
                          Created: {new Date(bucket.creation_date).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No R2 buckets found</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default WorkersManager;
