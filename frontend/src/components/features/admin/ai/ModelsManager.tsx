/**
 * AI Models Manager Component
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
import { Switch } from '@/components/ui/switch';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Play,
  Pencil,
  Trash2,
  Eye,
  Zap,
  MessageSquare,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { useModels, useProviders } from './hooks';
import type { AIModel, ModelFormData, AIProvider } from './types';

const ALL_FILTER_VALUE = 'all';
const ADMIN_SELECTOR_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function decodeSelector(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function normalizeAdminSelector(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const decoded = decodeSelector(trimmed);
  if (!decoded) return null;

  if ([trimmed, decoded].some((candidate) => /[\r\n\\/]/.test(candidate))) {
    return null;
  }

  return ADMIN_SELECTOR_PATTERN.test(trimmed) ? trimmed : null;
}

function normalizeFilterProvider(value: unknown): string {
  if (value === ALL_FILTER_VALUE) return ALL_FILTER_VALUE;
  return normalizeAdminSelector(value) ?? ALL_FILTER_VALUE;
}

export function normalizeModelOptionalPositiveInteger(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : undefined;
}

export function normalizeModelOptionalNonNegativeNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value >= 0 ? value : undefined;
}

export function normalizeModelPriority(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

export function normalizeModelFormData(data: ModelFormData): ModelFormData | null {
  const providerId = normalizeAdminSelector(data.providerId);
  if (!providerId) return null;
  return {
    ...data,
    providerId,
    contextWindow: normalizeModelOptionalPositiveInteger(data.contextWindow),
    maxTokens: normalizeModelOptionalPositiveInteger(data.maxTokens),
    inputCostPer1k: normalizeModelOptionalNonNegativeNumber(data.inputCostPer1k),
    outputCostPer1k: normalizeModelOptionalNonNegativeNumber(data.outputCostPer1k),
    priority: normalizeModelPriority(data.priority),
  };
}

function isSafeProvider(provider: AIProvider): boolean {
  return Boolean(normalizeAdminSelector(provider.id));
}

function isSafeModel(model: AIModel): boolean {
  return Boolean(
    normalizeAdminSelector(model.id) &&
      normalizeAdminSelector(model.provider?.id),
  );
}

interface ModelFormProps {
  model?: AIModel;
  providers: AIProvider[];
  onSubmit: (data: ModelFormData) => Promise<void>;
  onCancel: () => void;
}

function ModelForm({ model, providers, onSubmit, onCancel }: ModelFormProps) {
  const [formData, setFormData] = useState<ModelFormData>({
    modelName: model?.modelName || '',
    displayName: model?.displayName || '',
    providerId: model?.provider?.id || '',
    modelIdentifier: model?.modelIdentifier || '',
    description: model?.description || '',
    contextWindow: model?.contextWindow || undefined,
    maxTokens: model?.maxTokens || undefined,
    inputCostPer1k: model?.cost?.inputPer1k || undefined,
    outputCostPer1k: model?.cost?.outputPer1k || undefined,
    supportsVision: model?.capabilities?.vision || false,
    supportsStreaming: model?.capabilities?.streaming ?? true,
    supportsFunctionCalling: model?.capabilities?.functionCalling || false,
    priority: model?.priority || 0,
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
          <Label htmlFor="modelName">Model Name *</Label>
          <Input
            id="modelName"
            value={formData.modelName}
            onChange={(e) => setFormData({ ...formData, modelName: e.target.value })}
            placeholder="gpt-4o"
            disabled={!!model}
            required
          />
          <p className="text-xs text-muted-foreground">Used in API calls</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="displayName">Display Name *</Label>
          <Input
            id="displayName"
            value={formData.displayName}
            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
            placeholder="GPT-4o"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="providerId">Provider *</Label>
          <Select
            value={formData.providerId}
            onValueChange={(v) => {
              const providerId = normalizeAdminSelector(v);
              if (providerId) setFormData({ ...formData, providerId });
            }}
            disabled={!!model}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              {providers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="modelIdentifier">Model Identifier *</Label>
          <Input
            id="modelIdentifier"
            value={formData.modelIdentifier}
            onChange={(e) => setFormData({ ...formData, modelIdentifier: e.target.value })}
            placeholder="openai/gpt-4o"
            required
          />
          <p className="text-xs text-muted-foreground">Actual model identifier</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={formData.description || ''}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Model description"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="contextWindow">Context Window</Label>
          <Input
            id="contextWindow"
            type="number"
            value={formData.contextWindow || ''}
            onChange={(e) =>
              setFormData({ ...formData, contextWindow: e.target.value ? parseInt(e.target.value) : undefined })
            }
            placeholder="128000"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxTokens">Max Tokens</Label>
          <Input
            id="maxTokens"
            type="number"
            value={formData.maxTokens || ''}
            onChange={(e) =>
              setFormData({ ...formData, maxTokens: e.target.value ? parseInt(e.target.value) : undefined })
            }
            placeholder="4096"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <Input
            id="priority"
            type="number"
            value={formData.priority || ''}
            onChange={(e) =>
              setFormData({ ...formData, priority: e.target.value ? parseInt(e.target.value) : 0 })
            }
            placeholder="0"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="inputCost">Input Cost ($/1K tokens)</Label>
          <Input
            id="inputCost"
            type="number"
            step="0.0001"
            value={formData.inputCostPer1k || ''}
            onChange={(e) =>
              setFormData({ ...formData, inputCostPer1k: e.target.value ? parseFloat(e.target.value) : undefined })
            }
            placeholder="0.01"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="outputCost">Output Cost ($/1K tokens)</Label>
          <Input
            id="outputCost"
            type="number"
            step="0.0001"
            value={formData.outputCostPer1k || ''}
            onChange={(e) =>
              setFormData({ ...formData, outputCostPer1k: e.target.value ? parseFloat(e.target.value) : undefined })
            }
            placeholder="0.03"
          />
        </div>
      </div>

      <div className="flex gap-6 py-2">
        <div className="flex items-center gap-2">
          <Switch
            id="vision"
            checked={formData.supportsVision}
            onCheckedChange={(v) => setFormData({ ...formData, supportsVision: v })}
          />
          <Label htmlFor="vision" className="flex items-center gap-1">
            <Eye className="h-4 w-4" /> Vision
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="streaming"
            checked={formData.supportsStreaming}
            onCheckedChange={(v) => setFormData({ ...formData, supportsStreaming: v })}
          />
          <Label htmlFor="streaming" className="flex items-center gap-1">
            <Zap className="h-4 w-4" /> Streaming
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="functions"
            checked={formData.supportsFunctionCalling}
            onCheckedChange={(v) => setFormData({ ...formData, supportsFunctionCalling: v })}
          />
          <Label htmlFor="functions" className="flex items-center gap-1">
            <MessageSquare className="h-4 w-4" /> Functions
          </Label>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {model ? 'Update' : 'Create'} Model
        </Button>
      </DialogFooter>
    </form>
  );
}

interface TestResultProps {
  result: {
    success: boolean;
    modelName: string;
    latencyMs?: number;
    response?: string;
    error?: string;
  };
}

function TestResult({ result }: TestResultProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {result.success ? (
          <CheckCircle className="h-5 w-5 text-green-500" />
        ) : (
          <XCircle className="h-5 w-5 text-red-500" />
        )}
        <span className="font-medium">
          {result.success ? 'Test Passed' : 'Test Failed'}
        </span>
        {result.latencyMs && (
          <Badge variant="secondary">{result.latencyMs}ms</Badge>
        )}
      </div>
      {result.response && (
        <div className="p-3 bg-muted rounded-md">
          <p className="text-sm font-mono">{result.response}</p>
        </div>
      )}
      {result.error && (
        <div className="p-3 bg-red-50 dark:bg-red-950 rounded-md">
          <p className="text-sm text-red-600 dark:text-red-400">{result.error}</p>
        </div>
      )}
    </div>
  );
}

export function ModelsManager() {
  const { models, loading, error, fetchModels, createModel, updateModel, deleteModel, testModel } =
    useModels();
  const { providers, fetchProviders } = useProviders();
  const [showForm, setShowForm] = useState(false);
  const [editingModel, setEditingModel] = useState<AIModel | null>(null);
  const [testingModel, setTestingModel] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResultProps['result'] | null>(null);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [filterProvider, setFilterProvider] =
    useState<string>(ALL_FILTER_VALUE);
  const [filterEnabled, setFilterEnabled] =
    useState<string>(ALL_FILTER_VALUE);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AIModel | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingModel, setDeletingModel] = useState(false);
  const visibleProviders = providers.filter(isSafeProvider);
  const visibleModels = models.filter(isSafeModel);

  useEffect(() => {
    fetchModels();
    fetchProviders();
  }, [fetchModels, fetchProviders]);

  const handleCreate = async (data: ModelFormData) => {
    const safeData = normalizeModelFormData(data);
    if (!safeData) return;
    const result = await createModel(safeData);
    if (result.ok) {
      setShowForm(false);
    }
  };

  const handleUpdate = async (data: ModelFormData) => {
    if (!editingModel) return;
    const modelId = normalizeAdminSelector(editingModel.id);
    const safeData = normalizeModelFormData(data);
    if (!modelId || !safeData) return;
    const result = await updateModel(modelId, safeData);
    if (result.ok) {
      setEditingModel(null);
    }
  };

  const handleToggleEnabled = async (model: AIModel) => {
    const modelId = normalizeAdminSelector(model.id);
    if (!modelId) return;
    await updateModel(modelId, { isEnabled: !model.isEnabled });
  };

  const handleDeleteClick = (model: AIModel) => {
    if (!normalizeAdminSelector(model.id)) return;
    setDeleteTarget(model);
    setDeleteError(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    if (deletingModel) return;
    const modelId = normalizeAdminSelector(deleteTarget.id);
    if (!modelId) return;
    setDeletingModel(true);
    setDeleteError(null);
    const result = await deleteModel(modelId);
    if (result.ok) {
      setDeleteTarget(null);
    } else {
      setDeleteError(result.error || 'Failed to delete model');
    }
    setDeletingModel(false);
  };

  const handleTest = async (model: AIModel) => {
    const modelId = normalizeAdminSelector(model.id);
    if (!modelId) return;
    setTestingModel(modelId);
    setTestResult(null);
    setShowTestDialog(true);
    const result = await testModel(modelId);
    setTestingModel(null);
    if (result.ok && result.data) {
      setTestResult(result.data);
    } else {
      setTestResult({
        success: false,
        modelName: model.modelName,
        error: result.error,
      });
    }
  };

  const filteredModels = visibleModels.filter((m) => {
    if (filterProvider !== ALL_FILTER_VALUE && m.provider.id !== filterProvider) {
      return false;
    }
    if (filterEnabled === 'true' && !m.isEnabled) return false;
    if (filterEnabled === 'false' && m.isEnabled) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        m.modelName.toLowerCase().includes(q) ||
        m.displayName.toLowerCase().includes(q) ||
        m.provider.displayName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>AI Models</CardTitle>
            <CardDescription>Manage available AI models and their configurations</CardDescription>
          </div>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Model
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex gap-4 flex-wrap">
          <Input
            placeholder="Search models..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-xs"
          />
          <Select value={filterProvider} onValueChange={(value) => setFilterProvider(normalizeFilterProvider(value))}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Providers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER_VALUE}>All Providers</SelectItem>
              {visibleProviders.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterEnabled} onValueChange={setFilterEnabled}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER_VALUE}>All Status</SelectItem>
              <SelectItem value="true">Enabled Only</SelectItem>
              <SelectItem value="false">Disabled Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

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
            {filteredModels.map((model) => (
              <div
                key={model.id}
                className={`p-4 border rounded-lg ${
                  model.isEnabled
                    ? 'border-border'
                    : 'border-dashed border-muted-foreground/30 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{model.displayName}</span>
                      <Badge variant="outline" className="font-mono text-xs">
                        {model.modelName}
                      </Badge>
                      <Badge variant="secondary">{model.provider.displayName}</Badge>
                      {!model.isEnabled && <Badge variant="destructive">Disabled</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {model.description || model.modelIdentifier}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {model.contextWindow && <span>Context: {(model.contextWindow / 1000).toFixed(0)}K</span>}
                      {model.cost.inputPer1k !== null && (
                        <span>
                          Cost: ${model.cost.inputPer1k}/${model.cost.outputPer1k} per 1K
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        {model.capabilities.vision && (
                          <span title="Vision">
                            <Eye className="h-3 w-3" />
                          </span>
                        )}
                        {model.capabilities.streaming && (
                          <span title="Streaming">
                            <Zap className="h-3 w-3" />
                          </span>
                        )}
                        {model.capabilities.functionCalling && (
                          <span title="Function Calling">
                            <MessageSquare className="h-3 w-3" />
                          </span>
                        )}
                      </span>
                      <span>Priority: {model.priority}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(model)}
                      disabled={testingModel === model.id}
                    >
                      {testingModel === model.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      <span className="ml-1">Test</span>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Open model actions for ${model.displayName}`}
                          title={`Open model actions for ${model.displayName}`}
                        >
                          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingModel(model)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleEnabled(model)}>
                          {model.isEnabled ? 'Disable' : 'Enable'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(model)}
                          className="text-red-600"
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
            {!error && filteredModels.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No models found. Add your first model to get started.
              </p>
            )}
          </div>
        )}
      </CardContent>

      {/* Create Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Model</DialogTitle>
            <DialogDescription>Configure a new AI model for use in the system</DialogDescription>
          </DialogHeader>
          <ModelForm
            providers={visibleProviders}
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingModel} onOpenChange={() => setEditingModel(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Model</DialogTitle>
            <DialogDescription>Update model configuration</DialogDescription>
          </DialogHeader>
          {editingModel && (
            <ModelForm
              model={editingModel}
              providers={visibleProviders}
              onSubmit={handleUpdate}
              onCancel={() => setEditingModel(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Test Dialog */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Model Test</DialogTitle>
            <DialogDescription>Testing model connectivity and response</DialogDescription>
          </DialogHeader>
          {testingModel && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}
          {testResult && <TestResult result={testResult} />}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Model</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete model "{deleteTarget?.displayName}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteConfirm();
              }}
              disabled={deletingModel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingModel ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
