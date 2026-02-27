import { Router } from 'express';
import { signJwt, verifyJwt } from '../lib/jwt.js';
import { config } from '../config.js';
import crypto from 'crypto';

const router = Router();

const otpSessions = new Map();
const refreshTokenStore = new Set();

function getAdminEmail() {
  return process.env.ADMIN_EMAIL || 'admin@local';
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

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

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ ok: false, error: 'username and password required' });
  }

  const u = config.admin.username;
  const p = config.admin.password;
  if (!u || !p) {
    return res.status(500).json({ ok: false, error: 'server missing ADMIN_USERNAME/ADMIN_PASSWORD' });
  }

  if (String(username) !== String(u) || String(password) !== String(p)) {
    return res.status(401).json({ ok: false, error: 'invalid credentials' });
  }

  const sessionId = `otp-${crypto.randomUUID()}`;
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 10).toISOString();

  otpSessions.set(sessionId, {
    otp,
    expiresAt,
    username: u,
  });

  const payload = {
    sessionId,
    message: 'OTP sent',
    expiresAt,
    ...(config.appEnv !== 'production' ? { _dev_otp: otp } : {}),
  };

  return res.json({ ok: true, data: payload });
});

router.post('/verify-otp', async (req, res) => {
  const { sessionId, otp } = req.body || {};
  const id = String(sessionId || '').trim();
  const code = String(otp || '').trim();
  if (!id || !code) return res.status(400).json({ ok: false, error: 'sessionId and otp required' });

  const session = otpSessions.get(id);
  if (!session) return res.status(401).json({ ok: false, error: 'invalid session' });
  if (Date.now() > Date.parse(session.expiresAt)) {
    otpSessions.delete(id);
    return res.status(401).json({ ok: false, error: 'otp expired' });
  }
  if (String(session.otp) !== code) return res.status(401).json({ ok: false, error: 'invalid otp' });

  otpSessions.delete(id);

  const username = session.username;
  const email = getAdminEmail();

  const accessToken = signJwt(
    { sub: 'admin', role: 'admin', username, email, type: 'access' },
    { expiresIn: '15m' }
  );
  const refreshToken = signJwt(
    { sub: 'admin', role: 'admin', username, email, type: 'refresh' },
    { expiresIn: '7d' }
  );
  refreshTokenStore.add(refreshToken);

  return res.json({
    ok: true,
    data: {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 900,
      user: {
        username,
        email,
        role: 'admin',
        emailVerified: true,
      },
    },
  });
});

router.post('/resend-otp', async (req, res) => {
  const { sessionId } = req.body || {};
  const id = String(sessionId || '').trim();
  if (!id) return res.status(400).json({ ok: false, error: 'sessionId required' });

  const session = otpSessions.get(id);
  if (!session) return res.status(404).json({ ok: false, error: 'session not found' });

  const newOtp = generateOtp();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 10).toISOString();
  otpSessions.set(id, { ...session, otp: newOtp, expiresAt });

  return res.json({
    ok: true,
    data: {
      message: 'OTP resent',
      expiresAt,
      ...(config.appEnv !== 'production' ? { _dev_otp: newOtp } : {}),
    },
  });
});

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    const token = String(refreshToken || '').trim();
    if (!token) return res.status(400).json({ ok: false, error: 'refreshToken required' });

    if (!refreshTokenStore.has(token)) {
      return res.status(401).json({ ok: false, error: 'invalid refresh token' });
    }

    const claims = verifyJwt(token);
    if (claims?.type !== 'refresh') {
      return res.status(401).json({ ok: false, error: 'invalid refresh token' });
    }

    const username = claims.username || 'admin';
    const email = claims.email || getAdminEmail();
    const accessToken = signJwt(
      { sub: 'admin', role: 'admin', username, email, type: 'access' },
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
  if (token) refreshTokenStore.delete(token);
  return res.json({ ok: true });
});

router.post('/anonymous', async (req, res) => {
  const userId = `anon-${crypto.randomUUID()}`;
  const token = signJwt({ sub: userId, role: 'anon', userId, type: 'anon' }, { expiresIn: '30d' });
  const expiresAt = decodeExpiresAtFromToken(token) || new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
  return res.json({ ok: true, data: { token, expiresAt, userId } });
});

router.post('/anonymous/refresh', async (req, res) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    const claims = verifyJwt(token);
    if (claims?.type !== 'anon') return res.status(401).json({ ok: false, error: 'Unauthorized' });

    const userId = claims.userId || claims.sub || `anon-${crypto.randomUUID()}`;
    const next = signJwt({ sub: userId, role: 'anon', userId, type: 'anon' }, { expiresIn: '30d' });
    const expiresAt = decodeExpiresAtFromToken(next) || new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
    return res.json({ ok: true, data: { token: next, expiresAt, userId } });
  } catch {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
});

router.get('/me', async (req, res) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    const claims = verifyJwt(token);

    const role = claims.role || (claims.sub === 'admin' ? 'admin' : 'user');
    const username = claims.username || (role === 'admin' ? (config.admin.username || 'admin') : 'user');
    const email = claims.email || (role === 'admin' ? getAdminEmail() : '');

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

export default router;
