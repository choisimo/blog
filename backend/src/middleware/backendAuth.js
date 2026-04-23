import crypto from 'crypto';
import { config } from '../config.js';
import { createLogger } from '../lib/logger.js';

const logger = createLogger('backend-auth');

/**
 * Backend key validation middleware.
 * Security: Prevents direct access to backend, bypassing Gateway's auth/rate-limiting.
 * If BACKEND_KEY is not configured, only explicit insecure local development may pass through.
 */
export function requireBackendKey(req, res, next) {
  const backendKey = config.backendKey;
  const protectedEnvironment = config.security?.protectedEnvironment === true;
  const allowInsecureDevAuth =
    !protectedEnvironment && config.security?.allowInsecureDevAuth === true;

  if (!backendKey) {
    if (!allowInsecureDevAuth) {
      logger.error(
        { method: req.method, path: req.path },
        protectedEnvironment
          ? 'BACKEND_KEY missing in protected environment'
          : 'BACKEND_KEY missing and insecure dev auth is not allowed'
      );
      return res.status(503).json({
        ok: false,
        error: 'Service unavailable',
      });
    }
    logger.warn(
      { method: req.method, path: req.path },
      'BACKEND_KEY missing; allowing request because ALLOW_INSECURE_DEV_AUTH=true'
    );
    return next();
  }

  const clientKey = req.headers['x-backend-key'];

  if (!clientKey) {
    logger.warn({ ip: req.ip, method: req.method, path: req.path }, 'Missing X-Backend-Key');
    return res.status(401).json({ 
      ok: false, 
      error: 'Unauthorized - Missing backend key' 
    });
  }

  if (!timingSafeEqual(clientKey, backendKey)) {
    logger.warn({ ip: req.ip, method: req.method, path: req.path }, 'Invalid X-Backend-Key');
    return res.status(401).json({ 
      ok: false, 
      error: 'Unauthorized - Invalid backend key' 
    });
  }

  return next();
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

export default requireBackendKey;
