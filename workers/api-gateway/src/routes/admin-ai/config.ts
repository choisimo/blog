import { Hono } from 'hono';
import type { HonoEnv } from '../../types';
import { success, error } from '../../lib/response';
import { requireAdmin } from '../../middleware/auth';
import { queryOne, queryAll } from '../../lib/d1';
import type { AIModel, AIRoute } from './types';

const config = new Hono<HonoEnv>();

config.get('/export', requireAdmin, async (c) => {
  try {
    const db = c.env.DB;

    const modelsResult = await queryAll<
      AIModel & { provider_name: string; api_base_url: string | null; api_key_env: string | null }
    >(
      db,
      `SELECT m.*, p.name as provider_name, p.api_base_url, p.api_key_env
       FROM ai_models m
       JOIN ai_providers p ON m.provider_id = p.id
       WHERE m.is_enabled = 1 AND p.is_enabled = 1
       ORDER BY m.priority DESC`
    );

    const defaultRoute = await queryOne<AIRoute>(
      db,
      `SELECT * FROM ai_routes WHERE is_default = 1 AND is_enabled = 1`
    );

    const routesResult = await queryAll<AIRoute>(
      db,
      `SELECT * FROM ai_routes WHERE is_enabled = 1`
    );

    const modelList = modelsResult.map((m) => {
      const entry: Record<string, unknown> = {
        model_name: m.model_name,
        model_params: {
          model: m.model_identifier,
        },
        model_info: {
          description: m.description || m.display_name,
        },
      };

      if (m.api_key_env) {
        (entry.model_params as Record<string, unknown>).api_key = `os.environ/${m.api_key_env}`;
      }

      if (m.api_base_url) {
        (entry.model_params as Record<string, unknown>).api_base = m.api_base_url;
      }

      return entry;
    });

    const fallbacks: Record<string, string[]>[] = [];
    for (const route of routesResult) {
      if (route.fallback_model_ids) {
        const primaryModel = await queryOne<{ model_name: string }>(
          db,
          `SELECT model_name FROM ai_models WHERE id = ?`,
          route.primary_model_id
        );

        const fallbackIds = JSON.parse(route.fallback_model_ids) as string[];
        const fallbackModels = await queryAll<{ model_name: string }>(
          db,
          `SELECT model_name FROM ai_models WHERE id IN (${fallbackIds.map(() => '?').join(',')})`,
          ...fallbackIds
        );

        if (primaryModel && fallbackModels.length) {
          fallbacks.push({
            [primaryModel.model_name]: fallbackModels.map((m) => m.model_name),
          });
        }
      }
    }

    const contextFallbacks: Record<string, string[]>[] = [];
    for (const route of routesResult) {
      if (route.context_window_fallback_ids) {
        const primaryModel = await queryOne<{ model_name: string }>(
          db,
          `SELECT model_name FROM ai_models WHERE id = ?`,
          route.primary_model_id
        );

        const fallbackIds = JSON.parse(route.context_window_fallback_ids) as string[];
        const fallbackModels = await queryAll<{ model_name: string }>(
          db,
          `SELECT model_name FROM ai_models WHERE id IN (${fallbackIds.map(() => '?').join(',')})`,
          ...fallbackIds
        );

        if (primaryModel && fallbackModels.length) {
          contextFallbacks.push({
            [primaryModel.model_name]: fallbackModels.map((m) => m.model_name),
          });
        }
      }
    }

    const configData = {
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
      gateway_settings: {
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
        master_key: 'os.environ/AI_GATEWAY_MASTER_KEY',
        database_connection_pool_limit: 0,
        disable_spend_logs: true,
      },
    };

    return success(c, {
      config: configData,
      generated_at: new Date().toISOString(),
      model_count: modelList.length,
      route_count: routesResult.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate config';
    return error(c, message, 500);
  }
});

export default config;
