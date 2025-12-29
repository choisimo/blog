/**
 * Admin AI Configuration Routes
 *
 * AI 모델, Provider, 라우팅 설정을 관리하는 Admin 전용 API입니다.
 * D1 데이터베이스의 ai_providers, ai_models, ai_routes 테이블을 관리합니다.
 *
 * 모든 엔드포인트는 admin 권한이 필요합니다.
 */

import { Hono } from 'hono';
import type { Env } from '../types';
import { success, error, badRequest, notFound } from '../lib/response';
import { requireAdmin } from '../middleware/auth';

const adminAi = new Hono<{ Bindings: Env }>();

// ============================================================================
// Types
// ============================================================================

interface AIProvider {
  id: string;
  name: string;
  display_name: string;
  api_base_url: string | null;
  api_key_env: string | null;
  is_enabled: number;
  health_status: string;
  last_health_check: string | null;
  created_at: string;
  updated_at: string;
}

interface AIModel {
  id: string;
  provider_id: string;
  model_name: string;
  display_name: string;
  litellm_model: string;
  description: string | null;
  context_window: number | null;
  max_tokens: number | null;
  input_cost_per_1k: number | null;
  output_cost_per_1k: number | null;
  supports_vision: number;
  supports_streaming: number;
  supports_function_calling: number;
  is_enabled: number;
  priority: number;
  created_at: string;
  updated_at: string;
}

interface AIRoute {
  id: string;
  name: string;
  description: string | null;
  routing_strategy: string;
  primary_model_id: string | null;
  fallback_model_ids: string | null;
  context_window_fallback_ids: string | null;
  num_retries: number;
  timeout_seconds: number;
  is_default: number;
  is_enabled: number;
  created_at: string;
  updated_at: string;
}

interface AIUsageLog {
  id: string;
  model_id: string | null;
  route_id: string | null;
  request_type: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  estimated_cost: number | null;
  latency_ms: number | null;
  status: string | null;
  error_message: string | null;
  user_id: string | null;
  metadata: string | null;
  created_at: string;
}

interface AIUsageDaily {
  date: string;
  model_id: string;
  total_requests: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  total_cost: number;
  success_count: number;
  error_count: number;
  avg_latency_ms: number | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================================
// Provider Endpoints
// ============================================================================

/**
 * GET /admin/ai/providers
 * 모든 AI Provider 목록 조회
 */
adminAi.get('/providers', requireAdmin, async (c) => {
  try {
    const result = await c.env.DB.prepare(
      `SELECT * FROM ai_providers ORDER BY display_name ASC`
    ).all<AIProvider>();

    return success(c, {
      providers: result.results || [],
      total: result.results?.length || 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch providers';
    return error(c, message, 500);
  }
});

/**
 * GET /admin/ai/providers/:id
 * 특정 Provider 조회
 */
adminAi.get('/providers/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');

  try {
    const provider = await c.env.DB.prepare(
      `SELECT * FROM ai_providers WHERE id = ?`
    )
      .bind(id)
      .first<AIProvider>();

    if (!provider) {
      return notFound(c, `Provider not found: ${id}`);
    }

    // Get models for this provider
    const models = await c.env.DB.prepare(
      `SELECT * FROM ai_models WHERE provider_id = ? ORDER BY priority DESC`
    )
      .bind(id)
      .all<AIModel>();

    return success(c, {
      provider,
      models: models.results || [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch provider';
    return error(c, message, 500);
  }
});

/**
 * POST /admin/ai/providers
 * 새 Provider 생성
 */
adminAi.post('/providers', requireAdmin, async (c) => {
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
    await c.env.DB.prepare(
      `INSERT INTO ai_providers (id, name, display_name, api_base_url, api_key_env)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(id, name, display_name, api_base_url || null, api_key_env || null)
      .run();

    const provider = await c.env.DB.prepare(
      `SELECT * FROM ai_providers WHERE id = ?`
    )
      .bind(id)
      .first<AIProvider>();

    return success(c, { provider }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create provider';
    if (message.includes('UNIQUE constraint')) {
      return badRequest(c, `Provider with name '${name}' already exists`);
    }
    return error(c, message, 500);
  }
});

/**
 * PUT /admin/ai/providers/:id
 * Provider 업데이트
 */
adminAi.put('/providers/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const { display_name, api_base_url, api_key_env, is_enabled } = body as {
    display_name?: string;
    api_base_url?: string;
    api_key_env?: string;
    is_enabled?: boolean;
  };

  try {
    const existing = await c.env.DB.prepare(
      `SELECT * FROM ai_providers WHERE id = ?`
    )
      .bind(id)
      .first<AIProvider>();

    if (!existing) {
      return notFound(c, `Provider not found: ${id}`);
    }

    await c.env.DB.prepare(
      `UPDATE ai_providers SET
        display_name = COALESCE(?, display_name),
        api_base_url = COALESCE(?, api_base_url),
        api_key_env = COALESCE(?, api_key_env),
        is_enabled = COALESCE(?, is_enabled),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
      .bind(
        display_name || null,
        api_base_url !== undefined ? api_base_url : null,
        api_key_env !== undefined ? api_key_env : null,
        is_enabled !== undefined ? (is_enabled ? 1 : 0) : null,
        id
      )
      .run();

    const provider = await c.env.DB.prepare(
      `SELECT * FROM ai_providers WHERE id = ?`
    )
      .bind(id)
      .first<AIProvider>();

    return success(c, { provider });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update provider';
    return error(c, message, 500);
  }
});

/**
 * PUT /admin/ai/providers/:id/health
 * Provider 헬스 상태 업데이트 (외부 호출 결과 저장)
 */
adminAi.put('/providers/:id/health', requireAdmin, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const { status } = body as { status?: string };

  if (!status || !['healthy', 'degraded', 'down', 'unknown'].includes(status)) {
    return badRequest(c, 'status must be one of: healthy, degraded, down, unknown');
  }

  try {
    await c.env.DB.prepare(
      `UPDATE ai_providers SET
        health_status = ?,
        last_health_check = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
      .bind(status, id)
      .run();

    return success(c, { id, health_status: status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update health status';
    return error(c, message, 500);
  }
});

/**
 * DELETE /admin/ai/providers/:id
 * Provider 삭제 (연관 모델도 삭제됨)
 */
adminAi.delete('/providers/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');

  try {
    const existing = await c.env.DB.prepare(
      `SELECT * FROM ai_providers WHERE id = ?`
    )
      .bind(id)
      .first<AIProvider>();

    if (!existing) {
      return notFound(c, `Provider not found: ${id}`);
    }

    await c.env.DB.prepare(`DELETE FROM ai_providers WHERE id = ?`).bind(id).run();

    return success(c, { deleted: true, id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete provider';
    return error(c, message, 500);
  }
});

// ============================================================================
// Model Endpoints
// ============================================================================

/**
 * GET /admin/ai/models
 * 모든 AI 모델 목록 조회
 */
adminAi.get('/models', requireAdmin, async (c) => {
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

    const stmt = c.env.DB.prepare(query);
    const result = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();

    return success(c, {
      models: result.results || [],
      total: result.results?.length || 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch models';
    return error(c, message, 500);
  }
});

/**
 * GET /admin/ai/models/:id
 * 특정 모델 조회
 */
adminAi.get('/models/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');

  try {
    const model = await c.env.DB.prepare(
      `SELECT m.*, p.name as provider_name, p.display_name as provider_display_name
       FROM ai_models m
       JOIN ai_providers p ON m.provider_id = p.id
       WHERE m.id = ?`
    )
      .bind(id)
      .first();

    if (!model) {
      return notFound(c, `Model not found: ${id}`);
    }

    return success(c, { model });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch model';
    return error(c, message, 500);
  }
});

/**
 * POST /admin/ai/models
 * 새 모델 생성
 */
adminAi.post('/models', requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const {
    provider_id,
    model_name,
    display_name,
    litellm_model,
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
    litellm_model?: string;
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

  if (!provider_id || !model_name || !display_name || !litellm_model) {
    return badRequest(c, 'provider_id, model_name, display_name, and litellm_model are required');
  }

  const id = generateId('model');

  try {
    // Verify provider exists
    const provider = await c.env.DB.prepare(
      `SELECT id FROM ai_providers WHERE id = ?`
    )
      .bind(provider_id)
      .first();

    if (!provider) {
      return badRequest(c, `Provider not found: ${provider_id}`);
    }

    await c.env.DB.prepare(
      `INSERT INTO ai_models (
        id, provider_id, model_name, display_name, litellm_model,
        description, context_window, max_tokens, input_cost_per_1k, output_cost_per_1k,
        supports_vision, supports_streaming, supports_function_calling, priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        provider_id,
        model_name,
        display_name,
        litellm_model,
        description || null,
        context_window || null,
        max_tokens || null,
        input_cost_per_1k || null,
        output_cost_per_1k || null,
        supports_vision ? 1 : 0,
        supports_streaming !== false ? 1 : 0, // default true
        supports_function_calling ? 1 : 0,
        priority || 0
      )
      .run();

    const model = await c.env.DB.prepare(`SELECT * FROM ai_models WHERE id = ?`)
      .bind(id)
      .first<AIModel>();

    return success(c, { model }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create model';
    if (message.includes('UNIQUE constraint')) {
      return badRequest(c, `Model with name '${model_name}' already exists`);
    }
    return error(c, message, 500);
  }
});

/**
 * PUT /admin/ai/models/:id
 * 모델 업데이트
 */
adminAi.put('/models/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  try {
    const existing = await c.env.DB.prepare(`SELECT * FROM ai_models WHERE id = ?`)
      .bind(id)
      .first<AIModel>();

    if (!existing) {
      return notFound(c, `Model not found: ${id}`);
    }

    const {
      display_name,
      litellm_model,
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
      litellm_model: string;
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

    // Build dynamic update query
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (display_name !== undefined) {
      updates.push('display_name = ?');
      values.push(display_name);
    }
    if (litellm_model !== undefined) {
      updates.push('litellm_model = ?');
      values.push(litellm_model);
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

    await c.env.DB.prepare(
      `UPDATE ai_models SET ${updates.join(', ')} WHERE id = ?`
    )
      .bind(...values)
      .run();

    const model = await c.env.DB.prepare(`SELECT * FROM ai_models WHERE id = ?`)
      .bind(id)
      .first<AIModel>();

    return success(c, { model });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update model';
    return error(c, message, 500);
  }
});

/**
 * DELETE /admin/ai/models/:id
 * 모델 삭제
 */
adminAi.delete('/models/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');

  try {
    const existing = await c.env.DB.prepare(`SELECT * FROM ai_models WHERE id = ?`)
      .bind(id)
      .first<AIModel>();

    if (!existing) {
      return notFound(c, `Model not found: ${id}`);
    }

    await c.env.DB.prepare(`DELETE FROM ai_models WHERE id = ?`).bind(id).run();

    return success(c, { deleted: true, id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete model';
    return error(c, message, 500);
  }
});

// ============================================================================
// Route Endpoints
// ============================================================================

/**
 * GET /admin/ai/routes
 * 모든 라우팅 규칙 목록
 */
adminAi.get('/routes', requireAdmin, async (c) => {
  try {
    const result = await c.env.DB.prepare(
      `SELECT r.*, m.model_name as primary_model_name, m.display_name as primary_model_display_name
       FROM ai_routes r
       LEFT JOIN ai_models m ON r.primary_model_id = m.id
       ORDER BY r.is_default DESC, r.name ASC`
    ).all();

    return success(c, {
      routes: result.results || [],
      total: result.results?.length || 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch routes';
    return error(c, message, 500);
  }
});

/**
 * GET /admin/ai/routes/:id
 * 특정 라우팅 규칙 조회
 */
adminAi.get('/routes/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');

  try {
    const route = await c.env.DB.prepare(
      `SELECT r.*, m.model_name as primary_model_name
       FROM ai_routes r
       LEFT JOIN ai_models m ON r.primary_model_id = m.id
       WHERE r.id = ?`
    )
      .bind(id)
      .first();

    if (!route) {
      return notFound(c, `Route not found: ${id}`);
    }

    return success(c, { route });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch route';
    return error(c, message, 500);
  }
});

/**
 * POST /admin/ai/routes
 * 새 라우팅 규칙 생성
 */
adminAi.post('/routes', requireAdmin, async (c) => {
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
    // If setting as default, unset other defaults
    if (is_default) {
      await c.env.DB.prepare(
        `UPDATE ai_routes SET is_default = 0, updated_at = CURRENT_TIMESTAMP WHERE is_default = 1`
      ).run();
    }

    await c.env.DB.prepare(
      `INSERT INTO ai_routes (
        id, name, description, routing_strategy, primary_model_id,
        fallback_model_ids, context_window_fallback_ids, num_retries, timeout_seconds, is_default
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
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
      )
      .run();

    const route = await c.env.DB.prepare(`SELECT * FROM ai_routes WHERE id = ?`)
      .bind(id)
      .first<AIRoute>();

    return success(c, { route }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create route';
    if (message.includes('UNIQUE constraint')) {
      return badRequest(c, `Route with name '${name}' already exists`);
    }
    return error(c, message, 500);
  }
});

/**
 * PUT /admin/ai/routes/:id
 * 라우팅 규칙 업데이트
 */
adminAi.put('/routes/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  try {
    const existing = await c.env.DB.prepare(`SELECT * FROM ai_routes WHERE id = ?`)
      .bind(id)
      .first<AIRoute>();

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

    // If setting as default, unset other defaults
    if (is_default) {
      await c.env.DB.prepare(
        `UPDATE ai_routes SET is_default = 0, updated_at = CURRENT_TIMESTAMP WHERE is_default = 1 AND id != ?`
      )
        .bind(id)
        .run();
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

    await c.env.DB.prepare(`UPDATE ai_routes SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    const route = await c.env.DB.prepare(`SELECT * FROM ai_routes WHERE id = ?`)
      .bind(id)
      .first<AIRoute>();

    return success(c, { route });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update route';
    return error(c, message, 500);
  }
});

/**
 * DELETE /admin/ai/routes/:id
 * 라우팅 규칙 삭제
 */
adminAi.delete('/routes/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');

  try {
    const existing = await c.env.DB.prepare(`SELECT * FROM ai_routes WHERE id = ?`)
      .bind(id)
      .first<AIRoute>();

    if (!existing) {
      return notFound(c, `Route not found: ${id}`);
    }

    if (existing.is_default) {
      return badRequest(c, 'Cannot delete the default route. Set another route as default first.');
    }

    await c.env.DB.prepare(`DELETE FROM ai_routes WHERE id = ?`).bind(id).run();

    return success(c, { deleted: true, id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete route';
    return error(c, message, 500);
  }
});

// ============================================================================
// Usage Endpoints
// ============================================================================

/**
 * GET /admin/ai/usage
 * 사용량 통계 조회
 */
adminAi.get('/usage', requireAdmin, async (c) => {
  const startDate = c.req.query('start_date');
  const endDate = c.req.query('end_date');
  const modelId = c.req.query('model_id');
  const groupBy = c.req.query('group_by') || 'day'; // 'day', 'model'

  try {
    // Default date range: last 7 days
    const end = endDate || new Date().toISOString().split('T')[0];
    const start =
      startDate ||
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Summary stats
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

    const summaryStmt = c.env.DB.prepare(summaryQuery);
    const summary = modelId
      ? await summaryStmt.bind(start, end, modelId).first()
      : await summaryStmt.bind(start, end).first();

    // Breakdown by group
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

    const breakdownStmt = c.env.DB.prepare(breakdownQuery);
    const breakdown =
      groupBy === 'day' && modelId
        ? await breakdownStmt.bind(start, end, modelId).all()
        : await breakdownStmt.bind(start, end).all();

    return success(c, {
      summary: {
        total_requests: summary?.total_requests || 0,
        total_tokens: summary?.total_tokens || 0,
        total_cost: summary?.total_cost || 0,
        avg_latency_ms: summary?.avg_latency_ms || 0,
        success_count: summary?.success_count || 0,
        error_count: summary?.error_count || 0,
      },
      breakdown: breakdown.results || [],
      period: { start, end },
      group_by: groupBy,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch usage';
    return error(c, message, 500);
  }
});

/**
 * POST /admin/ai/usage/log
 * 사용량 로그 기록 (LiteLLM callback에서 호출)
 */
adminAi.post('/usage/log', requireAdmin, async (c) => {
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
    await c.env.DB.prepare(
      `INSERT INTO ai_usage_logs (
        id, model_id, route_id, request_type, prompt_tokens, completion_tokens,
        total_tokens, estimated_cost, latency_ms, status, error_message, user_id, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
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
      )
      .run();

    // Update daily aggregates
    const today = new Date().toISOString().split('T')[0];
    if (model_id) {
      await c.env.DB.prepare(
        `INSERT INTO ai_usage_daily (date, model_id, total_requests, total_prompt_tokens, total_completion_tokens, total_tokens, total_cost, success_count, error_count)
         VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(date, model_id) DO UPDATE SET
           total_requests = total_requests + 1,
           total_prompt_tokens = total_prompt_tokens + excluded.total_prompt_tokens,
           total_completion_tokens = total_completion_tokens + excluded.total_completion_tokens,
           total_tokens = total_tokens + excluded.total_tokens,
           total_cost = total_cost + excluded.total_cost,
           success_count = success_count + excluded.success_count,
           error_count = error_count + excluded.error_count`
      )
        .bind(
          today,
          model_id,
          prompt_tokens || 0,
          completion_tokens || 0,
          total_tokens || 0,
          estimated_cost || 0,
          status === 'success' ? 1 : 0,
          status === 'error' ? 1 : 0
        )
        .run();
    }

    return success(c, { logged: true, id }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to log usage';
    return error(c, message, 500);
  }
});

// ============================================================================
// Config Generation Endpoint
// ============================================================================

/**
 * GET /admin/ai/config/litellm
 * DB 설정을 기반으로 LiteLLM YAML 설정 생성
 */
adminAi.get('/config/litellm', requireAdmin, async (c) => {
  try {
    // Get all enabled models with their providers
    const models = await c.env.DB.prepare(
      `SELECT m.*, p.name as provider_name, p.api_base_url, p.api_key_env
       FROM ai_models m
       JOIN ai_providers p ON m.provider_id = p.id
       WHERE m.is_enabled = 1 AND p.is_enabled = 1
       ORDER BY m.priority DESC`
    ).all<AIModel & { provider_name: string; api_base_url: string | null; api_key_env: string | null }>();

    // Get default route
    const defaultRoute = await c.env.DB.prepare(
      `SELECT * FROM ai_routes WHERE is_default = 1 AND is_enabled = 1`
    ).first<AIRoute>();

    // Get all enabled routes for fallback config
    const routes = await c.env.DB.prepare(
      `SELECT * FROM ai_routes WHERE is_enabled = 1`
    ).all<AIRoute>();

    // Build model_list
    const modelList = (models.results || []).map((m) => {
      const entry: Record<string, unknown> = {
        model_name: m.model_name,
        litellm_params: {
          model: m.litellm_model,
        },
        model_info: {
          description: m.description || m.display_name,
        },
      };

      // Add api_key reference if provider has one
      if (m.api_key_env) {
        (entry.litellm_params as Record<string, unknown>).api_key = `os.environ/${m.api_key_env}`;
      }

      // Add api_base if provider has one (for Ollama, etc)
      if (m.api_base_url) {
        (entry.litellm_params as Record<string, unknown>).api_base = m.api_base_url;
      }

      return entry;
    });

    // Build fallbacks from routes
    const fallbacks: Record<string, string[]>[] = [];
    for (const route of routes.results || []) {
      if (route.fallback_model_ids) {
        const primaryModel = await c.env.DB.prepare(
          `SELECT model_name FROM ai_models WHERE id = ?`
        )
          .bind(route.primary_model_id)
          .first<{ model_name: string }>();

        const fallbackIds = JSON.parse(route.fallback_model_ids) as string[];
        const fallbackModels = await c.env.DB.prepare(
          `SELECT model_name FROM ai_models WHERE id IN (${fallbackIds.map(() => '?').join(',')})`
        )
          .bind(...fallbackIds)
          .all<{ model_name: string }>();

        if (primaryModel && fallbackModels.results?.length) {
          fallbacks.push({
            [primaryModel.model_name]: fallbackModels.results.map((m) => m.model_name),
          });
        }
      }
    }

    // Build context_window_fallbacks
    const contextFallbacks: Record<string, string[]>[] = [];
    for (const route of routes.results || []) {
      if (route.context_window_fallback_ids) {
        const primaryModel = await c.env.DB.prepare(
          `SELECT model_name FROM ai_models WHERE id = ?`
        )
          .bind(route.primary_model_id)
          .first<{ model_name: string }>();

        const fallbackIds = JSON.parse(route.context_window_fallback_ids) as string[];
        const fallbackModels = await c.env.DB.prepare(
          `SELECT model_name FROM ai_models WHERE id IN (${fallbackIds.map(() => '?').join(',')})`
        )
          .bind(...fallbackIds)
          .all<{ model_name: string }>();

        if (primaryModel && fallbackModels.results?.length) {
          contextFallbacks.push({
            [primaryModel.model_name]: fallbackModels.results.map((m) => m.model_name),
          });
        }
      }
    }

    // Build final config
    const config = {
      model_list: modelList,
      router_settings: {
        routing_strategy: defaultRoute?.routing_strategy || 'latency-based-routing',
        num_retries: defaultRoute?.num_retries || 3,
        timeout: defaultRoute?.timeout_seconds || 120,
        ...(fallbacks.length > 0 && { fallbacks }),
        ...(contextFallbacks.length > 0 && { context_window_fallbacks: contextFallbacks }),
        allowed_fails: 3,
        cooldown_time: 60,
      },
      litellm_settings: {
        set_verbose: false,
        drop_params: true,
        request_timeout: defaultRoute?.timeout_seconds || 120,
        cache: false,
        success_callback: [],
        failure_callback: [],
        supports_function_calling: true,
        supports_tool_choice: true,
      },
      general_settings: {
        master_key: 'os.environ/LITELLM_MASTER_KEY',
        database_connection_pool_limit: 0,
        disable_spend_logs: true,
      },
    };

    // Return as JSON (caller can convert to YAML if needed)
    return success(c, {
      config,
      generated_at: new Date().toISOString(),
      model_count: modelList.length,
      route_count: routes.results?.length || 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate config';
    return error(c, message, 500);
  }
});

/**
 * GET /admin/ai/overview
 * Dashboard overview - 전체 현황 요약
 */
adminAi.get('/overview', requireAdmin, async (c) => {
  try {
    // Provider stats
    const providerStats = await c.env.DB.prepare(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_enabled = 1 THEN 1 ELSE 0 END) as enabled,
        SUM(CASE WHEN health_status = 'healthy' THEN 1 ELSE 0 END) as healthy,
        SUM(CASE WHEN health_status = 'degraded' THEN 1 ELSE 0 END) as degraded,
        SUM(CASE WHEN health_status = 'down' THEN 1 ELSE 0 END) as down
       FROM ai_providers`
    ).first();

    // Model stats
    const modelStats = await c.env.DB.prepare(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_enabled = 1 THEN 1 ELSE 0 END) as enabled,
        SUM(CASE WHEN supports_vision = 1 THEN 1 ELSE 0 END) as vision_capable,
        SUM(CASE WHEN supports_function_calling = 1 THEN 1 ELSE 0 END) as function_calling_capable
       FROM ai_models`
    ).first();

    // Route stats
    const routeStats = await c.env.DB.prepare(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_enabled = 1 THEN 1 ELSE 0 END) as enabled
       FROM ai_routes`
    ).first();

    // Today's usage
    const today = new Date().toISOString().split('T')[0];
    const todayUsage = await c.env.DB.prepare(
      `SELECT 
        SUM(total_requests) as requests,
        SUM(total_tokens) as tokens,
        SUM(total_cost) as cost
       FROM ai_usage_daily WHERE date = ?`
    )
      .bind(today)
      .first();

    // Default route info
    const defaultRoute = await c.env.DB.prepare(
      `SELECT r.name, m.model_name as primary_model
       FROM ai_routes r
       LEFT JOIN ai_models m ON r.primary_model_id = m.id
       WHERE r.is_default = 1`
    ).first();

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

export default adminAi;
