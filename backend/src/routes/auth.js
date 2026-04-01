import { Router } from 'express';
import { TOTP, NobleCryptoPlugin, ScureBase32Plugin } from 'otplib';

// otplib v13: TOTP class-based API requires explicit crypto/base32 plugins
const totp = new TOTP({
  crypto: new NobleCryptoPlugin(),
  base32: new ScureBase32Plugin(),
});
import QRCode from 'qrcode';
import { signJwt, verifyJwt } from '../lib/jwt.js';
import { config } from '../config.js';
import crypto from 'crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getRedisClient } from '../lib/redis-client.js';
import { createLogger } from '../lib/logger.js';

const logger = createLogger('auth');

const router = Router();

// ─── In-memory state ───────────────────────────────────────────────────────────

// TOTP secret: only use env-supplied TOTP_SECRET. Never auto-generate at startup.
let totpSecret = config.totp?.secret || null;
let totpSetupComplete = !!totpSecret;

// ADMIN_SETUP_TOKEN: used to gate the one-time TOTP provisioning flow.
// If not supplied in env, generate a random one and print it once to the console.
const adminSetupToken = process.env.ADMIN_SETUP_TOKEN || (() => {
  const generated = crypto.randomBytes(32).toString('hex');
  console.warn(
    '\n[auth] ⚠️  ADMIN_SETUP_TOKEN not set — generated a one-time token for this session:\n' +
    `       ADMIN_SETUP_TOKEN=${generated}\n` +
    '       Set this in your .env to make it permanent.\n'
  );
  return generated;
})();

/** @type {Map<string, { expiresAt: number }>} */
const totpChallenges = new Map();

/** @type {Map<string, { provider: string, expiresAt: number }>} */
const oauthStates = new Map();

/** @type {Set<string>} Fallback in-memory store when Redis is unavailable */
const _refreshTokenFallback = new Set();

const MAX_MAP_SIZE = 10_000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

function pruneExpiredEntries() {
  purgeStaleChallenges();
  // Cap _refreshTokenFallback — Set preserves insertion order, evict oldest
  if (_refreshTokenFallback.size > MAX_MAP_SIZE) {
    const excess = _refreshTokenFallback.size - MAX_MAP_SIZE;
    let removed = 0;
    for (const token of _refreshTokenFallback) {
      if (removed >= excess) break;
      _refreshTokenFallback.delete(token);
      removed++;
    }
  }
}

const _cleanupTimer = setInterval(pruneExpiredEntries, CLEANUP_INTERVAL_MS);
if (_cleanupTimer.unref) _cleanupTimer.unref();

function guardedMapSet(map, key, value) {
  if (map.size >= MAX_MAP_SIZE) pruneExpiredEntries();
  if (map.size >= MAX_MAP_SIZE) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
  map.set(key, value);
}

function guardedSetAdd(set, value) {
  if (set.size >= MAX_MAP_SIZE) {
    const oldest = set.values().next().value;
    if (oldest !== undefined) set.delete(oldest);
  }
  set.add(value);
}

const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days in seconds
const REDIS_KEY_PREFIX = 'refresh_token:';
const ANONYMOUS_TOKEN_EXPIRY = '30d';
const ANONYMOUS_TOKEN_EXPIRY_SECONDS = 30 * 24 * 60 * 60;

async function addRefreshToken(token) {
  try {
    const redis = await getRedisClient();
    await redis.set(`${REDIS_KEY_PREFIX}${token}`, '1', { EX: REFRESH_TOKEN_TTL });
  } catch (err) {
    logger.warn({}, 'Redis unavailable, falling back to in-memory store for refresh token', { error: err.message });
    guardedSetAdd(_refreshTokenFallback, token);
  }
}

async function hasRefreshToken(token) {
  try {
    const redis = await getRedisClient();
    const val = await redis.get(`${REDIS_KEY_PREFIX}${token}`);
    return val !== null;
  } catch (err) {
    logger.warn({}, 'Redis unavailable, checking in-memory fallback for refresh token', { error: err.message });
    return _refreshTokenFallback.has(token);
  }
}

async function removeRefreshToken(token) {
  try {
    const redis = await getRedisClient();
    await redis.del(`${REDIS_KEY_PREFIX}${token}`);
  } catch (err) {
    logger.warn({}, 'Redis unavailable, removing from in-memory fallback for refresh token', { error: err.message });
    _refreshTokenFallback.delete(token);
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getBearerToken(req) {
  const auth = req.headers['authorization'] || '';
  return String(auth).replace(/^Bearer\s+/i, '').trim();
}

function decodeExpiresAtFromToken(token) {
  try {
    const claims = verifyJwt(token);
    const expMs = typeof claims?.exp === 'number' ? claims.exp * 1000 : null;
    return expMs ? new Date(expMs).toISOString() : null;
  } catch {
    return null;
  }
}

function issueTokens(email) {
  const accessToken = signJwt(
    { sub: 'admin', role: 'admin', username: 'admin', email, emailVerified: true, type: 'access' },
    { expiresIn: '15m' }
  );
  const refreshToken = signJwt(
    { sub: 'admin', role: 'admin', username: 'admin', email, emailVerified: true, type: 'refresh' },
    { expiresIn: '7d' }
  );
  addRefreshToken(refreshToken).catch(err => logger.error({}, 'Failed to store refresh token', { error: err.message }));
  return { accessToken, refreshToken };
}

function buildAnonymousPayload(userId) {
  return {
    sub: userId,
    role: 'anonymous',
    userId,
    type: 'access',
    tokenClass: 'anonymous',
  };
}

function isAnonymousClaims(claims) {
  if (!claims || typeof claims !== 'object') return false;

  const userId = String(claims.userId || claims.sub || '');
  if (!userId.startsWith('anon-')) return false;

  return (
    claims.role === 'anonymous' &&
    claims.type === 'access' &&
    claims.tokenClass === 'anonymous'
  );
}

function isEmailAllowed(email) {
  const csv = config.oauth?.allowedEmails || '';
  if (!csv) return true; // if no allowlist configured, allow any OAuth email (dev mode)
  return csv
    .split(',')
    .map(e => e.trim().toLowerCase())
    .includes(String(email).toLowerCase());
}

function purgeStaleChallenges() {
  const now = Date.now();
  for (const [id, val] of totpChallenges) {
    if (now > val.expiresAt) totpChallenges.delete(id);
  }
  for (const [state, val] of oauthStates) {
    if (now > val.expiresAt) oauthStates.delete(state);
  }
}

async function upsertEnvVar(envPath, key, value) {
  let content = '';
  try {
    content = await fs.readFile(envPath, 'utf8');
  } catch {
    content = '';
  }

  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lineRegex = new RegExp(`^${escapedKey}=.*$`, 'm');
  const newLine = `${key}=${value}`;

  if (lineRegex.test(content)) {
    content = content.replace(lineRegex, newLine);
  } else {
    content = content.endsWith('\n') || content === ''
      ? content + newLine + '\n'
      : content + '\n' + newLine + '\n';
  }

  await fs.writeFile(envPath, content, 'utf8');
}

// ─── TOTP ──────────────────────────────────────────────────────────────────────

router.get('/totp/setup', async (req, res) => {
  if (totpSetupComplete) {
    return res.json({ ok: true, data: { setupComplete: true } });
  }

  const providedToken = req.headers['setup-token'];
  if (!providedToken || providedToken !== adminSetupToken) {
    return res.json({ ok: true, data: { setupComplete: false, requiresToken: true } });
  }

  try {
    if (!totpSecret) {
      totpSecret = totp.generateSecret();
    }

    const issuer = 'nodove blog';
    const account = 'admin';
    const otpauthUri = totp.toURI({ label: account, issuer, secret: totpSecret });
    const qrDataUrl = await QRCode.toDataURL(otpauthUri);

    return res.json({
      ok: true,
      data: {
        otpauthUri,
        qrDataUrl,
        secret: totpSecret,
        setupComplete: false,
      },
    });
  } catch (err) {
    logger.error({}, 'totp/setup error', { error: err.message });
    return res.status(500).json({ ok: false, error: 'Failed to generate TOTP setup' });
  }
});

router.post('/totp/setup/verify', async (req, res) => {
  if (totpSetupComplete) {
    return res.json({ ok: true, data: { setupComplete: true } });
  }

  const providedToken = req.headers['setup-token'];
  if (!providedToken || providedToken !== adminSetupToken) {
    return res.status(401).json({ ok: false, error: 'Setup-Token required' });
  }

  const { code } = req.body || {};
  if (!code) return res.status(400).json({ ok: false, error: 'code required' });
  if (!totpSecret) return res.status(400).json({ ok: false, error: 'TOTP not initialized — call GET /totp/setup first' });

  const valid = await totp.verify(String(code).trim(), { secret: totpSecret });
  if (!valid) return res.status(401).json({ ok: false, error: 'invalid code' });

  totpSetupComplete = true;

  try {
    const envPath = path.join(config.content.repoRoot, 'backend', '.env');
    await upsertEnvVar(envPath, 'TOTP_SECRET', totpSecret);
  } catch (err) {
    logger.error({}, 'Failed to persist TOTP_SECRET to .env', { error: err.message });
  }

  return res.json({ ok: true, data: { setupComplete: true } });
});

router.post('/totp/challenge', async (req, res) => {
  purgeStaleChallenges();
  const challengeId = `totp-${crypto.randomUUID()}`;
  guardedMapSet(totpChallenges, challengeId, { expiresAt: Date.now() + 5 * 60 * 1000 });
  return res.json({ ok: true, data: { challengeId } });
});

router.post('/totp/verify', async (req, res) => {
  const { challengeId, code } = req.body || {};
  if (!challengeId || !code) {
    return res.status(400).json({ ok: false, error: 'challengeId and code required' });
  }

  const challenge = totpChallenges.get(String(challengeId).trim());
  if (!challenge) return res.status(401).json({ ok: false, error: 'invalid or expired challenge' });
  if (Date.now() > challenge.expiresAt) {
    totpChallenges.delete(challengeId);
    return res.status(401).json({ ok: false, error: 'challenge expired' });
  }

  const valid = await totp.verify(String(code).trim(), { secret: totpSecret });
  if (!valid) return res.status(401).json({ ok: false, error: 'invalid TOTP code' });

  totpChallenges.delete(challengeId);

  const email = process.env.ADMIN_EMAIL || 'admin@local';
  const { accessToken, refreshToken } = issueTokens(email);

  return res.json({
    ok: true,
    data: {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 900,
      user: {
        username: 'admin',
        email,
        role: 'admin',
        emailVerified: true,
      },
    },
  });
});

// ─── OAuth2 — GitHub ────────────────────────────────────────────────────────────

/**
 * GET /api/v1/auth/oauth/github
 * Redirects to GitHub OAuth2 authorization URL.
 */
router.get('/oauth/github', (req, res) => {
  const clientId = config.oauth?.githubClientId;
  if (!clientId) {
    return res.status(503).json({ ok: false, error: 'GitHub OAuth not configured' });
  }

  purgeStaleChallenges();
  const state = crypto.randomUUID();
  guardedMapSet(oauthStates, state, { provider: 'github', expiresAt: Date.now() + 5 * 60 * 1000 });

  const redirectUri = `${config.oauth.redirectBaseUrl || config.apiBaseUrl}/api/v1/auth/oauth/github/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'read:user user:email',
    state,
  });
  return res.redirect(302, `https://github.com/login/oauth/authorize?${params.toString()}`);
});

/**
 * GET /api/v1/auth/oauth/github/callback
 * GitHub OAuth2 callback — exchanges code for token, fetches email, issues JWT.
 */
router.get('/oauth/github/callback', async (req, res) => {
  const { code, state, error: oauthError } = req.query;
  const frontendBase = config.oauth?.redirectBaseUrl || config.siteBaseUrl;

  if (oauthError) {
    return res.redirect(302, `${frontendBase}/admin/auth/callback#error=${encodeURIComponent(oauthError)}`);
  }

  const stateData = oauthStates.get(String(state || ''));
  if (!stateData || stateData.provider !== 'github' || Date.now() > stateData.expiresAt) {
    return res.redirect(302, `${frontendBase}/admin/auth/callback#error=invalid_state`);
  }
  oauthStates.delete(String(state));

  try {
    const clientId = config.oauth.githubClientId;
    const clientSecret = config.oauth.githubClientSecret;
    const redirectUri = `${config.oauth.redirectBaseUrl || config.apiBaseUrl}/api/v1/auth/oauth/github/callback`;

    // Exchange code for access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error || !tokenData.access_token) {
      return res.redirect(302, `${frontendBase}/admin/auth/callback#error=token_exchange_failed`);
    }

    // Fetch primary verified email
    const emailsRes = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    const emails = await emailsRes.json();
    const primary = Array.isArray(emails)
      ? emails.find(e => e.primary && e.verified)
      : null;
    const email = primary?.email;

    if (!email) {
      return res.redirect(302, `${frontendBase}/admin/auth/callback#error=no_verified_email`);
    }

    if (!isEmailAllowed(email)) {
      return res.redirect(302, `${frontendBase}/admin/auth/callback#error=email_not_allowed`);
    }

    const { accessToken, refreshToken } = issueTokens(email);
    const params = new URLSearchParams({ token: accessToken, refreshToken });
    return res.redirect(302, `${frontendBase}/admin/auth/callback#${params.toString()}`);
  } catch (err) {
    logger.error({}, 'github/callback error', { error: err.message });
    return res.redirect(302, `${frontendBase}/admin/auth/callback#error=server_error`);
  }
});

// ─── OAuth2 — Google ────────────────────────────────────────────────────────────

/**
 * GET /api/v1/auth/oauth/google
 * Redirects to Google OIDC authorization URL.
 */
router.get('/oauth/google', (req, res) => {
  const clientId = config.oauth?.googleClientId;
  if (!clientId) {
    return res.status(503).json({ ok: false, error: 'Google OAuth not configured' });
  }

  purgeStaleChallenges();
  const state = crypto.randomUUID();
  guardedMapSet(oauthStates, state, { provider: 'google', expiresAt: Date.now() + 5 * 60 * 1000 });

  const redirectUri = `${config.oauth.redirectBaseUrl || config.apiBaseUrl}/api/v1/auth/oauth/google/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
  });
  return res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

/**
 * GET /api/v1/auth/oauth/google/callback
 * Google OIDC callback — exchanges code for token, fetches userinfo, issues JWT.
 */
router.get('/oauth/google/callback', async (req, res) => {
  const { code, state, error: oauthError } = req.query;
  const frontendBase = config.oauth?.redirectBaseUrl || config.siteBaseUrl;

  if (oauthError) {
    return res.redirect(302, `${frontendBase}/admin/auth/callback#error=${encodeURIComponent(oauthError)}`);
  }

  const stateData = oauthStates.get(String(state || ''));
  if (!stateData || stateData.provider !== 'google' || Date.now() > stateData.expiresAt) {
    return res.redirect(302, `${frontendBase}/admin/auth/callback#error=invalid_state`);
  }
  oauthStates.delete(String(state));

  try {
    const clientId = config.oauth.googleClientId;
    const clientSecret = config.oauth.googleClientSecret;
    const redirectUri = `${config.oauth.redirectBaseUrl || config.apiBaseUrl}/api/v1/auth/oauth/google/callback`;

    // Exchange code for access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }).toString(),
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error || !tokenData.access_token) {
      return res.redirect(302, `${frontendBase}/admin/auth/callback#error=token_exchange_failed`);
    }

    // Fetch userinfo
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userInfo = await userRes.json();
    const email = userInfo?.email;

    if (!email) {
      return res.redirect(302, `${frontendBase}/admin/auth/callback#error=no_email`);
    }

    if (!isEmailAllowed(email)) {
      return res.redirect(302, `${frontendBase}/admin/auth/callback#error=email_not_allowed`);
    }

    const { accessToken, refreshToken } = issueTokens(email);
    const params = new URLSearchParams({ token: accessToken, refreshToken });
    return res.redirect(302, `${frontendBase}/admin/auth/callback#${params.toString()}`);
  } catch (err) {
    logger.error({}, 'google/callback error', { error: err.message });
    return res.redirect(302, `${frontendBase}/admin/auth/callback#error=server_error`);
  }
});

// ─── Token management (kept verbatim) ─────────────────────────────────────────

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    const token = String(refreshToken || '').trim();
    if (!token) return res.status(400).json({ ok: false, error: 'refreshToken required' });

    const tokenExists = await hasRefreshToken(token);
    if (!tokenExists) {
      return res.status(401).json({ ok: false, error: 'invalid refresh token' });
    }

    const claims = verifyJwt(token);
    if (claims?.type !== 'refresh') {
      return res.status(401).json({ ok: false, error: 'invalid refresh token' });
    }

    const username = claims.username || 'admin';
    const email = claims.email || process.env.ADMIN_EMAIL || 'admin@local';
    const accessToken = signJwt(
      { sub: 'admin', role: 'admin', username, email, emailVerified: true, type: 'access' },
      { expiresIn: '15m' }
    );

    return res.json({
      ok: true,
      data: {
        accessToken,
        tokenType: 'Bearer',
        expiresIn: 900,
      },
    });
  } catch (err) {
    return res.status(401).json({ ok: false, error: 'invalid refresh token' });
  }
});

router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body || {};
  const token = String(refreshToken || '').trim();
  if (token) await removeRefreshToken(token);
  return res.json({ ok: true });
});

router.get('/me', async (req, res) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    const claims = verifyJwt(token);

    const role = claims.role || (claims.sub === 'admin' ? 'admin' : 'user');
    const username = claims.username || (role === 'admin' ? 'admin' : 'user');
    const email = claims.email || (role === 'admin' ? (process.env.ADMIN_EMAIL || 'admin@local') : '');

    return res.json({
      ok: true,
      data: {
        user: {
          username,
          email,
          role,
          emailVerified: true,
        },
        claims,
      },
    });
  } catch (err) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
});

// ─── Anonymous (kept verbatim) ─────────────────────────────────────────────────

router.post('/anonymous', async (req, res) => {
  const userId = `anon-${crypto.randomUUID()}`;
  const token = signJwt(buildAnonymousPayload(userId), {
    expiresIn: ANONYMOUS_TOKEN_EXPIRY,
  });
  const expiresAt =
    decodeExpiresAtFromToken(token) ||
    new Date(Date.now() + ANONYMOUS_TOKEN_EXPIRY_SECONDS * 1000).toISOString();
  return res.json({
    ok: true,
    data: {
      token,
      expiresAt,
      expiresIn: ANONYMOUS_TOKEN_EXPIRY_SECONDS,
      userId,
      tokenType: 'Bearer',
      isAnonymous: true,
    },
  });
});

router.post('/anonymous/refresh', async (req, res) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    const claims = verifyJwt(token);
    if (!isAnonymousClaims(claims)) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const userId = claims.userId || claims.sub || `anon-${crypto.randomUUID()}`;
    const next = signJwt(buildAnonymousPayload(userId), {
      expiresIn: ANONYMOUS_TOKEN_EXPIRY,
    });
    const expiresAt =
      decodeExpiresAtFromToken(next) ||
      new Date(Date.now() + ANONYMOUS_TOKEN_EXPIRY_SECONDS * 1000).toISOString();
    return res.json({
      ok: true,
      data: {
        token: next,
        expiresAt,
        expiresIn: ANONYMOUS_TOKEN_EXPIRY_SECONDS,
        userId,
        tokenType: 'Bearer',
        isAnonymous: true,
      },
    });
  } catch {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
});

export default router;
