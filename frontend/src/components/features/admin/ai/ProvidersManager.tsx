/**
 * AI Providers Manager Component
 */

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  MoreHorizontal,
  RefreshCw,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Circle,
} from 'lucide-react';
import { useProviders } from './hooks';
import type { AIProvider, ProviderFormData } from './types';

interface ProviderFormProps {
  provider?: AIProvider;
  onSubmit: (data: ProviderFormData) => Promise<void>;
  onCancel: () => void;
}

function ProviderForm({ provider, onSubmit, onCancel }: ProviderFormProps) {
  const [formData, setFormData] = useState<ProviderFormData>({
    name: provider?.name || '',
    displayName: provider?.displayName || '',
    apiBaseUrl: provider?.apiBaseUrl || '',
    apiKeyEnv: provider?.apiKeyEnv || '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="openai"
            disabled={!!provider}
            required
          />
          <p className="text-xs text-muted-foreground">Identifier (lowercase, no spaces)</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="displayName">Display Name *</Label>
          <Input
            id="displayName"
            value={formData.displayName}
            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
            placeholder="OpenAI"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="apiBaseUrl">API Base URL</Label>
        <Input
          id="apiBaseUrl"
          value={formData.apiBaseUrl || ''}
          onChange={(e) => setFormData({ ...formData, apiBaseUrl: e.target.value })}
          placeholder="https://api.openai.com/v1"
        />
        <p className="text-xs text-muted-foreground">Leave empty for default provider URL</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="apiKeyEnv">API Key Environment Variable</Label>
        <Input
          id="apiKeyEnv"
          value={formData.apiKeyEnv || ''}
          onChange={(e) => setFormData({ ...formData, apiKeyEnv: e.target.value })}
          placeholder="OPENAI_API_KEY"
        />
        <p className="text-xs text-muted-foreground">
          Environment variable name containing the API key (for security, we don't store actual keys)
        </p>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {provider ? 'Update' : 'Create'} Provider
        </Button>
      </DialogFooter>
    </form>
  );
}

function HealthStatusBadge({ status }: { status: AIProvider['healthStatus'] }) {
  switch (status) {
    case 'healthy':
      return (
        <Badge variant="default" className="bg-green-500">
          <CheckCircle className="h-3 w-3 mr-1" />
          Healthy
        </Badge>
      );
    case 'degraded':
      return (
        <Badge variant="secondary" className="bg-yellow-500 text-white">
          <AlertCircle className="h-3 w-3 mr-1" />
          Degraded
        </Badge>
      );
    case 'down':
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Down
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          <Circle className="h-3 w-3 mr-1" />
          Unknown
        </Badge>
      );
  }
}

export function ProvidersManager() {
  const {
    providers,
    loading,
    error,
    fetchProviders,
    createProvider,
    updateProvider,
    deleteProvider,
    checkHealth,
  } = useProviders();
  const [showForm, setShowForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null);
  const [checkingHealth, setCheckingHealth] = useState<string | null>(null);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const handleCreate = async (data: ProviderFormData) => {
    const result = await createProvider(data);
    if (result.ok) {
      setShowForm(false);
    }
  };

  const handleUpdate = async (data: ProviderFormData) => {
    if (!editingProvider) return;
    const result = await updateProvider(editingProvider.id, data);
    if (result.ok) {
      setEditingProvider(null);
    }
  };

  const handleToggleEnabled = async (provider: AIProvider) => {
    await updateProvider(provider.id, { isEnabled: !provider.isEnabled });
  };

  const handleDelete = async (provider: AIProvider) => {
    if (!confirm(`Delete provider "${provider.displayName}"? This cannot be undone.`)) return;
    await deleteProvider(provider.id);
  };

  const handleCheckHealth = async (provider: AIProvider) => {
    setCheckingHealth(provider.id);
    await checkHealth(provider.id);
    setCheckingHealth(null);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>AI Providers</CardTitle>
            <CardDescription>Manage AI service providers and their API configurations</CardDescription>
          </div>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Provider
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-md flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {providers.map((provider) => (
              <div
                key={provider.id}
                className={`p-4 border rounded-lg ${
                  provider.isEnabled
                    ? 'border-border'
                    : 'border-dashed border-muted-foreground/30 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{provider.displayName}</span>
                      <Badge variant="outline" className="font-mono text-xs">
                        {provider.name}
                      </Badge>
                      <HealthStatusBadge status={provider.healthStatus} />
                      {!provider.isEnabled && <Badge variant="destructive">Disabled</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {provider.apiBaseUrl && <p>URL: {provider.apiBaseUrl}</p>}
                      {provider.apiKeyEnv && <p>API Key: ${provider.apiKeyEnv}</p>}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{provider.enabledModelCount}/{provider.modelCount} models enabled</span>
                      {provider.lastHealthCheck && (
                        <span>Last check: {new Date(provider.lastHealthCheck).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCheckHealth(provider)}
                      disabled={checkingHealth === provider.id}
                    >
                      {checkingHealth === provider.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      <span className="ml-1">Health</span>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingProvider(provider)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleEnabled(provider)}>
                          {provider.isEnabled ? 'Disable' : 'Enable'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDelete(provider)}
                          className="text-red-600"
                          disabled={provider.modelCount > 0}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))}
            {providers.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No providers configured. Add your first provider to get started.
              </p>
            )}
          </div>
        )}
      </CardContent>

      {/* Create Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Provider</DialogTitle>
            <DialogDescription>Configure a new AI service provider</DialogDescription>
          </DialogHeader>
          <ProviderForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingProvider} onOpenChange={() => setEditingProvider(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Provider</DialogTitle>
            <DialogDescription>Update provider configuration</DialogDescription>
          </DialogHeader>
          {editingProvider && (
            <ProviderForm
              provider={editingProvider}
              onSubmit={handleUpdate}
              onCancel={() => setEditingProvider(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
