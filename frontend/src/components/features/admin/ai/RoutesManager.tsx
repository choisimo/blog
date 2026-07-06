/**
 * AI Routes Manager Component
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
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  Star,
  ArrowDown,
  Copy,
} from 'lucide-react';
import { useRoutes, useModels } from './hooks';
import type { AIRoute, RouteFormData, AIModel } from './types';
import { toast } from '@/hooks/ui/use-toast';

const ADMIN_SELECTOR_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const ROUTING_STRATEGIES: Array<RouteFormData['routingStrategy']> = [
  'simple',
  'latency-based-routing',
  'cost-based-routing',
];

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

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

function normalizeSelectorList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map(normalizeAdminSelector).filter(isPresent)));
}

function normalizeRoutingStrategy(
  value: unknown,
): RouteFormData['routingStrategy'] {
  return ROUTING_STRATEGIES.includes(value as RouteFormData['routingStrategy'])
    ? (value as RouteFormData['routingStrategy'])
    : 'latency-based-routing';
}

export function normalizeRouteRetries(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 3;
  return Math.min(10, Math.max(0, Math.floor(value)));
}

export function normalizeRouteTimeoutSeconds(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 120;
  return Math.min(600, Math.max(10, Math.floor(value)));
}

export function normalizeRouteFormData(data: RouteFormData): RouteFormData | null {
  const name = normalizeAdminSelector(data.name);
  const primaryModelId = normalizeAdminSelector(data.primaryModelId);
  if (!name || !primaryModelId) return null;

  return {
    ...data,
    name,
    routingStrategy: normalizeRoutingStrategy(data.routingStrategy),
    primaryModelId,
    fallbackModelIds: normalizeSelectorList(data.fallbackModelIds).filter(
      (id) => id !== primaryModelId,
    ),
    contextWindowFallbackIds: normalizeSelectorList(
      data.contextWindowFallbackIds,
    ),
    numRetries: normalizeRouteRetries(data.numRetries),
    timeoutSeconds: normalizeRouteTimeoutSeconds(data.timeoutSeconds),
  };
}

function isSafeModel(model: AIModel): boolean {
  return Boolean(normalizeAdminSelector(model.id));
}

function isSafeRoute(route: AIRoute): boolean {
  return Boolean(
    normalizeAdminSelector(route.id) &&
      normalizeAdminSelector(route.name) &&
      (!route.primaryModel || normalizeAdminSelector(route.primaryModel.id)),
  );
}

interface RouteFormProps {
  route?: AIRoute;
  models: AIModel[];
  onSubmit: (data: RouteFormData) => Promise<void>;
  onCancel: () => void;
}

function RouteForm({ route, models, onSubmit, onCancel }: RouteFormProps) {
  const [formData, setFormData] = useState<RouteFormData>({
    name: normalizeAdminSelector(route?.name) || '',
    description: route?.description || '',
    routingStrategy: normalizeRoutingStrategy(route?.routingStrategy),
    primaryModelId: normalizeAdminSelector(route?.primaryModel?.id) || '',
    fallbackModelIds: normalizeSelectorList(route?.fallbackModelIds),
    contextWindowFallbackIds: normalizeSelectorList(
      route?.contextWindowFallbackIds,
    ),
    numRetries: route?.numRetries || 3,
    timeoutSeconds: route?.timeoutSeconds || 120,
    isDefault: route?.isDefault || false,
  });
  const [submitting, setSubmitting] = useState(false);

  const enabledModels = models.filter((m) => m.isEnabled && isSafeModel(m));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const safeData = normalizeRouteFormData(formData);
    if (!safeData) return;
    setSubmitting(true);
    try {
      await onSubmit(safeData);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleFallback = (modelId: string) => {
    const safeModelId = normalizeAdminSelector(modelId);
    if (!safeModelId) return;
    const current = formData.fallbackModelIds || [];
    if (current.includes(safeModelId)) {
      setFormData({
        ...formData,
        fallbackModelIds: current.filter((id) => id !== safeModelId),
      });
    } else {
      setFormData({
        ...formData,
        fallbackModelIds: [...current, safeModelId],
      });
    }
  };

  const toggleContextFallback = (modelId: string) => {
    const safeModelId = normalizeAdminSelector(modelId);
    if (!safeModelId) return;
    const current = formData.contextWindowFallbackIds || [];
    if (current.includes(safeModelId)) {
      setFormData({
        ...formData,
        contextWindowFallbackIds: current.filter((id) => id !== safeModelId),
      });
    } else {
      setFormData({
        ...formData,
        contextWindowFallbackIds: [...current, safeModelId],
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Route Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="default"
            disabled={!!route}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="strategy">Routing Strategy</Label>
          <Select
            value={formData.routingStrategy}
            onValueChange={(v) =>
              setFormData({
                ...formData,
                routingStrategy: normalizeRoutingStrategy(v),
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="simple">Simple</SelectItem>
              <SelectItem value="latency-based-routing">Latency Based</SelectItem>
              <SelectItem value="cost-based-routing">Cost Based</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={formData.description || ''}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Route description"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="primaryModel">Primary Model</Label>
        <Select
          value={formData.primaryModelId || ''}
          onValueChange={(v) => {
            const primaryModelId = normalizeAdminSelector(v);
            if (primaryModelId) {
              setFormData({
                ...formData,
                primaryModelId,
                fallbackModelIds: (formData.fallbackModelIds || []).filter(
                  (id) => id !== primaryModelId,
                ),
              });
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select primary model" />
          </SelectTrigger>
          <SelectContent>
            {enabledModels.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.displayName} ({m.provider.displayName})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Fallback Models</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Select models to use when the primary model fails
        </p>
        <div className="flex flex-wrap gap-2">
          {enabledModels
            .filter((m) => m.id !== formData.primaryModelId)
            .map((m) => (
              <Badge
                key={m.id}
                variant={formData.fallbackModelIds?.includes(m.id) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => toggleFallback(m.id)}
              >
                {m.displayName}
              </Badge>
            ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Context Window Fallbacks</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Select models for long context scenarios
        </p>
        <div className="flex flex-wrap gap-2">
          {enabledModels
            .filter((m) => (m.contextWindow || 0) > 100000)
            .map((m) => (
              <Badge
                key={m.id}
                variant={
                  formData.contextWindowFallbackIds?.includes(m.id) ? 'default' : 'outline'
                }
                className="cursor-pointer"
                onClick={() => toggleContextFallback(m.id)}
              >
                {m.displayName} ({((m.contextWindow || 0) / 1000).toFixed(0)}K)
              </Badge>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="retries">Retries</Label>
          <Input
            id="retries"
            type="number"
            value={formData.numRetries}
            onChange={(e) =>
              setFormData({ ...formData, numRetries: parseInt(e.target.value) || 3 })
            }
            min={0}
            max={10}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="timeout">Timeout (seconds)</Label>
          <Input
            id="timeout"
            type="number"
            value={formData.timeoutSeconds}
            onChange={(e) =>
              setFormData({ ...formData, timeoutSeconds: parseInt(e.target.value) || 120 })
            }
            min={10}
            max={600}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isDefault"
          checked={formData.isDefault}
          onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
          className="h-4 w-4"
        />
        <Label htmlFor="isDefault">Set as default route</Label>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {route ? 'Update' : 'Create'} Route
        </Button>
      </DialogFooter>
    </form>
  );
}

export function RoutesManager() {
  const { routes, loading, error, fetchRoutes, createRoute, updateRoute, deleteRoute } =
    useRoutes();
  const { models, fetchModels } = useModels();
  const [showForm, setShowForm] = useState(false);
  const [editingRoute, setEditingRoute] = useState<AIRoute | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AIRoute | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingRoute, setDeletingRoute] = useState(false);
  const visibleModels = models.filter(isSafeModel);
  const visibleRoutes = routes.filter(isSafeRoute);

  useEffect(() => {
    fetchRoutes();
    fetchModels();
  }, [fetchRoutes, fetchModels]);

  const handleCreate = async (data: RouteFormData) => {
    const safeData = normalizeRouteFormData(data);
    if (!safeData) return;
    const result = await createRoute(safeData);
    if (result.ok) {
      setShowForm(false);
    }
  };

  const handleUpdate = async (data: RouteFormData) => {
    if (!editingRoute) return;
    const routeId = normalizeAdminSelector(editingRoute.id);
    const safeData = normalizeRouteFormData(data);
    if (!routeId || !safeData) return;
    const result = await updateRoute(routeId, safeData);
    if (result.ok) {
      setEditingRoute(null);
    }
  };

  const handleSetDefault = async (route: AIRoute) => {
    const routeId = normalizeAdminSelector(route.id);
    if (!routeId) return;
    await updateRoute(routeId, { isDefault: true });
  };

  const handleToggleEnabled = async (route: AIRoute) => {
    const routeId = normalizeAdminSelector(route.id);
    if (!routeId) return;
    await updateRoute(routeId, { isEnabled: !route.isEnabled });
  };

  const handleDeleteClick = (route: AIRoute) => {
    if (!normalizeAdminSelector(route.id)) return;
    if (route.isDefault) {
      toast({
        variant: 'destructive',
        title: 'Cannot Delete',
        description: 'Cannot delete the default route. Set another route as default first.',
      });
      return;
    }
    setDeleteTarget(route);
    setDeleteError(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    if (deletingRoute) return;
    const routeId = normalizeAdminSelector(deleteTarget.id);
    if (!routeId) return;
    setDeletingRoute(true);
    setDeleteError(null);
    const result = await deleteRoute(routeId);
    if (result.ok) {
      setDeleteTarget(null);
    } else {
      setDeleteError(result.error || 'Failed to delete route');
    }
    setDeletingRoute(false);
  };

  const handleClone = (route: AIRoute) => {
    const name = normalizeAdminSelector(route.name);
    if (!name) return;
    setEditingRoute({
      ...route,
      id: '',
      name: `${name}-copy`,
      isDefault: false,
      fallbackModelIds: normalizeSelectorList(route.fallbackModelIds),
      contextWindowFallbackIds: normalizeSelectorList(
        route.contextWindowFallbackIds,
      ),
    } as AIRoute);
    setShowForm(true);
  };

  const getModelName = (modelId: string) => {
    const safeModelId = normalizeAdminSelector(modelId);
    if (!safeModelId) return '';
    const model = visibleModels.find((m) => m.id === safeModelId);
    return model?.displayName || safeModelId;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Routing Rules</CardTitle>
            <CardDescription>Configure model routing and fallback strategies</CardDescription>
          </div>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Route
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
            {visibleRoutes.map((route) => (
              <div
                key={route.id}
                className={`p-4 border rounded-lg ${
                  route.isDefault
                    ? 'border-primary bg-primary/5'
                    : route.isEnabled
                    ? 'border-border'
                    : 'border-dashed border-muted-foreground/30 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {route.isDefault && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                      <span className="font-medium">{route.name}</span>
                      <Badge variant="outline">{route.routingStrategy}</Badge>
                      {!route.isEnabled && <Badge variant="destructive">Disabled</Badge>}
                    </div>
                    {route.description && (
                      <p className="text-sm text-muted-foreground">{route.description}</p>
                    )}

                    {/* Route Flow Visualization */}
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium text-muted-foreground">Flow:</span>
                      {route.primaryModel && (
                        <Badge variant="secondary">{route.primaryModel.displayName}</Badge>
                      )}
                      {normalizeSelectorList(route.fallbackModelIds).length > 0 && (
                        <>
                          <ArrowDown className="h-4 w-4 text-muted-foreground" />
                          {normalizeSelectorList(route.fallbackModelIds).map((id, idx) => (
                            <span key={id} className="flex items-center gap-1">
                              <Badge variant="outline">{getModelName(id)}</Badge>
                              {idx < normalizeSelectorList(route.fallbackModelIds).length - 1 && (
                                <ArrowDown className="h-3 w-3 text-muted-foreground" />
                              )}
                            </span>
                          ))}
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Retries: {route.numRetries}</span>
                      <span>Timeout: {route.timeoutSeconds}s</span>
                      {normalizeSelectorList(route.contextWindowFallbackIds).length > 0 && (
                        <span>
                          Long context: {normalizeSelectorList(route.contextWindowFallbackIds).map(getModelName).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Open route actions for ${route.name}`}
                        title={`Open route actions for ${route.name}`}
                      >
                        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditingRoute(route)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleClone(route)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Clone
                      </DropdownMenuItem>
                      {!route.isDefault && (
                        <DropdownMenuItem onClick={() => handleSetDefault(route)}>
                          <Star className="h-4 w-4 mr-2" />
                          Set as Default
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => handleToggleEnabled(route)}>
                        {route.isEnabled ? 'Disable' : 'Enable'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDeleteClick(route)}
                        className="text-red-600"
                        disabled={route.isDefault}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
            {!error && visibleRoutes.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No routes configured. Add your first routing rule to get started.
              </p>
            )}
          </div>
        )}
      </CardContent>

      {/* Create Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Route</DialogTitle>
            <DialogDescription>Configure a new routing rule</DialogDescription>
          </DialogHeader>
          <RouteForm
            models={visibleModels}
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingRoute} onOpenChange={() => setEditingRoute(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Route</DialogTitle>
            <DialogDescription>Update routing configuration</DialogDescription>
          </DialogHeader>
          {editingRoute && (
            <RouteForm
              route={editingRoute}
              models={visibleModels}
              onSubmit={handleUpdate}
              onCancel={() => setEditingRoute(null)}
            />
          )}
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
            <AlertDialogTitle>Delete Route</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete route "{deleteTarget?.name}"? This action cannot be undone.
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
              disabled={deletingRoute}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingRoute ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
