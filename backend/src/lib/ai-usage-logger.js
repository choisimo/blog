/**
 * AI Usage Logger
 * 
 * Logs AI usage to D1 database for monitoring and analytics.
 * Works asynchronously to not block AI responses.
 */

import { execute, queryOne, isD1Configured } from './d1.js';

/**
 * Log an AI usage event to the database
 * Runs asynchronously and silently fails to not impact AI performance
 */
export async function logAIUsage(data) {
  // Skip if D1 not configured
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

    // Lookup model ID by name
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

    // Lookup route ID by name
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

    // Update daily aggregation
    const today = new Date().toISOString().split('T')[0];
    if (modelId) {
      // Try to update existing record
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

      // Insert if doesn't exist
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
    // Silently fail - logging should not impact AI performance
    console.warn('[AIUsage] Failed to log usage:', err.message);
  }
}

/**
 * Create a usage logger middleware/wrapper for AI clients
 */
export function createUsageLogger(defaultRouteName) {
  return async function logUsage(data) {
    await logAIUsage({
      routeName: defaultRouteName,
      ...data,
    });
  };
}
