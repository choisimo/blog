import { memo, useState, useMemo } from 'react';
import { Search, Database, Zap, AlertTriangle, CheckCircle, Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TraceEvent } from './types';

interface ConsoleTraceProps {
  traces: TraceEvent[];
  className?: string;
}

const TRACE_ICONS: Record<TraceEvent['type'], typeof Search> = {
  search: Search,
  retrieve: Database,
  generate: Zap,
  tool: Zap,
  error: AlertTriangle,
};

function TraceItem({ trace }: { trace: TraceEvent }) {
  const Icon = TRACE_ICONS[trace.type] || Zap;

  const statusIcon = trace.status === 'done' ? (
    <CheckCircle className="w-3 h-3 text-emerald-500" />
  ) : trace.status === 'error' ? (
    <AlertTriangle className="w-3 h-3 text-red-400" />
  ) : trace.status === 'running' ? (
    <Loader2 className="w-3 h-3 text-primary animate-spin" />
  ) : (
    <span className="w-3 h-3 rounded-full border border-zinc-600" />
  );

  return (
    <div className={cn(
      'flex items-start gap-2 py-1.5 px-2 text-xs',
      trace.status === 'error' && 'bg-red-500/5'
    )}>
      <div className="flex-shrink-0 mt-0.5">
        {statusIcon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3 h-3 text-zinc-500" />
          <span className={cn(
            'font-mono',
            trace.status === 'error' ? 'text-red-400' : 'text-zinc-300'
          )}>
            {trace.label}
          </span>
          {trace.duration !== undefined && (
            <span className="text-zinc-600 ml-auto">
              {trace.duration}ms
            </span>
          )}
        </div>
        {trace.detail && (
          <p className="text-zinc-500 truncate mt-0.5">{trace.detail}</p>
        )}
      </div>
    </div>
  );
}

export const ConsoleTrace = memo(function ConsoleTrace({
  traces,
  className,
}: ConsoleTraceProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const summary = useMemo(() => {
    const running = traces.filter(t => t.status === 'running').length;
    const done = traces.filter(t => t.status === 'done').length;
    const error = traces.filter(t => t.status === 'error').length;
    const totalDuration = traces.reduce((sum, t) => sum + (t.duration || 0), 0);
    return { running, done, error, total: traces.length, totalDuration };
  }, [traces]);

  if (traces.length === 0) return null;

  const hasRunning = summary.running > 0;
  const hasError = summary.error > 0;

  return (
    <div className={cn('border-t border-zinc-800/60 bg-zinc-950/70', className)}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 bg-zinc-950/80 hover:bg-zinc-900/60 transition-colors"
      >
        <div className={cn(
          'w-1.5 h-1.5 rounded-full',
          hasError ? 'bg-red-500' : hasRunning ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
        )} />
        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
          Trace
        </span>
        
        <div className="flex items-center gap-1.5 ml-auto text-[10px] font-mono text-zinc-500">
          {hasRunning && (
            <span className="flex items-center gap-1 text-amber-400">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              {summary.running}
            </span>
          )}
          {summary.done > 0 && (
            <span className="flex items-center gap-1 text-emerald-500">
              <CheckCircle className="w-2.5 h-2.5" />
              {summary.done}
            </span>
          )}
          {hasError && (
            <span className="flex items-center gap-1 text-red-400">
              <AlertTriangle className="w-2.5 h-2.5" />
              {summary.error}
            </span>
          )}
          {summary.totalDuration > 0 && (
            <span className="text-zinc-600 ml-1">
              {summary.totalDuration}ms
            </span>
          )}
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 ml-1 text-zinc-600" />
          ) : (
            <ChevronUp className="w-3 h-3 ml-1 text-zinc-600" />
          )}
        </div>
      </button>
      
      {isExpanded && (
        <div className="max-h-32 overflow-y-auto bg-zinc-950/60 border-t border-zinc-800/40">
          {traces.map(trace => (
            <TraceItem key={trace.id} trace={trace} />
          ))}
        </div>
      )}
    </div>
  );
});
