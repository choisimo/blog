import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Play,
  History,
  BookTemplate,
  Loader2,
  Trash2,
  Copy,
  RotateCcw,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  DollarSign,
  Bot,
  Save,
  ChevronRight,
} from 'lucide-react';
import {
  usePlayground,
  useModels,
  type PlaygroundRunResult,
  type PlaygroundHistory,
  type PromptTemplate,
} from './hooks';
import type { AIModel } from './types';
import { cn } from '@/lib/utils';

function formatLatency(ms: number | null): string {
  if (ms === null) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatCost(cost: number | null): string {
  if (cost === null) return '-';
  if (cost < 0.001) return `$${cost.toFixed(6)}`;
  return `$${cost.toFixed(4)}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ResultCard({
  result,
  isComparing,
}: {
  result: PlaygroundRunResult;
  isComparing: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (result.response) {
      navigator.clipboard.writeText(result.response);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card className={cn(isComparing ? 'flex-1 min-w-[300px]' : 'w-full')}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            <span className="font-medium text-sm">{result.model_name}</span>
            <Badge variant="outline" className="text-xs">
              {result.provider_name}
            </Badge>
          </div>
          {result.status === 'success' ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {result.status === 'error' ? (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-500">
            {result.error_message}
          </div>
        ) : (
          <>
            <ScrollArea className={cn(isComparing ? 'h-[200px]' : 'h-auto max-h-[400px]')}>
              <div className="prose prose-sm dark:prose-invert whitespace-pre-wrap">
                {result.response}
              </div>
            </ScrollArea>
            <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatLatency(result.latency_ms)}
                </span>
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  {result.total_tokens ?? '-'} tokens
                </span>
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  {formatCost(result.estimated_cost)}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleCopy}>
                {copied ? (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function HistoryDialog({
  history,
  open,
  onClose,
  onRerun,
}: {
  history: PlaygroundHistory | null;
  open: boolean;
  onClose: () => void;
  onRerun: (history: PlaygroundHistory) => void;
}) {
  if (!history) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{history.title || 'Execution Detail'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <Label className="text-muted-foreground">Model</Label>
              <div className="font-medium">{history.model_name}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">Provider</Label>
              <div>{history.provider_name}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">Temperature</Label>
              <div>{history.temperature}</div>
            </div>
            <div>
              <Label className="text-muted-foreground">Max Tokens</Label>
              <div>{history.max_tokens || 'Auto'}</div>
            </div>
          </div>

          {history.system_prompt && (
            <div>
              <Label className="text-muted-foreground">System Prompt</Label>
              <div className="mt-1 p-3 bg-muted rounded text-sm whitespace-pre-wrap">
                {history.system_prompt}
              </div>
            </div>
          )}

          <div>
            <Label className="text-muted-foreground">User Prompt</Label>
            <div className="mt-1 p-3 bg-muted rounded text-sm whitespace-pre-wrap">
              {history.user_prompt}
            </div>
          </div>

          {history.status === 'success' && history.response && (
            <div>
              <Label className="text-muted-foreground">Response</Label>
              <ScrollArea className="mt-1 h-[200px]">
                <div className="p-3 bg-muted rounded text-sm whitespace-pre-wrap">
                  {history.response}
                </div>
              </ScrollArea>
            </div>
          )}

          {history.status === 'error' && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-500">
              {history.error_message}
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
            <span>Latency: {formatLatency(history.latency_ms)}</span>
            <span>Tokens: {history.total_tokens ?? '-'}</span>
            <span>Cost: {formatCost(history.estimated_cost)}</span>
            <span className="ml-auto">{formatDate(history.created_at)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => onRerun(history)}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Re-run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SaveTemplateDialog({
  open,
  onClose,
  onSave,
  initialData,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    description?: string;
    category?: string;
    system_prompt?: string;
    user_prompt_template: string;
    default_temperature?: number;
  }) => void;
  initialData: {
    system_prompt?: string;
    user_prompt: string;
    temperature: number;
  };
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');

  const handleSave = () => {
    onSave({
      name,
      description: description || undefined,
      category,
      system_prompt: initialData.system_prompt || undefined,
      user_prompt_template: initialData.user_prompt,
      default_temperature: initialData.temperature,
    });
    setName('');
    setDescription('');
    setCategory('general');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save as Template</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Code Review Assistant"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={2}
            />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="coding">Coding</SelectItem>
                <SelectItem value="writing">Writing</SelectItem>
                <SelectItem value="analysis">Analysis</SelectItem>
                <SelectItem value="creative">Creative</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Playground() {
  const { models, fetchModels } = useModels();
  const {
    history,
    templates,
    running,
    total: historyTotal,
    runPlayground,
    fetchHistory,
    deleteHistory,
    clearHistory,
    fetchTemplates,
    createTemplate,
    deleteTemplate,
    useTemplate,
  } = usePlayground();

  const [systemPrompt, setSystemPrompt] = useState('');
  const [userPrompt, setUserPrompt] = useState('');
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState<number | undefined>(undefined);
  const [results, setResults] = useState<PlaygroundRunResult[]>([]);
  const [activeTab, setActiveTab] = useState('playground');

  const [selectedHistory, setSelectedHistory] = useState<PlaygroundHistory | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [clearHistoryOpen, setClearHistoryOpen] = useState(false);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);

  useEffect(() => {
    fetchModels(undefined, true);
    fetchHistory({ limit: 20 });
    fetchTemplates();
  }, [fetchModels, fetchHistory, fetchTemplates]);

  const enabledModels = models.filter((m) => m.isEnabled);

  const handleModelToggle = (modelId: string) => {
    setSelectedModelIds((prev) =>
      prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId]
    );
  };

  const handleRun = async () => {
    if (!userPrompt.trim() || selectedModelIds.length === 0) return;

    const result = await runPlayground({
      system_prompt: systemPrompt || undefined,
      user_prompt: userPrompt,
      model_ids: selectedModelIds,
      temperature,
      max_tokens: maxTokens,
    });

    if (result.ok && result.data) {
      setResults(result.data.results);
      fetchHistory({ limit: 20 });
    }
  };

  const handleLoadFromHistory = (hist: PlaygroundHistory) => {
    setSystemPrompt(hist.system_prompt || '');
    setUserPrompt(hist.user_prompt);
    setTemperature(hist.temperature);
    setMaxTokens(hist.max_tokens || undefined);
    if (hist.model_id) {
      setSelectedModelIds([hist.model_id]);
    }
    setActiveTab('playground');
    setHistoryDialogOpen(false);
  };

  const handleLoadTemplate = async (template: PromptTemplate) => {
    await useTemplate(template.id);
    setSystemPrompt(template.system_prompt || '');
    setUserPrompt(template.user_prompt_template);
    setTemperature(template.default_temperature);
    setMaxTokens(template.default_max_tokens || undefined);
    if (template.default_model_id) {
      setSelectedModelIds([template.default_model_id]);
    }
    setActiveTab('playground');
  };

  const handleSaveTemplate = async (data: Parameters<typeof createTemplate>[0]) => {
    await createTemplate(data);
  };

  const handleDeleteTemplate = async () => {
    if (deleteTemplateId) {
      await deleteTemplate(deleteTemplateId);
      setDeleteTemplateId(null);
    }
  };

  const handleClearHistory = async () => {
    await clearHistory();
    setClearHistoryOpen(false);
  };

  const isComparing = results.length > 1;

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="playground" className="flex items-center gap-2">
            <Play className="h-4 w-4" />
            Playground
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History
            {historyTotal > 0 && (
              <Badge variant="secondary" className="ml-1">
                {historyTotal}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <BookTemplate className="h-4 w-4" />
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="playground" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Prompts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>System Prompt (Optional)</Label>
                    <Textarea
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      placeholder="You are a helpful assistant..."
                      rows={3}
                      className="mt-1 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <Label>User Prompt *</Label>
                    <Textarea
                      value={userPrompt}
                      onChange={(e) => setUserPrompt(e.target.value)}
                      placeholder="Enter your prompt here..."
                      rows={6}
                      className="mt-1 font-mono text-sm"
                    />
                  </div>
                </CardContent>
              </Card>

              {results.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={cn('flex gap-4', isComparing ? 'flex-wrap' : 'flex-col')}>
                      {results.map((result) => (
                        <ResultCard
                          key={result.history_id}
                          result={result}
                          isComparing={isComparing}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Models</CardTitle>
                    <span className="text-xs text-muted-foreground">
                      {selectedModelIds.length}/5 selected
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                      {enabledModels.map((model) => (
                        <div
                          key={model.id}
                          className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                          onClick={() => handleModelToggle(model.id)}
                        >
                          <Checkbox
                            checked={selectedModelIds.includes(model.id)}
                            disabled={
                              !selectedModelIds.includes(model.id) && selectedModelIds.length >= 5
                            }
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{model.displayName}</div>
                            <div className="text-xs text-muted-foreground">
                              {model.provider.displayName}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Parameters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>Temperature</Label>
                      <span className="text-sm text-muted-foreground">{temperature}</span>
                    </div>
                    <Slider
                      value={[temperature]}
                      onValueChange={([v]) => setTemperature(v)}
                      min={0}
                      max={2}
                      step={0.1}
                    />
                  </div>
                  <div>
                    <Label>Max Tokens (Optional)</Label>
                    <Input
                      type="number"
                      value={maxTokens ?? ''}
                      onChange={(e) =>
                        setMaxTokens(e.target.value ? parseInt(e.target.value, 10) : undefined)
                      }
                      placeholder="Auto"
                      className="mt-1"
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={handleRun}
                  disabled={running || !userPrompt.trim() || selectedModelIds.length === 0}
                >
                  {running ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  {running ? 'Running...' : 'Run'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSaveTemplateOpen(true)}
                  disabled={!userPrompt.trim()}
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Execution History
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setClearHistoryOpen(true)}
                  disabled={history.length === 0}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Latency</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="max-w-[200px] truncate">
                        {item.title || item.user_prompt.slice(0, 50)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{item.model_name}</div>
                        <div className="text-xs text-muted-foreground">{item.provider_name}</div>
                      </TableCell>
                      <TableCell>
                        {item.status === 'success' ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-500">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Success
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-500/10 text-red-500">
                            <XCircle className="h-3 w-3 mr-1" />
                            Error
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatLatency(item.latency_ms)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatCost(item.estimated_cost)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(item.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedHistory(item);
                              setHistoryDialogOpen(true);
                            }}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteHistory(item.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {history.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No history yet. Run a prompt to get started.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookTemplate className="h-5 w-5" />
                Prompt Templates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((template) => (
                  <Card
                    key={template.id}
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => handleLoadTemplate(template)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{template.name}</CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTemplateId(template.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {template.description || template.user_prompt_template.slice(0, 100)}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          {template.category}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Used {template.usage_count}x
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {templates.length === 0 && (
                  <div className="col-span-full text-center text-muted-foreground py-8">
                    No templates yet. Save a prompt as a template to get started.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <HistoryDialog
        history={selectedHistory}
        open={historyDialogOpen}
        onClose={() => setHistoryDialogOpen(false)}
        onRerun={handleLoadFromHistory}
      />

      <SaveTemplateDialog
        open={saveTemplateOpen}
        onClose={() => setSaveTemplateOpen(false)}
        onSave={handleSaveTemplate}
        initialData={{
          system_prompt: systemPrompt,
          user_prompt: userPrompt,
          temperature,
        }}
      />

      <AlertDialog open={clearHistoryOpen} onOpenChange={setClearHistoryOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All History?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all execution history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearHistory} className="bg-red-500 hover:bg-red-600">
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTemplateId} onOpenChange={() => setDeleteTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this template. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTemplate}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
