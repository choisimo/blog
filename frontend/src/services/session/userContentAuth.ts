import { bearerAuth } from "@/lib/auth";
import {
  getStoredAnonymousToken,
  getValidAnonymousToken,
  isTokenExpired,
  parseJwtPayload,
} from "@/services/session/auth";
import { useAuthStore } from "@/stores/session/useAuthStore";

type PrincipalPayload = {
  sub?: unknown;
};

function getActiveSessionToken(): string | null {
  const accessToken = useAuthStore.getState().accessToken;
  if (accessToken && accessToken.trim() && !isTokenExpired(accessToken, 60)) {
    return accessToken.trim();
  }
  return null;
}

function getTokenSub(token: string): string | null {
  const payload = parseJwtPayload(token) as PrincipalPayload | null;
  return typeof payload?.sub === "string" && payload.sub.trim()
    ? payload.sub.trim()
    : null;
}

export function getSessionAuthToken(): string | null {
  return getActiveSessionToken();
}

export async function getPrincipalToken(): Promise<string> {
  const sessionToken = getActiveSessionToken();
  if (sessionToken) {
    return sessionToken;
  }

  const storedAnonymousToken = getStoredAnonymousToken();
  if (storedAnonymousToken && !isTokenExpired(storedAnonymousToken, 60)) {
    return storedAnonymousToken;
  }

  return getValidAnonymousToken();
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
