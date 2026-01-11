import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
} from '@/components/ui/dialog';
import {
  RefreshCw,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  ChevronRight,
  Activity,
} from 'lucide-react';
import { useTraces, type AITraceSummary, type AITraceSpan, type TraceStats } from './hooks';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  success: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10' },
  error: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
  timeout: { icon: AlertCircle, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  pending: { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-500/10' },
};

const SPAN_TYPE_COLORS: Record<string, string> = {
  client_request: 'bg-purple-500',
  worker_receive: 'bg-blue-500',
  worker_process: 'bg-cyan-500',
  backend_call: 'bg-green-500',
  backend_receive: 'bg-emerald-500',
  llm_call: 'bg-orange-500',
  llm_response: 'bg-amber-500',
  worker_response: 'bg-indigo-500',
  client_receive: 'bg-violet-500',
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={cn('gap-1', config.bg, config.color)}>
      <Icon className="h-3 w-3" />
      {status}
    </Badge>
  );
}

function formatLatency(ms: number | null): string {
  if (ms === null) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function TraceWaterfall({ spans }: { spans: AITraceSpan[] }) {
  if (!spans.length) return <div className="text-muted-foreground text-sm">No spans</div>;

  const minTime = Math.min(...spans.map((s) => s.start_time_ms));
  const maxTime = Math.max(...spans.map((s) => s.end_time_ms || s.start_time_ms));
  const totalDuration = maxTime - minTime || 1;

  return (
    <div className="space-y-2">
      {spans.map((span) => {
        const startOffset = ((span.start_time_ms - minTime) / totalDuration) * 100;
        const width = ((span.latency_ms || 1) / totalDuration) * 100;
        const barColor = SPAN_TYPE_COLORS[span.span_type] || 'bg-gray-500';

        return (
          <div key={span.id} className="flex items-center gap-4">
            <div className="w-32 text-xs text-muted-foreground truncate" title={span.span_type}>
              {span.span_type}
            </div>
            <div className="flex-1 h-6 bg-muted rounded relative">
              <div
                className={cn('absolute h-full rounded', barColor)}
                style={{ left: `${startOffset}%`, width: `${Math.max(width, 1)}%` }}
              />
            </div>
            <div className="w-20 text-xs text-right">{formatLatency(span.latency_ms)}</div>
          </div>
        );
      })}
      <div className="flex justify-between text-xs text-muted-foreground mt-2 pt-2 border-t">
        <span>0ms</span>
        <span>{formatLatency(totalDuration)}</span>
      </div>
    </div>
  );
}

function TraceDetailDialog({
  traceId,
  open,
  onClose,
}: {
  traceId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { fetchTraceDetail } = useTraces();
  const [detail, setDetail] = useState<{ summary: AITraceSummary; spans: AITraceSpan[] } | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (traceId && open) {
      setLoading(true);
      fetchTraceDetail(traceId).then((result) => {
        if (result.ok && result.data) {
          setDetail(result.data);
        }
        setLoading(false);
      });
    }
  }, [traceId, open, fetchTraceDetail]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Trace Detail
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : detail ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Trace ID:</span>
                <code className="ml-2 text-xs bg-muted px-2 py-1 rounded">
                  {detail.summary.trace_id}
                </code>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <span className="ml-2">
                  <StatusBadge status={detail.summary.status} />
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Total Latency:</span>
                <span className="ml-2 font-mono">
                  {formatLatency(detail.summary.total_latency_ms)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Spans:</span>
                <span className="ml-2">{detail.summary.total_spans}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Path:</span>
                <code className="ml-2 text-xs bg-muted px-2 py-1 rounded">
                  {detail.summary.request_path || '-'}
                </code>
              </div>
              <div>
                <span className="text-muted-foreground">Created:</span>
                <span className="ml-2">{formatDate(detail.summary.created_at)}</span>
              </div>
            </div>

            {detail.summary.error_message && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-500">
                {detail.summary.error_message}
              </div>
            )}

            <div>
              <h4 className="font-medium mb-4">Request Timeline</h4>
              <TraceWaterfall spans={detail.spans} />
            </div>

            <div>
              <h4 className="font-medium mb-2">Span Details</h4>
              <div className="space-y-2 max-h-60 overflow-auto">
                {detail.spans.map((span) => (
                  <div
                    key={span.id}
                    className="text-xs p-2 bg-muted rounded flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn('w-2 h-2 rounded-full', SPAN_TYPE_COLORS[span.span_type])}
                      />
                      <span className="font-mono">{span.span_type}</span>
                      {span.request_method && (
                        <Badge variant="outline" className="text-[10px]">
                          {span.request_method}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <StatusBadge status={span.status} />
                      <span className="font-mono">{formatLatency(span.latency_ms)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">No trace data found</div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TraceStatsCard() {
  const { fetchTraceStats } = useTraces();
  const [stats, setStats] = useState<TraceStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchTraceStats(24).then((result) => {
      if (result.ok && result.data) {
        setStats(result.data.stats);
      }
      setLoading(false);
    });
  }, [fetchTraceStats]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const successRate =
    stats.total_traces > 0 ? ((stats.success_count / stats.total_traces) * 100).toFixed(1) : '0';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Last 24 Hours</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold">{stats.total_traces}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-500">{successRate}%</div>
            <div className="text-xs text-muted-foreground">Success Rate</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-500">{stats.error_count}</div>
            <div className="text-xs text-muted-foreground">Errors</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{formatLatency(stats.avg_latency_ms)}</div>
            <div className="text-xs text-muted-foreground">Avg Latency</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TraceViewer() {
  const { traces, loading, error, total, fetchTraces } = useTraces();
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const limit = 20;

  useEffect(() => {
    fetchTraces({
      limit,
      offset: page * limit,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      traceId: searchTerm || undefined,
    });
  }, [fetchTraces, page, statusFilter, searchTerm]);

  const handleRefresh = () => {
    fetchTraces({
      limit,
      offset: page * limit,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      traceId: searchTerm || undefined,
    });
  };

  const handleViewDetail = (traceId: string) => {
    setSelectedTraceId(traceId);
    setDialogOpen(true);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <TraceStatsCard />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Request Traces
            </CardTitle>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by trace ID..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(0);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="timeout">Timeout</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-500">
              {error}
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trace ID</TableHead>
                <TableHead>Path</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Spans</TableHead>
                <TableHead>Latency</TableHead>
                <TableHead>Time</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {traces.map((trace) => (
                <TableRow key={trace.trace_id}>
                  <TableCell className="font-mono text-xs">{trace.trace_id}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs">
                    {trace.request_path || '-'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={trace.status} />
                  </TableCell>
                  <TableCell>{trace.total_spans}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {formatLatency(trace.total_latency_ms)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(trace.created_at)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewDetail(trace.trace_id)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && traces.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No traces found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)} of {total}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <TraceDetailDialog
        traceId={selectedTraceId}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}
