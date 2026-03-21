import { Hono } from 'hono';
import type { HonoEnv } from '../../types';
import { success, error, notFound } from '../../lib/response';
import { requireAdmin } from '../../middleware/auth';
import { queryOne, queryAll } from '../../lib/d1';

const traces = new Hono<HonoEnv>();

traces.get('/', requireAdmin, async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 200);
  const offset = parseInt(c.req.query('offset') || '0', 10);
  const status = c.req.query('status');
  const traceId = c.req.query('trace_id');
  const startDate = c.req.query('start_date');
  const endDate = c.req.query('end_date');

  try {
    let query = `SELECT * FROM ai_trace_summary WHERE 1=1`;
    const params: (string | number)[] = [];

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }
    if (traceId) {
      query += ` AND trace_id LIKE ?`;
      params.push(`%${traceId}%`);
    }
    if (startDate) {
      query += ` AND created_at >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND created_at <= ?`;
      params.push(endDate);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const results = await queryAll<Record<string, unknown>>(
      c.env.DB,
      query,
      ...params
    );

    const countQuery = `SELECT COUNT(*) as total FROM ai_trace_summary WHERE 1=1${
      status ? ' AND status = ?' : ''
    }${traceId ? ' AND trace_id LIKE ?' : ''}${startDate ? ' AND created_at >= ?' : ''}${
      endDate ? ' AND created_at <= ?' : ''
    }`;
    const countParams = params.slice(0, -2);
    const countResult = await queryOne<{ total: number }>(
      c.env.DB,
      countQuery,
      ...countParams
    );

    return success(c, {
      traces: results,
      total: countResult?.total || 0,
      limit,
      offset,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch traces';
    return error(c, message, 500);
  }
});

traces.get('/:traceId', requireAdmin, async (c) => {
  const traceId = c.req.param('traceId');

  try {
    const summary = await queryOne<Record<string, unknown>>(
      c.env.DB,
      `SELECT * FROM ai_trace_summary WHERE trace_id = ?`,
      traceId
    );

    if (!summary) {
      return notFound(c, `Trace not found: ${traceId}`);
    }

    const spans = await queryAll<Record<string, unknown>>(
      c.env.DB,
      `SELECT * FROM ai_traces WHERE trace_id = ? ORDER BY start_time_ms ASC`,
      traceId
    );

    return success(c, {
      summary,
      spans,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch trace';
    return error(c, message, 500);
  }
});

traces.get('/stats/summary', requireAdmin, async (c) => {
  const hours = parseInt(c.req.query('hours') || '24', 10);
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  try {
    const stats = await queryOne<{
      total_traces: number;
      success_count: number;
      error_count: number;
      timeout_count: number;
      avg_latency_ms: number;
      max_latency_ms: number;
      min_latency_ms: number;
    }>(
      c.env.DB,
      `SELECT
        COUNT(*) as total_traces,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
        SUM(CASE WHEN status = 'timeout' THEN 1 ELSE 0 END) as timeout_count,
        AVG(total_latency_ms) as avg_latency_ms,
        MAX(total_latency_ms) as max_latency_ms,
        MIN(total_latency_ms) as min_latency_ms
       FROM ai_trace_summary
       WHERE created_at >= ?`,
      since
    );

    const bySpanType = await queryAll<{
      span_type: string;
      count: number;
      avg_latency: number;
    }>(
      c.env.DB,
      `SELECT span_type, COUNT(*) as count, AVG(latency_ms) as avg_latency
       FROM ai_traces
       WHERE created_at >= ?
       GROUP BY span_type
       ORDER BY count DESC`,
      since
    );

    return success(c, {
      period_hours: hours,
      since,
      stats: stats || {},
      by_span_type: bySpanType,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch trace stats';
    return error(c, message, 500);
  }
});

export default traces;
