export const TRACE_ID_HEADER = 'X-Trace-ID';

export type SpanType =
  | 'client_request'
  | 'worker_receive'
  | 'worker_process'
  | 'backend_call'
  | 'backend_receive'
  | 'llm_call'
  | 'llm_response'
  | 'worker_response'
  | 'client_receive';

export type TraceStatus = 'pending' | 'success' | 'error' | 'timeout';

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  spanType: SpanType;
  startTimeMs: number;
  endTimeMs?: number;
  latencyMs?: number;
  status: TraceStatus;
  metadata?: Record<string, unknown>;
}

export interface Trace {
  traceId: string;
  spans: TraceSpan[];
  totalLatencyMs?: number;
  status: TraceStatus;
  createdAt: string;
}

export function generateTraceId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `tr_${timestamp}_${random}`;
}

export function generateSpanId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `sp_${random}`;
}

export function getTraceIdFromHeaders(headers: Headers): string | null {
  return (
    headers.get(TRACE_ID_HEADER) ||
    headers.get('x-trace-id') ||
    (() => {
      const reqId = headers.get('X-Request-ID') || headers.get('x-request-id');
      return reqId?.startsWith('tr_') ? reqId : null;
    })()
  );
}

export function ensureTraceId(headers: Headers): string {
  return getTraceIdFromHeaders(headers) || generateTraceId();
}

export function createSpan(
  traceId: string,
  spanType: SpanType,
  parentSpanId?: string,
  metadata?: Record<string, unknown>
): TraceSpan {
  return {
    traceId,
    spanId: generateSpanId(),
    parentSpanId,
    spanType,
    startTimeMs: Date.now(),
    status: 'pending',
    metadata,
  };
}

export function completeSpan(
  span: TraceSpan,
  status: TraceStatus = 'success',
  metadata?: Record<string, unknown>
): TraceSpan {
  const endTimeMs = Date.now();
  return {
    ...span,
    endTimeMs,
    latencyMs: endTimeMs - span.startTimeMs,
    status,
    metadata: { ...span.metadata, ...metadata },
  };
}

const TRACE_ID_PATTERN = /^tr_[a-z0-9]+_[a-z0-9]+$/;

export function isValidTraceId(traceId: string): boolean {
  return TRACE_ID_PATTERN.test(traceId);
}

export function getTraceTimestamp(traceId: string): Date | null {
  if (!isValidTraceId(traceId)) return null;
  const parts = traceId.split('_');
  if (parts.length < 2) return null;
  const timestamp = parseInt(parts[1], 36);
  return isNaN(timestamp) ? null : new Date(timestamp);
}

export interface TraceContext {
  traceId: string;
  rootSpan: TraceSpan;
  currentSpan?: TraceSpan;
}

export function createTraceContext(
  traceId: string,
  spanType: SpanType = 'worker_receive',
  metadata?: Record<string, unknown>
): TraceContext {
  const rootSpan = createSpan(traceId, spanType, undefined, metadata);
  return { traceId, rootSpan, currentSpan: rootSpan };
}
