import { Hono } from 'hono';
import type { HonoEnv } from '../../types';
import { success, error, badRequest, notFound } from '../../lib/response';
import { requireAdmin } from '../../middleware/auth';
import { createAIService } from '../../lib/ai-service';
import { queryOne, queryAll, execute } from '../../lib/d1';
import type { AIProvider, AIModel } from './types';

const providers = new Hono<HonoEnv>();

providers.get('/', requireAdmin, async (c) => {
  try {
    const providers_list = await queryAll<AIProvider>(
      c.env.DB,
      `SELECT * FROM ai_providers ORDER BY display_name ASC`
    );

    return success(c, {
      providers: providers_list,
      total: providers_list.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch providers';
    return error(c, message, 500);
  }
});

providers.get('/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');

  try {
    const provider = await queryOne<AIProvider>(
      c.env.DB,
      `SELECT * FROM ai_providers WHERE id = ?`,
      id
    );

    if (!provider) {
      return notFound(c, `Provider not found: ${id}`);
    }

    const modelsList = await queryAll<AIModel>(
      c.env.DB,
      `SELECT * FROM ai_models WHERE provider_id = ? ORDER BY priority DESC`,
      id
    );

    return success(c, {
      provider,
      models: modelsList,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch provider';
    return error(c, message, 500);
  }
});

providers.post('/', requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { name, display_name, api_base_url, api_key_env } = body as {
    name?: string;
    display_name?: string;
    api_base_url?: string;
    api_key_env?: string;
  };

  if (!name || !display_name) {
    return badRequest(c, 'name and display_name are required');
  }

  const id = `prov_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

  try {
    await execute(
      c.env.DB,
      `INSERT INTO ai_providers (id, name, display_name, api_base_url, api_key_env)
       VALUES (?, ?, ?, ?, ?)`,
      id, name, display_name, api_base_url || null, api_key_env || null
    );

    const provider = await queryOne<AIProvider>(
      c.env.DB,
      `SELECT * FROM ai_providers WHERE id = ?`,
      id
    );

    return success(c, { provider }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create provider';
    if (message.includes('UNIQUE constraint')) {
      return badRequest(c, `Provider with name '${name}' already exists`);
    }
    return error(c, message, 500);
  }
});

providers.put('/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const { display_name, api_base_url, api_key_env, is_enabled } = body as {
    display_name?: string;
    api_base_url?: string;
    api_key_env?: string;
    is_enabled?: boolean;
  };

  try {
    const existing = await queryOne<AIProvider>(
      c.env.DB,
      `SELECT * FROM ai_providers WHERE id = ?`,
      id
    );

    if (!existing) {
      return notFound(c, `Provider not found: ${id}`);
    }

    await execute(
      c.env.DB,
      `UPDATE ai_providers SET
        display_name = COALESCE(?, display_name),
        api_base_url = COALESCE(?, api_base_url),
        api_key_env = COALESCE(?, api_key_env),
        is_enabled = COALESCE(?, is_enabled),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      display_name || null,
      api_base_url !== undefined ? api_base_url : null,
      api_key_env !== undefined ? api_key_env : null,
      is_enabled !== undefined ? (is_enabled ? 1 : 0) : null,
      id
    );

    const provider = await queryOne<AIProvider>(
      c.env.DB,
      `SELECT * FROM ai_providers WHERE id = ?`,
      id
    );

    return success(c, { provider });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update provider';
    return error(c, message, 500);
  }
});

providers.put('/:id/health', requireAdmin, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const { status } = body as { status?: string };

  try {
    const provider = await queryOne<AIProvider>(
      c.env.DB,
      `SELECT * FROM ai_providers WHERE id = ?`,
      id
    );

    if (!provider) {
      return notFound(c, `Provider not found: ${id}`);
    }

    if (status) {
      if (!['healthy', 'degraded', 'down', 'unknown'].includes(status)) {
        return badRequest(c, 'status must be one of: healthy, degraded, down, unknown');
      }

      await execute(
        c.env.DB,
        `UPDATE ai_providers SET
          health_status = ?,
          last_health_check = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        status, id
      );

      return success(c, {
        providerId: id,
        status,
        latencyMs: null,
        error: null,
        checkedAt: new Date().toISOString(),
      });
    }

    const model = await queryOne<AIModel>(
      c.env.DB,
      `SELECT * FROM ai_models WHERE provider_id = ? AND is_enabled = 1 ORDER BY priority ASC, created_at ASC LIMIT 1`,
      id
    );

    let computedStatus: 'healthy' | 'down' | 'unknown' = 'unknown';
    let latencyMs: number | null = null;
    let errorMessage: string | null = null;

    if (model) {
      try {
        const aiService = createAIService(c.env);
        const startedAt = Date.now();
        await aiService.chat([{ role: 'user', content: 'Reply with OK.' }], {
          model: model.model_identifier,
          timeout: 15000,
          maxTokens: 8,
        });
        latencyMs = Date.now() - startedAt;
        computedStatus = 'healthy';
      } catch (err) {
        computedStatus = 'down';
        errorMessage = err instanceof Error ? err.message : 'Health check failed';
      }
    }

    await execute(
      c.env.DB,
      `UPDATE ai_providers SET
        health_status = ?,
        last_health_check = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      computedStatus, id
    );

    return success(c, {
      providerId: id,
      status: computedStatus,
      latencyMs,
      error: errorMessage,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update health status';
    return error(c, message, 500);
  }
});

providers.post('/:id/kill-switch', requireAdmin, async (c) => {
  const id = c.req.param('id');

  try {
    const existing = await queryOne<AIProvider>(
      c.env.DB,
      `SELECT * FROM ai_providers WHERE id = ?`,
      id
    );

    if (!existing) {
      return notFound(c, `Provider not found: ${id}`);
    }

    const enabledCount = await queryOne<{ count: number }>(
      c.env.DB,
      `SELECT COUNT(*) as count FROM ai_providers WHERE is_enabled = 1 AND id != ?`,
      id
    );

    if (!enabledCount || enabledCount.count === 0) {
      return badRequest(c, 'Cannot disable the last enabled provider');
    }

    await execute(
      c.env.DB,
      `UPDATE ai_providers SET is_enabled = 0, health_status = 'down', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      id
    );

    await c.env.KV.delete('config:ai_providers');

    return success(c, { killed: true, id, provider_name: existing.name });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to kill switch provider';
    return error(c, message, 500);
  }
});

providers.post('/:id/enable', requireAdmin, async (c) => {
  const id = c.req.param('id');

  try {
    const existing = await queryOne<AIProvider>(
      c.env.DB,
      `SELECT * FROM ai_providers WHERE id = ?`,
      id
    );

    if (!existing) {
      return notFound(c, `Provider not found: ${id}`);
    }

    await execute(
      c.env.DB,
      `UPDATE ai_providers SET is_enabled = 1, health_status = 'unknown', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      id
    );

    await c.env.KV.delete('config:ai_providers');

    return success(c, { enabled: true, id, provider_name: existing.name });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to enable provider';
    return error(c, message, 500);
  }
});

providers.delete('/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');

  try {
    const existing = await queryOne<AIProvider>(
      c.env.DB,
      `SELECT * FROM ai_providers WHERE id = ?`,
      id
    );

    if (!existing) {
      return notFound(c, `Provider not found: ${id}`);
    }

    await execute(c.env.DB, `DELETE FROM ai_providers WHERE id = ?`, id);

    return success(c, { deleted: true, id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete provider';
    return error(c, message, 500);
  }
});

export default providers;
