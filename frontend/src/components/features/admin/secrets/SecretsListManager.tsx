/**
 * Secrets List Manager - CRUD UI for secrets
 */

import { useState, useEffect, useCallback } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Switch } from '@/components/ui/switch';
import {
  Plus,
  Search,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Edit,
  RefreshCw,
  Wand2,
  CheckCircle,
  XCircle,
  Key,
  ShieldAlert,
} from 'lucide-react';
import { useSecrets, useCategories } from './hooks';
import type { SecretCategory, SecretPublic, SecretFormData } from './types';

interface SecretsListManagerProps {
  categories: SecretCategory[];
  initialCategoryFilter?: string | null;
}

type PlaintextActionKind = 'reveal' | 'copy';

interface PendingPlaintextAction {
  kind: PlaintextActionKind;
  secret: SecretPublic;
}

const BREAK_GLASS_REASON_REQUIRED = 'break-glass reason is required';
const CONTROL_TEXT_PATTERN = /[\u0000-\u001F\u007F]+/g;
const COLLAPSED_WHITESPACE_PATTERN = /\s+/g;
const REVEALED_VALUE_DISPLAY_FALLBACK = '[non-displayable secret value]';

function normalizeSafeText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value
    .replace(CONTROL_TEXT_PATTERN, ' ')
    .replace(COLLAPSED_WHITESPACE_PATTERN, ' ')
    .trim();
  return normalized || fallback;
}

function normalizeRevealedSecretDisplayValue(value: unknown): string {
  const normalized = normalizeSafeText(value);
  return normalized || REVEALED_VALUE_DISPLAY_FALLBACK;
}

function normalizeSecretId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || /[\r\n/\\]/.test(normalized) || !/^[A-Za-z0-9_-]+$/.test(normalized)) {
    return null;
  }
  return normalized;
}

function normalizeCategoryId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized || /[\r\n/\\]/.test(normalized) || !/^[a-z0-9_-]+$/.test(normalized)) {
    return null;
  }
  return normalized;
}

function normalizeSecretKeyName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  if (!normalized || /[\r\n]/.test(normalized) || !/^[A-Z_][A-Z0-9_]*$/.test(normalized)) {
    return null;
  }
  return normalized;
}

function normalizeSecretCategory(category: SecretCategory): SecretCategory | null {
  const id = normalizeCategoryId(category.id);
  if (!id) return null;
  return {
    ...category,
    id,
    display_name: normalizeSafeText(category.display_name, id),
    description: normalizeSafeText(category.description),
  };
}

function normalizeSecret(secret: SecretPublic): SecretPublic | null {
  const id = normalizeSecretId(secret.id);
  const categoryId = normalizeCategoryId(secret.category_id);
  const keyName = normalizeSecretKeyName(secret.key_name);
  if (!id || !categoryId || !keyName) return null;
  return {
    ...secret,
    id,
    category_id: categoryId,
    key_name: keyName,
    display_name: normalizeSafeText(secret.display_name, keyName),
    description: secret.description ? normalizeSafeText(secret.description) : null,
    category_name: secret.category_name
      ? normalizeSafeText(secret.category_name, 'Uncategorized')
      : secret.category_name,
  };
}

function normalizeSecrets(secrets: SecretPublic[]): SecretPublic[] {
  return secrets.flatMap((secret) => {
    const normalized = normalizeSecret(secret);
    return normalized ? [normalized] : [];
  });
}

function normalizeCategories(categories: SecretCategory[]): SecretCategory[] {
  return categories.flatMap((category) => {
    const normalized = normalizeSecretCategory(category);
    return normalized ? [normalized] : [];
  });
}

function needsBreakGlassReason(error?: string): boolean {
  return error?.toLowerCase().includes(BREAK_GLASS_REASON_REQUIRED) ?? false;
}

export function SecretsListManager({ categories: initialCategories, initialCategoryFilter }: SecretsListManagerProps) {
  const {
    secrets,
    loading,
    error,
    fetchSecrets,
    createSecret,
    updateSecret,
    deleteSecret,
    revealSecret,
    generateValue,
  } = useSecrets();

  const { categories, fetchCategories } = useCategories();

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>(
    normalizeCategoryId(initialCategoryFilter) ?? 'all',
  );

  // Sync category filter when parent passes a new initial value (e.g. category card click)
  useEffect(() => {
    const normalizedInitialCategory = normalizeCategoryId(initialCategoryFilter);
    if (normalizedInitialCategory) {
      setCategoryFilter(normalizedInitialCategory);
    }
  }, [initialCategoryFilter]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedSecret, setSelectedSecret] = useState<SecretPublic | null>(null);
  const [revealedValues, setRevealedValues] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pendingPlaintextAction, setPendingPlaintextAction] =
    useState<PendingPlaintextAction | null>(null);
  const [plaintextReason, setPlaintextReason] = useState('');
  const [plaintextError, setPlaintextError] = useState('');
  const [plaintextLoading, setPlaintextLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState<SecretFormData>({
    categoryId: '',
    keyName: '',
    displayName: '',
    description: '',
    value: '',
    isRequired: false,
    isSensitive: true,
    valueType: 'string',
    envFallback: '',
  });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    fetchSecrets();
    if (initialCategories.length === 0) {
      fetchCategories();
    }
  }, [fetchSecrets, fetchCategories, initialCategories.length]);

  const effectiveCategories = normalizeCategories(
    initialCategories.length > 0 ? initialCategories : categories,
  );
  const safeSecrets = normalizeSecrets(secrets);

  // Filter secrets
  const filteredSecrets = safeSecrets.filter((secret) => {
    const matchesSearch =
      searchTerm === '' ||
      secret.key_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      secret.display_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || secret.category_id === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Group by category
  const groupedSecrets = filteredSecrets.reduce(
    (acc, secret) => {
      const cat = secret.category_name || 'Uncategorized';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(secret);
      return acc;
    },
    {} as Record<string, SecretPublic[]>
  );

  const hideSecretValue = useCallback((secretId: string) => {
    setRevealedValues((prev) => {
      const next = { ...prev };
      delete next[secretId];
      return next;
    });
  }, []);

  const showSecretValue = useCallback((secret: SecretPublic, value: string) => {
    const normalizedSecret = normalizeSecret(secret);
    if (!normalizedSecret) return;
    setRevealedValues((prev) => ({
      ...prev,
      [normalizedSecret.id]: value,
    }));
    setTimeout(() => hideSecretValue(normalizedSecret.id), 30000);
  }, [hideSecretValue]);

  const copySecretValue = useCallback(async (secret: SecretPublic, value: string) => {
    const normalizedSecret = normalizeSecret(secret);
    if (!normalizedSecret) return;
    await navigator.clipboard.writeText(value);
    setCopiedId(normalizedSecret.id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const requestPlaintextValue = useCallback(
    async (
      secret: SecretPublic,
      kind: PlaintextActionKind,
      reason?: string,
    ): Promise<boolean> => {
      const normalizedSecret = normalizeSecret(secret);
      if (!normalizedSecret) {
        setPlaintextError('Invalid secret identifier');
        return false;
      }
      const result = await revealSecret(normalizedSecret.id, reason);

      if (result.ok && result.data) {
        if (kind === 'copy') {
          await copySecretValue(normalizedSecret, result.data.value);
        } else {
          showSecretValue(normalizedSecret, result.data.value);
        }
        return true;
      }

      if (!reason && needsBreakGlassReason(result.error)) {
        setPendingPlaintextAction({ kind, secret: normalizedSecret });
        setPlaintextReason('');
        setPlaintextError('');
        return false;
      }

      setPlaintextError(normalizeSafeText(result.error, 'Failed to retrieve secret value'));
      return false;
    },
    [copySecretValue, revealSecret, showSecretValue],
  );

  const closePlaintextDialog = useCallback(() => {
    setPendingPlaintextAction(null);
    setPlaintextReason('');
    setPlaintextError('');
    setPlaintextLoading(false);
  }, []);

  const handlePlaintextReasonSubmit = useCallback(async () => {
    if (!pendingPlaintextAction) return;
    const reason = plaintextReason.trim();
    if (reason.length < 8) {
      setPlaintextError('Reason must be at least 8 characters.');
      return;
    }

    setPlaintextLoading(true);
    setPlaintextError('');
    const ok = await requestPlaintextValue(
      pendingPlaintextAction.secret,
      pendingPlaintextAction.kind,
      reason,
    );
    setPlaintextLoading(false);
    if (ok) {
      closePlaintextDialog();
    }
  }, [
    closePlaintextDialog,
    pendingPlaintextAction,
    plaintextReason,
    requestPlaintextValue,
  ]);

  const handleReveal = useCallback(
    async (secret: SecretPublic) => {
      const normalizedSecret = normalizeSecret(secret);
      if (!normalizedSecret) return;
      if (revealedValues[normalizedSecret.id]) {
        hideSecretValue(normalizedSecret.id);
        return;
      }

      await requestPlaintextValue(normalizedSecret, 'reveal');
    },
    [hideSecretValue, requestPlaintextValue, revealedValues],
  );

  const handleCopy = useCallback(async (secret: SecretPublic) => {
    const normalizedSecret = normalizeSecret(secret);
    if (!normalizedSecret) return;
    const value = revealedValues[normalizedSecret.id];

    if (value) {
      await copySecretValue(normalizedSecret, value);
      return;
    }

    await requestPlaintextValue(normalizedSecret, 'copy');
  }, [copySecretValue, requestPlaintextValue, revealedValues]);

  const handleCreate = async () => {
    setFormError('');
    const categoryId = normalizeCategoryId(formData.categoryId);
    const keyName = normalizeSecretKeyName(formData.keyName);
    if (!categoryId || !keyName) {
      setFormError('Invalid secret key or category');
      return;
    }

    setFormLoading(true);

    const result = await createSecret({
      ...formData,
      categoryId,
      keyName,
      displayName: normalizeSafeText(formData.displayName, keyName),
      description: normalizeSafeText(formData.description),
      envFallback: normalizeSafeText(formData.envFallback),
    });
    if (result.ok) {
      setIsCreateOpen(false);
      resetForm();
    } else {
      setFormError(result.error || 'Failed to create secret');
    }

    setFormLoading(false);
  };

  const handleUpdate = async () => {
    const normalizedSecret = selectedSecret ? normalizeSecret(selectedSecret) : null;
    if (!normalizedSecret) return;
    setFormError('');
    setFormLoading(true);

    const result = await updateSecret(normalizedSecret.id, {
      displayName: normalizeSafeText(formData.displayName, normalizedSecret.key_name),
      description: normalizeSafeText(formData.description),
      value: formData.value || undefined,
      isRequired: formData.isRequired,
      isSensitive: formData.isSensitive,
      valueType: formData.valueType,
      envFallback: normalizeSafeText(formData.envFallback),
    });

    if (result.ok) {
      setIsEditOpen(false);
      resetForm();
    } else {
      setFormError(result.error || 'Failed to update secret');
    }

    setFormLoading(false);
  };

  const handleDelete = async () => {
    const normalizedSecret = selectedSecret ? normalizeSecret(selectedSecret) : null;
    if (!normalizedSecret) return;
    if (formLoading) return;
    setFormError('');
    setFormLoading(true);

    const result = await deleteSecret(normalizedSecret.id);
    if (result.ok) {
      setIsDeleteOpen(false);
      setSelectedSecret(null);
    } else {
      setFormError(result.error || 'Failed to delete secret');
    }

    setFormLoading(false);
  };

  const handleGenerate = async () => {
    const result = await generateValue('apiKey', undefined, 'sk');
    if (result.ok && result.data) {
      setFormData((prev) => ({ ...prev, value: result.data!.value }));
    }
  };

  const resetForm = () => {
    setFormData({
      categoryId: effectiveCategories[0]?.id || '',
      keyName: '',
      displayName: '',
      description: '',
      value: '',
      isRequired: false,
      isSensitive: true,
      valueType: 'string',
      envFallback: '',
    });
    setFormError('');
    setSelectedSecret(null);
  };

  const openEdit = (secret: SecretPublic) => {
    const normalizedSecret = normalizeSecret(secret);
    if (!normalizedSecret) return;
    setSelectedSecret(normalizedSecret);
    setFormData({
      categoryId: normalizedSecret.category_id,
      keyName: normalizedSecret.key_name,
      displayName: normalizedSecret.display_name,
      description: normalizedSecret.description || '',
      value: '', // Don't pre-fill value
      isRequired: !!normalizedSecret.is_required,
      isSensitive: !!normalizedSecret.is_sensitive,
      valueType: normalizedSecret.value_type,
      envFallback: normalizedSecret.env_fallback || '',
    });
    setIsEditOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search secrets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={categoryFilter}
          onValueChange={(value) => {
            const normalizedCategory =
              value === 'all' ? 'all' : normalizeCategoryId(value);
            if (normalizedCategory) setCategoryFilter(normalizedCategory);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {effectiveCategories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={() => fetchSecrets()}
          variant="outline"
          size="icon"
          aria-label="Refresh secrets list"
          title="Refresh secrets list"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
        </Button>
        <Button onClick={() => {
          resetForm();
          setIsCreateOpen(true);
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Secret
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Secrets List */}
      <div className="space-y-6">
        {Object.entries(groupedSecrets).map(([category, categorySecrets]) => (
          <Card key={category}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{category}</CardTitle>
              <CardDescription>{categorySecrets.length} secrets</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {categorySecrets.map((secret) => (
                  <div
                    key={secret.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        {secret.has_value ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono">{secret.key_name}</code>
                          {secret.is_required ? (
                            <Badge variant="outline" className="text-xs">
                              Required
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {secret.display_name}
                        </p>
                      </div>
                      {secret.has_value && (
                        <div className="flex-shrink-0 font-mono text-sm text-muted-foreground">
                          {revealedValues[secret.id] ? (
                            <span className="text-foreground">
                              {normalizeRevealedSecretDisplayValue(revealedValues[secret.id])}
                            </span>
                          ) : (
                            '••••••••••••••••'
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-4">
                      {secret.has_value && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleReveal(secret)}
                            title={`${revealedValues[secret.id] ? 'Hide' : 'Reveal'} ${secret.key_name}`}
                            aria-label={`${revealedValues[secret.id] ? 'Hide' : 'Reveal'} ${secret.key_name}`}
                          >
                            {revealedValues[secret.id] ? (
                              <EyeOff className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              <Eye className="h-4 w-4" aria-hidden="true" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopy(secret)}
                            title={`Copy ${secret.key_name}`}
                            aria-label={`Copy ${secret.key_name}`}
                          >
                            {copiedId === secret.id ? (
                              <CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" />
                            ) : (
                              <Copy className="h-4 w-4" aria-hidden="true" />
                            )}
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(secret)}
                        title={`Edit ${secret.key_name}`}
                        aria-label={`Edit ${secret.key_name}`}
                      >
                        <Edit className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const normalizedSecret = normalizeSecret(secret);
                          if (!normalizedSecret) return;
                          setSelectedSecret(normalizedSecret);
                          setFormError('');
                          setIsDeleteOpen(true);
                        }}
                        title={`Delete ${secret.key_name}`}
                        aria-label={`Delete ${secret.key_name}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredSecrets.length === 0 && !loading && !error && (
          <Card>
            <CardContent className="py-12 text-center">
              <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No secrets found</p>
              <Button className="mt-4" onClick={() => {
                resetForm();
                setIsCreateOpen(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Secret
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Secret</DialogTitle>
            <DialogDescription>
              Create a new encrypted secret. The value will be encrypted at rest.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={formData.categoryId}
                  onValueChange={(v) => {
                    const normalizedCategory = normalizeCategoryId(v);
                    if (normalizedCategory) {
                      setFormData((prev) => ({
                        ...prev,
                        categoryId: normalizedCategory,
                      }));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {effectiveCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Value Type</Label>
                <Select
                  value={formData.valueType}
                  onValueChange={(v) =>
                    setFormData((prev) => ({
                      ...prev,
                      valueType: v as SecretFormData['valueType'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="string">String</SelectItem>
                    <SelectItem value="url">URL</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="boolean">Boolean</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Key Name</Label>
              <Input
                placeholder="OPENAI_API_KEY"
                value={formData.keyName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    keyName: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
                  }))
                }
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Uppercase with underscores</p>
            </div>
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input
                placeholder="OpenAI API Key"
                value={formData.displayName}
                onChange={(e) => setFormData((prev) => ({ ...prev, displayName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="Used for AI chat completions..."
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Value</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleGenerate}>
                  <Wand2 className="h-3 w-3 mr-1" />
                  Generate
                </Button>
              </div>
              <Input
                type="password"
                placeholder="Enter secret value..."
                value={formData.value}
                onChange={(e) => setFormData((prev) => ({ ...prev, value: e.target.value }))}
                className="font-mono"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isRequired}
                  onCheckedChange={(v) => setFormData((prev) => ({ ...prev, isRequired: v }))}
                />
                <Label>Required</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isSensitive}
                  onCheckedChange={(v) => setFormData((prev) => ({ ...prev, isSensitive: v }))}
                />
                <Label>Sensitive</Label>
              </div>
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={formLoading || !formData.keyName}>
              {formLoading ? 'Creating...' : 'Create Secret'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Secret</DialogTitle>
            <DialogDescription>
              Update secret settings. Leave value empty to keep current value.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Key Name</Label>
              <Input value={formData.keyName} disabled className="font-mono bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input
                value={formData.displayName}
                onChange={(e) => setFormData((prev) => ({ ...prev, displayName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>New Value (optional)</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleGenerate}>
                  <Wand2 className="h-3 w-3 mr-1" />
                  Generate
                </Button>
              </div>
              <Input
                type="password"
                placeholder="Leave empty to keep current value..."
                value={formData.value}
                onChange={(e) => setFormData((prev) => ({ ...prev, value: e.target.value }))}
                className="font-mono"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isRequired}
                  onCheckedChange={(v) => setFormData((prev) => ({ ...prev, isRequired: v }))}
                />
                <Label>Required</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isSensitive}
                  onCheckedChange={(v) => setFormData((prev) => ({ ...prev, isSensitive: v }))}
                />
                <Label>Sensitive</Label>
              </div>
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={formLoading}>
              {formLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plaintext Reason Dialog */}
      <Dialog
        open={!!pendingPlaintextAction}
        onOpenChange={(open) => {
          if (!open) closePlaintextDialog();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Audit Reason
            </DialogTitle>
            <DialogDescription>
              {pendingPlaintextAction?.secret.key_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="plaintext-reason">Reason</Label>
              <Textarea
                id="plaintext-reason"
                value={plaintextReason}
                onChange={(e) => {
                  setPlaintextReason(e.target.value);
                  if (plaintextError) setPlaintextError('');
                }}
                rows={3}
                autoFocus
              />
            </div>
            {plaintextError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {plaintextError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closePlaintextDialog}
              disabled={plaintextLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePlaintextReasonSubmit}
              disabled={plaintextLoading || plaintextReason.trim().length < 8}
            >
              {plaintextLoading ? 'Continuing...' : 'Continue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={isDeleteOpen}
        onOpenChange={(open) => {
          setIsDeleteOpen(open);
          if (!open) setFormError('');
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Secret</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <code className="font-mono">{selectedSecret?.key_name}</code>? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {formError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              disabled={formLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {formLoading ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
