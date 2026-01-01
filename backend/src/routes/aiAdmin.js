/**
 * AI Admin API Routes
 *
 * Admin endpoints for managing AI providers, models, routes, and usage.
 * All endpoints require admin authentication.
 *
 * Base path: /api/v1/admin/ai
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, execute, isD1Configured } from '../lib/d1.js';
import requireAdmin from '../middleware/adminAuth.js';
import { getN8NClient } from '../lib/n8n-client.js';

const router = Router();

// Apply admin auth to all routes
router.use(requireAdmin);

// ============================================================================
// Helpers
// ============================================================================

const generateId = (prefix) => `${prefix}_${uuidv4().split('-')[0]}`;

const parseJsonField = (field) => {
  if (!field) return null;
  if (typeof field === 'object') return field;
  try {
    return JSON.parse(field);
  } catch {
    return null;
  }
};

// Check D1 middleware
const checkD1 = (req, res, next) => {
  if (!isD1Configured()) {
    return res.status(500).json({
      ok: false,
      error: 'D1 database not configured. Set CF_ACCOUNT_ID, CF_API_TOKEN, D1_DATABASE_ID',
    });
  }
  next();
};

router.use(checkD1);

// ============================================================================
// Providers CRUD
// ============================================================================

/**
 * GET /providers - List all providers
 */
router.get('/providers', async (req, res, next) => {
  try {
    const providers = await queryAll(`
      SELECT 
        p.*,
        (SELECT COUNT(*) FROM ai_models WHERE provider_id = p.id) as model_count,
        (SELECT COUNT(*) FROM ai_models WHERE provider_id = p.id AND is_enabled = 1) as enabled_model_count
      FROM ai_providers p
      ORDER BY p.display_name
    `);

    const formatted = providers.map((p) => ({
      id: p.id,
      name: p.name,
      displayName: p.display_name,
      apiBaseUrl: p.api_base_url,
      apiKeyEnv: p.api_key_env,
      isEnabled: !!p.is_enabled,
      healthStatus: p.health_status,
      lastHealthCheck: p.last_health_check,
      modelCount: p.model_count,
      enabledModelCount: p.enabled_model_count,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));

    res.json({ ok: true, data: { providers: formatted } });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /providers/:id - Get single provider
 */
router.get('/providers/:id', async (req, res, next) => {
  try {
    const provider = await queryOne(
      'SELECT * FROM ai_providers WHERE id = ?',
      req.params.id
    );

    if (!provider) {
      return res.status(404).json({ ok: false, error: 'Provider not found' });
    }

    res.json({
      ok: true,
      data: {
        id: provider.id,
        name: provider.name,
        displayName: provider.display_name,
        apiBaseUrl: provider.api_base_url,
        apiKeyEnv: provider.api_key_env,
        isEnabled: !!provider.is_enabled,
        healthStatus: provider.health_status,
        lastHealthCheck: provider.last_health_check,
        createdAt: provider.created_at,
        updatedAt: provider.updated_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /providers - Create provider
 */
router.post('/providers', async (req, res, next) => {
  try {
    const { name, displayName, apiBaseUrl, apiKeyEnv } = req.body;

    if (!name || !displayName) {
      return res.status(400).json({
        ok: false,
        error: 'name and displayName are required',
      });
    }

    // Check for duplicate name
    const existing = await queryOne(
      'SELECT id FROM ai_providers WHERE name = ?',
      name
    );
    if (existing) {
      return res.status(409).json({
        ok: false,
        error: `Provider with name "${name}" already exists`,
      });
    }

    const id = generateId('prov');
    await execute(
      `INSERT INTO ai_providers (id, name, display_name, api_base_url, api_key_env)
       VALUES (?, ?, ?, ?, ?)`,
      id,
      name,
      displayName,
      apiBaseUrl || null,
      apiKeyEnv || null
    );

    const provider = await queryOne('SELECT * FROM ai_providers WHERE id = ?', id);

    res.status(201).json({
      ok: true,
      data: {
        id: provider.id,
        name: provider.name,
        displayName: provider.display_name,
        apiBaseUrl: provider.api_base_url,
        apiKeyEnv: provider.api_key_env,
        isEnabled: !!provider.is_enabled,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /providers/:id - Update provider
 */
router.put('/providers/:id', async (req, res, next) => {
  try {
    const { displayName, apiBaseUrl, apiKeyEnv, isEnabled } = req.body;

    const existing = await queryOne(
      'SELECT * FROM ai_providers WHERE id = ?',
      req.params.id
    );
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Provider not found' });
    }

    await execute(
      `UPDATE ai_providers 
       SET display_name = ?, api_base_url = ?, api_key_env = ?, is_enabled = ?, updated_at = datetime('now')
       WHERE id = ?`,
      displayName ?? existing.display_name,
      apiBaseUrl !== undefined ? apiBaseUrl : existing.api_base_url,
      apiKeyEnv !== undefined ? apiKeyEnv : existing.api_key_env,
      isEnabled !== undefined ? (isEnabled ? 1 : 0) : existing.is_enabled,
      req.params.id
    );

    const provider = await queryOne(
      'SELECT * FROM ai_providers WHERE id = ?',
      req.params.id
    );

    res.json({
      ok: true,
      data: {
        id: provider.id,
        name: provider.name,
        displayName: provider.display_name,
        apiBaseUrl: provider.api_base_url,
        apiKeyEnv: provider.api_key_env,
        isEnabled: !!provider.is_enabled,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /providers/:id - Delete provider
 */
router.delete('/providers/:id', async (req, res, next) => {
  try {
    const existing = await queryOne(
      'SELECT * FROM ai_providers WHERE id = ?',
      req.params.id
    );
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Provider not found' });
    }

    // Check if has models
    const modelCount = await queryOne(
      'SELECT COUNT(*) as count FROM ai_models WHERE provider_id = ?',
      req.params.id
    );
    if (modelCount?.count > 0) {
      return res.status(400).json({
        ok: false,
        error: `Cannot delete provider with ${modelCount.count} models. Delete models first.`,
      });
    }

    await execute('DELETE FROM ai_providers WHERE id = ?', req.params.id);

    res.json({ ok: true, data: { deleted: req.params.id } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /providers/:id/health - Check provider health
 */
router.post('/providers/:id/health', async (req, res, next) => {
  try {
    const provider = await queryOne(
      'SELECT * FROM ai_providers WHERE id = ?',
      req.params.id
    );
    if (!provider) {
      return res.status(404).json({ ok: false, error: 'Provider not found' });
    }

    // Get first enabled model for this provider
    const model = await queryOne(
      'SELECT * FROM ai_models WHERE provider_id = ? AND is_enabled = 1 LIMIT 1',
      req.params.id
    );

    let healthStatus = 'unknown';
    let latencyMs = null;
    let error = null;

    if (model) {
      try {
        const client = getN8NClient();
        const start = Date.now();
        await client.chat(
          [{ role: 'user', content: 'Hello' }],
          { model: model.model_name, timeout: 10000 }
        );
        latencyMs = Date.now() - start;
        healthStatus = 'healthy';
      } catch (err) {
        healthStatus = 'down';
        error = err.message;
      }
    }

    // Update provider health status
    await execute(
      `UPDATE ai_providers 
       SET health_status = ?, last_health_check = datetime('now'), updated_at = datetime('now')
       WHERE id = ?`,
      healthStatus,
      req.params.id
    );

    res.json({
      ok: true,
      data: {
        providerId: req.params.id,
        status: healthStatus,
        latencyMs,
        error,
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Models CRUD
// ============================================================================

/**
 * GET /models - List all models
 */
router.get('/models', async (req, res, next) => {
  try {
    const { providerId, enabled } = req.query;

    let sql = `
      SELECT 
        m.*,
        p.name as provider_name,
        p.display_name as provider_display_name,
        p.is_enabled as provider_enabled
      FROM ai_models m
      JOIN ai_providers p ON m.provider_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (providerId) {
      sql += ' AND m.provider_id = ?';
      params.push(providerId);
    }
    if (enabled !== undefined) {
      sql += ' AND m.is_enabled = ?';
      params.push(enabled === 'true' || enabled === '1' ? 1 : 0);
    }

    sql += ' ORDER BY m.priority DESC, m.display_name';

    const models = await queryAll(sql, ...params);

    const formatted = models.map((m) => ({
      id: m.id,
      modelName: m.model_name,
      displayName: m.display_name,
      n8nModel: m.litellm_model, // DB column name kept for compatibility
      description: m.description,
      provider: {
        id: m.provider_id,
        name: m.provider_name,
        displayName: m.provider_display_name,
        isEnabled: !!m.provider_enabled,
      },
      contextWindow: m.context_window,
      maxTokens: m.max_tokens,
      cost: {
        inputPer1k: m.input_cost_per_1k,
        outputPer1k: m.output_cost_per_1k,
      },
      capabilities: {
        vision: !!m.supports_vision,
        streaming: !!m.supports_streaming,
        functionCalling: !!m.supports_function_calling,
      },
      isEnabled: !!m.is_enabled,
      priority: m.priority,
      createdAt: m.created_at,
      updatedAt: m.updated_at,
    }));

    res.json({ ok: true, data: { models: formatted } });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /models/:id - Get single model
 */
router.get('/models/:id', async (req, res, next) => {
  try {
    const model = await queryOne(
      `SELECT m.*, p.name as provider_name, p.display_name as provider_display_name
       FROM ai_models m
       JOIN ai_providers p ON m.provider_id = p.id
       WHERE m.id = ?`,
      req.params.id
    );

    if (!model) {
      return res.status(404).json({ ok: false, error: 'Model not found' });
    }

    res.json({
      ok: true,
      data: {
        model: {
          id: model.id,
          modelName: model.model_name,
          displayName: model.display_name,
          n8nModel: model.litellm_model, // DB column name kept for compatibility
          description: model.description,
          provider: {
            id: model.provider_id,
            name: model.provider_name,
            displayName: model.provider_display_name,
          },
          contextWindow: model.context_window,
          maxTokens: model.max_tokens,
          cost: {
            inputPer1k: model.input_cost_per_1k,
            outputPer1k: model.output_cost_per_1k,
          },
          capabilities: {
            vision: !!model.supports_vision,
            streaming: !!model.supports_streaming,
            functionCalling: !!model.supports_function_calling,
          },
          isEnabled: !!model.is_enabled,
          priority: model.priority,
          createdAt: model.created_at,
          updatedAt: model.updated_at,
        },
        contextWindow: model.context_window,
        maxTokens: model.max_tokens,
        cost: {
          inputPer1k: model.input_cost_per_1k,
          outputPer1k: model.output_cost_per_1k,
        },
        capabilities: {
          vision: !!model.supports_vision,
          streaming: !!model.supports_streaming,
          functionCalling: !!model.supports_function_calling,
        },
        isEnabled: !!model.is_enabled,
        priority: model.priority,
        createdAt: model.created_at,
        updatedAt: model.updated_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /models - Create model
 */
router.post('/models', async (req, res, next) => {
  try {
    const {
      modelName,
      displayName,
      providerId,
      n8nModel,
      description,
      contextWindow,
      maxTokens,
      inputCostPer1k,
      outputCostPer1k,
      supportsVision,
      supportsStreaming,
      supportsFunctionCalling,
      priority,
    } = req.body;

    if (!modelName || !displayName || !providerId || !n8nModel) {
      return res.status(400).json({
        ok: false,
        error: 'modelName, displayName, providerId, and n8nModel are required',
      });
    }

    // Check provider exists
    const provider = await queryOne(
      'SELECT id FROM ai_providers WHERE id = ?',
      providerId
    );
    if (!provider) {
      return res.status(400).json({
        ok: false,
        error: `Provider "${providerId}" not found`,
      });
    }

    // Check for duplicate model name
    const existing = await queryOne(
      'SELECT id FROM ai_models WHERE model_name = ?',
      modelName
    );
    if (existing) {
      return res.status(409).json({
        ok: false,
        error: `Model with name "${modelName}" already exists`,
      });
    }

    const id = generateId('model');
    await execute(
      `INSERT INTO ai_models (
        id, provider_id, model_name, display_name, litellm_model, description,
        context_window, max_tokens, input_cost_per_1k, output_cost_per_1k,
        supports_vision, supports_streaming, supports_function_calling, priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      providerId,
      modelName,
      displayName,
      n8nModel,
      description || null,
      contextWindow || null,
      maxTokens || null,
      inputCostPer1k || null,
      outputCostPer1k || null,
      supportsVision ? 1 : 0,
      supportsStreaming !== false ? 1 : 0,
      supportsFunctionCalling ? 1 : 0,
      priority || 0
    );

    const model = await queryOne('SELECT * FROM ai_models WHERE id = ?', id);

    res.status(201).json({
      ok: true,
      data: {
        id: model.id,
        modelName: model.model_name,
        displayName: model.display_name,
        litellmModel: model.litellm_model,
        providerId: model.provider_id,
        isEnabled: !!model.is_enabled,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /models/:id - Update model
 */
router.put('/models/:id', async (req, res, next) => {
  try {
    const {
      displayName,
      n8nModel,
      description,
      contextWindow,
      maxTokens,
      inputCostPer1k,
      outputCostPer1k,
      supportsVision,
      supportsStreaming,
      supportsFunctionCalling,
      isEnabled,
      priority,
    } = req.body;

    const existing = await queryOne(
      'SELECT * FROM ai_models WHERE id = ?',
      req.params.id
    );
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Model not found' });
    }

    await execute(
      `UPDATE ai_models SET
        display_name = ?,
        litellm_model = ?,
        description = ?,
        context_window = ?,
        max_tokens = ?,
        input_cost_per_1k = ?,
        output_cost_per_1k = ?,
        supports_vision = ?,
        supports_streaming = ?,
        supports_function_calling = ?,
        is_enabled = ?,
        priority = ?,
        updated_at = datetime('now')
      WHERE id = ?`,
      displayName ?? existing.display_name,
      n8nModel ?? existing.litellm_model,
      description !== undefined ? description : existing.description,
      contextWindow !== undefined ? contextWindow : existing.context_window,
      maxTokens !== undefined ? maxTokens : existing.max_tokens,
      inputCostPer1k !== undefined ? inputCostPer1k : existing.input_cost_per_1k,
      outputCostPer1k !== undefined ? outputCostPer1k : existing.output_cost_per_1k,
      supportsVision !== undefined ? (supportsVision ? 1 : 0) : existing.supports_vision,
      supportsStreaming !== undefined ? (supportsStreaming ? 1 : 0) : existing.supports_streaming,
      supportsFunctionCalling !== undefined ? (supportsFunctionCalling ? 1 : 0) : existing.supports_function_calling,
      isEnabled !== undefined ? (isEnabled ? 1 : 0) : existing.is_enabled,
      priority !== undefined ? priority : existing.priority,
      req.params.id
    );

    const model = await queryOne('SELECT * FROM ai_models WHERE id = ?', req.params.id);

    res.json({
      ok: true,
      data: {
        id: model.id,
        modelName: model.model_name,
        displayName: model.display_name,
        isEnabled: !!model.is_enabled,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /models/:id - Delete model
 */
router.delete('/models/:id', async (req, res, next) => {
  try {
    const existing = await queryOne(
      'SELECT * FROM ai_models WHERE id = ?',
      req.params.id
    );
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Model not found' });
    }

    // Check if used in routes
    const routeUsage = await queryOne(
      `SELECT COUNT(*) as count FROM ai_routes 
       WHERE primary_model_id = ? 
         OR fallback_model_ids LIKE ?
         OR context_window_fallback_ids LIKE ?`,
      req.params.id,
      `%${req.params.id}%`,
      `%${req.params.id}%`
    );
    if (routeUsage?.count > 0) {
      return res.status(400).json({
        ok: false,
        error: 'Cannot delete model used in routing rules. Update routes first.',
      });
    }

    await execute('DELETE FROM ai_models WHERE id = ?', req.params.id);

    res.json({ ok: true, data: { deleted: req.params.id } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /models/:id/test - Test model
 */
router.post('/models/:id/test', async (req, res, next) => {
  try {
    const model = await queryOne(
      'SELECT * FROM ai_models WHERE id = ?',
      req.params.id
    );
    if (!model) {
      return res.status(404).json({ ok: false, error: 'Model not found' });
    }

    const { prompt } = req.body;
    const testPrompt = prompt || 'Say "Hello" in one word.';

    try {
      const client = getN8NClient();
      const start = Date.now();
      const response = await client.chat(
        [{ role: 'user', content: testPrompt }],
        { model: model.model_name, timeout: 30000 }
      );
      const latencyMs = Date.now() - start;

      res.json({
        ok: true,
        data: {
          success: true,
          modelId: model.id,
          modelName: model.model_name,
          latencyMs,
          response: response.content?.slice(0, 500),
          usage: response.usage,
        },
      });
    } catch (err) {
      res.json({
        ok: true,
        data: {
          success: false,
          modelId: model.id,
          modelName: model.model_name,
          error: err.message,
        },
      });
    }
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Routes CRUD
// ============================================================================

/**
 * GET /routes - List all routes
 */
router.get('/routes', async (req, res, next) => {
  try {
    const routes = await queryAll(`
      SELECT 
        r.*,
        m.model_name as primary_model_name,
        m.display_name as primary_model_display_name
      FROM ai_routes r
      LEFT JOIN ai_models m ON r.primary_model_id = m.id
      ORDER BY r.is_default DESC, r.name
    `);

    const formatted = routes.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      routingStrategy: r.routing_strategy,
      primaryModel: r.primary_model_id
        ? {
            id: r.primary_model_id,
            modelName: r.primary_model_name,
            displayName: r.primary_model_display_name,
          }
        : null,
      fallbackModelIds: parseJsonField(r.fallback_model_ids) || [],
      contextWindowFallbackIds: parseJsonField(r.context_window_fallback_ids) || [],
      numRetries: r.num_retries,
      timeoutSeconds: r.timeout_seconds,
      isDefault: !!r.is_default,
      isEnabled: !!r.is_enabled,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    res.json({ ok: true, data: { routes: formatted } });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /routes/:id - Get single route
 */
router.get('/routes/:id', async (req, res, next) => {
  try {
    const route = await queryOne(
      `SELECT r.*, m.model_name as primary_model_name, m.display_name as primary_model_display_name
       FROM ai_routes r
       LEFT JOIN ai_models m ON r.primary_model_id = m.id
       WHERE r.id = ?`,
      req.params.id
    );

    if (!route) {
      return res.status(404).json({ ok: false, error: 'Route not found' });
    }

    res.json({
      ok: true,
      data: {
        id: route.id,
        name: route.name,
        description: route.description,
        routingStrategy: route.routing_strategy,
        primaryModel: route.primary_model_id
          ? {
              id: route.primary_model_id,
              modelName: route.primary_model_name,
              displayName: route.primary_model_display_name,
            }
          : null,
        fallbackModelIds: parseJsonField(route.fallback_model_ids) || [],
        contextWindowFallbackIds: parseJsonField(route.context_window_fallback_ids) || [],
        numRetries: route.num_retries,
        timeoutSeconds: route.timeout_seconds,
        isDefault: !!route.is_default,
        isEnabled: !!route.is_enabled,
        createdAt: route.created_at,
        updatedAt: route.updated_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /routes - Create route
 */
router.post('/routes', async (req, res, next) => {
  try {
    const {
      name,
      description,
      routingStrategy,
      primaryModelId,
      fallbackModelIds,
      contextWindowFallbackIds,
      numRetries,
      timeoutSeconds,
      isDefault,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        ok: false,
        error: 'name is required',
      });
    }

    // Check for duplicate name
    const existing = await queryOne(
      'SELECT id FROM ai_routes WHERE name = ?',
      name
    );
    if (existing) {
      return res.status(409).json({
        ok: false,
        error: `Route with name "${name}" already exists`,
      });
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await execute('UPDATE ai_routes SET is_default = 0');
    }

    const id = generateId('route');
    await execute(
      `INSERT INTO ai_routes (
        id, name, description, routing_strategy, primary_model_id,
        fallback_model_ids, context_window_fallback_ids,
        num_retries, timeout_seconds, is_default
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      name,
      description || null,
      routingStrategy || 'latency-based-routing',
      primaryModelId || null,
      fallbackModelIds ? JSON.stringify(fallbackModelIds) : null,
      contextWindowFallbackIds ? JSON.stringify(contextWindowFallbackIds) : null,
      numRetries || 3,
      timeoutSeconds || 120,
      isDefault ? 1 : 0
    );

    const route = await queryOne('SELECT * FROM ai_routes WHERE id = ?', id);

    res.status(201).json({
      ok: true,
      data: {
        id: route.id,
        name: route.name,
        isDefault: !!route.is_default,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /routes/:id - Update route
 */
router.put('/routes/:id', async (req, res, next) => {
  try {
    const {
      name,
      description,
      routingStrategy,
      primaryModelId,
      fallbackModelIds,
      contextWindowFallbackIds,
      numRetries,
      timeoutSeconds,
      isDefault,
      isEnabled,
    } = req.body;

    const existing = await queryOne(
      'SELECT * FROM ai_routes WHERE id = ?',
      req.params.id
    );
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Route not found' });
    }

    // If setting as default, unset other defaults
    if (isDefault && !existing.is_default) {
      await execute('UPDATE ai_routes SET is_default = 0 WHERE id != ?', req.params.id);
    }

    await execute(
      `UPDATE ai_routes SET
        name = ?,
        description = ?,
        routing_strategy = ?,
        primary_model_id = ?,
        fallback_model_ids = ?,
        context_window_fallback_ids = ?,
        num_retries = ?,
        timeout_seconds = ?,
        is_default = ?,
        is_enabled = ?,
        updated_at = datetime('now')
      WHERE id = ?`,
      name ?? existing.name,
      description !== undefined ? description : existing.description,
      routingStrategy ?? existing.routing_strategy,
      primaryModelId !== undefined ? primaryModelId : existing.primary_model_id,
      fallbackModelIds !== undefined ? JSON.stringify(fallbackModelIds) : existing.fallback_model_ids,
      contextWindowFallbackIds !== undefined ? JSON.stringify(contextWindowFallbackIds) : existing.context_window_fallback_ids,
      numRetries ?? existing.num_retries,
      timeoutSeconds ?? existing.timeout_seconds,
      isDefault !== undefined ? (isDefault ? 1 : 0) : existing.is_default,
      isEnabled !== undefined ? (isEnabled ? 1 : 0) : existing.is_enabled,
      req.params.id
    );

    const route = await queryOne('SELECT * FROM ai_routes WHERE id = ?', req.params.id);

    res.json({
      ok: true,
      data: {
        id: route.id,
        name: route.name,
        isDefault: !!route.is_default,
        isEnabled: !!route.is_enabled,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /routes/:id - Delete route
 */
router.delete('/routes/:id', async (req, res, next) => {
  try {
    const existing = await queryOne(
      'SELECT * FROM ai_routes WHERE id = ?',
      req.params.id
    );
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Route not found' });
    }

    if (existing.is_default) {
      return res.status(400).json({
        ok: false,
        error: 'Cannot delete the default route. Set another route as default first.',
      });
    }

    await execute('DELETE FROM ai_routes WHERE id = ?', req.params.id);

    res.json({ ok: true, data: { deleted: req.params.id } });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Usage & Monitoring
// ============================================================================

/**
 * GET /usage - Get usage statistics
 */
router.get('/usage', async (req, res, next) => {
  try {
    const { startDate, endDate, modelId, groupBy } = req.query;

    // Default to last 7 days
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Summary
    let summaryQuery = `
      SELECT 
        COUNT(*) as total_requests,
        COALESCE(SUM(total_tokens), 0) as total_tokens,
        COALESCE(SUM(estimated_cost), 0) as total_cost,
        COALESCE(AVG(latency_ms), 0) as avg_latency_ms,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count
      FROM ai_usage_logs
      WHERE date(created_at) >= ? AND date(created_at) <= ?
    `;
    const summaryParams = [start, end];

    if (modelId) {
      summaryQuery += ' AND model_id = ?';
      summaryParams.push(modelId);
    }

    const summaryResult = await queryOne(summaryQuery, ...summaryParams);

    // Breakdown
    let breakdownQuery;
    let breakdownParams = [start, end];

    if (groupBy === 'model') {
      breakdownQuery = `
        SELECT 
          u.model_id,
          m.model_name,
          m.display_name,
          COUNT(*) as requests,
          COALESCE(SUM(u.total_tokens), 0) as tokens,
          COALESCE(SUM(u.estimated_cost), 0) as cost,
          COALESCE(AVG(u.latency_ms), 0) as avg_latency_ms
        FROM ai_usage_logs u
        LEFT JOIN ai_models m ON u.model_id = m.id
        WHERE date(u.created_at) >= ? AND date(u.created_at) <= ?
        GROUP BY u.model_id
        ORDER BY requests DESC
      `;
    } else {
      // Default: group by day
      breakdownQuery = `
        SELECT 
          date(created_at) as date,
          COUNT(*) as requests,
          COALESCE(SUM(total_tokens), 0) as tokens,
          COALESCE(SUM(estimated_cost), 0) as cost,
          COALESCE(AVG(latency_ms), 0) as avg_latency_ms
        FROM ai_usage_logs
        WHERE date(created_at) >= ? AND date(created_at) <= ?
      `;
      if (modelId) {
        breakdownQuery += ' AND model_id = ?';
        breakdownParams.push(modelId);
      }
      breakdownQuery += ' GROUP BY date(created_at) ORDER BY date ASC';
    }

    const breakdownResult = await queryAll(breakdownQuery, ...breakdownParams);

    res.json({
      ok: true,
      data: {
        period: { start, end },
        summary: {
          totalRequests: summaryResult?.total_requests || 0,
          totalTokens: summaryResult?.total_tokens || 0,
          totalCost: Math.round((summaryResult?.total_cost || 0) * 10000) / 10000,
          avgLatencyMs: Math.round(summaryResult?.avg_latency_ms || 0),
          successCount: summaryResult?.success_count || 0,
          errorCount: summaryResult?.error_count || 0,
        },
        breakdown: breakdownResult.map((r) => ({
          ...(r.date ? { date: r.date } : {}),
          ...(r.model_id
            ? {
                model: {
                  id: r.model_id,
                  modelName: r.model_name,
                  displayName: r.display_name,
                },
              }
            : {}),
          requests: r.requests,
          tokens: r.tokens,
          cost: Math.round((r.cost || 0) * 10000) / 10000,
          avgLatencyMs: Math.round(r.avg_latency_ms || 0),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /usage/log - Log a usage event (internal use)
 */
router.post('/usage/log', async (req, res, next) => {
  try {
    const {
      modelId,
      routeId,
      requestType,
      promptTokens,
      completionTokens,
      latencyMs,
      status,
      errorMessage,
      userId,
      metadata,
    } = req.body;

    const totalTokens = (promptTokens || 0) + (completionTokens || 0);

    // Calculate estimated cost
    let estimatedCost = 0;
    if (modelId) {
      const model = await queryOne(
        'SELECT input_cost_per_1k, output_cost_per_1k FROM ai_models WHERE id = ?',
        modelId
      );
      if (model) {
        estimatedCost =
          ((promptTokens || 0) * (model.input_cost_per_1k || 0)) / 1000 +
          ((completionTokens || 0) * (model.output_cost_per_1k || 0)) / 1000;
      }
    }

    const id = generateId('usage');
    await execute(
      `INSERT INTO ai_usage_logs (
        id, model_id, route_id, request_type,
        prompt_tokens, completion_tokens, total_tokens,
        estimated_cost, latency_ms, status, error_message, user_id, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      modelId || null,
      routeId || null,
      requestType || 'chat',
      promptTokens || 0,
      completionTokens || 0,
      totalTokens,
      estimatedCost,
      latencyMs || null,
      status || 'success',
      errorMessage || null,
      userId || null,
      metadata ? JSON.stringify(metadata) : null
    );

    res.status(201).json({ ok: true, data: { id } });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// n8n Config Sync
// ============================================================================

/**
 * POST /reload - Sync database config to n8n
 * This generates a config object that could be used to update n8n workflows
 */
router.post('/reload', async (req, res, next) => {
  try {
    // Get all enabled models
    const models = await queryAll(`
      SELECT m.*, p.name as provider_name, p.api_base_url, p.api_key_env
      FROM ai_models m
      JOIN ai_providers p ON m.provider_id = p.id
      WHERE m.is_enabled = 1 AND p.is_enabled = 1
      ORDER BY m.priority DESC
    `);

    // Get default route
    const defaultRoute = await queryOne(
      'SELECT * FROM ai_routes WHERE is_default = 1 AND is_enabled = 1'
    );

    // Build n8n config
    const modelList = models.map((m) => ({
      model_name: m.model_name,
      n8n_params: {
        model: m.litellm_model,
        ...(m.api_base_url ? { api_base: m.api_base_url } : {}),
        ...(m.api_key_env ? { api_key: `os.environ/${m.api_key_env}` } : {}),
      },
      model_info: {
        description: m.description,
        context_window: m.context_window,
        max_tokens: m.max_tokens,
        input_cost_per_token: m.input_cost_per_1k ? m.input_cost_per_1k / 1000 : undefined,
        output_cost_per_token: m.output_cost_per_1k ? m.output_cost_per_1k / 1000 : undefined,
        supports_vision: !!m.supports_vision,
        supports_streaming: !!m.supports_streaming,
        supports_function_calling: !!m.supports_function_calling,
      },
    }));

    // Build fallbacks from default route
    let fallbacks = [];
    if (defaultRoute) {
      const primaryModel = await queryOne(
        'SELECT model_name FROM ai_models WHERE id = ?',
        defaultRoute.primary_model_id
      );
      const fallbackIds = parseJsonField(defaultRoute.fallback_model_ids) || [];
      
      if (primaryModel && fallbackIds.length > 0) {
        const fallbackModels = await queryAll(
          `SELECT model_name FROM ai_models WHERE id IN (${fallbackIds.map(() => '?').join(',')})`,
          ...fallbackIds
        );
        fallbacks.push({
          [primaryModel.model_name]: fallbackModels.map((m) => m.model_name),
        });
      }
    }

    const n8nConfig = {
      model_list: modelList,
      router_settings: {
        routing_strategy: defaultRoute?.routing_strategy || 'latency-based-routing',
        num_retries: defaultRoute?.num_retries || 3,
        timeout: defaultRoute?.timeout_seconds || 120,
        fallbacks,
      },
    };

    // Note: Actually updating n8n requires updating workflow configurations
    // For now, we just return the config that would be applied

    res.json({
      ok: true,
      data: {
        config: n8nConfig,
        modelCount: models.length,
        message: 'Config generated. Update n8n workflows to apply.',
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /config/export - Export current config as YAML-compatible JSON
 */
router.get('/config/export', async (req, res, next) => {
  try {
    const providers = await queryAll('SELECT * FROM ai_providers');
    const models = await queryAll('SELECT * FROM ai_models');
    const routes = await queryAll('SELECT * FROM ai_routes');

    res.json({
      ok: true,
      data: {
        exportedAt: new Date().toISOString(),
        providers: providers.map((p) => ({
          id: p.id,
          name: p.name,
          displayName: p.display_name,
          apiBaseUrl: p.api_base_url,
          apiKeyEnv: p.api_key_env,
          isEnabled: !!p.is_enabled,
        })),
        models: models.map((m) => ({
          id: m.id,
          providerId: m.provider_id,
          modelName: m.model_name,
          displayName: m.display_name,
          n8nModel: m.litellm_model,
          description: m.description,
          contextWindow: m.context_window,
          maxTokens: m.max_tokens,
          inputCostPer1k: m.input_cost_per_1k,
          outputCostPer1k: m.output_cost_per_1k,
          supportsVision: !!m.supports_vision,
          supportsStreaming: !!m.supports_streaming,
          supportsFunctionCalling: !!m.supports_function_calling,
          isEnabled: !!m.is_enabled,
          priority: m.priority,
        })),
        routes: routes.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          routingStrategy: r.routing_strategy,
          primaryModelId: r.primary_model_id,
          fallbackModelIds: parseJsonField(r.fallback_model_ids),
          contextWindowFallbackIds: parseJsonField(r.context_window_fallback_ids),
          numRetries: r.num_retries,
          timeoutSeconds: r.timeout_seconds,
          isDefault: !!r.is_default,
          isEnabled: !!r.is_enabled,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
