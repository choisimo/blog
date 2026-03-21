import { Hono } from 'hono';
import type { HonoEnv } from '../../types';
import { success, error, badRequest, notFound } from '../../lib/response';
import { requireAdmin } from '../../middleware/auth';
import { createAIService } from '../../lib/ai-service';
import { generateId } from './types';
import type { AIModel, PlaygroundHistory } from './types';
import { queryOne, queryAll, execute } from '../../lib/d1';

const playground = new Hono<HonoEnv>();

playground.post('/run', requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const {
    system_prompt,
    user_prompt,
    model_ids,
    temperature = 0.7,
    max_tokens,
    title,
  } = body as {
    system_prompt?: string;
    user_prompt?: string;
    model_ids?: string[];
    temperature?: number;
    max_tokens?: number;
    title?: string;
  };

  if (!user_prompt) {
    return badRequest(c, 'user_prompt is required');
  }

  if (!model_ids || model_ids.length === 0) {
    return badRequest(c, 'At least one model_id is required');
  }

  if (model_ids.length > 5) {
    return badRequest(c, 'Maximum 5 models allowed for comparison');
  }

  try {
    const placeholders = model_ids.map(() => '?').join(',');
    const models = await queryAll<
      AIModel & { provider_name: string; api_base_url: string | null; api_key_env: string | null }
    >(
      c.env.DB,
      `SELECT m.*, p.name as provider_name, p.api_base_url, p.api_key_env
       FROM ai_models m
       JOIN ai_providers p ON m.provider_id = p.id
       WHERE m.id IN (${placeholders}) AND m.is_enabled = 1 AND p.is_enabled = 1`,
      ...model_ids
    );

    if (models.length === 0) {
      return badRequest(c, 'No enabled models found with given IDs');
    }

    const aiService = createAIService(c.env);
    const results: Array<{
      model_id: string;
      model_name: string;
      provider_name: string;
      response: string | null;
      prompt_tokens: number | null;
      completion_tokens: number | null;
      total_tokens: number | null;
      latency_ms: number;
      estimated_cost: number | null;
      status: 'success' | 'error';
      error_message: string | null;
      history_id: string;
    }> = [];

    const executions = models.map(async (model) => {
      const historyId = generateId('ph');
      const startTime = Date.now();

      try {
        const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
        if (system_prompt) {
          messages.push({ role: 'system', content: system_prompt });
        }
        messages.push({ role: 'user', content: user_prompt });

        const chatResult = await aiService.chat(messages, {
          model: model.model_identifier,
          temperature,
          maxTokens: max_tokens || model.max_tokens || undefined,
          timeout: 120000,
        });

        const latencyMs = Date.now() - startTime;
        const promptTokens = chatResult.usage?.prompt_tokens || null;
        const completionTokens = chatResult.usage?.completion_tokens || null;
        const totalTokens = chatResult.usage?.total_tokens || null;

        let estimatedCost: number | null = null;
        if (
          model.input_cost_per_1k &&
          model.output_cost_per_1k &&
          promptTokens &&
          completionTokens
        ) {
          estimatedCost =
            (promptTokens / 1000) * model.input_cost_per_1k +
            (completionTokens / 1000) * model.output_cost_per_1k;
        }

        await execute(
          c.env.DB,
          `INSERT INTO ai_playground_history (
            id, title, system_prompt, user_prompt, model_id, model_name, provider_id, provider_name,
            response, prompt_tokens, completion_tokens, total_tokens, latency_ms, estimated_cost,
            temperature, max_tokens, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          historyId,
          title || `Playground ${new Date().toLocaleString()}`,
          system_prompt || null,
          user_prompt,
          model.id,
          model.display_name,
          model.provider_id,
          model.provider_name,
          chatResult.content,
          promptTokens,
          completionTokens,
          totalTokens,
          latencyMs,
          estimatedCost,
          temperature,
          max_tokens || null,
          'success'
        );

        return {
          model_id: model.id,
          model_name: model.display_name,
          provider_name: model.provider_name,
          response: chatResult.content,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: totalTokens,
          latency_ms: latencyMs,
          estimated_cost: estimatedCost,
          status: 'success' as const,
          error_message: null,
          history_id: historyId,
        };
      } catch (err) {
        const latencyMs = Date.now() - startTime;
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';

        await execute(
          c.env.DB,
          `INSERT INTO ai_playground_history (
            id, title, system_prompt, user_prompt, model_id, model_name, provider_id, provider_name,
            latency_ms, temperature, max_tokens, status, error_message
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          historyId,
          title || `Playground ${new Date().toLocaleString()}`,
          system_prompt || null,
          user_prompt,
          model.id,
          model.display_name,
          model.provider_id,
          model.provider_name,
          latencyMs,
          temperature,
          max_tokens || null,
          'error',
          errorMessage
        );

        return {
          model_id: model.id,
          model_name: model.display_name,
          provider_name: model.provider_name,
          response: null,
          prompt_tokens: null,
          completion_tokens: null,
          total_tokens: null,
          latency_ms: latencyMs,
          estimated_cost: null,
          status: 'error' as const,
          error_message: errorMessage,
          history_id: historyId,
        };
      }
    });

    const executionResults = await Promise.all(executions);
    results.push(...executionResults);

    return success(c, {
      results,
      input: {
        system_prompt,
        user_prompt,
        temperature,
        max_tokens,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to execute playground';
    return error(c, message, 500);
  }
});

playground.get('/history', requireAdmin, async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 200);
  const offset = parseInt(c.req.query('offset') || '0', 10);
  const modelId = c.req.query('model_id');
  const status = c.req.query('status');

  try {
    let query = `SELECT * FROM ai_playground_history WHERE 1=1`;
    const params: (string | number)[] = [];

    if (modelId) {
      query += ` AND model_id = ?`;
      params.push(modelId);
    }
    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const history = await queryAll<PlaygroundHistory>(c.env.DB, query, ...params);

    let countQuery = `SELECT COUNT(*) as total FROM ai_playground_history WHERE 1=1`;
    const countParams: string[] = [];
    if (modelId) {
      countQuery += ` AND model_id = ?`;
      countParams.push(modelId);
    }
    if (status) {
      countQuery += ` AND status = ?`;
      countParams.push(status);
    }

    const countResult = await queryOne<{ total: number }>(c.env.DB, countQuery, ...countParams);

    return success(c, {
      history,
      total: countResult?.total || 0,
      limit,
      offset,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch history';
    return error(c, message, 500);
  }
});

playground.get('/history/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');

  try {
    const history = await queryOne<PlaygroundHistory>(c.env.DB, `SELECT * FROM ai_playground_history WHERE id = ?`, id);

    if (!history) {
      return notFound(c, `History not found: ${id}`);
    }

    return success(c, { history });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch history';
    return error(c, message, 500);
  }
});

playground.delete('/history/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');

  try {
    const existing = await queryOne<{ id: string }>(c.env.DB, `SELECT id FROM ai_playground_history WHERE id = ?`, id);

    if (!existing) {
      return notFound(c, `History not found: ${id}`);
    }

    await execute(c.env.DB, `DELETE FROM ai_playground_history WHERE id = ?`, id);

    return success(c, { deleted: true, id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete history';
    return error(c, message, 500);
  }
});

playground.delete('/history', requireAdmin, async (c) => {
  const olderThanDays = parseInt(c.req.query('older_than_days') || '0', 10);

  try {
    let query = `DELETE FROM ai_playground_history`;
    const params: string[] = [];

    if (olderThanDays > 0) {
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
      query += ` WHERE created_at < ?`;
      params.push(cutoffDate);
    }

    const result = await execute(c.env.DB, query, ...params);

    return success(c, {
      deleted: true,
      rows_affected: result.meta.changes,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to clear history';
    return error(c, message, 500);
  }
});

export default playground;
