import { config } from '../config.js';
import { verifyJwt, isAdminClaims } from '../lib/jwt.js';

/**
 * Admin 보호 미들웨어.
 * - ADMIN_BEARER_TOKEN 또는 JWT_SECRET 둘 중 하나라도 설정되어 있으면 보호 활성화
 * - 둘 다 없으면(로컬 편의) 패스스루
 */
export function requireAdmin(req, res, next) {
  const protectionEnabled = !!(config.admin.bearerToken || config.auth?.jwtSecret);
  if (!protectionEnabled) {
    if (config.security?.protectedEnvironment) {
      return res.status(503).json({ ok: false, error: 'Service unavailable' });
    }
    return next();
  }

  const auth = req.headers['authorization'] || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  // Static bearer token 우선
  if (config.admin.bearerToken && token === config.admin.bearerToken) return next();

  // JWT 어드민 검사
  if (config.auth?.jwtSecret) {
    try {
      const claims = verifyJwt(token);
      if (claims?.type === 'refresh') return res.status(401).json({ ok: false, error: 'Unauthorized' });
      if (isAdminClaims(claims) && claims.emailVerified === true) return next();
    } catch {}
  }

  return res.status(401).json({ ok: false, error: 'Unauthorized' });
}

export default requireAdmin;
