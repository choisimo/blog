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
} from 'lucide-react';
import { useSecrets, useCategories } from './hooks';
import type { SecretCategory, SecretPublic, SecretFormData } from './types';

interface SecretsListManagerProps {
  categories: SecretCategory[];
}

export function SecretsListManager({ categories: initialCategories }: SecretsListManagerProps) {
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
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedSecret, setSelectedSecret] = useState<SecretPublic | null>(null);
  const [revealedValues, setRevealedValues] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const effectiveCategories = initialCategories.length > 0 ? initialCategories : categories;

  // Filter secrets
  const filteredSecrets = secrets.filter((secret) => {
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

  const handleReveal = useCallback(
    async (secret: SecretPublic) => {
      if (revealedValues[secret.id]) {
        // Hide
        setRevealedValues((prev) => {
          const next = { ...prev };
          delete next[secret.id];
          return next;
        });
        return;
      }

      const result = await revealSecret(secret.id);
      if (result.ok && result.data) {
        setRevealedValues((prev) => ({
          ...prev,
          [secret.id]: result.data!.value,
        }));
        // Auto-hide after 30 seconds
        setTimeout(() => {
          setRevealedValues((prev) => {
            const next = { ...prev };
            delete next[secret.id];
            return next;
          });
        }, 30000);
      }
    },
    [revealSecret, revealedValues]
  );

  const handleCopy = useCallback(async (secret: SecretPublic) => {
    let value = revealedValues[secret.id];

    if (!value) {
      const result = await revealSecret(secret.id);
      if (result.ok && result.data) {
        value = result.data.value;
      }
    }

    if (value) {
      await navigator.clipboard.writeText(value);
      setCopiedId(secret.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }, [revealSecret, revealedValues]);

  const handleCreate = async () => {
    setFormError('');
    setFormLoading(true);

    const result = await createSecret(formData);
    if (result.ok) {
      setIsCreateOpen(false);
      resetForm();
    } else {
      setFormError(result.error || 'Failed to create secret');
    }

    setFormLoading(false);
  };

  const handleUpdate = async () => {
    if (!selectedSecret) return;
    setFormError('');
    setFormLoading(true);

    const result = await updateSecret(selectedSecret.id, {
      displayName: formData.displayName,
      description: formData.description,
      value: formData.value || undefined,
      isRequired: formData.isRequired,
      isSensitive: formData.isSensitive,
      valueType: formData.valueType,
      envFallback: formData.envFallback,
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
    if (!selectedSecret) return;
    setFormLoading(true);

    const result = await deleteSecret(selectedSecret.id);
    if (result.ok) {
      setIsDeleteOpen(false);
      setSelectedSecret(null);
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
    setSelectedSecret(secret);
    setFormData({
      categoryId: secret.category_id,
      keyName: secret.key_name,
      displayName: secret.display_name,
      description: secret.description || '',
      value: '', // Don't pre-fill value
      isRequired: !!secret.is_required,
      isSensitive: !!secret.is_sensitive,
      valueType: secret.value_type,
      envFallback: secret.env_fallback || '',
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
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
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
        <Button onClick={() => fetchSecrets()} variant="outline" size="icon">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
        <Button onClick={() => setIsCreateOpen(true)}>
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
                            <span className="text-foreground">{revealedValues[secret.id]}</span>
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
                            title={revealedValues[secret.id] ? 'Hide' : 'Reveal'}
                          >
                            {revealedValues[secret.id] ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopy(secret)}
                            title="Copy"
                          >
                            {copiedId === secret.id ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(secret)}
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedSecret(secret);
                          setIsDeleteOpen(true);
                        }}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredSecrets.length === 0 && !loading && (
          <Card>
            <CardContent className="py-12 text-center">
              <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No secrets found</p>
              <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
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
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, categoryId: v }))}
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

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Secret</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <code className="font-mono">{selectedSecret?.key_name}</code>? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
