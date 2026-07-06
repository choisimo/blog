import { memo, useState, useMemo } from 'react';
import { Search, Database, Zap, AlertTriangle, CheckCircle, Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TraceEvent } from './types';

interface ConsoleTraceProps {
  traces: TraceEvent[];
  className?: string;
  label?: string;
  title?: string;
  summaryLabel?: string;
  toggleLabel?: string;
}

const TRACE_ICONS: Record<TraceEvent['type'], typeof Search> = {
  search: Search,
  retrieve: Database,
  generate: Zap,
  tool: Zap,
  error: AlertTriangle,
};

type NormalizedTraceStatus = 'pending' | 'running' | 'done' | 'error';

const TRACE_STATUSES = new Set<NormalizedTraceStatus>(['pending', 'running', 'done', 'error']);
const ANSI_ESCAPE_PATTERN =
  /\u001B(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001B\\))/g;
const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/g;
const WHITESPACE_PATTERN = /\s+/g;
const DEFAULT_TRACE_LABEL = 'Console trace';
const DEFAULT_TRACE_SUMMARY_LABEL = 'Trace';
const DEFAULT_TRACE_TOGGLE_LABEL = 'Toggle trace details';

function normalizeTraceText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return fallback;
  }

  const normalized = String(value)
    .replace(ANSI_ESCAPE_PATTERN, ' ')
    .replace(CONTROL_CHAR_PATTERN, ' ')
    .replace(WHITESPACE_PATTERN, ' ')
    .trim();

  return normalized || fallback;
}

function normalizeTraceType(value: unknown): TraceEvent['type'] {
  return typeof value === 'string' && value in TRACE_ICONS
    ? (value as TraceEvent['type'])
    : 'tool';
}

function normalizeTraceStatus(value: unknown): NormalizedTraceStatus {
  return typeof value === 'string' && TRACE_STATUSES.has(value as NormalizedTraceStatus)
    ? (value as NormalizedTraceStatus)
    : 'pending';
}

function normalizeTraceDuration(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return undefined;
  }

  return Math.round(value);
}

function TraceItem({ trace }: { trace: TraceEvent }) {
  const traceType = normalizeTraceType(trace.type);
  const status = normalizeTraceStatus(trace.status);
  const label = normalizeTraceText(trace.label, 'Trace step');
  const detail = normalizeTraceText(trace.detail);
  const duration = normalizeTraceDuration(trace.duration);
  const Icon = TRACE_ICONS[traceType] || Zap;

  const statusIcon = status === 'done' ? (
    <CheckCircle className="w-3 h-3 text-emerald-500" aria-hidden="true" />
  ) : status === 'error' ? (
    <AlertTriangle className="w-3 h-3 text-red-400" aria-hidden="true" />
  ) : status === 'running' ? (
    <Loader2 className="w-3 h-3 text-primary animate-spin" aria-hidden="true" />
  ) : (
    <span className="w-3 h-3 rounded-full border border-zinc-600" aria-hidden="true" />
  );

  return (
    <div className={cn(
      'flex items-start gap-2 py-1.5 px-2 text-xs',
      status === 'error' && 'bg-red-500/5'
    )}>
      <div className="flex-shrink-0 mt-0.5">
        {statusIcon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3 h-3 text-zinc-500" aria-hidden="true" />
          <span className={cn(
            'font-mono',
            status === 'error' ? 'text-red-400' : 'text-zinc-300'
          )}>
            {label}
          </span>
          {duration !== undefined && (
            <span className="text-zinc-600 ml-auto">
              {duration}ms
            </span>
          )}
        </div>
        {detail && (
          <p className="text-zinc-500 truncate mt-0.5">{detail}</p>
        )}
      </div>
    </div>
  );
}

export const ConsoleTrace = memo(function ConsoleTrace({
  traces,
  className,
  label = DEFAULT_TRACE_LABEL,
  title,
  summaryLabel = DEFAULT_TRACE_SUMMARY_LABEL,
  toggleLabel = DEFAULT_TRACE_TOGGLE_LABEL,
}: ConsoleTraceProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const safeLabel = normalizeTraceText(label, DEFAULT_TRACE_LABEL);
  const safeTitle = normalizeTraceText(title);
  const safeSummaryLabel = normalizeTraceText(
    summaryLabel,
    DEFAULT_TRACE_SUMMARY_LABEL
  );
  const safeToggleLabel = normalizeTraceText(
    toggleLabel,
    DEFAULT_TRACE_TOGGLE_LABEL
  );

  const summary = useMemo(() => {
    return traces.reduce((acc, trace) => {
      const status = normalizeTraceStatus(trace.status);
      const duration = normalizeTraceDuration(trace.duration);

      if (status === 'running') acc.running += 1;
      if (status === 'done') acc.done += 1;
      if (status === 'error') acc.error += 1;
      if (duration !== undefined) acc.totalDuration += duration;

      return acc;
    }, { running: 0, done: 0, error: 0, total: traces.length, totalDuration: 0 });
  }, [traces]);

  if (traces.length === 0) return null;

  const hasRunning = summary.running > 0;
  const hasError = summary.error > 0;

  return (
    <div
      className={cn('border-t border-zinc-800/60 bg-zinc-950/70', className)}
      role="region"
      aria-label={safeLabel}
      title={safeTitle || undefined}
    >
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-label={safeToggleLabel}
        className="w-full flex items-center gap-2 px-3 py-1.5 bg-zinc-950/80 hover:bg-zinc-900/60 transition-colors"
      >
        <div className={cn(
          'w-1.5 h-1.5 rounded-full',
          hasError ? 'bg-red-500' : hasRunning ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
        )} aria-hidden="true" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
          {safeSummaryLabel}
        </span>
        
        <div className="flex items-center gap-1.5 ml-auto text-[10px] font-mono text-zinc-500">
          {hasRunning && (
            <span className="flex items-center gap-1 text-amber-400">
              <Loader2 className="w-2.5 h-2.5 animate-spin" aria-hidden="true" />
              {summary.running}
            </span>
          )}
          {summary.done > 0 && (
            <span className="flex items-center gap-1 text-emerald-500">
              <CheckCircle className="w-2.5 h-2.5" aria-hidden="true" />
              {summary.done}
            </span>
          )}
          {hasError && (
            <span className="flex items-center gap-1 text-red-400">
              <AlertTriangle className="w-2.5 h-2.5" aria-hidden="true" />
              {summary.error}
            </span>
          )}
          {summary.totalDuration > 0 && (
            <span className="text-zinc-600 ml-1">
              {summary.totalDuration}ms
            </span>
          )}
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 ml-1 text-zinc-600" aria-hidden="true" />
          ) : (
            <ChevronUp className="w-3 h-3 ml-1 text-zinc-600" aria-hidden="true" />
          )}
        </div>
      </button>
      
      {isExpanded && (
        <div className="max-h-32 overflow-y-auto overscroll-contain bg-zinc-950/60 border-t border-zinc-800/40">
          {traces.map((trace, idx) => (
            <TraceItem key={`${normalizeTraceText(trace.id, 'trace')}-${idx}`} trace={trace} />
          ))}
        </div>
      )}
    </div>
  );
});
