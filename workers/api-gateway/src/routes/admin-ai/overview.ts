import { Hono } from 'hono';
import type { HonoEnv } from '../../types';
import { success, error } from '../../lib/response';
import { requireAdmin } from '../../middleware/auth';
import { queryOne } from '../../lib/d1';

const overview = new Hono<HonoEnv>();

overview.get('/', requireAdmin, async (c) => {
  try {
    const providerStats = await queryOne<{
      total: number;
      enabled: number;
      healthy: number;
      degraded: number;
      down: number;
    }>(
      c.env.DB,
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_enabled = 1 THEN 1 ELSE 0 END) as enabled,
        SUM(CASE WHEN health_status = 'healthy' THEN 1 ELSE 0 END) as healthy,
        SUM(CASE WHEN health_status = 'degraded' THEN 1 ELSE 0 END) as degraded,
        SUM(CASE WHEN health_status = 'down' THEN 1 ELSE 0 END) as down
       FROM ai_providers`
    );

    const modelStats = await queryOne<{
      total: number;
      enabled: number;
      vision_capable: number;
      function_calling_capable: number;
    }>(
      c.env.DB,
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_enabled = 1 THEN 1 ELSE 0 END) as enabled,
        SUM(CASE WHEN supports_vision = 1 THEN 1 ELSE 0 END) as vision_capable,
        SUM(CASE WHEN supports_function_calling = 1 THEN 1 ELSE 0 END) as function_calling_capable
       FROM ai_models`
    );

    const routeStats = await queryOne<{ total: number; enabled: number }>(
      c.env.DB,
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_enabled = 1 THEN 1 ELSE 0 END) as enabled
       FROM ai_routes`
    );

    const today = new Date().toISOString().split('T')[0];
    const todayUsage = await queryOne<{
      requests: number;
      tokens: number;
      cost: number;
    }>(
      c.env.DB,
      `SELECT
        SUM(total_requests) as requests,
        SUM(total_tokens) as tokens,
        SUM(total_cost) as cost
       FROM ai_usage_daily WHERE date = ?`,
      today
    );

    const defaultRoute = await queryOne<{ name: string; primary_model: string }>(
      c.env.DB,
      `SELECT r.name, m.model_name as primary_model
       FROM ai_routes r
       LEFT JOIN ai_models m ON r.primary_model_id = m.id
       WHERE r.is_default = 1`
    );

    return success(c, {
      providers: providerStats,
      models: modelStats,
      routes: routeStats,
      today_usage: {
        requests: todayUsage?.requests || 0,
        tokens: todayUsage?.tokens || 0,
        cost: todayUsage?.cost || 0,
      },
      default_route: defaultRoute,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch overview';
    return error(c, message, 500);
  }
});

export default overview;
