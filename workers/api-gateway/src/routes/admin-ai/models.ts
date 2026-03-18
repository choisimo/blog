import { Hono } from 'hono';
import type { HonoEnv } from '../../types';
import { success, error, badRequest, notFound } from '../../lib/response';
import { requireAdmin } from '../../middleware/auth';
import { queryOne, queryAll, execute } from '../../lib/d1';
import { generateId } from './types';
import type { AIModel } from './types';

const models = new Hono<HonoEnv>();

models.get('/', requireAdmin, async (c) => {
  const providerId = c.req.query('provider_id');
  const enabledOnly = c.req.query('enabled') === 'true';

  try {
    let query = `
      SELECT m.*, p.name as provider_name, p.display_name as provider_display_name
      FROM ai_models m
      JOIN ai_providers p ON m.provider_id = p.id
    `;
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (providerId) {
      conditions.push('m.provider_id = ?');
      params.push(providerId);
    }

    if (enabledOnly) {
      conditions.push('m.is_enabled = 1');
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY m.priority DESC, m.display_name ASC';

    const modelsList = await queryAll(c.env.DB, query, ...params);

    return success(c, {
      models: modelsList,
      total: modelsList.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch models';
    return error(c, message, 500);
  }
});

models.get('/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');

  try {
    const model = await queryOne(
      c.env.DB,
      `SELECT m.*, p.name as provider_name, p.display_name as provider_display_name
       FROM ai_models m
       JOIN ai_providers p ON m.provider_id = p.id
       WHERE m.id = ?`,
      id
    );

    if (!model) {
      return notFound(c, `Model not found: ${id}`);
    }

    return success(c, { model });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch model';
    return error(c, message, 500);
  }
});

models.post('/', requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const {
    provider_id,
    model_name,
    display_name,
    model_identifier,
    description,
    context_window,
    max_tokens,
    input_cost_per_1k,
    output_cost_per_1k,
    supports_vision,
    supports_streaming,
    supports_function_calling,
    priority,
  } = body as {
    provider_id?: string;
    model_name?: string;
    display_name?: string;
    model_identifier?: string;
    description?: string;
    context_window?: number;
    max_tokens?: number;
    input_cost_per_1k?: number;
    output_cost_per_1k?: number;
    supports_vision?: boolean;
    supports_streaming?: boolean;
    supports_function_calling?: boolean;
    priority?: number;
  };

  if (!provider_id || !model_name || !display_name || !model_identifier) {
    return badRequest(
      c,
      'provider_id, model_name, display_name, and model_identifier are required'
    );
  }

  const id = generateId('model');

  try {
    const provider = await queryOne(
      c.env.DB,
      `SELECT id FROM ai_providers WHERE id = ?`,
      provider_id
    );

    if (!provider) {
      return badRequest(c, `Provider not found: ${provider_id}`);
    }

    await execute(
      c.env.DB,
      `INSERT INTO ai_models (
        id, provider_id, model_name, display_name, model_identifier,
        description, context_window, max_tokens, input_cost_per_1k, output_cost_per_1k,
        supports_vision, supports_streaming, supports_function_calling, priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      provider_id,
      model_name,
      display_name,
      model_identifier,
      description || null,
      context_window || null,
      max_tokens || null,
      input_cost_per_1k || null,
      output_cost_per_1k || null,
      supports_vision ? 1 : 0,
      supports_streaming !== false ? 1 : 0,
      supports_function_calling ? 1 : 0,
      priority || 0
    );

    const model = await queryOne<AIModel>(
      c.env.DB,
      `SELECT * FROM ai_models WHERE id = ?`,
      id
    );

    return success(c, { model }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create model';
    if (message.includes('UNIQUE constraint')) {
      return badRequest(c, `Model with name '${model_name}' already exists`);
    }
    return error(c, message, 500);
  }
});

models.put('/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  try {
    const existing = await queryOne<AIModel>(
      c.env.DB,
      `SELECT * FROM ai_models WHERE id = ?`,
      id
    );

    if (!existing) {
      return notFound(c, `Model not found: ${id}`);
    }

    const {
      display_name,
      model_identifier,
      description,
      context_window,
      max_tokens,
      input_cost_per_1k,
      output_cost_per_1k,
      supports_vision,
      supports_streaming,
      supports_function_calling,
      is_enabled,
      priority,
    } = body as Partial<{
      display_name: string;
      model_identifier: string;
      description: string;
      context_window: number;
      max_tokens: number;
      input_cost_per_1k: number;
      output_cost_per_1k: number;
      supports_vision: boolean;
      supports_streaming: boolean;
      supports_function_calling: boolean;
      is_enabled: boolean;
      priority: number;
    }>;

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (display_name !== undefined) {
      updates.push('display_name = ?');
      values.push(display_name);
    }
    if (model_identifier !== undefined) {
      updates.push('model_identifier = ?');
      values.push(model_identifier);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description || null);
    }
    if (context_window !== undefined) {
      updates.push('context_window = ?');
      values.push(context_window);
    }
    if (max_tokens !== undefined) {
      updates.push('max_tokens = ?');
      values.push(max_tokens);
    }
    if (input_cost_per_1k !== undefined) {
      updates.push('input_cost_per_1k = ?');
      values.push(input_cost_per_1k);
    }
    if (output_cost_per_1k !== undefined) {
      updates.push('output_cost_per_1k = ?');
      values.push(output_cost_per_1k);
    }
    if (supports_vision !== undefined) {
      updates.push('supports_vision = ?');
      values.push(supports_vision ? 1 : 0);
    }
    if (supports_streaming !== undefined) {
      updates.push('supports_streaming = ?');
      values.push(supports_streaming ? 1 : 0);
    }
    if (supports_function_calling !== undefined) {
      updates.push('supports_function_calling = ?');
      values.push(supports_function_calling ? 1 : 0);
    }
    if (is_enabled !== undefined) {
      updates.push('is_enabled = ?');
      values.push(is_enabled ? 1 : 0);
    }
    if (priority !== undefined) {
      updates.push('priority = ?');
      values.push(priority);
    }

    if (updates.length === 0) {
      return badRequest(c, 'No fields to update');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await execute(
      c.env.DB,
      `UPDATE ai_models SET ${updates.join(', ')} WHERE id = ?`,
      ...values
    );

    const model = await queryOne<AIModel>(
      c.env.DB,
      `SELECT * FROM ai_models WHERE id = ?`,
      id
    );

    return success(c, { model });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update model';
    return error(c, message, 500);
  }
});

models.delete('/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');

  try {
    const existing = await queryOne<AIModel>(
      c.env.DB,
      `SELECT * FROM ai_models WHERE id = ?`,
      id
    );

    if (!existing) {
      return notFound(c, `Model not found: ${id}`);
    }

    await execute(c.env.DB, `DELETE FROM ai_models WHERE id = ?`, id);

    return success(c, { deleted: true, id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete model';
    return error(c, message, 500);
  }
});

export default models;
