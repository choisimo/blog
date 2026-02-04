import { config } from '../config.js';
import { verifyJwt } from '../lib/jwt.js';

/**
 * User authentication middleware.
 * Validates JWT token and extracts userId from claims.
 * Sets req.userId and req.userClaims for downstream use.
 */
export function requireUserAuth(req, res, next) {
  const jwtSecret = config.auth?.jwtSecret;
  if (!jwtSecret) {
    return res.status(503).json({ 
      ok: false, 
      error: 'Authentication not configured' 
    });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Unauthorized - Missing token' });
  }

  const token = authHeader.slice(7);
  if (!token) {
    return res.status(401).json({ ok: false, error: 'Unauthorized - Empty token' });
  }

  try {
    const claims = verifyJwt(token);
    
    const userId = claims.sub || claims.userId || claims.user_id;
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'Unauthorized - Invalid token claims' });
    }

    req.userId = userId;
    req.userClaims = claims;
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ ok: false, error: 'Unauthorized - Token expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ ok: false, error: 'Unauthorized - Invalid token' });
    }
    console.error('[userAuth] JWT verification error:', err.message);
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
}

export function requireUserOwnership(paramName = 'userId') {
  return (req, res, next) => {
    const paramUserId = req.params[paramName];
    const tokenUserId = req.userId;

    if (!tokenUserId) {
      return res.status(401).json({ ok: false, error: 'Unauthorized - Not authenticated' });
    }

    if (paramUserId && paramUserId !== tokenUserId) {
      console.warn(`[userAuth] IDOR attempt: token=${tokenUserId}, param=${paramUserId}, path=${req.path}`);
      return res.status(403).json({ ok: false, error: 'Forbidden - Access denied' });
    }

    return next();
  };
}

export default requireUserAuth;
