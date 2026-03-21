import { Hono } from 'hono';
import type { HonoEnv } from '../../types';
import { success, error, badRequest, notFound } from '../../lib/response';
import { requireAdmin } from '../../middleware/auth';
import { queryOne, queryAll, execute } from '../../lib/d1';
import { generateId } from './types';
import type { AIRoute } from './types';

const routes = new Hono<HonoEnv>();

routes.get('/', requireAdmin, async (c) => {
  try {
    const routesList = await queryAll(
      c.env.DB,
      `SELECT r.*, m.model_name as primary_model_name, m.display_name as primary_model_display_name
       FROM ai_routes r
       LEFT JOIN ai_models m ON r.primary_model_id = m.id
       ORDER BY r.is_default DESC, r.name ASC`
    );

    return success(c, {
      routes: routesList,
      total: routesList.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch routes';
    return error(c, message, 500);
  }
});

routes.get('/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');

  try {
    const route = await queryOne(
      c.env.DB,
      `SELECT r.*, m.model_name as primary_model_name
       FROM ai_routes r
       LEFT JOIN ai_models m ON r.primary_model_id = m.id
       WHERE r.id = ?`,
      id
    );

    if (!route) {
      return notFound(c, `Route not found: ${id}`);
    }

    return success(c, { route });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch route';
    return error(c, message, 500);
  }
});

routes.post('/', requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const {
    name,
    description,
    routing_strategy,
    primary_model_id,
    fallback_model_ids,
    context_window_fallback_ids,
    num_retries,
    timeout_seconds,
    is_default,
  } = body as {
    name?: string;
    description?: string;
    routing_strategy?: string;
    primary_model_id?: string;
    fallback_model_ids?: string[];
    context_window_fallback_ids?: string[];
    num_retries?: number;
    timeout_seconds?: number;
    is_default?: boolean;
  };

  if (!name) {
    return badRequest(c, 'name is required');
  }

  const id = generateId('route');

  try {
    if (is_default) {
      await execute(
        c.env.DB,
        `UPDATE ai_routes SET is_default = 0, updated_at = CURRENT_TIMESTAMP WHERE is_default = 1`
      );
    }

    await execute(
      c.env.DB,
      `INSERT INTO ai_routes (
        id, name, description, routing_strategy, primary_model_id,
        fallback_model_ids, context_window_fallback_ids, num_retries, timeout_seconds, is_default
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      name,
      description || null,
      routing_strategy || 'latency-based-routing',
      primary_model_id || null,
      fallback_model_ids ? JSON.stringify(fallback_model_ids) : null,
      context_window_fallback_ids ? JSON.stringify(context_window_fallback_ids) : null,
      num_retries ?? 3,
      timeout_seconds ?? 120,
      is_default ? 1 : 0
    );

    const route = await queryOne<AIRoute>(
      c.env.DB,
      `SELECT * FROM ai_routes WHERE id = ?`,
      id
    );

    return success(c, { route }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create route';
    if (message.includes('UNIQUE constraint')) {
      return badRequest(c, `Route with name '${name}' already exists`);
    }
    return error(c, message, 500);
  }
});

routes.put('/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  try {
    const existing = await queryOne<AIRoute>(
      c.env.DB,
      `SELECT * FROM ai_routes WHERE id = ?`,
      id
    );

    if (!existing) {
      return notFound(c, `Route not found: ${id}`);
    }

    const {
      name,
      description,
      routing_strategy,
      primary_model_id,
      fallback_model_ids,
      context_window_fallback_ids,
      num_retries,
      timeout_seconds,
      is_default,
      is_enabled,
    } = body as Partial<{
      name: string;
      description: string;
      routing_strategy: string;
      primary_model_id: string;
      fallback_model_ids: string[];
      context_window_fallback_ids: string[];
      num_retries: number;
      timeout_seconds: number;
      is_default: boolean;
      is_enabled: boolean;
    }>;

    if (is_default) {
      await execute(
        c.env.DB,
        `UPDATE ai_routes SET is_default = 0, updated_at = CURRENT_TIMESTAMP WHERE is_default = 1 AND id != ?`,
        id
      );
    }

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description || null);
    }
    if (routing_strategy !== undefined) {
      updates.push('routing_strategy = ?');
      values.push(routing_strategy);
    }
    if (primary_model_id !== undefined) {
      updates.push('primary_model_id = ?');
      values.push(primary_model_id || null);
    }
    if (fallback_model_ids !== undefined) {
      updates.push('fallback_model_ids = ?');
      values.push(JSON.stringify(fallback_model_ids));
    }
    if (context_window_fallback_ids !== undefined) {
      updates.push('context_window_fallback_ids = ?');
      values.push(JSON.stringify(context_window_fallback_ids));
    }
    if (num_retries !== undefined) {
      updates.push('num_retries = ?');
      values.push(num_retries);
    }
    if (timeout_seconds !== undefined) {
      updates.push('timeout_seconds = ?');
      values.push(timeout_seconds);
    }
    if (is_default !== undefined) {
      updates.push('is_default = ?');
      values.push(is_default ? 1 : 0);
    }
    if (is_enabled !== undefined) {
      updates.push('is_enabled = ?');
      values.push(is_enabled ? 1 : 0);
    }

    if (updates.length === 0) {
      return badRequest(c, 'No fields to update');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await execute(
      c.env.DB,
      `UPDATE ai_routes SET ${updates.join(', ')} WHERE id = ?`,
      ...values
    );

    const route = await queryOne<AIRoute>(
      c.env.DB,
      `SELECT * FROM ai_routes WHERE id = ?`,
      id
    );

    return success(c, { route });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update route';
    return error(c, message, 500);
  }
});

routes.delete('/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');

  try {
    const existing = await queryOne<AIRoute>(
      c.env.DB,
      `SELECT * FROM ai_routes WHERE id = ?`,
      id
    );

    if (!existing) {
      return notFound(c, `Route not found: ${id}`);
    }

    if (existing.is_default) {
      return badRequest(c, 'Cannot delete the default route. Set another route as default first.');
    }

    await execute(c.env.DB, `DELETE FROM ai_routes WHERE id = ?`, id);

    return success(c, { deleted: true, id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete route';
    return error(c, message, 500);
  }
});

export default routes;
