import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { adminApiFetch } from '@/services/admin/apiClient';
import { AlertCircle, RefreshCw, RotateCcw, Save } from 'lucide-react';

interface AgentPrompt {
  mode: string;
  label: string;
  text: string;
  isOverridden: boolean;
}

const MODE_ORDER = ['default', 'research', 'coding', 'blog', 'article', 'terminal', 'performance'];
const PROMPT_MODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const MAX_PROMPT_TEXT_LENGTH = 120_000;

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

function decodePromptMode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function normalizePromptMode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const decoded = decodePromptMode(trimmed);
  if (!decoded) return null;

  if ([trimmed, decoded].some((candidate) => /[\r\n\\/]/.test(candidate))) {
    return null;
  }

  return PROMPT_MODE_PATTERN.test(trimmed) ? trimmed : null;
}

function normalizePromptLabel(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.replace(/[\r\n]+/g, ' ').trim();
  return cleaned || fallback;
}

export function normalizePromptText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n?/g, '\n')
    .slice(0, MAX_PROMPT_TEXT_LENGTH);
}

function normalizePrompt(prompt: AgentPrompt): AgentPrompt | null {
  const mode = normalizePromptMode(prompt.mode);
  if (!mode) return null;

  return {
    ...prompt,
    mode,
    label: normalizePromptLabel(prompt.label, mode),
  };
}

function getPromptErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function getModeRank(mode: string): number {
  const rank = MODE_ORDER.indexOf(mode);
  return rank === -1 ? Number.MAX_SAFE_INTEGER : rank;
}

function sortPrompts(prompts: AgentPrompt[]): AgentPrompt[] {
  return [...prompts].sort(
    (a, b) => getModeRank(a.mode) - getModeRank(b.mode) || a.label.localeCompare(b.label)
  );
}

export function PromptsManager() {
  const { toast } = useToast();

  const [prompts, setPrompts] = useState<AgentPrompt[]>([]);
  const [selectedMode, setSelectedMode] = useState<string>('default');
  const [editedText, setEditedText] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [hasLocalEdit, setHasLocalEdit] = useState(false);
  const selectedModeRef = useRef(selectedMode);
  const hasLocalEditRef = useRef(hasLocalEdit);
  const isBusy = saving || resetting;

  selectedModeRef.current = selectedMode;
  hasLocalEditRef.current = hasLocalEdit;

  const loadPrompts = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await adminApiFetch<{ prompts: AgentPrompt[] }>('/prompts', {
        pathPrefix: '/api/v1/agent',
      });

      if (!result.ok || !result.data) {
        throw new Error(result.error || 'Failed to fetch prompts');
      }

      const sorted = sortPrompts(
        (Array.isArray(result.data.prompts) ? result.data.prompts : [])
          .map(normalizePrompt)
          .filter(isPresent),
      );
      setPrompts(sorted);
      const currentMode = selectedModeRef.current;
      const active = sorted.find((prompt) => prompt.mode === currentMode) ?? sorted[0];
      if (active) {
        setSelectedMode(active.mode);
        if (!(hasLocalEditRef.current && active.mode === currentMode)) {
          setEditedText(active.text);
          setHasLocalEdit(false);
        }
      }
    } catch (error) {
      const message = getPromptErrorMessage(error, 'Failed to fetch prompts');
      setLoadError(message);
      toast({
        title: 'Failed to load prompts',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  const selectMode = (mode: string) => {
    if (isBusy) return;
    const safeMode = normalizePromptMode(mode);
    if (!safeMode) return;
    const prompt = prompts.find((p) => p.mode === safeMode);
    if (prompt) {
      setSelectedMode(safeMode);
      setEditedText(prompt.text);
      setHasLocalEdit(false);
    }
  };

  const handleSave = async () => {
    const mode = normalizePromptMode(selectedMode);
    if (!mode) return;
    const submittedText = normalizePromptText(editedText);
    setSaving(true);
    try {
      const result = await adminApiFetch<AgentPrompt>(`/prompts/${encodeURIComponent(mode)}`, {
        pathPrefix: '/api/v1/agent',
        method: 'PUT',
        body: { text: submittedText },
      });

      if (!result.ok || !result.data) {
        throw new Error(result.error || 'Save failed');
      }

      const updated = normalizePrompt(result.data);
      if (!updated) {
        throw new Error('Invalid prompt response');
      }
      setPrompts((prev) => sortPrompts(prev.map((p) => (p.mode === updated.mode ? updated : p))));
      setEditedText((current) => (current === submittedText ? updated.text : current));
      setHasLocalEdit(false);
      toast({ title: 'Prompt saved', description: `${updated.label} prompt updated` });
    } catch (error) {
      toast({
        title: 'Save failed',
        description: getPromptErrorMessage(error, 'Save failed'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const mode = normalizePromptMode(selectedMode);
    if (!mode) return;
    setResetting(true);
    try {
      const result = await adminApiFetch<AgentPrompt>(`/prompts/${encodeURIComponent(mode)}`, {
        pathPrefix: '/api/v1/agent',
        method: 'DELETE',
      });

      if (!result.ok || !result.data) {
        throw new Error(result.error || 'Reset failed');
      }

      const updated = normalizePrompt(result.data);
      if (!updated) {
        throw new Error('Invalid prompt response');
      }
      setPrompts((prev) => sortPrompts(prev.map((p) => (p.mode === updated.mode ? updated : p))));
      setEditedText(updated.text);
      setHasLocalEdit(false);
      toast({ title: 'Prompt reset', description: `${updated.label} restored to default` });
    } catch (error) {
      toast({
        title: 'Reset failed',
        description: getPromptErrorMessage(error, 'Reset failed'),
        variant: 'destructive',
      });
    } finally {
      setResetting(false);
    }
  };

  const activePrompt = prompts.find((p) => p.mode === selectedMode);
  const isDirty = activePrompt ? editedText !== activePrompt.text : false;

  if (loading) {
    return (
      <div className="flex items-center gap-3 px-4 py-8 text-sm text-zinc-400">
        <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
        <span>Loading prompts…</span>
      </div>
    );
  }

  if (loadError && prompts.length === 0) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-medium">Unable to load prompts</p>
              <p className="mt-1 text-xs">{loadError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadPrompts()}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200 dark:hover:bg-red-900/30"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-0 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden min-h-[500px]">
      <div className="w-44 shrink-0 border-r border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 flex flex-col">
        <div className="px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-700">
          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            Modes
          </p>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {prompts.map((p) => (
            <button
              key={p.mode}
              type="button"
              onClick={() => selectMode(p.mode)}
              disabled={isBusy}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50 ${
                selectedMode === p.mode
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium border-r-2 border-zinc-900 dark:border-zinc-100'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-white/60 dark:hover:bg-zinc-900/40'
              }`}
            >
              <span>{p.label}</span>
              {p.isOverridden && (
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" title="Custom override" />
              )}
            </button>
          ))}
        </div>
        <div className="px-3 py-2.5 border-t border-zinc-200 dark:border-zinc-700">
          <button
            type="button"
            onClick={loadPrompts}
            disabled={loading || isBusy}
            className="w-full flex items-center justify-center gap-1.5 h-7 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-40"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {activePrompt ? (
          <>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  {activePrompt.label}
                </span>
                <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                  {activePrompt.mode}
                </span>
                {activePrompt.isOverridden && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 px-1.5 py-0.5 rounded font-medium">
                    custom
                  </span>
                )}
                {isDirty && (
                  <span className="text-xs text-zinc-400 dark:text-zinc-500 italic">
                    unsaved changes
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {activePrompt.isOverridden && (
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={isBusy}
                    title="Reset to default"
                    className="flex items-center gap-1.5 h-7 px-2.5 text-xs font-medium rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isBusy || !isDirty}
                  className="flex items-center gap-1.5 h-7 px-2.5 text-xs font-semibold rounded-md bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 text-white shadow-sm transition-all active:scale-95 disabled:opacity-40"
                >
                  <Save className="h-3 w-3" />
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>

            <div className="flex-1 p-3 bg-white dark:bg-zinc-900">
              <textarea
                value={editedText}
                onChange={(e) => {
                  setEditedText(e.target.value);
                  setHasLocalEdit(true);
                }}
                disabled={isBusy}
                rows={24}
                spellCheck={false}
                className="w-full h-full min-h-[400px] resize-none font-mono text-xs leading-relaxed text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-400 focus-visible:ring-offset-0 placeholder:text-zinc-400 disabled:cursor-not-allowed disabled:opacity-70"
                placeholder="Enter system prompt…"
              />
            </div>

            <div className="px-4 py-2 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20 shrink-0">
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                {editedText.length.toLocaleString()} characters
                {activePrompt.isOverridden
                  ? ' · Override active (resets on server restart)'
                  : ' · Default prompt'}
              </p>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-zinc-400">
            Select a mode to edit its prompt
          </div>
        )}
      </div>
    </div>
  );
}
