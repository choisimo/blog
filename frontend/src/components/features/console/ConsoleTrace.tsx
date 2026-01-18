/**
 * Console Trace Panel
 * 
 * Shows execution trace for transparency
 * High-fidelity cyberpunk industrial style
 */

import { memo } from 'react';
import { Search, Database, Zap, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
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
  if (traces.length === 0) return null;

  return (
    <div className={cn('border-t border-zinc-800/50', className)}>
      <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-950/50 border-b border-zinc-800/30">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-500/60" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
          Trace
        </span>
      </div>
      <div className="max-h-32 overflow-y-auto bg-zinc-950/30">
        {traces.map(trace => (
          <TraceItem key={trace.id} trace={trace} />
        ))}
      </div>
    </div>
  );
});
