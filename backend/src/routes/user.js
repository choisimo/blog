import { Router } from 'express';
import crypto from 'crypto';
import { queryAll, queryOne, execute, isD1Configured } from '../lib/d1.js';

const router = Router();

const requireDb = (req, res, next) => {
  if (!isD1Configured()) {
    return res.status(503).json({ ok: false, error: 'Database not configured' });
  }
  next();
};

function sha256(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

function toJson(v) {
  try {
    return JSON.stringify(v);
  } catch {
    return null;
  }
}

function fromJson(v) {
  if (!v) return null;
  try {
    return JSON.parse(String(v));
  } catch {
    return null;
  }
}

function getHeader(req, name) {
  const key = String(name || '').toLowerCase();
  for (const [k, v] of Object.entries(req.headers || {})) {
    if (String(k).toLowerCase() === key) return Array.isArray(v) ? v[0] : v;
  }
  return undefined;
}

function isExpired(expiresAt) {
  const ts = Date.parse(String(expiresAt || ''));
  if (!ts) return true;
  return Date.now() > ts;
}

async function getActiveSessionByToken(token) {
  return queryOne(
    `SELECT s.*, f.fingerprint_hash
     FROM user_sessions s
     JOIN user_fingerprints f ON s.fingerprint_id = f.id
     WHERE s.session_token = ? AND s.is_active = 1`,
    token
  );
}

router.post('/session', requireDb, async (req, res, next) => {
  try {
    const fingerprint = req.body?.fingerprint || {};
    const visitorId = String(fingerprint.visitorId || '').trim();
    if (!visitorId) return res.status(400).json({ ok: false, error: 'fingerprint.visitorId is required' });

    const fingerprintHash = sha256(visitorId);
    const now = new Date().toISOString();

    let fpRow = await queryOne(`SELECT * FROM user_fingerprints WHERE fingerprint_hash = ?`, fingerprintHash);

    if (!fpRow) {
      const fpId = `fp-${crypto.randomUUID()}`;
      await execute(
        `INSERT INTO user_fingerprints (
          id, fingerprint_hash, device_info, browser_info, os_info, screen_info,
          timezone, language, first_seen_at, last_seen_at, visit_count, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)`,
        fpId,
        fingerprintHash,
        null,
        toJson({ userAgent: req.body?.userAgent || null, components: fingerprint.components || null }),
        null,
        null,
        null,
        null,
        now,
        now,
        now,
        now
      );
      fpRow = await queryOne(`SELECT * FROM user_fingerprints WHERE fingerprint_hash = ?`, fingerprintHash);
    } else {
      await execute(
        `UPDATE user_fingerprints
         SET last_seen_at = ?, visit_count = COALESCE(visit_count, 0) + 1, updated_at = ?
         WHERE id = ?`,
        now,
        now,
        fpRow.id
      );
    }

    const sessionToken = `sess_${crypto.randomBytes(24).toString('hex')}`;
    const sessionId = `sess-${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();

    await execute(
      `INSERT INTO user_sessions (
        id, fingerprint_id, session_token, user_agent, ip_address, country_code, preferences,
        started_at, expires_at, last_activity_at, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      sessionId,
      fpRow.id,
      sessionToken,
      String(req.body?.userAgent || '').slice(0, 512) || null,
      String(req.ip || '').slice(0, 64) || null,
      null,
      null,
      now,
      expiresAt,
      now,
      now,
      now
    );

    return res.json({
      ok: true,
      data: {
        sessionToken,
        fingerprintId: fpRow.id,
        expiresAt,
      },
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/session/:token', requireDb, async (req, res, next) => {
  try {
    const token = String(req.params.token || '').trim();
    if (!token) return res.status(400).json({ ok: false, error: 'token is required' });

    const row = await getActiveSessionByToken(token);
    if (!row) return res.status(404).json({ ok: false, error: 'session not found' });
    if (isExpired(row.expires_at)) {
      await execute(`UPDATE user_sessions SET is_active = 0, updated_at = ? WHERE id = ?`, new Date().toISOString(), row.id);
      return res.status(401).json({ ok: false, error: 'session expired' });
    }

    return res.json({
      ok: true,
      data: {
        sessionToken: row.session_token,
        fingerprintId: row.fingerprint_id,
        expiresAt: row.expires_at,
        firstSeenAt: row.started_at,
        visitCount: undefined,
      },
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/session/:token/recover', requireDb, async (req, res, next) => {
  try {
    const token = String(req.params.token || '').trim();
    if (!token) return res.status(400).json({ ok: false, error: 'token is required' });

    const old = await queryOne(`SELECT * FROM user_sessions WHERE session_token = ?`, token);
    if (!old) return res.status(404).json({ ok: false, error: 'session not found' });

    const now = new Date().toISOString();
    const newToken = `sess_${crypto.randomBytes(24).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();

    // deactivate old
    await execute(`UPDATE user_sessions SET is_active = 0, updated_at = ? WHERE id = ?`, now, old.id);

    const newId = `sess-${crypto.randomUUID()}`;
    await execute(
      `INSERT INTO user_sessions (
        id, fingerprint_id, session_token, user_agent, ip_address, country_code, preferences,
        started_at, expires_at, last_activity_at, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      newId,
      old.fingerprint_id,
      newToken,
      old.user_agent,
      old.ip_address,
      old.country_code,
      old.preferences,
      now,
      expiresAt,
      now,
      now,
      now
    );

    return res.json({
      ok: true,
      data: {
        sessionToken: newToken,
        fingerprintId: old.fingerprint_id,
        expiresAt,
      },
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/preferences', requireDb, async (req, res, next) => {
  try {
    const token = String(getHeader(req, 'x-session-token') || '').trim();
    if (!token) return res.status(401).json({ ok: false, error: 'missing session token' });

    const session = await getActiveSessionByToken(token);
    if (!session) return res.status(401).json({ ok: false, error: 'invalid session token' });
    if (isExpired(session.expires_at)) return res.status(401).json({ ok: false, error: 'session expired' });

    const rows = await queryAll(
      `SELECT preference_key, preference_value FROM user_preferences WHERE fingerprint_id = ?`,
      session.fingerprint_id
    );

    const preferences = {};
    for (const r of rows) {
      preferences[r.preference_key] = fromJson(r.preference_value) ?? r.preference_value;
    }

    return res.json({ ok: true, data: { preferences } });
  } catch (err) {
    return next(err);
  }
});

router.put('/preferences', requireDb, async (req, res, next) => {
  try {
    const token = String(getHeader(req, 'x-session-token') || '').trim();
    if (!token) return res.status(401).json({ ok: false, error: 'missing session token' });

    const session = await getActiveSessionByToken(token);
    if (!session) return res.status(401).json({ ok: false, error: 'invalid session token' });
    if (isExpired(session.expires_at)) return res.status(401).json({ ok: false, error: 'session expired' });

    const key = String(req.body?.key || '').trim().slice(0, 128);
    const value = req.body?.value;
    if (!key) return res.status(400).json({ ok: false, error: 'key is required' });

    const id = `pref-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    await execute(
      `INSERT INTO user_preferences (id, fingerprint_id, preference_key, preference_value, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(fingerprint_id, preference_key)
       DO UPDATE SET preference_value = excluded.preference_value, updated_at = excluded.updated_at`,
      id,
      session.fingerprint_id,
      key,
      toJson(value) ?? String(value ?? ''),
      now,
      now
    );

    return res.json({ ok: true, data: { saved: true } });
  } catch (err) {
    return next(err);
  }
});

export default router;
