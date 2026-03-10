import { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Play, Pause, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { getApiBaseUrl } from '@/utils/network/apiBase';
import { useAuthStore } from '@/stores/session/useAuthStore';

interface LogEntry {
  id?: number;
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  service?: string;
  message: string;
  [key: string]: unknown;
}

const LEVEL_COLORS: Record<string, string> = {
  error: 'text-red-600 bg-red-50 border-red-200',
  warn: 'text-amber-600 bg-amber-50 border-amber-200',
  info: 'text-zinc-700 bg-zinc-50 border-zinc-200',
  debug: 'text-slate-500 bg-slate-50 border-slate-200',
};

const LEVEL_BADGE: Record<string, string> = {
  error: 'bg-red-100 text-red-700',
  warn: 'bg-amber-100 text-amber-700',
  info: 'bg-zinc-100 text-zinc-600',
  debug: 'bg-slate-100 text-slate-500',
};

function LogRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const { timestamp, level, service, message, ...rest } = entry;
  const hasContext = Object.keys(rest).filter(k => !['id', 'pid', 'type'].includes(k)).length > 0;

  const contextData = Object.fromEntries(
    Object.entries(rest).filter(([k]) => !['id', 'pid', 'type'].includes(k))
  );

  return (
    <div className={`border-b border-zinc-100 last:border-0 ${expanded ? 'bg-zinc-50' : 'hover:bg-zinc-50'}`}>
      <button
        type="button"
        className={`w-full flex items-start gap-2 px-3 py-2 text-left ${hasContext ? 'cursor-pointer' : 'cursor-default'}`}
        onClick={() => hasContext && setExpanded(v => !v)}
        disabled={!hasContext}
      >
        <span className="font-mono text-xs text-zinc-400 whitespace-nowrap pt-0.5 w-[160px] shrink-0">
          {new Date(timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          <span className="text-zinc-300">.{String(new Date(timestamp).getMilliseconds()).padStart(3, '0')}</span>
        </span>
        <span className={`text-xs font-mono font-semibold px-1.5 py-0.5 rounded-sm shrink-0 ${LEVEL_BADGE[level] ?? LEVEL_BADGE.info}`}>
          {level.toUpperCase()}
        </span>
        {service && (
          <span className="text-xs font-mono text-zinc-400 bg-zinc-100 px-1 py-0.5 rounded shrink-0">
            {service}
          </span>
        )}
        <span className="text-xs text-zinc-700 flex-1 break-all">{message}</span>
        {hasContext && (
          <span className="text-zinc-400 shrink-0 mt-0.5">
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </span>
        )}
      </button>
      {expanded && hasContext && (
        <pre className="px-3 pb-2 pt-0 text-xs font-mono text-zinc-600 bg-zinc-50 overflow-x-auto border-t border-zinc-100">
          {JSON.stringify(contextData, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function LogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [serviceFilter, setServiceFilter] = useState('');
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const pausedRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { getValidAccessToken } = useAuthStore();

  const connect = useCallback(async () => {
    if (esRef.current) {
      esRef.current.close();
    }

    const token = await getValidAccessToken();
    if (!token) return;

    const base = getApiBaseUrl();
    const url = `${base}/api/v1/admin/logs/stream`;

    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (e) => {
      if (pausedRef.current) return;
      try {
        const data = JSON.parse(e.data) as LogEntry;
        if (data.type === 'connected') return;
        setLogs(prev => [data, ...prev].slice(0, 1000));
      } catch {
      }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
      setTimeout(() => connect(), 3000);
    };
  }, [getValidAccessToken]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
    };
  }, [connect]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const handleClear = () => setLogs([]);

  const filtered = logs.filter(l => {
    if (levelFilter !== 'all' && l.level !== levelFilter) return false;
    if (serviceFilter && l.service && !l.service.includes(serviceFilter)) return false;
    if (serviceFilter && !l.service) return false;
    return true;
  });

  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full shrink-0 ${connected ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
          <span className="text-xs font-semibold text-zinc-700">Server Logs</span>
          <span className="font-mono text-xs text-zinc-400">({filtered.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-zinc-200 rounded-md overflow-hidden">
            {(['all', 'error', 'warn', 'info', 'debug'] as const).map(l => (
              <button
                key={l}
                type="button"
                onClick={() => setLevelFilter(l)}
                className={`px-2 py-1 text-xs transition-colors ${
                  levelFilter === l ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-500 hover:bg-zinc-50'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="service..."
            value={serviceFilter}
            onChange={e => setServiceFilter(e.target.value)}
            className="h-7 px-2 text-xs border border-zinc-200 rounded-md w-24 focus:outline-none focus:ring-1 focus:ring-zinc-400"
          />
          <button
            type="button"
            onClick={() => setPaused(v => !v)}
            className="h-7 w-7 flex items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 transition-colors"
          >
            {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="h-7 w-7 flex items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={connect}
            className="h-7 w-7 flex items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 transition-colors"
          >
            <RefreshCw className={`h-3 w-3 ${!connected ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      <div className="h-[500px] overflow-y-auto font-mono bg-white">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-zinc-400">
            {connected ? 'Waiting for logs...' : 'Connecting...'}
          </div>
        ) : (
          filtered.map((entry, i) => (
            <LogRow key={`${entry.timestamp}-${i}`} entry={entry} />
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
