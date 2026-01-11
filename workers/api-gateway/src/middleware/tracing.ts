import { Context, Next } from 'hono';
import type { HonoEnv } from '../types';

export const TRACE_ID_HEADER = 'X-Trace-ID';

function generateTraceId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `tr_${timestamp}_${random}`;
}

function generateSpanId(): string {
  return `sp_${Math.random().toString(36).slice(2, 10)}`;
}

export interface TraceData {
  traceId: string;
  spanId: string;
  startTimeMs: number;
  path: string;
  method: string;
}

export async function tracingMiddleware(c: Context<HonoEnv>, next: Next) {
  const incomingTraceId = c.req.header(TRACE_ID_HEADER) || c.req.header('x-trace-id');
  const traceId = incomingTraceId || generateTraceId();
  const spanId = generateSpanId();
  const startTimeMs = Date.now();

  const traceData: TraceData = {
    traceId,
    spanId,
    startTimeMs,
    path: c.req.path,
    method: c.req.method,
  };

  c.set('trace', traceData);
  c.set('traceId', traceId);

  c.header(TRACE_ID_HEADER, traceId);

  await next();

  const endTimeMs = Date.now();
  const latencyMs = endTimeMs - startTimeMs;
  const status = c.res.status;

  if (c.req.path.startsWith('/api/v1/ai') || c.req.path.startsWith('/api/v1/chat')) {
    try {
      await logTrace(c.env.DB, {
        traceId,
        spanId,
        spanType: 'worker_process',
        startTimeMs,
        endTimeMs,
        latencyMs,
        status: status >= 200 && status < 400 ? 'success' : 'error',
        requestPath: c.req.path,
        requestMethod: c.req.method,
        responseStatus: status,
      });
    } catch (err) {
      console.error('Failed to log trace:', err);
    }
  }
}

interface TraceLogParams {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  spanType: string;
  startTimeMs: number;
  endTimeMs?: number;
  latencyMs?: number;
  status: string;
  modelId?: string;
  providerId?: string;
  routeId?: string;
  userId?: string;
  requestPath?: string;
  requestMethod?: string;
  responseStatus?: number;
  errorMessage?: string;
  tokensUsed?: number;
  estimatedCost?: number;
  metadata?: Record<string, unknown>;
}

async function logTrace(db: D1Database, params: TraceLogParams): Promise<void> {
  const id = `trc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  await db
    .prepare(
      `INSERT INTO ai_traces (
        id, trace_id, span_id, parent_span_id, span_type,
        start_time_ms, end_time_ms, latency_ms, status,
        model_id, provider_id, route_id, user_id,
        request_path, request_method, response_status,
        error_message, tokens_used, estimated_cost, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      params.traceId,
      params.spanId,
      params.parentSpanId || null,
      params.spanType,
      params.startTimeMs,
      params.endTimeMs || null,
      params.latencyMs || null,
      params.status,
      params.modelId || null,
      params.providerId || null,
      params.routeId || null,
      params.userId || null,
      params.requestPath || null,
      params.requestMethod || null,
      params.responseStatus || null,
      params.errorMessage || null,
      params.tokensUsed || null,
      params.estimatedCost || null,
      params.metadata ? JSON.stringify(params.metadata) : null
    )
    .run();

  await db
    .prepare(
      `INSERT INTO ai_trace_summary (trace_id, total_spans, total_latency_ms, status, root_span_type, request_path, created_at)
       VALUES (?, 1, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(trace_id) DO UPDATE SET
         total_spans = total_spans + 1,
         total_latency_ms = CASE WHEN excluded.total_latency_ms > total_latency_ms THEN excluded.total_latency_ms ELSE total_latency_ms END,
         status = excluded.status,
         completed_at = CURRENT_TIMESTAMP`
    )
    .bind(
      params.traceId,
      params.latencyMs || 0,
      params.status,
      params.spanType,
      params.requestPath || null
    )
    .run();
}

export async function logAITrace(
  db: D1Database,
  traceId: string,
  spanType: string,
  params: Partial<TraceLogParams>
): Promise<void> {
  const spanId = generateSpanId();
  await logTrace(db, {
    traceId,
    spanId,
    spanType,
    startTimeMs: params.startTimeMs || Date.now(),
    status: params.status || 'success',
    ...params,
  });
}
