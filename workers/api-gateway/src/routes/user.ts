import { Hono } from 'hono';
import type { HonoEnv } from '../types';
import { success, badRequest, notFound, serverError } from '../lib/response';

const user = new Hono<HonoEnv>();

function generateId(): string {
  return crypto.randomUUID();
}

function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hashFingerprint(fingerprint: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(fingerprint);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

type FingerprintData = {
  visitorId: string;
  components?: {
    screenResolution?: { value: number[] };
    timezone?: { value: string };
    language?: { value: string };
    platform?: { value: string };
  };
};

type SessionCreateBody = {
  fingerprint: FingerprintData;
  userAgent?: string;
};

user.post('/session', async (c) => {
  const body = await c.req.json<SessionCreateBody>().catch(() => ({} as SessionCreateBody));

  if (!body.fingerprint?.visitorId) {
    return badRequest(c, 'fingerprint.visitorId is required');
  }

  const db = c.env.DB;
  const fingerprintHash = await hashFingerprint(body.fingerprint.visitorId);

  try {
    let fingerprintRecord = await db
      .prepare('SELECT * FROM user_fingerprints WHERE fingerprint_hash = ?')
      .bind(fingerprintHash)
      .first<{ id: string; visit_count: number }>();

    let fingerprintId: string;
    let isNewUser = false;

    if (fingerprintRecord) {
      fingerprintId = fingerprintRecord.id;
      await db
        .prepare(`
          UPDATE user_fingerprints 
          SET last_seen_at = datetime('now'), 
              visit_count = visit_count + 1,
              updated_at = datetime('now')
          WHERE id = ?
        `)
        .bind(fingerprintId)
        .run();
    } else {
      isNewUser = true;
      fingerprintId = generateId();
      const components = body.fingerprint.components;

      await db
        .prepare(`
          INSERT INTO user_fingerprints (
            id, fingerprint_hash, screen_info, timezone, language, browser_info
          ) VALUES (?, ?, ?, ?, ?, ?)
        `)
        .bind(
          fingerprintId,
          fingerprintHash,
          components?.screenResolution?.value ? JSON.stringify(components.screenResolution.value) : null,
          components?.timezone?.value || null,
          components?.language?.value || null,
          components?.platform?.value || null
        )
        .run();
    }

    const sessionToken = generateSessionToken();
    const sessionId = generateId();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const cfHeaders = c.req.raw.headers;
    const ipAddress = cfHeaders.get('CF-Connecting-IP') || '';
    const countryCode = cfHeaders.get('CF-IPCountry') || '';

    await db
      .prepare(`
        INSERT INTO user_sessions (
          id, fingerprint_id, session_token, user_agent, ip_address, country_code, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(sessionId, fingerprintId, sessionToken, body.userAgent || null, ipAddress, countryCode, expiresAt)
      .run();

    return success(c, {
      sessionToken,
      fingerprintId,
      isNewUser,
      expiresAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create session';
    console.error('Session creation failed:', message);
    return serverError(c, message);
  }
});

user.get('/session/:token', async (c) => {
  const token = c.req.param('token');

  if (!token) {
    return badRequest(c, 'Session token is required');
  }

  const db = c.env.DB;

  try {
    const session = await db
      .prepare(`
        SELECT s.*, f.fingerprint_hash, f.first_seen_at, f.visit_count
        FROM user_sessions s
        JOIN user_fingerprints f ON s.fingerprint_id = f.id
        WHERE s.session_token = ? AND s.is_active = 1 AND s.expires_at > datetime('now')
      `)
      .bind(token)
      .first<{
        id: string;
        fingerprint_id: string;
        session_token: string;
        expires_at: string;
        first_seen_at: string;
        visit_count: number;
      }>();

    if (!session) {
      return notFound(c, 'Session not found or expired');
    }

    await db
      .prepare(`
        UPDATE user_sessions SET last_activity_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `)
      .bind(session.id)
      .run();

    return success(c, {
      sessionId: session.id,
      fingerprintId: session.fingerprint_id,
      expiresAt: session.expires_at,
      firstSeenAt: session.first_seen_at,
      visitCount: session.visit_count,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to validate session';
    console.error('Session validation failed:', message);
    return serverError(c, message);
  }
});

user.post('/session/:token/recover', async (c) => {
  const token = c.req.param('token');

  if (!token) {
    return badRequest(c, 'Session token is required');
  }

  const db = c.env.DB;

  try {
    const oldSession = await db
      .prepare(`
        SELECT fingerprint_id FROM user_sessions WHERE session_token = ?
      `)
      .bind(token)
      .first<{ fingerprint_id: string }>();

    if (!oldSession) {
      return notFound(c, 'Session not found');
    }

    await db
      .prepare(`
        UPDATE user_sessions SET is_active = 0, updated_at = datetime('now')
        WHERE session_token = ?
      `)
      .bind(token)
      .run();

    const newSessionToken = generateSessionToken();
    const newSessionId = generateId();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const cfHeaders = c.req.raw.headers;
    const ipAddress = cfHeaders.get('CF-Connecting-IP') || '';
    const countryCode = cfHeaders.get('CF-IPCountry') || '';

    await db
      .prepare(`
        INSERT INTO user_sessions (
          id, fingerprint_id, session_token, ip_address, country_code, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(newSessionId, oldSession.fingerprint_id, newSessionToken, ipAddress, countryCode, expiresAt)
      .run();

    return success(c, {
      sessionToken: newSessionToken,
      fingerprintId: oldSession.fingerprint_id,
      expiresAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to recover session';
    console.error('Session recovery failed:', message);
    return serverError(c, message);
  }
});

type PreferenceBody = {
  key: string;
  value: unknown;
};

user.put('/preferences', async (c) => {
  const sessionToken = c.req.header('X-Session-Token');
  if (!sessionToken) {
    return badRequest(c, 'X-Session-Token header is required');
  }

  const body = await c.req.json<PreferenceBody>().catch(() => ({} as PreferenceBody));
  if (!body.key) {
    return badRequest(c, 'key is required');
  }

  const db = c.env.DB;

  try {
    const session = await db
      .prepare(`
        SELECT fingerprint_id FROM user_sessions 
        WHERE session_token = ? AND is_active = 1 AND expires_at > datetime('now')
      `)
      .bind(sessionToken)
      .first<{ fingerprint_id: string }>();

    if (!session) {
      return notFound(c, 'Session not found or expired');
    }

    await db
      .prepare(`
        INSERT INTO user_preferences (id, fingerprint_id, preference_key, preference_value)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(fingerprint_id, preference_key)
        DO UPDATE SET preference_value = ?, updated_at = datetime('now')
      `)
      .bind(
        generateId(),
        session.fingerprint_id,
        body.key,
        JSON.stringify(body.value),
        JSON.stringify(body.value)
      )
      .run();

    return success(c, { updated: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save preference';
    console.error('Preference save failed:', message);
    return serverError(c, message);
  }
});

user.get('/preferences', async (c) => {
  const sessionToken = c.req.header('X-Session-Token');
  if (!sessionToken) {
    return badRequest(c, 'X-Session-Token header is required');
  }

  const db = c.env.DB;

  try {
    const session = await db
      .prepare(`
        SELECT fingerprint_id FROM user_sessions 
        WHERE session_token = ? AND is_active = 1 AND expires_at > datetime('now')
      `)
      .bind(sessionToken)
      .first<{ fingerprint_id: string }>();

    if (!session) {
      return notFound(c, 'Session not found or expired');
    }

    const preferences = await db
      .prepare(`
        SELECT preference_key, preference_value FROM user_preferences WHERE fingerprint_id = ?
      `)
      .bind(session.fingerprint_id)
      .all<{ preference_key: string; preference_value: string }>();

    const result: Record<string, unknown> = {};
    for (const pref of preferences.results || []) {
      try {
        result[pref.preference_key] = JSON.parse(pref.preference_value);
      } catch {
        result[pref.preference_key] = pref.preference_value;
      }
    }

    return success(c, { preferences: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get preferences';
    console.error('Preference fetch failed:', message);
    return serverError(c, message);
  }
});

export default user;
