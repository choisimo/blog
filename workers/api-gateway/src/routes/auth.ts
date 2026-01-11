/**
 * Enhanced Auth Routes with Email OTP Verification
 *
 * Flow:
 * 1. POST /auth/login - Verify credentials, send OTP to admin email
 * 2. POST /auth/verify-otp - Verify OTP, issue access + refresh tokens
 * 3. POST /auth/refresh - Use refresh token to get new access token
 * 4. POST /auth/logout - Invalidate refresh token
 * 5. GET /auth/me - Get current user info
 *
 * Security:
 * - Admin credentials from GitHub Secrets (env vars)
 * - OTP sent to admin email (ADMIN_EMAIL)
 * - Access token: 15 minutes
 * - Refresh token: 7 days (stored in KV for revocation)
 * - OTP: 10 minutes, single use
 */

import { Hono } from 'hono';
import type { HonoEnv, Env, AuthSession } from '../types';
import { success, badRequest, unauthorized, error } from '../lib/response';
import {
  verifyJwt,
  signJwt,
  generateAccessToken,
  generateRefreshToken,
  generateOtp,
  generateSecureToken,
  OTP_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
} from '../lib/jwt';

const auth = new Hono<HonoEnv>();

// KV key prefixes
const KV_AUTH_SESSION_PREFIX = 'auth:session:';
const KV_REFRESH_TOKEN_PREFIX = 'auth:refresh:';

// Anonymous token expiry (30 days)
const ANONYMOUS_TOKEN_EXPIRY = 30 * 24 * 3600;

/**
 * Hash a string using SHA-256 (for OTP storage)
 */
async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Send OTP email via Resend
 */
async function sendOtpEmail(env: Env, email: string, otp: string): Promise<boolean> {
  const apiKey = env.RESEND_API_KEY;
  const from = env.NOTIFY_FROM_EMAIL;

  if (!apiKey || !from) {
    console.error('Missing email configuration for OTP');
    return false;
  }

  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #0f172a; max-width: 400px; margin: 0 auto; padding: 20px;">
      <h2 style="margin: 0 0 16px; color: #1e293b;">Admin Login Verification</h2>
      <p style="margin: 0 0 16px; color: #475569;">Your one-time verification code is:</p>
      <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; text-align: center; margin: 0 0 16px;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0f172a;">${otp}</span>
      </div>
      <p style="margin: 0 0 8px; color: #64748b; font-size: 14px;">This code expires in 10 minutes.</p>
      <p style="margin: 0; color: #94a3b8; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
    </div>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `Admin Login: Your verification code is ${otp}`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Failed to send OTP email:', res.status, err);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error sending OTP email:', err);
    return false;
  }
}

/**
 * POST /auth/login
 * Step 1: Verify credentials and send OTP to admin email
 */
auth.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { username, password } = body as { username?: string; password?: string };

  if (!username || !password) {
    return badRequest(c, 'username and password required');
  }

  // Verify admin credentials from env (GitHub Secrets)
  const adminUsername = c.env.ADMIN_USERNAME;
  const adminPassword = c.env.ADMIN_PASSWORD;
  const adminEmail = c.env.ADMIN_EMAIL;

  if (!adminUsername || !adminPassword) {
    return error(c, 'Authentication not configured', 500);
  }

  if (username !== adminUsername || password !== adminPassword) {
    // Add delay to prevent timing attacks
    await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500));
    return unauthorized(c, 'Invalid credentials');
  }

  if (!adminEmail) {
    return error(c, 'Admin email not configured for OTP verification', 500);
  }

  // Generate OTP and session
  const otp = generateOtp(6);
  const sessionId = generateSecureToken(32);
  const otpHash = await hashString(otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY * 1000).toISOString();

  // Store session in KV
  const session: AuthSession = {
    id: sessionId,
    username: adminUsername,
    email: adminEmail,
    otp_hash: otpHash,
    otp_expires_at: expiresAt,
    is_verified: 0,
    created_at: new Date().toISOString(),
  };

  await c.env.KV.put(
    `${KV_AUTH_SESSION_PREFIX}${sessionId}`,
    JSON.stringify(session),
    { expirationTtl: OTP_EXPIRY + 60 } // Add 1 minute buffer
  );

  // Send OTP email
  const emailSent = await sendOtpEmail(c.env, adminEmail, otp);

  if (!emailSent) {
    // In development, return OTP for testing (NOT for production!)
    if (c.env.ENV !== 'production') {
      return success(c, {
        sessionId,
        message: 'OTP generated (dev mode)',
        expiresAt,
        _dev_otp: otp, // Only in development!
      });
    }
    return error(c, 'Failed to send verification email', 500);
  }

  // Mask email for response
  const maskedEmail = adminEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3');

  return success(c, {
    sessionId,
    message: `Verification code sent to ${maskedEmail}`,
    expiresAt,
  });
});

/**
 * POST /auth/verify-otp
 * Step 2: Verify OTP and issue tokens
 */
auth.post('/verify-otp', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { sessionId, otp } = body as { sessionId?: string; otp?: string };

  if (!sessionId || !otp) {
    return badRequest(c, 'sessionId and otp required');
  }

  // Get session from KV
  const sessionData = await c.env.KV.get(`${KV_AUTH_SESSION_PREFIX}${sessionId}`);
  if (!sessionData) {
    return unauthorized(c, 'Invalid or expired session');
  }

  const session: AuthSession = JSON.parse(sessionData);

  // Check if already verified (prevent replay)
  if (session.is_verified) {
    return unauthorized(c, 'Session already verified');
  }

  // Check OTP expiration
  if (new Date(session.otp_expires_at) < new Date()) {
    await c.env.KV.delete(`${KV_AUTH_SESSION_PREFIX}${sessionId}`);
    return unauthorized(c, 'Verification code expired');
  }

  // Verify OTP
  const otpHash = await hashString(otp);
  if (otpHash !== session.otp_hash) {
    // Add delay to prevent brute force
    await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500));
    return unauthorized(c, 'Invalid verification code');
  }

  // Mark session as verified and delete it (single use)
  await c.env.KV.delete(`${KV_AUTH_SESSION_PREFIX}${sessionId}`);

  // Generate tokens
  const tokenPayload = {
    sub: 'admin',
    role: 'admin',
    username: session.username,
    email: session.email,
    emailVerified: true,
  };

  const accessToken = await generateAccessToken(tokenPayload, c.env);
  const refreshToken = await generateRefreshToken(tokenPayload, c.env);

  // Store refresh token in KV for revocation capability
  const refreshTokenId = generateSecureToken(16);
  await c.env.KV.put(
    `${KV_REFRESH_TOKEN_PREFIX}${refreshTokenId}`,
    JSON.stringify({
      token: refreshToken,
      username: session.username,
      createdAt: new Date().toISOString(),
    }),
    { expirationTtl: REFRESH_TOKEN_EXPIRY }
  );

  return success(c, {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: 15 * 60, // 15 minutes in seconds
    user: {
      username: session.username,
      email: session.email,
      role: 'admin',
    },
  });
});

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
    // Verify refresh token
    const payload = await verifyJwt(refreshToken, c.env);

    if (payload.type !== 'refresh') {
      return unauthorized(c, 'Invalid token type');
    }

    // Generate new access token
    const accessToken = await generateAccessToken(
      {
        sub: payload.sub,
        role: payload.role,
        username: payload.username,
        email: payload.email,
        emailVerified: true,
      },
      c.env
    );

    return success(c, {
      accessToken,
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
      // We could store revoked tokens in KV if needed
      // For now, just acknowledge logout
      // The refresh token will naturally expire
    } catch {
      // Ignore errors during logout
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

    // Ensure it's an access token and email is verified
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

/**
 * POST /auth/resend-otp
 * Resend OTP for an existing session
 */
auth.post('/resend-otp', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { sessionId } = body as { sessionId?: string };

  if (!sessionId) {
    return badRequest(c, 'sessionId required');
  }

  // Get session from KV
  const sessionData = await c.env.KV.get(`${KV_AUTH_SESSION_PREFIX}${sessionId}`);
  if (!sessionData) {
    return unauthorized(c, 'Invalid or expired session');
  }

  const session: AuthSession = JSON.parse(sessionData);

  // Check if already verified
  if (session.is_verified) {
    return badRequest(c, 'Session already verified');
  }

  // Generate new OTP
  const otp = generateOtp(6);
  const otpHash = await hashString(otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY * 1000).toISOString();

  // Update session
  session.otp_hash = otpHash;
  session.otp_expires_at = expiresAt;

  await c.env.KV.put(
    `${KV_AUTH_SESSION_PREFIX}${sessionId}`,
    JSON.stringify(session),
    { expirationTtl: OTP_EXPIRY + 60 }
  );

  // Send new OTP email
  const emailSent = await sendOtpEmail(c.env, session.email, otp);

  if (!emailSent) {
    if (c.env.ENV !== 'production') {
      return success(c, {
        message: 'New OTP generated (dev mode)',
        expiresAt,
        _dev_otp: otp,
      });
    }
    return error(c, 'Failed to send verification email', 500);
  }

  const maskedEmail = session.email.replace(/(.{2})(.*)(@.*)/, '$1***$3');

  return success(c, {
    message: `New verification code sent to ${maskedEmail}`,
    expiresAt,
  });
});

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
      type: 'access',
    },
    c.env,
    ANONYMOUS_TOKEN_EXPIRY
  );

  return success(c, {
    token,
    userId: anonymousId,
    tokenType: 'Bearer',
    expiresIn: ANONYMOUS_TOKEN_EXPIRY,
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
    if (payload.role !== 'anonymous' || !payload.sub?.startsWith('anon-')) {
      return badRequest(c, 'Not an anonymous token');
    }

    // Generate new token with same anonymous ID
    const newToken = await signJwt(
      {
        sub: payload.sub,
        role: 'anonymous',
        username: 'Anonymous',
        type: 'access',
      },
      c.env,
      ANONYMOUS_TOKEN_EXPIRY
    );

    return success(c, {
      token: newToken,
      userId: payload.sub,
      tokenType: 'Bearer',
      expiresIn: ANONYMOUS_TOKEN_EXPIRY,
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
        type: 'access',
      },
      c.env,
      ANONYMOUS_TOKEN_EXPIRY
    );

    return success(c, {
      token: newToken,
      userId: anonymousId,
      tokenType: 'Bearer',
      expiresIn: ANONYMOUS_TOKEN_EXPIRY,
      isAnonymous: true,
      renewed: true,
    });
  }
});

export default auth;
