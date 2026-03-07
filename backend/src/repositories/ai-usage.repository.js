import { execute, queryOne, isD1Configured } from './base/d1.repository.js';

export async function logAIUsage(data) {
  if (!isD1Configured()) {
    return;
  }

  try {
    const {
      modelName,
      routeName,
      requestType = 'chat',
      promptTokens = 0,
      completionTokens = 0,
      latencyMs,
      status = 'success',
      errorMessage,
      userId,
      metadata,
    } = data;

    let modelId = null;
    if (modelName) {
      const model = await queryOne(
        'SELECT id, input_cost_per_1k, output_cost_per_1k FROM ai_models WHERE model_name = ?',
        modelName
      );
      if (model) {
        modelId = model.id;
      }
    }

    let routeId = null;
    if (routeName) {
      const route = await queryOne(
        'SELECT id FROM ai_routes WHERE name = ?',
        routeName
      );
      if (route) {
        routeId = route.id;
      }
    }

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

    const totalTokens = (promptTokens || 0) + (completionTokens || 0);
    const id = `usage_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await execute(
      `INSERT INTO ai_usage_logs (
        id, model_id, route_id, request_type,
        prompt_tokens, completion_tokens, total_tokens,
        estimated_cost, latency_ms, status, error_message, user_id, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      modelId,
      routeId,
      requestType,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCost,
      latencyMs || null,
      status,
      errorMessage || null,
      userId || null,
      metadata ? JSON.stringify(metadata) : null
    );

    const today = new Date().toISOString().split('T')[0];
    if (modelId) {
      const result = await execute(
        `UPDATE ai_usage_daily SET
          total_requests = total_requests + 1,
          total_prompt_tokens = total_prompt_tokens + ?,
          total_completion_tokens = total_completion_tokens + ?,
          total_tokens = total_tokens + ?,
          total_cost = total_cost + ?,
          success_count = success_count + ?,
          error_count = error_count + ?,
          avg_latency_ms = (avg_latency_ms * (total_requests - 1) + ?) / total_requests
        WHERE date = ? AND model_id = ?`,
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCost,
        status === 'success' ? 1 : 0,
        status === 'error' ? 1 : 0,
        latencyMs || 0,
        today,
        modelId
      );

      if (result.changes === 0) {
        await execute(
          `INSERT INTO ai_usage_daily (
            date, model_id, total_requests,
            total_prompt_tokens, total_completion_tokens, total_tokens,
            total_cost, success_count, error_count, avg_latency_ms
          ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`,
          today,
          modelId,
          promptTokens,
          completionTokens,
          totalTokens,
          estimatedCost,
          status === 'success' ? 1 : 0,
          status === 'error' ? 1 : 0,
          latencyMs || 0
        );
      }
    }
  } catch (err) {
    console.warn('[AIUsage] Failed to log usage:', err.message);
  }
}

export function createUsageLogger(defaultRouteName) {
  return async function logUsage(data) {
    await logAIUsage({
      routeName: defaultRouteName,
      ...data,
    });
  };
}
