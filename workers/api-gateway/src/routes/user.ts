import { Hono, type Context } from 'hono';
import type { HonoEnv } from '../types';
import { success, badRequest, notFound, serverError, error } from '../lib/response';

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

async function sha256Hex(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashSessionToken(token: string): Promise<string> {
  // The token is already 256-bit random. Hashing it before persistence prevents
  // database/read-log compromise from becoming direct session replay material.
  return sha256Hex(`user-session:${token}`);
}

function sessionTokenMarker(tokenHash: string): string {
  // Keep the legacy NOT NULL/UNIQUE column populated without storing the bearer
  // secret itself. New lookups use session_token_hash; old plaintext rows are
  // still supported as a compatibility fallback in findActiveSessionByToken().
  return `sha256:${tokenHash}`;
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

type SessionRecord = {
  id: string;
  fingerprint_id: string;
  session_token: string;
  session_token_hash?: string | null;
  expires_at: string;
  first_seen_at: string | null;
  visit_count: number | null;
};

function getAuthorizationToken(authHeader?: string): string {
  const raw = String(authHeader || '').trim();
  if (!raw.toLowerCase().startsWith('bearer ')) {
    return '';
  }

  return raw.slice(7).trim();
}

function getSessionTokenFromRequest(c: Context<HonoEnv>): string {
  const bearerToken = getAuthorizationToken(c.req.header('Authorization'));
  if (bearerToken) {
    return bearerToken;
  }

  return String(c.req.header('X-Session-Token') || '').trim();
}

async function findActiveSessionByToken(
  db: HonoEnv['Bindings']['DB'],
  token: string
): Promise<SessionRecord | null> {
  const tokenHash = await hashSessionToken(token);
  const session = await db
    .prepare(`
      SELECT s.*, f.fingerprint_hash, f.first_seen_at, f.visit_count
      FROM user_sessions s
      JOIN user_fingerprints f ON s.fingerprint_id = f.id
      WHERE (
          (s.session_token_hash IS NOT NULL AND s.session_token_hash = ?)
          OR (s.session_token_hash IS NULL AND s.session_token = ?)
        )
        AND s.is_active = 1
        AND datetime(s.expires_at) > datetime('now')
    `)
    .bind(tokenHash, token)
    .first<SessionRecord>();

  return session ?? null;
}

async function findRecoverableSessionByToken(
  db: HonoEnv['Bindings']['DB'],
  token: string
): Promise<Pick<SessionRecord, 'id' | 'fingerprint_id'> | null> {
  const tokenHash = await hashSessionToken(token);
  const session = await db
    .prepare(`
      SELECT id, fingerprint_id
      FROM user_sessions
      WHERE (
          (session_token_hash IS NOT NULL AND session_token_hash = ?)
          OR (session_token_hash IS NULL AND session_token = ?)
        )
        AND is_active = 1
    `)
    .bind(tokenHash, token)
    .first<Pick<SessionRecord, 'id' | 'fingerprint_id'>>();

  return session ?? null;
}

async function deactivateSessionIfActive(
  db: HonoEnv['Bindings']['DB'],
  sessionId: string
): Promise<boolean> {
  const result = await db
    .prepare(`
      UPDATE user_sessions
      SET is_active = 0, updated_at = datetime('now')
      WHERE id = ? AND is_active = 1
    `)
    .bind(sessionId)
    .run();

  return Number(result.meta?.changes ?? 0) === 1;
}

async function touchSessionActivity(db: HonoEnv['Bindings']['DB'], sessionId: string): Promise<void> {
  await db
    .prepare(`
      UPDATE user_sessions SET last_activity_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `)
    .bind(sessionId)
    .run();
}

function toSessionResponse(session: SessionRecord, presentedToken: string, includeLegacySessionId = false) {
  return {
    sessionToken: presentedToken,
    ...(includeLegacySessionId ? { sessionId: session.id } : {}),
    fingerprintId: session.fingerprint_id,
    expiresAt: session.expires_at,
    firstSeenAt: session.first_seen_at ?? undefined,
    visitCount:
      typeof session.visit_count === 'number' ? session.visit_count : undefined,
  };
}

async function recoverSessionByToken(c: Context<HonoEnv>, token: string) {
  const db = c.env.DB;

  const oldSession = await findRecoverableSessionByToken(db, token);

  if (!oldSession) {
    return notFound(c, 'Session not found or already recovered');
  }

  const deactivated = await deactivateSessionIfActive(db, oldSession.id);
  if (!deactivated) {
    return notFound(c, 'Session not found or already recovered');
  }

  const newSessionToken = generateSessionToken();
  const newSessionTokenHash = await hashSessionToken(newSessionToken);
  const newSessionId = generateId();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const cfHeaders = c.req.raw.headers;
  const ipAddress = cfHeaders.get('CF-Connecting-IP') || '';
  const countryCode = cfHeaders.get('CF-IPCountry') || '';

  await db
    .prepare(`
      INSERT INTO user_sessions (
        id, fingerprint_id, session_token, session_token_hash, ip_address, country_code, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      newSessionId,
      oldSession.fingerprint_id,
      sessionTokenMarker(newSessionTokenHash),
      newSessionTokenHash,
      ipAddress,
      countryCode,
      expiresAt
    )
    .run();

  return success(c, {
    sessionToken: newSessionToken,
    fingerprintId: oldSession.fingerprint_id,
    expiresAt,
  });
}

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
    const sessionTokenHash = await hashSessionToken(sessionToken);
    const sessionId = generateId();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const cfHeaders = c.req.raw.headers;
    const ipAddress = cfHeaders.get('CF-Connecting-IP') || '';
    const countryCode = cfHeaders.get('CF-IPCountry') || '';

    await db
      .prepare(`
        INSERT INTO user_sessions (
          id, fingerprint_id, session_token, session_token_hash, user_agent, ip_address, country_code, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        sessionId,
        fingerprintId,
        sessionTokenMarker(sessionTokenHash),
        sessionTokenHash,
        body.userAgent || null,
        ipAddress,
        countryCode,
        expiresAt
      )
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

user.get('/session/verify', async (c) => {
  const token = getSessionTokenFromRequest(c);
  if (!token) {
    return badRequest(c, 'Authorization or X-Session-Token header is required');
  }

  const db = c.env.DB;

  try {
    const session = await findActiveSessionByToken(db, token);
    if (!session) {
      return notFound(c, 'Session not found or expired');
    }

    await touchSessionActivity(db, session.id);
    return success(c, toSessionResponse(session, token));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to validate session';
    console.error('Session validation failed:', message);
    return serverError(c, message);
  }
});

user.get('/session/:token', (c) =>
  error(
    c,
    'Session tokens in URL paths are no longer accepted. Use GET /api/v1/user/session/verify with Authorization: Bearer <token>.',
    410,
    'DEPRECATED_SESSION_TOKEN_IN_URL'
  )
);

user.post('/session/recover', async (c) => {
  const token = getSessionTokenFromRequest(c);
  if (!token) {
    return badRequest(c, 'Authorization or X-Session-Token header is required');
  }

  try {
    return await recoverSessionByToken(c, token);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to recover session';
    console.error('Session recovery failed:', message);
    return serverError(c, message);
  }
});

user.post('/session/:token/recover', (c) =>
  error(
    c,
    'Session tokens in URL paths are no longer accepted. Use POST /api/v1/user/session/recover with Authorization: Bearer <token>.',
    410,
    'DEPRECATED_SESSION_TOKEN_IN_URL'
  )
);

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
    const session = await findActiveSessionByToken(db, sessionToken);

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
    const session = await findActiveSessionByToken(db, sessionToken);

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
