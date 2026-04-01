import jwt from 'jsonwebtoken';
import { config } from '../config.js';

const JWT_ISSUER = 'blog-api-gateway';
const JWT_AUDIENCE = 'blog-platform';

function createJwtError(message) {
  return Object.assign(new Error(message), { name: 'JsonWebTokenError' });
}

function hasExpectedAudience(audienceClaim) {
  if (typeof audienceClaim === 'string') {
    return audienceClaim === JWT_AUDIENCE;
  }

  if (Array.isArray(audienceClaim)) {
    return audienceClaim.includes(JWT_AUDIENCE);
  }

  return false;
}

export function signJwt(payload, opts = {}) {
  const secret = config.auth.jwtSecret;
  if (!secret) throw Object.assign(new Error('JWT not configured'), { status: 500 });
  return jwt.sign(
    {
      ...payload,
      iss: JWT_ISSUER,
      aud: JWT_AUDIENCE,
    },
    secret,
    { expiresIn: config.auth.jwtExpiresIn, ...opts },
  );
}

export function verifyJwt(token) {
  const secret = config.auth.jwtSecret;
  if (!secret) throw Object.assign(new Error('JWT not configured'), { status: 500 });
  const claims = jwt.verify(token, secret);

  if (claims && typeof claims === 'object') {
    if (!claims.iss || claims.iss !== JWT_ISSUER) {
      throw createJwtError('Invalid token issuer');
    }

    if (!claims.aud || !hasExpectedAudience(claims.aud)) {
      throw createJwtError('Invalid token audience');
    }
  }

  return claims;
}

export function isAdminClaims(claims) {
  if (!claims || typeof claims !== 'object') return false;
  return claims.role === 'admin' || claims.sub === 'admin';
}
