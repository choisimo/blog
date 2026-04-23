import { config } from '../config.js';
import { verifyJwt, isAdminClaims } from '../lib/jwt.js';

/**
 * Admin 보호 미들웨어.
 * - ADMIN_BEARER_TOKEN 또는 JWT_SECRET 둘 중 하나라도 설정되어 있으면 보호 활성화
 * - 둘 다 없으면 명시적 ALLOW_INSECURE_DEV_AUTH=true 에서만 패스스루
 */
function isInsecureDevAuthAllowed() {
  return (
    config.security?.protectedEnvironment !== true &&
    config.security?.allowInsecureDevAuth === true
  );
}

function isAdminProtectionConfigured() {
  return !!(config.admin.bearerToken || config.auth?.jwtSecret);
}

export function isAdminRequest(req) {
  if (!isAdminProtectionConfigured()) {
    return isInsecureDevAuthAllowed();
  }

  const auth = req.headers['authorization'] || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;

  // Static bearer token 우선
  if (config.admin.bearerToken && token === config.admin.bearerToken) return true;

  // JWT 어드민 검사
  if (config.auth?.jwtSecret) {
    try {
      const claims = verifyJwt(token);
      if (claims?.type === 'refresh') return false;
      if (isAdminClaims(claims) && claims.emailVerified === true) return true;
    } catch {}
  }

  return false;
}

export function requireAdmin(req, res, next) {
  if (!isAdminProtectionConfigured()) {
    if (isInsecureDevAuthAllowed()) return next();
    return res.status(503).json({ ok: false, error: 'Service unavailable' });
  }

  if (isAdminRequest(req)) return next();

  return res.status(401).json({ ok: false, error: 'Unauthorized' });
}

export default requireAdmin;
