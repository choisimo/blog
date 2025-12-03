/**
 * Config Routes
 * 
 * KV 기반 동적 설정 관리 엔드포인트입니다.
 * AI 서버 URL 등을 재배포 없이 변경할 수 있습니다.
 * 
 * 모든 엔드포인트는 admin 권한이 필요합니다.
 */

import { Hono } from 'hono';
import type { Env } from '../types';
import { success, badRequest, error } from '../lib/response';
import { requireAdmin } from '../middleware/auth';
import {
  CONFIG_KEYS,
  setConfig,
  deleteConfig,
  getAllConfig,
  clearConfigCache,
} from '../lib/config';

const config = new Hono<{ Bindings: Env }>();

/**
 * GET /config
 * 현재 설정 값들을 조회합니다 (source 포함)
 */
config.get('/', requireAdmin, async (c) => {
  try {
    const configs = await getAllConfig(c.env);
    return success(c, {
      configs,
      keys: Object.keys(CONFIG_KEYS),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get config';
    return error(c, message, 500);
  }
});

/**
 * PUT /config/:key
 * 설정 값을 업데이트합니다
 * 
 * Body: { value: string }
 */
config.put('/:key', requireAdmin, async (c) => {
  const { key } = c.req.param();
  const body = await c.req.json().catch(() => ({}));
  const { value } = body as { value?: string };

  // Validate key
  const validKeys = Object.keys(CONFIG_KEYS) as Array<keyof typeof CONFIG_KEYS>;
  if (!validKeys.includes(key as keyof typeof CONFIG_KEYS)) {
    return badRequest(c, `Invalid config key: ${key}. Valid keys: ${validKeys.join(', ')}`);
  }

  // Validate value
  if (typeof value !== 'string' || !value.trim()) {
    return badRequest(c, 'value is required and must be a non-empty string');
  }

  // URL validation for URL keys
  if (key.includes('URL')) {
    try {
      new URL(value);
    } catch {
      return badRequest(c, `Invalid URL format: ${value}`);
    }
  }

  try {
    await setConfig(c.env.KV, key as keyof typeof CONFIG_KEYS, value.trim());
    return success(c, {
      key,
      value: key.includes('KEY') ? '***' + value.slice(-4) : value,
      message: `Config ${key} updated successfully`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to set config';
    return error(c, message, 500);
  }
});

/**
 * DELETE /config/:key
 * 설정 값을 삭제합니다 (env/default로 폴백)
 */
config.delete('/:key', requireAdmin, async (c) => {
  const { key } = c.req.param();

  // Validate key
  const validKeys = Object.keys(CONFIG_KEYS) as Array<keyof typeof CONFIG_KEYS>;
  if (!validKeys.includes(key as keyof typeof CONFIG_KEYS)) {
    return badRequest(c, `Invalid config key: ${key}. Valid keys: ${validKeys.join(', ')}`);
  }

  try {
    await deleteConfig(c.env.KV, key as keyof typeof CONFIG_KEYS);
    return success(c, {
      key,
      message: `Config ${key} deleted. Will now use env/default value.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete config';
    return error(c, message, 500);
  }
});

/**
 * POST /config/clear-cache
 * 인메모리 캐시를 클리어합니다
 */
config.post('/clear-cache', requireAdmin, async (c) => {
  clearConfigCache();
  return success(c, {
    message: 'Config cache cleared',
  });
});

export default config;
