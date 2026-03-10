import crypto from 'crypto';
import { config } from '../config.js';
import { createLogger } from '../lib/logger.js';

const logger = createLogger('backend-auth');

/**
 * Backend key validation middleware.
 * Security: Prevents direct access to backend, bypassing Gateway's auth/rate-limiting.
 * If BACKEND_KEY not configured (local dev): allows all requests.
 */
export function requireBackendKey(req, res, next) {
  const backendKey = config.backendKey;
  
  if (!backendKey) {
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
