/**
 * AI Console - Main Component
 * 
 * Professional AI Console with RAG-first approach
 * High-fidelity cyberpunk industrial style
 * No emojis, no raw SVG - lucide-react icons only
 */

import { memo, useCallback } from 'react';
import { Terminal, Trash2, X, Minimize2, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTheme } from '@/contexts/ThemeContext';
import { semanticSearch, type RAGSearchResult } from '@/services/rag';
import { searchWeb } from '@/services/webSearch';
import { streamChatEvents } from '@/services/chat';
import { useConsoleState } from './useConsoleState';
import { ConsoleMessages } from './ConsoleMessages';
import { ConsoleInput } from './ConsoleInput';
import { ConsoleTrace } from './ConsoleTrace';
import type { Citation, TraceEvent } from './types';

interface AIConsoleProps {
  className?: string;
  onClose?: () => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ragResultToCitation(result: RAGSearchResult, index: number): Citation {
  return {
    id: result.id || `cite-${index}`,
    title: result.metadata?.title || 'Untitled',
    url: result.metadata?.slug && result.metadata?.year
      ? `/blog/${result.metadata.year}/${result.metadata.slug}`
      : undefined,
    slug: result.metadata?.slug,
    year: result.metadata?.year,
    snippet: result.content?.slice(0, 200) || result.snippet || '',
    score: result.score ?? 0,
    category: result.metadata?.category,
  };
}

function buildRAGContextString(citations: Citation[]): string {
  if (citations.length === 0) return '';

  const parts = citations.map((c, i) => 
    `[${i + 1}] ${c.title}\n${c.snippet}`
  );

  return parts.join('\n\n');
}

export const AIConsole = memo(function AIConsole({
  className,
  onClose,
  isMinimized,
  onToggleMinimize,
}: AIConsoleProps) {
  const isMobile = useIsMobile();
  const { isTerminal } = useTheme();
  const { state, actions } = useConsoleState();

  const modeLabel = state.mode === 'rag' ? 'RAG' : state.mode === 'web' ? 'Web' : 'Agent';

  const handleSubmit = useCallback(async () => {
    const query = state.input.trim();
    if (!query || state.isProcessing) return;

    const userMsgId = generateId();
    const assistantMsgId = generateId();
    const searchTraceId = generateId();
    const generateTraceId = generateId();

    actions.setProcessing(true);
    actions.addUserMessage(userMsgId, query);

    const abortController = actions.createAbortController();

    let citations: Citation[] = [];
    let webAnswer: string | undefined;

    try {
      // Phase 1: Search (mode-dependent)
      const searchTrace: TraceEvent = {
        id: searchTraceId,
        type: 'search',
        label: state.mode === 'web' ? 'Web Search' : state.mode === 'rag' ? 'Semantic Search' : 'Prepare',
        detail: `Query: "${query.slice(0, 50)}${query.length > 50 ? '...' : ''}"`,
        timestamp: Date.now(),
        status: 'running',
      };
      actions.addTrace(searchTrace);

      const searchStart = Date.now();
      if (state.mode === 'rag') {
        const ragResponse = await semanticSearch(query, {
          n_results: 5,
          signal: abortController.signal,
        });

        const searchDuration = Date.now() - searchStart;

        if (!ragResponse.ok || !ragResponse.data) {
          actions.updateTrace(searchTraceId, {
            status: 'error',
            duration: searchDuration,
            detail: ragResponse.error?.message || 'Search failed',
          });
          throw new Error(ragResponse.error?.message || 'RAG search failed');
        }

        citations = ragResponse.data.results.map(ragResultToCitation);
        actions.setCitations(citations);
        actions.updateTrace(searchTraceId, {
          status: 'done',
          duration: searchDuration,
          detail: `Found ${citations.length} results`,
        });
      } else if (state.mode === 'web') {
        const webResponse = await searchWeb(query, { maxResults: 5, searchDepth: 'basic' });
        const searchDuration = Date.now() - searchStart;
        webAnswer = webResponse.answer;

        citations = (webResponse.results || []).map((r, idx) => ({
          id: r.url || `web-${idx}`,
          title: r.title || 'Untitled',
          url: r.url,
          snippet: r.snippet || '',
          score: r.score ?? 0,
        }));

        actions.setCitations(citations);
        actions.updateTrace(searchTraceId, {
          status: 'done',
          duration: searchDuration,
          detail: `Found ${citations.length} results`,
        });
      } else {
        actions.setCitations([]);
        actions.updateTrace(searchTraceId, {
          status: 'done',
          duration: Date.now() - searchStart,
          detail: 'Skipped',
        });
      }

      // Phase 2: Generate Response
      const genTrace: TraceEvent = {
        id: generateTraceId,
        type: 'generate',
        label: state.mode === 'web' ? 'Present Results' : 'Generate Response',
        timestamp: Date.now(),
        status: 'running',
      };
      actions.addTrace(genTrace);
      actions.addAssistantMessage(assistantMsgId);

      const genStart = Date.now();

      if (state.mode === 'web') {
        const lines = citations.map((c, i) => {
          const url = c.url ? `\n${c.url}` : '';
          const snippet = c.snippet ? `\n${c.snippet}` : '';
          return `${i + 1}. ${c.title}${url}${snippet}`;
        });
        const content = [webAnswer?.trim(), lines.join('\n\n')].filter(Boolean).join('\n\n');
        if (content) {
          actions.appendAssistantContent(assistantMsgId, content);
        }
        const genDuration = Date.now() - genStart;
        actions.updateTrace(generateTraceId, {
          status: 'done',
          duration: genDuration,
        });
        actions.finishAssistantMessage(assistantMsgId);
        return;
      }

      const ragContext = state.mode === 'rag' ? buildRAGContextString(citations) : '';

      for await (const event of streamChatEvents({
        text: query,
        ragContext: ragContext || undefined,
        signal: abortController.signal,
      })) {
        if (event.type === 'text') {
          actions.appendAssistantContent(assistantMsgId, event.text);
        }
      }

      const genDuration = Date.now() - genStart;
      actions.updateTrace(generateTraceId, {
        status: 'done',
        duration: genDuration,
      });

      actions.finishAssistantMessage(assistantMsgId);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        actions.finishAssistantMessage(assistantMsgId);
        actions.updateTrace(generateTraceId, { status: 'error', detail: 'Cancelled' });
      } else {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        actions.setError(errMsg);
        actions.updateTrace(generateTraceId, { status: 'error', detail: errMsg });
      }
    } finally {
      actions.setProcessing(false);
    }
  }, [state.input, state.isProcessing, state.mode, actions]);

  const handleStop = useCallback(() => {
    actions.abort();
    actions.setProcessing(false);
  }, [actions]);

  return (
    <div
      className={cn(
        'flex flex-col rounded-lg overflow-hidden',
        isTerminal 
          ? 'bg-[hsl(var(--terminal-code-bg))] border border-border shadow-2xl shadow-black/50'
          : 'bg-card border border-border shadow-lg',
        className
      )}
    >
      {/* Header */}
      <div className={cn(
        'flex items-center border-b',
        isTerminal 
          ? 'bg-[hsl(var(--terminal-titlebar))] border-border'
          : 'bg-muted/50 border-border',
        isMobile ? 'gap-2 px-3 py-2.5' : 'gap-2 px-3 py-2'
      )}>
        {/* macOS buttons - hide on mobile */}
        {!isMobile && isTerminal && (
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-500 cursor-pointer transition-colors" onClick={onClose} />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 hover:bg-amber-500 cursor-pointer transition-colors" onClick={onToggleMinimize} />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>
        )}

        <div className={cn(
          'flex-1 flex items-center gap-2',
          isMobile ? 'justify-start' : 'justify-center'
        )}>
          <Terminal className={cn(
            isMobile ? 'w-5 h-5' : 'w-4 h-4',
            isTerminal ? 'text-primary' : 'text-muted-foreground'
          )} />
          <span className={cn(
            'font-mono',
            isMobile ? 'text-sm' : 'text-xs',
            isTerminal ? 'text-foreground' : 'text-muted-foreground'
          )}>
            AI Console
          </span>
          <span className={cn(
            'font-mono rounded',
            isMobile ? 'text-xs px-2 py-1' : 'text-[10px] px-1.5 py-0.5',
            isTerminal 
              ? 'text-primary bg-primary/10 border border-primary/20'
              : 'text-muted-foreground bg-muted'
          )}>
            {modeLabel}
          </span>
        </div>

        <div className={cn('flex items-center', isMobile ? 'gap-1' : 'gap-1')}>
          <button
            onClick={actions.clearAll}
            className={cn(
              'rounded transition-colors',
              isTerminal 
                ? 'text-muted-foreground hover:text-foreground hover:bg-primary/10'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              isMobile ? 'p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center' : 'p-1.5'
            )}
            title="Clear conversation"
          >
            <Trash2 className={cn(isMobile ? 'w-5 h-5' : 'w-3.5 h-3.5')} />
          </button>
          {onToggleMinimize && !isMobile && (
            <button
              onClick={onToggleMinimize}
              className={cn(
                'p-1.5 rounded transition-colors',
                isTerminal 
                  ? 'text-muted-foreground hover:text-foreground hover:bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className={cn(
                'rounded transition-colors',
                isTerminal 
                  ? 'text-muted-foreground hover:text-foreground hover:bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                isMobile ? 'p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center' : 'p-1.5'
              )}
            >
              <X className={cn(isMobile ? 'w-5 h-5' : 'w-3.5 h-3.5')} />
            </button>
          )}
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <ConsoleMessages messages={state.messages} isMobile={isMobile} isTerminal={isTerminal} scrollKey={state.traces.length} className="flex-1 min-h-0" />

          {/* Trace */}
          <ConsoleTrace traces={state.traces} />

          {/* Error Banner */}
          {state.error && (
            <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 text-xs text-red-400">
              {state.error}
            </div>
          )}

          {/* Input */}
          <ConsoleInput
            value={state.input}
            onChange={actions.setInput}
            onSubmit={handleSubmit}
            onStop={handleStop}
            isProcessing={state.isProcessing}
            mode={state.mode}
            onModeChange={actions.setMode}
            isMobile={isMobile}
            isTerminal={isTerminal}
            className={cn(isMobile ? 'mt-4' : 'mt-5')}
          />
        </>
      )}
    </div>
  );
});

export default AIConsole;
