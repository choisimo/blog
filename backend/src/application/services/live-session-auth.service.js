import crypto from "crypto";
import { assertSessionTokenStorePort } from "../ports/session-token-store.port.js";

function readHeaderValue(value) {
  if (Array.isArray(value)) return value[0];
  if (typeof value === "string") return value;
  return "";
}

function isExpired(expiresAt) {
  const ts = Date.parse(String(expiresAt || ""));
  if (!ts) return true;
  return Date.now() > ts;
}

export function getBearerToken(req) {
  const authHeader = readHeaderValue(req?.headers?.authorization).trim();
  if (!authHeader.toLowerCase().startsWith("bearer ")) return "";
  return authHeader.slice(7).trim();
}

export function deriveLiveSessionIdFromToken(token) {
  return `live-${crypto.createHash("sha256").update(token).digest("hex").slice(0, 16)}`;
}

/**
 * Live session auth application service.
 * @param {{sessionTokenStore: {
 *  isAvailable: () => boolean,
 *  findActiveByToken: (token:string) => Promise<{id:string, expiresAt?:string|null}|null>,
 *  touchActivity: (sessionId:string) => Promise<void>,
 *  deactivateById: (sessionId:string) => Promise<void>
 * }}} deps
 */
export function createLiveSessionAuthService({ sessionTokenStore }) {
  assertSessionTokenStorePort(sessionTokenStore);

  async function verifySessionToken(token) {
    if (!token) {
      return {
        ok: false,
        status: 401,
        error: "missing authorization token",
      };
    }

    if (!sessionTokenStore.isAvailable()) {
      return {
        ok: false,
        status: 503,
        error: "session store unavailable",
      };
    }

    const row = await sessionTokenStore.findActiveByToken(token);
    if (!row) {
      return { ok: false, status: 401, error: "invalid session token" };
    }

    if (isExpired(row.expiresAt)) {
      await sessionTokenStore.deactivateById(row.id);
      return { ok: false, status: 401, error: "session expired" };
    }

    await sessionTokenStore.touchActivity(row.id);
    return {
      ok: true,
      status: 200,
      sessionId: deriveLiveSessionIdFromToken(token),
    };
  }

  async function resolveLiveSessionId(req, fallbackSessionId) {
    const bearerToken = getBearerToken(req);

    if (bearerToken) {
      const verified = await verifySessionToken(bearerToken);
      if (!verified.ok) {
        return {
          ok: false,
          authProvided: true,
          status: verified.status || 401,
          error: verified.error || "invalid session token",
        };
      }

      return {
        ok: true,
        authProvided: true,
        status: 200,
        sessionId: verified.sessionId,
      };
    }

    const sessionId =
      typeof fallbackSessionId === "string" ? fallbackSessionId.trim() : "";
    if (!sessionId) {
      return {
        ok: false,
        authProvided: false,
        status: 400,
        error: "sessionId is required",
      };
    }

    return {
      ok: true,
      authProvided: false,
      status: 200,
      sessionId,
    };
  }

  return {
    verifySessionToken,
    resolveLiveSessionId,
  };
}
