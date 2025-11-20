import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function signJwt(payload, opts = {}) {
  const secret = config.auth.jwtSecret;
  if (!secret) throw Object.assign(new Error('JWT not configured'), { status: 500 });
  return jwt.sign(payload, secret, { expiresIn: config.auth.jwtExpiresIn, ...opts });
}

export function verifyJwt(token) {
  const secret = config.auth.jwtSecret;
  if (!secret) throw Object.assign(new Error('JWT not configured'), { status: 500 });
  return jwt.verify(token, secret);
}

export function isAdminClaims(claims) {
  if (!claims || typeof claims !== 'object') return false;
  return claims.role === 'admin' || claims.sub === 'admin';
}
