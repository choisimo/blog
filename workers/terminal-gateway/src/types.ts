/**
 * Terminal Gateway - Type Definitions
 */

export interface Env {
  // Environment variables
  ENV: string;
  TERMINAL_ORIGIN: string;

  // Secrets
  ORIGIN_SECRET_KEY: string;
  JWT_SECRET: string;

  // KV Namespace
  KV: KVNamespace;
}

export interface JWTPayload {
  sub: string; // user id
  email?: string;
  exp: number;
  iat: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export interface SessionInfo {
  userId: string;
  clientIP: string;
  connectedAt: number;
  lastActivity: number;
}
