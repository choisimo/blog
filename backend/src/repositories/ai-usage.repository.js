import { execute, queryOne, isD1Configured } from './base/d1.repository.js';
import { createLogger } from '../lib/logger.js';

const logger = createLogger('ai-usage');

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
    let estimatedCost = 0;

    if (modelName) {
      const model = await queryOne(
        'SELECT id, input_cost_per_1k, output_cost_per_1k FROM ai_models WHERE model_name = ?',
        modelName
      );
      if (model) {
        modelId = model.id;
        estimatedCost =
          ((promptTokens || 0) * (model.input_cost_per_1k || 0)) / 1000 +
          ((completionTokens || 0) * (model.output_cost_per_1k || 0)) / 1000;
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

    if (modelId) {
      const today = new Date().toISOString().split('T')[0];
      const isSuccess = status === 'success' ? 1 : 0;
      const isError = status === 'error' ? 1 : 0;
      const safeLatency = latencyMs || 0;

      await execute(
        `INSERT INTO ai_usage_daily (
          date, model_id, total_requests,
          total_prompt_tokens, total_completion_tokens, total_tokens,
          total_cost, success_count, error_count, avg_latency_ms
        ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(date, model_id) DO UPDATE SET
          total_requests        = total_requests + 1,
          total_prompt_tokens   = total_prompt_tokens + excluded.total_prompt_tokens,
          total_completion_tokens = total_completion_tokens + excluded.total_completion_tokens,
          total_tokens          = total_tokens + excluded.total_tokens,
          total_cost            = total_cost + excluded.total_cost,
          success_count         = success_count + excluded.success_count,
          error_count           = error_count + excluded.error_count,
          avg_latency_ms        = (avg_latency_ms * total_requests + excluded.avg_latency_ms)
                                  / (total_requests + 1)`,
        today,
        modelId,
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCost,
        isSuccess,
        isError,
        safeLatency
      );
    }
  } catch (err) {
    logger.warn({}, 'Failed to log usage', { error: err.message });
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
