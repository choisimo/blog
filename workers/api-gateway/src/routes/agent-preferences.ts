import { Hono } from 'hono';
import type { HonoEnv } from '../types';
import { requireAuth } from '../middleware/auth';
import { error, success } from '../lib/response';
import { digest, isRegisteredImageUser } from '../lib/reader-image-policy';
import { normalizeAgentPreferences } from '../../../../shared/src/contracts/agent-preferences.js';

const router = new Hono<HonoEnv>();
router.use('*', requireAuth, async (c, next) => {
  c.header('Cache-Control', 'private, no-store');
  if (!isRegisteredImageUser(c.get('user'))) return error(c, '계정 로그인이 필요합니다.', 403, 'MEMBER_REQUIRED');
  try { await next(); }
  catch { return error(c, '계정 설정 저장소를 사용할 수 없습니다.', 503, 'PREFERENCES_UNAVAILABLE'); }
});
router.get('/', async c => {
  const owner = await digest(`account:${c.get('user')!.sub}`);
  const row = await c.env.DB.prepare('SELECT version, preferences_json FROM reader_agent_preferences WHERE owner = ?')
    .bind(owner).first<{version: number; preferences_json: string}>();
  return success(c, { version: row?.version || 0,
    preferences: normalizeAgentPreferences(row ? JSON.parse(row.preferences_json) : null) });
});
router.put('/', async c => {
  const text = await c.req.text();
  if (new TextEncoder().encode(text).length > 8192) return error(c, '설정이 너무 큽니다.', 413, 'PAYLOAD_TOO_LARGE');
  let body: { version?: unknown; preferences?: unknown };
  try { body = JSON.parse(text); } catch { return error(c, '잘못된 설정입니다.', 400, 'INVALID_PREFERENCES'); }
  if (!body || !Number.isSafeInteger(body.version) || Number(body.version) < 0 || !body.preferences)
    return error(c, '설정 버전이 필요합니다.', 400, 'INVALID_PREFERENCES');
  const owner = await digest(`account:${c.get('user')!.sub}`);
  const preferences = normalizeAgentPreferences(body.preferences);
  const version = Number(body.version);
  const statement = version === 0
    ? c.env.DB.prepare('INSERT OR IGNORE INTO reader_agent_preferences (owner, version, preferences_json, updated_at) VALUES (?, 1, ?, ?)')
      .bind(owner, JSON.stringify(preferences), Date.now())
    : c.env.DB.prepare('UPDATE reader_agent_preferences SET version = version + 1, preferences_json = ?, updated_at = ? WHERE owner = ? AND version = ?')
      .bind(JSON.stringify(preferences), Date.now(), owner, version);
  const result = await statement.run();
  if (Number(result.meta.changes || 0) !== 1) return error(c, '다른 기기에서 설정이 변경되었습니다. 다시 불러온 뒤 저장하세요.', 409, 'PREFERENCES_CONFLICT');
  return success(c, { version: version + 1, preferences });
});
export default router;
