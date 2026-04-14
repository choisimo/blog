/**
 * Auth Routes — TOTP + OAuth2 (GitHub / Google)
 *
 * Admin authentication flow (replaces username/password + email OTP):
 *
 * TOTP flow:
 *   GET  /auth/totp/status        - Check whether TOTP is already configured
 *   GET  /auth/totp/setup         - Get secret for first-time setup or authenticated re-view
 *   POST /auth/totp/setup/verify  - Confirm TOTP setup with first code
 *   POST /auth/totp/challenge     - Create a short-lived challenge
 *   POST /auth/totp/verify        - Verify code + challengeId → issue JWT
 *
 * OAuth2 flow:
 *   GET  /auth/oauth/github           - Redirect to GitHub
 *   GET  /auth/oauth/github/callback  - Exchange code → issue JWT → redirect to frontend
 *   GET  /auth/oauth/google           - Redirect to Google
 *   GET  /auth/oauth/google/callback  - Exchange code → issue JWT → redirect to frontend
 *
 * Token management (unchanged):
 *   POST /auth/refresh    - Refresh access token
 *   POST /auth/logout     - Invalidate session
 *   GET  /auth/me         - Current user info
 *
 * Anonymous (unchanged, verbatim):
 *   POST /auth/anonymous         - Issue anonymous JWT
 *   POST /auth/anonymous/refresh - Refresh anonymous JWT
 *
 * Security:
 *   - TOTP secret stored in KV at key `totp:secret`
 *   - TOTP setup complete flag at `totp:setup:complete`
 *   - TOTP challenges expire in 5 minutes (`auth:challenge:{id}`)
 *   - OAuth state tokens expire in 5 minutes (`auth:oauth:state:{state}`)
 *   - Only emails in ADMIN_ALLOWED_EMAILS can authenticate via OAuth
 *   - All admin tokens have emailVerified: true
 */

import { Hono } from 'hono';
import type { HonoEnv } from '../types';
import { success, badRequest, unauthorized, error } from '../lib/response';
import {
  verifyJwt,
  signJwt,
  generateAccessToken,
  generateRefreshToken,
  generateSecureToken,
  REFRESH_TOKEN_EXPIRY,
} from '../lib/jwt';
import {
  generateTotpSecret,
  buildOtpauthUri,
  findMatchingTotpStep,
} from '../lib/totp';
import {
  buildGithubAuthUrl,
  exchangeGithubCode,
  buildGoogleAuthUrl,
  exchangeGoogleCode,
  generatePkcePair,
  isEmailAllowed,
} from '../lib/oauth';

const auth = new Hono<HonoEnv>();

// KV key prefixes
const KV_REFRESH_TOKEN_PREFIX = 'auth:refresh:';
const KV_REFRESH_FAMILY_PREFIX = 'auth:refresh-family:';
const KV_TOTP_SECRET_KEY = 'totp:secret';
const KV_TOTP_SETUP_KEY = 'totp:setup:complete';
const KV_TOTP_LAST_STEP_KEY = 'totp:last-successful-step';
const KV_CHALLENGE_PREFIX = 'auth:challenge:';
const KV_OAUTH_STATE_PREFIX = 'auth:oauth:state:';

// Anonymous token expiry (30 days)
const ANONYMOUS_TOKEN_EXPIRY = 30 * 24 * 3600;

// TOTP challenge TTL (5 minutes)
const CHALLENGE_TTL = 5 * 60;

// OAuth state TTL (5 minutes)
const OAUTH_STATE_TTL = 5 * 60;

// ============================================================================
// HELPERS
// ============================================================================

/** Build admin token payload with emailVerified: true */
function adminPayload(email: string) {
  return {
    sub: 'admin',
    role: 'admin' as const,
    username: 'admin',
    email,
    emailVerified: true,
  };
}

type RefreshTokenRecord = {
  jti: string;
  familyId: string;
  sub: string;
  email?: string;
  status: 'active' | 'rotated' | 'revoked';
  createdAt: string;
  rotatedAt?: string;
  replacedBy?: string;
  reason?: string;
};

type RefreshFamilyRecord = {
  familyId: string;
  revokedAt: string;
  reason: string;
  lastJti?: string;
};

function normalizeFrontendBaseUrl(rawValue: string | undefined): string | null {
  const trimmed = rawValue?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/admin\/auth\/callback\/?$/i, '').replace(/\/+$/g, '');
}

function getFrontendCallbackUrl(env: HonoEnv['Bindings']): string | null {
  const frontendBase = normalizeFrontendBaseUrl(env.OAUTH_REDIRECT_BASE_URL);
  if (!frontendBase) {
    return null;
  }
  return `${frontendBase}/admin/auth/callback`;
}

function getProviderCallbackUrl(requestUrl: string, provider: 'github' | 'google'): string {
  const origin = new URL(requestUrl).origin;
  return `${origin}/api/v1/auth/oauth/${provider}/callback`;
}

async function getRefreshFamilyRecord(
  env: HonoEnv['Bindings'],
  familyId: string
): Promise<RefreshFamilyRecord | null> {
  const raw = await env.KV.get(`${KV_REFRESH_FAMILY_PREFIX}${familyId}`);
  if (!raw) return null;
  return JSON.parse(raw) as RefreshFamilyRecord;
}

async function revokeRefreshFamily(
  env: HonoEnv['Bindings'],
  familyId: string,
  reason: string,
  lastJti?: string
): Promise<void> {
  await env.KV.put(
    `${KV_REFRESH_FAMILY_PREFIX}${familyId}`,
    JSON.stringify({
      familyId,
      revokedAt: new Date().toISOString(),
      reason,
      ...(lastJti ? { lastJti } : {}),
    } satisfies RefreshFamilyRecord),
    { expirationTtl: REFRESH_TOKEN_EXPIRY }
  );
}

async function putRefreshTokenRecord(
  env: HonoEnv['Bindings'],
  record: RefreshTokenRecord
): Promise<void> {
  await env.KV.put(`${KV_REFRESH_TOKEN_PREFIX}${record.jti}`, JSON.stringify(record), {
    expirationTtl: REFRESH_TOKEN_EXPIRY,
  });
}

async function getRefreshTokenRecord(
  env: HonoEnv['Bindings'],
  jti: string
): Promise<RefreshTokenRecord | null> {
  const raw = await env.KV.get(`${KV_REFRESH_TOKEN_PREFIX}${jti}`);
  if (!raw) return null;
  return JSON.parse(raw) as RefreshTokenRecord;
}

/** Issue access + refresh tokens and store refresh token in KV */
async function issueAdminTokens(
  payload: ReturnType<typeof adminPayload>,
  env: HonoEnv['Bindings'],
  options: { familyId?: string } = {}
): Promise<{
  accessToken: string;
  refreshToken: string;
  refreshTokenId: string;
  familyId: string;
}> {
  const familyId = options.familyId ?? generateSecureToken(16);
  const refreshTokenId = generateSecureToken(16);

  const accessToken = await generateAccessToken(payload, env);
  const refreshToken = await generateRefreshToken(
    {
      ...payload,
      familyId,
    },
    env,
    refreshTokenId
  );

  await putRefreshTokenRecord(env, {
    jti: refreshTokenId,
    familyId,
    sub: payload.sub,
    email: payload.email,
    status: 'active',
    createdAt: new Date().toISOString(),
  });

  return {
    accessToken,
    refreshToken,
    refreshTokenId,
    familyId,
  };
}

async function consumeTotpStep(
  env: HonoEnv['Bindings'],
  step: number
): Promise<boolean> {
  const previous = await env.KV.get(KV_TOTP_LAST_STEP_KEY);
  const previousStep = previous ? Number.parseInt(previous, 10) : Number.NaN;
  if (Number.isFinite(previousStep) && step <= previousStep) {
    return false;
  }

  await env.KV.put(
    KV_TOTP_LAST_STEP_KEY,
    String(step),
    { expirationTtl: 30 * 24 * 60 * 60 }
  );
  return true;
}

// ============================================================================
// TOTP SETUP
// ============================================================================

/**
 * GET /auth/totp/status
 * Returns whether TOTP setup is complete without exposing the secret itself.
 */
auth.get('/totp/status', async (c) => {
  const setupComplete = await c.env.KV.get(KV_TOTP_SETUP_KEY);

  return success(c, {
    setupComplete: setupComplete === 'true',
    requiresSetupToken: setupComplete !== 'true',
  });
});

/**
 * GET /auth/totp/setup
 * Returns otpauthUri + base32 secret for QR code rendering.
 * If setup is already complete, returns status-only unless a valid admin Bearer token is provided.
 * If setup is not complete, requires a valid Setup-Token header.
 */
auth.get('/totp/setup', async (c) => {
  const setupComplete = await c.env.KV.get(KV_TOTP_SETUP_KEY);

  if (setupComplete === 'true') {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return success(c, { setupComplete: true });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    try {
      const payload = await verifyJwt(token, c.env);
      if (payload.role !== 'admin') {
        return unauthorized(c, 'Admin token required');
      }
    } catch {
      return unauthorized(c, 'Invalid admin token');
    }
  } else {
    const configuredSetupToken = c.env.ADMIN_SETUP_TOKEN?.trim();
    if (!configuredSetupToken) {
      return error(c, 'ADMIN_SETUP_TOKEN is not configured', 503, 'SETUP_TOKEN_UNAVAILABLE');
    }

    const providedSetupToken = c.req.header('Setup-Token')?.trim();
    if (!providedSetupToken || providedSetupToken !== configuredSetupToken) {
      return unauthorized(c, 'Valid setup token required');
    }
  }

  // Get or generate the TOTP secret
  let secret = await c.env.KV.get(KV_TOTP_SECRET_KEY);
  if (!secret) {
    secret = generateTotpSecret();
    await c.env.KV.put(KV_TOTP_SECRET_KEY, secret);
  }

  const otpauthUri = buildOtpauthUri(secret, 'nodove blog', 'admin');

  return success(c, {
    otpauthUri,
    secret,
    setupComplete: setupComplete === 'true',
  });
});

/**
 * POST /auth/totp/setup/verify
 * Verify the first TOTP code to confirm setup is complete.
 * Body: { code: string }
 */
auth.post('/totp/setup/verify', async (c) => {
  const setupComplete = await c.env.KV.get(KV_TOTP_SETUP_KEY);
  if (setupComplete === 'true') {
    return success(c, { setupComplete: true, message: 'TOTP setup already complete' });
  }

  const configuredSetupToken = c.env.ADMIN_SETUP_TOKEN?.trim();
  if (!configuredSetupToken) {
    return error(c, 'ADMIN_SETUP_TOKEN is not configured', 503, 'SETUP_TOKEN_UNAVAILABLE');
  }

  const providedSetupToken = c.req.header('Setup-Token')?.trim();
  if (!providedSetupToken || providedSetupToken !== configuredSetupToken) {
    return unauthorized(c, 'Valid setup token required');
  }

  const body = (await c.req.json().catch(() => ({}))) as { code?: string };
  const { code } = body;

  if (!code) return badRequest(c, 'code required');

  const secret = await c.env.KV.get(KV_TOTP_SECRET_KEY);
  if (!secret) return error(c, 'TOTP not yet initialized — call GET /auth/totp/setup first', 400);

  const matchingStep = await findMatchingTotpStep(secret, code);
  if (matchingStep === null) {
    return unauthorized(c, 'Invalid TOTP code');
  }

  if (!(await consumeTotpStep(c.env, matchingStep))) {
    return unauthorized(c, 'TOTP code already used');
  }

  await c.env.KV.put(KV_TOTP_SETUP_KEY, 'true');
  return success(c, { setupComplete: true, message: 'TOTP setup complete' });
});

// ============================================================================
// TOTP LOGIN
// ============================================================================

/**
 * POST /auth/totp/challenge
 * Creates a short-lived challenge ID (5 min) that must be passed to /totp/verify.
 * Stateless — no user identity needed yet.
 */
auth.post('/totp/challenge', async (c) => {
  const setupComplete = await c.env.KV.get(KV_TOTP_SETUP_KEY);
  if (setupComplete !== 'true') {
    return error(c, 'TOTP not configured — complete setup first', 400);
  }

  const challengeId = generateSecureToken(32);
  await c.env.KV.put(
    `${KV_CHALLENGE_PREFIX}${challengeId}`,
    JSON.stringify({ id: challengeId, createdAt: new Date().toISOString() }),
    { expirationTtl: CHALLENGE_TTL }
  );

  return success(c, {
    challengeId,
    expiresIn: CHALLENGE_TTL,
  });
});

/**
 * POST /auth/totp/verify
 * Verify TOTP code + challenge → issue JWT tokens.
 * Body: { challengeId: string, code: string }
 */
auth.post('/totp/verify', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    challengeId?: string;
    code?: string;
  };
  const { challengeId, code } = body;

  if (!challengeId || !code) {
    return badRequest(c, 'challengeId and code required');
  }

  // Validate challenge (consume it — single use)
  const challengeData = await c.env.KV.get(`${KV_CHALLENGE_PREFIX}${challengeId}`);
  if (!challengeData) {
    return unauthorized(c, 'Invalid or expired challenge');
  }
  await c.env.KV.delete(`${KV_CHALLENGE_PREFIX}${challengeId}`);

  // Verify TOTP code
  const secret = await c.env.KV.get(KV_TOTP_SECRET_KEY);
  if (!secret) {
    return error(c, 'TOTP not configured', 500);
  }

  const matchingStep = await findMatchingTotpStep(secret, code);
  if (matchingStep === null) {
    await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500));
    return unauthorized(c, 'Invalid TOTP code');
  }

  if (!(await consumeTotpStep(c.env, matchingStep))) {
    await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500));
    return unauthorized(c, 'TOTP code already used');
  }

  // Issue tokens — use a placeholder email since TOTP has no identity
  const payload = adminPayload('admin@totp.local');
  const { accessToken, refreshToken } = await issueAdminTokens(payload, c.env);

  return success(c, {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: 15 * 60,
    user: {
      username: 'admin',
      email: 'admin@totp.local',
      role: 'admin',
      emailVerified: true,
      authMethod: 'totp',
    },
  });
});

// ============================================================================
// OAUTH2 — GITHUB
// ============================================================================

/**
 * GET /auth/oauth/github
 * Redirect to GitHub OAuth authorization page
 */
auth.get('/oauth/github', async (c) => {
  const clientId = c.env.GITHUB_CLIENT_ID;
  const frontendCallbackUrl = getFrontendCallbackUrl(c.env);

  if (!clientId || !frontendCallbackUrl) {
    return error(c, 'GitHub OAuth not configured', 500);
  }

  const state = generateSecureToken(32);
  const { codeVerifier, codeChallenge } = await generatePkcePair();
  await c.env.KV.put(
    `${KV_OAUTH_STATE_PREFIX}${state}`,
    JSON.stringify({
      state,
      provider: 'github',
      createdAt: new Date().toISOString(),
      codeVerifier,
    }),
    { expirationTtl: OAUTH_STATE_TTL }
  );

  const redirectUri = getProviderCallbackUrl(c.req.url, 'github');
  const url = buildGithubAuthUrl(state, clientId, redirectUri, codeChallenge);
  return c.redirect(url, 302);
});

/**
 * GET /auth/oauth/github/callback
 * Exchange code → verify email → issue JWT → redirect to frontend
 */
auth.get('/oauth/github/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const frontendCallbackUrl = getFrontendCallbackUrl(c.env);

  if (!code || !state || !frontendCallbackUrl) {
    return error(c, 'Invalid callback parameters', 400);
  }

  // Validate state
  const stateData = await c.env.KV.get(`${KV_OAUTH_STATE_PREFIX}${state}`);
  if (!stateData) {
    return unauthorized(c, 'Invalid or expired OAuth state');
  }
  await c.env.KV.delete(`${KV_OAUTH_STATE_PREFIX}${state}`);
  const parsedState = JSON.parse(stateData) as {
    provider?: string;
    codeVerifier?: string;
  };
  if (parsedState.provider !== 'github' || !parsedState.codeVerifier) {
    return unauthorized(c, 'Invalid or expired OAuth state');
  }

  const clientId = c.env.GITHUB_CLIENT_ID;
  const clientSecret = c.env.GITHUB_CLIENT_SECRET;
  const allowedEmails = c.env.ADMIN_ALLOWED_EMAILS;

  if (!clientId || !clientSecret) {
    return error(c, 'GitHub OAuth not configured', 500);
  }

  try {
    const redirectUri = getProviderCallbackUrl(c.req.url, 'github');
    const { email } = await exchangeGithubCode(
      code,
      clientId,
      clientSecret,
      redirectUri,
      parsedState.codeVerifier
    );

    // Check allowlist
    if (!allowedEmails || !isEmailAllowed(email, allowedEmails)) {
      return c.redirect(`${frontendCallbackUrl}#error=email_not_allowed`, 302);
    }

    const payload = adminPayload(email);
    const { accessToken, refreshToken } = await issueAdminTokens(payload, c.env);

    const fragment = new URLSearchParams({ token: accessToken, refreshToken });
    return c.redirect(`${frontendCallbackUrl}#${fragment.toString()}`, 302);
  } catch (err) {
    console.error('GitHub callback error:', err);
    return c.redirect(`${frontendCallbackUrl}#error=oauth_failed`, 302);
  }
});

// ============================================================================
// OAUTH2 — GOOGLE
// ============================================================================

/**
 * GET /auth/oauth/google
 * Redirect to Google OIDC authorization page
 */
auth.get('/oauth/google', async (c) => {
  const clientId = c.env.GOOGLE_CLIENT_ID;
  const frontendCallbackUrl = getFrontendCallbackUrl(c.env);

  if (!clientId || !frontendCallbackUrl) {
    return error(c, 'Google OAuth not configured', 500);
  }

  const state = generateSecureToken(32);
  const { codeVerifier, codeChallenge } = await generatePkcePair();
  await c.env.KV.put(
    `${KV_OAUTH_STATE_PREFIX}${state}`,
    JSON.stringify({
      state,
      provider: 'google',
      createdAt: new Date().toISOString(),
      codeVerifier,
    }),
    { expirationTtl: OAUTH_STATE_TTL }
  );

  const redirectUri = getProviderCallbackUrl(c.req.url, 'google');
  const url = buildGoogleAuthUrl(state, clientId, redirectUri, codeChallenge);
  return c.redirect(url, 302);
});

/**
 * GET /auth/oauth/google/callback
 * Exchange code → verify email → issue JWT → redirect to frontend
 */
auth.get('/oauth/google/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const frontendCallbackUrl = getFrontendCallbackUrl(c.env);

  if (!code || !state || !frontendCallbackUrl) {
    return error(c, 'Invalid callback parameters', 400);
  }

  // Validate state
  const stateData = await c.env.KV.get(`${KV_OAUTH_STATE_PREFIX}${state}`);
  if (!stateData) {
    return unauthorized(c, 'Invalid or expired OAuth state');
  }
  await c.env.KV.delete(`${KV_OAUTH_STATE_PREFIX}${state}`);
  const parsedState = JSON.parse(stateData) as {
    provider?: string;
    codeVerifier?: string;
  };
  if (parsedState.provider !== 'google' || !parsedState.codeVerifier) {
    return unauthorized(c, 'Invalid or expired OAuth state');
  }

  const clientId = c.env.GOOGLE_CLIENT_ID;
  const clientSecret = c.env.GOOGLE_CLIENT_SECRET;
  const allowedEmails = c.env.ADMIN_ALLOWED_EMAILS;

  if (!clientId || !clientSecret) {
    return error(c, 'Google OAuth not configured', 500);
  }

  try {
    const redirectUri = getProviderCallbackUrl(c.req.url, 'google');
    const { email } = await exchangeGoogleCode(
      code,
      clientId,
      clientSecret,
      redirectUri,
      parsedState.codeVerifier
    );

    // Check allowlist
    if (!allowedEmails || !isEmailAllowed(email, allowedEmails)) {
      return c.redirect(`${frontendCallbackUrl}#error=email_not_allowed`, 302);
    }

    const payload = adminPayload(email);
    const { accessToken, refreshToken } = await issueAdminTokens(payload, c.env);

    const fragment = new URLSearchParams({ token: accessToken, refreshToken });
    return c.redirect(`${frontendCallbackUrl}#${fragment.toString()}`, 302);
  } catch (err) {
    console.error('Google callback error:', err);
    return c.redirect(`${frontendCallbackUrl}#error=oauth_failed`, 302);
  }
});

// ============================================================================
// TOKEN MANAGEMENT (unchanged)
// ============================================================================

/**
 * POST /auth/refresh
 * Use refresh token to get new access token
 */
auth.post('/refresh', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { refreshToken } = body as { refreshToken?: string };

  if (!refreshToken) {
    return badRequest(c, 'refreshToken required');
  }

  try {
    const payload = await verifyJwt(refreshToken, c.env);

    if (payload.type !== 'refresh') {
      return unauthorized(c, 'Invalid token type');
    }
    if (payload.role !== 'admin' || !payload.emailVerified || !payload.email) {
      return unauthorized(c, 'Invalid refresh token');
    }

    if (!payload.jti) {
      return unauthorized(c, 'Token missing jti claim');
    }
    if (!payload.familyId) {
      return unauthorized(c, 'Token missing family claim');
    }

    const revokedFamily = await getRefreshFamilyRecord(c.env, payload.familyId);
    if (revokedFamily) {
      return unauthorized(c, 'Refresh token revoked or expired');
    }

    const tokenRecord = await getRefreshTokenRecord(c.env, payload.jti);
    if (!tokenRecord) {
      await revokeRefreshFamily(c.env, payload.familyId, 'reuse-detected', payload.jti);
      return unauthorized(c, 'Refresh token revoked or expired');
    }
    if (tokenRecord.status !== 'active') {
      await revokeRefreshFamily(c.env, payload.familyId, 'reuse-detected', payload.jti);
      return unauthorized(c, 'Refresh token reuse detected');
    }

    const newTokens = await issueAdminTokens(
      adminPayload(payload.email),
      c.env,
      { familyId: payload.familyId }
    );
    await putRefreshTokenRecord(c.env, {
      ...tokenRecord,
      status: 'rotated',
      rotatedAt: new Date().toISOString(),
      replacedBy: newTokens.refreshTokenId,
    });

    return success(c, {
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
      tokenType: 'Bearer',
      expiresIn: 15 * 60,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid refresh token';
    return unauthorized(c, message);
  }
});

/**
 * POST /auth/logout
 * Invalidate refresh token (client should also discard tokens)
 */
auth.post('/logout', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { refreshToken } = body as { refreshToken?: string };

  if (refreshToken) {
    try {
      const payload = await verifyJwt(refreshToken, c.env);
      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }
      if (payload.familyId) {
        await revokeRefreshFamily(c.env, payload.familyId, 'logout', payload.jti);
      }
      if (payload.jti) {
        const tokenRecord = await getRefreshTokenRecord(c.env, payload.jti);
        if (tokenRecord) {
          await putRefreshTokenRecord(c.env, {
            ...tokenRecord,
            status: 'revoked',
            reason: 'logout',
          });
        }
      }
    } catch {
      // Token may already be expired/invalid — still acknowledge logout
    }
  }

  return success(c, { message: 'Logged out successfully' });
});

/**
 * GET /auth/me
 * Get current user info from access token
 */
auth.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) {
    return unauthorized(c, 'Missing Authorization header');
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return unauthorized(c, 'Invalid Authorization format');
  }

  try {
    const claims = await verifyJwt(token, c.env);

    if (claims.type === 'refresh') {
      return unauthorized(c, 'Invalid token type');
    }

    return success(c, {
      user: {
        username: claims.username,
        email: claims.email,
        role: claims.role,
        emailVerified: claims.emailVerified,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unauthorized';
    return unauthorized(c, message);
  }
});

// ============================================================================
// ANONYMOUS TOKENS (verbatim — DO NOT MODIFY)
// ============================================================================

/**
 * POST /auth/anonymous
 * Issue an anonymous JWT token for unauthenticated users
 * This allows anonymous users to use features like memos, personas, etc.
 * The token contains a unique anonymous user ID that persists across sessions
 */
auth.post('/anonymous', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { existingId } = body as { existingId?: string };

  // Use existing anonymous ID or generate a new one
  let anonymousId: string;

  if (existingId && typeof existingId === 'string' && existingId.startsWith('anon-')) {
    // Validate existing ID format (anon-{uuid})
    const uuidPart = existingId.slice(5);
    if (/^[a-f0-9-]{36}$/.test(uuidPart)) {
      anonymousId = existingId;
    } else {
      anonymousId = `anon-${crypto.randomUUID()}`;
    }
  } else {
    anonymousId = `anon-${crypto.randomUUID()}`;
  }

  // Generate a long-lived token for anonymous users
  const token = await signJwt(
    {
      sub: anonymousId,
      role: 'anonymous',
      username: 'Anonymous',
      tokenClass: 'anonymous',
      type: 'access',
    },
    c.env,
    ANONYMOUS_TOKEN_EXPIRY
  );
  const expiresAt = new Date(
    Date.now() + ANONYMOUS_TOKEN_EXPIRY * 1000
  ).toISOString();

  return success(c, {
    token,
    userId: anonymousId,
    tokenType: 'Bearer',
    expiresIn: ANONYMOUS_TOKEN_EXPIRY,
    expiresAt,
    isAnonymous: true,
  });
});

/**
 * POST /auth/anonymous/refresh
 * Refresh an anonymous token (extends expiration)
 */
auth.post('/anonymous/refresh', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) {
    return unauthorized(c, 'Missing Authorization header');
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return unauthorized(c, 'Invalid Authorization format');
  }

  try {
    const payload = await verifyJwt(token, c.env);

    // Only refresh anonymous tokens
    if (
      payload.role !== 'anonymous' ||
      payload.type !== 'access' ||
      payload.tokenClass !== 'anonymous' ||
      !payload.sub?.startsWith('anon-')
    ) {
      return badRequest(c, 'Not an anonymous token');
    }

    // Generate new token with same anonymous ID
    const newToken = await signJwt(
      {
        sub: payload.sub,
        role: 'anonymous',
        username: 'Anonymous',
        tokenClass: 'anonymous',
        type: 'access',
      },
      c.env,
      ANONYMOUS_TOKEN_EXPIRY
    );
    const expiresAt = new Date(
      Date.now() + ANONYMOUS_TOKEN_EXPIRY * 1000
    ).toISOString();

    return success(c, {
      token: newToken,
      userId: payload.sub,
      tokenType: 'Bearer',
      expiresIn: ANONYMOUS_TOKEN_EXPIRY,
      expiresAt,
      isAnonymous: true,
    });
  } catch (err) {
    // Token expired or invalid - issue new anonymous token
    const anonymousId = `anon-${crypto.randomUUID()}`;
    const newToken = await signJwt(
      {
        sub: anonymousId,
        role: 'anonymous',
        username: 'Anonymous',
        tokenClass: 'anonymous',
        type: 'access',
      },
      c.env,
      ANONYMOUS_TOKEN_EXPIRY
    );
    const expiresAt = new Date(
      Date.now() + ANONYMOUS_TOKEN_EXPIRY * 1000
    ).toISOString();

    return success(c, {
      token: newToken,
      userId: anonymousId,
      tokenType: 'Bearer',
      expiresIn: ANONYMOUS_TOKEN_EXPIRY,
      expiresAt,
      isAnonymous: true,
      renewed: true,
    });
  }
});

export default auth;
