import { Hono } from 'hono';
import type { HonoEnv } from '../../types';
import { success, error } from '../../lib/response';
import { requireAdmin } from '../../middleware/auth';
import { generateId } from './types';
import type { AIUsageLog } from './types';
import { queryOne, queryAll, execute } from '../../lib/d1';

const usage = new Hono<HonoEnv>();

usage.get('/', requireAdmin, async (c) => {
  const startDate = c.req.query('start_date');
  const endDate = c.req.query('end_date');
  const modelId = c.req.query('model_id');
  const groupBy = c.req.query('group_by') || 'day';

  try {
    const end = endDate || new Date().toISOString().split('T')[0];
    const start =
      startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const summaryQuery = `
      SELECT
        COUNT(*) as total_requests,
        SUM(total_tokens) as total_tokens,
        SUM(estimated_cost) as total_cost,
        AVG(latency_ms) as avg_latency_ms,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count
      FROM ai_usage_logs
      WHERE date(created_at) >= ? AND date(created_at) <= ?
      ${modelId ? 'AND model_id = ?' : ''}
    `;

    const summaryParams: (string)[] = [start, end];
    if (modelId) summaryParams.push(modelId);
    const summary = await queryOne<{
      total_requests: number;
      total_tokens: number;
      total_cost: number;
      avg_latency_ms: number;
      success_count: number;
      error_count: number;
    }>(c.env.DB, summaryQuery, ...summaryParams);

    let breakdownQuery: string;
    if (groupBy === 'model') {
      breakdownQuery = `
        SELECT
          m.model_name,
          m.display_name,
          COUNT(*) as requests,
          SUM(l.total_tokens) as tokens,
          SUM(l.estimated_cost) as cost,
          AVG(l.latency_ms) as avg_latency_ms
        FROM ai_usage_logs l
        LEFT JOIN ai_models m ON l.model_id = m.id
        WHERE date(l.created_at) >= ? AND date(l.created_at) <= ?
        GROUP BY l.model_id
        ORDER BY requests DESC
      `;
    } else {
      breakdownQuery = `
        SELECT
          date(created_at) as date,
          COUNT(*) as requests,
          SUM(total_tokens) as tokens,
          SUM(estimated_cost) as cost,
          AVG(latency_ms) as avg_latency_ms
        FROM ai_usage_logs
        WHERE date(created_at) >= ? AND date(created_at) <= ?
        ${modelId ? 'AND model_id = ?' : ''}
        GROUP BY date(created_at)
        ORDER BY date ASC
      `;
    }

    const breakdownParams: (string)[] = [start, end];
    if (groupBy === 'day' && modelId) breakdownParams.push(modelId);
    const breakdown = await queryAll<Record<string, unknown>>(c.env.DB, breakdownQuery, ...breakdownParams);

    return success(c, {
      summary: {
        total_requests: summary?.total_requests || 0,
        total_tokens: summary?.total_tokens || 0,
        total_cost: summary?.total_cost || 0,
        avg_latency_ms: summary?.avg_latency_ms || 0,
        success_count: summary?.success_count || 0,
        error_count: summary?.error_count || 0,
      },
      breakdown,
      period: { start, end },
      group_by: groupBy,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch usage';
    return error(c, message, 500);
  }
});

usage.post('/log', requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const {
    model_id,
    route_id,
    request_type,
    prompt_tokens,
    completion_tokens,
    total_tokens,
    estimated_cost,
    latency_ms,
    status,
    error_message,
    user_id,
    metadata,
  } = body as Partial<AIUsageLog>;

  const id = generateId('usage');

  try {
    await execute(
      c.env.DB,
      `INSERT INTO ai_usage_logs (
        id, model_id, route_id, request_type, prompt_tokens, completion_tokens,
        total_tokens, estimated_cost, latency_ms, status, error_message, user_id, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      model_id || null,
      route_id || null,
      request_type || 'chat',
      prompt_tokens || null,
      completion_tokens || null,
      total_tokens || null,
      estimated_cost || null,
      latency_ms || null,
      status || 'success',
      error_message || null,
      user_id || null,
      metadata ? JSON.stringify(metadata) : null
    );

    const today = new Date().toISOString().split('T')[0];
    if (model_id) {
      await execute(
        c.env.DB,
        `INSERT INTO ai_usage_daily (date, model_id, total_requests, total_prompt_tokens, total_completion_tokens, total_tokens, total_cost, success_count, error_count)
         VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(date, model_id) DO UPDATE SET
           total_requests = total_requests + 1,
           total_prompt_tokens = total_prompt_tokens + excluded.total_prompt_tokens,
           total_completion_tokens = total_completion_tokens + excluded.total_completion_tokens,
           total_tokens = total_tokens + excluded.total_tokens,
           total_cost = total_cost + excluded.total_cost,
           success_count = success_count + excluded.success_count,
           error_count = error_count + excluded.error_count`,
        today,
        model_id,
        prompt_tokens || 0,
        completion_tokens || 0,
        total_tokens || 0,
        estimated_cost || 0,
        status === 'success' ? 1 : 0,
        status === 'error' ? 1 : 0
      );
    }

    return success(c, { logged: true, id }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to log usage';
    return error(c, message, 500);
  }
});

export default usage;
