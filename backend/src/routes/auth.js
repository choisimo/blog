import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

const router = Router();

function sign(payload) {
  const secret = config.auth.jwtSecret;
  if (!secret) throw Object.assign(new Error('Server not configured for JWT'), { status: 500 });
  return jwt.sign(payload, secret, { expiresIn: config.auth.jwtExpiresIn });
}

function verify(token) {
  const secret = config.auth.jwtSecret;
  return jwt.verify(token, secret);
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

  const token = sign({ sub: 'admin', role: 'admin', username: u });
  return res.json({ ok: true, data: { token } });
});

router.get('/me', async (req, res) => {
  try {
    const auth = req.headers['authorization'] || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (!token) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    const claims = verify(token);
    return res.json({ ok: true, data: { claims } });
  } catch (err) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
});

export default router;
