import crypto from 'node:crypto';
import { config } from '../config.js';

const SIGNATURE_VERSION = 'v1';
const DEFAULT_TOLERANCE_SECONDS = 300;

function readHeader(headers, name) {
  const lower = name.toLowerCase();
  const value = headers?.[lower] ?? headers?.[name];
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' ? value : null;
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length !== right.length) {
    try {
      crypto.timingSafeEqual(left, left);
    } catch {}
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

function buildPayload({ timestamp, method, pathAndQuery, requestId }) {
  return [
    SIGNATURE_VERSION,
    timestamp,
    String(method || '').toUpperCase(),
    pathAndQuery,
    requestId,
  ].join('\n');
}

function sign(secret, payload) {
  return `${SIGNATURE_VERSION}:${crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')}`;
}

function requestPathAndQuery(req) {
  return req.originalUrl || req.url || '/';
}

function hasValidBackendKey(req) {
  const expected = config.backendKey;
  if (!expected) return false;
  const provided = readHeader(req.headers, 'x-backend-key');
  return Boolean(provided && safeEqual(provided, expected));
}

export function verifyGatewaySignatureRequest(req, options = {}) {
  const secret = options.secret || config.security?.gatewaySigningSecret;
  if (!secret) {
    return { ok: true, skipped: true, reason: 'not_configured' };
  }

  const timestamp = readHeader(req.headers, 'x-gateway-timestamp');
  const requestId = readHeader(req.headers, 'x-gateway-request-id');
  const signature = readHeader(req.headers, 'x-gateway-signature');
  const version = readHeader(req.headers, 'x-gateway-signature-version') || SIGNATURE_VERSION;

  if (!timestamp || !requestId || !signature || version !== SIGNATURE_VERSION) {
    return { ok: false, code: 'MISSING_GATEWAY_SIGNATURE' };
  }

  const ts = Number.parseInt(timestamp, 10);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const tolerance = Number(options.toleranceSeconds || DEFAULT_TOLERANCE_SECONDS);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > tolerance) {
    return { ok: false, code: 'STALE_GATEWAY_SIGNATURE' };
  }

  const payload = buildPayload({
    timestamp,
    method: req.method,
    pathAndQuery: requestPathAndQuery(req),
    requestId,
  });
  const expected = sign(secret, payload);
  if (!safeEqual(signature, expected)) {
    return { ok: false, code: 'INVALID_GATEWAY_SIGNATURE' };
  }

  req.gatewaySignatureVerified = true;
  req.gatewayRequestId = requestId;
  return { ok: true, skipped: false, requestId };
}

export function requireGatewaySignature(options = {}) {
  const allowBackendKey = options.allowBackendKey === true;
  const bypassPaths = new Set(options.bypassPaths || []);

  return (req, res, next) => {
    if (bypassPaths.has(req.path) || bypassPaths.has(req.originalUrl)) {
      return next();
    }

    const result = verifyGatewaySignatureRequest(req, options);
    if (result.ok) return next();

    if (allowBackendKey && hasValidBackendKey(req)) {
      req.gatewaySignatureVerified = false;
      req.gatewaySignatureBypassedByBackendKey = true;
      return next();
    }

    return res.status(401).json({
      ok: false,
      error: {
        code: result.code || 'INVALID_GATEWAY_SIGNATURE',
        message: 'Invalid gateway signature',
      },
    });
  };
}
