import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { adminFetchRaw } from '@/services/admin/apiClient';
import { getApiBaseUrl } from '@/utils/network/apiBase';
import { RefreshCw, RotateCcw, Save } from 'lucide-react';

interface AgentPrompt {
  mode: string;
  label: string;
  text: string;
  isOverridden: boolean;
}

const MODE_ORDER = ['default', 'research', 'coding', 'blog', 'article', 'terminal', 'performance'];

export function PromptsManager() {
  const { toast } = useToast();
  const API_BASE = getApiBaseUrl();

  const [prompts, setPrompts] = useState<AgentPrompt[]>([]);
  const [selectedMode, setSelectedMode] = useState<string>('default');
  const [editedText, setEditedText] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const loadOnMount = useCallback(() => {
    setLoading(true);
    adminFetchRaw(`${API_BASE}/api/v1/agent/prompts`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch prompts');
        return res.json();
      })
      .then((json) => {
        const sorted: AgentPrompt[] = [...(json.data.prompts as AgentPrompt[])].sort(
          (a, b) => MODE_ORDER.indexOf(a.mode) - MODE_ORDER.indexOf(b.mode)
        );
        setPrompts(sorted);
        const active = sorted[0];
        if (active) {
          setSelectedMode(active.mode);
          setEditedText(active.text);
        }
      })
      .catch(() => toast({ title: 'Failed to load prompts', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [API_BASE, toast]);

  useEffect(() => {
    loadOnMount();
  }, [loadOnMount]);

  const selectMode = (mode: string) => {
    const prompt = prompts.find((p) => p.mode === mode);
    if (prompt) {
      setSelectedMode(mode);
      setEditedText(prompt.text);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await adminFetchRaw(`${API_BASE}/api/v1/agent/prompts/${selectedMode}`, {
        method: 'PUT',
        body: JSON.stringify({ text: editedText }),
      });
      if (!res.ok) throw new Error('Save failed');
      const json = await res.json();
      const updated: AgentPrompt = json.data;
      setPrompts((prev) => prev.map((p) => (p.mode === updated.mode ? updated : p)));
      toast({ title: 'Prompt saved', description: `${updated.label} prompt updated` });
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const res = await adminFetchRaw(`${API_BASE}/api/v1/agent/prompts/${selectedMode}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Reset failed');
      const json = await res.json();
      const updated: AgentPrompt = json.data;
      setPrompts((prev) => prev.map((p) => (p.mode === updated.mode ? updated : p)));
      setEditedText(updated.text);
      toast({ title: 'Prompt reset', description: `${updated.label} restored to default` });
    } catch {
      toast({ title: 'Reset failed', variant: 'destructive' });
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
              className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-400 ${
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
            onClick={loadOnMount}
            disabled={loading}
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
                    disabled={resetting || saving}
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
                  disabled={saving || !isDirty}
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
                onChange={(e) => setEditedText(e.target.value)}
                rows={24}
                spellCheck={false}
                className="w-full h-full min-h-[400px] resize-none font-mono text-xs leading-relaxed text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-400 focus-visible:ring-offset-0 placeholder:text-zinc-400"
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
