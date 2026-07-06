import { bearerAuth } from "@/lib/auth";
import {
  clearAnonymousToken,
  getStoredAnonymousToken,
  getValidAnonymousToken,
  isTokenExpired,
  parseJwtPayload,
} from "@/services/session/auth";
import { useAuthStore } from "@/stores/session/useAuthStore";

type PrincipalPayload = {
  sub?: unknown;
};

const MAX_PRINCIPAL_TOKEN_LENGTH = 4096;
const MAX_PRINCIPAL_SUB_LENGTH = 256;
const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/;

function normalizePrincipalToken(token: string | null | undefined): string | null {
  if (typeof token !== "string") return null;
  const value = token.trim();
  if (
    !value ||
    value.length > MAX_PRINCIPAL_TOKEN_LENGTH ||
    /\s/.test(value) ||
    CONTROL_CHAR_PATTERN.test(value)
  ) {
    return null;
  }
  return value;
}

export function normalizePrincipalSub(sub: unknown): string | null {
  if (typeof sub !== "string") return null;

  const value = sub.trim();
  if (
    !value ||
    value.length > MAX_PRINCIPAL_SUB_LENGTH ||
    /\s/.test(value) ||
    CONTROL_CHAR_PATTERN.test(value) ||
    /%(?:0a|0d)/i.test(value)
  ) {
    return null;
  }

  return value;
}

function getActiveSessionToken(): string | null {
  const accessToken = normalizePrincipalToken(useAuthStore.getState().accessToken);
  if (accessToken && !isTokenExpired(accessToken, 60)) {
    return accessToken;
  }
  return null;
}

async function getValidSessionToken(): Promise<string | null> {
  const activeToken = getActiveSessionToken();
  if (activeToken) {
    return activeToken;
  }

  const refreshedToken = await useAuthStore.getState().getValidAccessToken();
  const normalizedRefreshedToken = normalizePrincipalToken(refreshedToken);
  if (normalizedRefreshedToken && !isTokenExpired(normalizedRefreshedToken, 60)) {
    return normalizedRefreshedToken;
  }

  return null;
}

function getTokenSub(token: string): string | null {
  try {
    const payload = parseJwtPayload(token) as PrincipalPayload | null;
    return normalizePrincipalSub(payload?.sub);
  } catch {
    return null;
  }
}

export function getSessionAuthToken(): string | null {
  return getActiveSessionToken();
}

export async function getPrincipalToken(): Promise<string> {
  const sessionToken = await getValidSessionToken();
  if (sessionToken) {
    return sessionToken;
  }

  const rawStoredAnonymousToken = getStoredAnonymousToken();
  const storedAnonymousToken = normalizePrincipalToken(rawStoredAnonymousToken);
  if (storedAnonymousToken) {
    if (!isTokenExpired(storedAnonymousToken, 60)) {
      return storedAnonymousToken;
    }
    clearAnonymousToken();
  } else if (rawStoredAnonymousToken) {
    clearAnonymousToken();
  }

  const anonymousToken = normalizePrincipalToken(await getValidAnonymousToken());
  if (!anonymousToken) {
    throw new Error("No principal token available");
  }

  return anonymousToken;
}

export async function refreshPrincipalTokenAfterAuthFailure(): Promise<string> {
  useAuthStore.getState().clearAuth();
  clearAnonymousToken();
  const anonymousToken = normalizePrincipalToken(await getValidAnonymousToken());
  if (!anonymousToken) {
    throw new Error("No principal token available");
  }
  return anonymousToken;
}

export async function getPrincipalUserId(): Promise<string> {
  const token = await getPrincipalToken();
  const sub = getTokenSub(token);
  if (!sub) {
    throw new Error("No principal subject available");
  }
  return sub;
}

export async function getPrincipalHeaders(
  init?: HeadersInit,
): Promise<Headers> {
  const headers = new Headers(init);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const token = await getPrincipalToken();
  const sub = getTokenSub(token);
  if (!sub) {
    throw new Error("No principal subject available");
  }

  headers.set("Authorization", bearerAuth(token).Authorization);
  headers.set("X-Principal-Sub", sub);
  return headers;
}
