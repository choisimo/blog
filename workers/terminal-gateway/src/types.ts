/**
 * Terminal Gateway - Type Definitions
 */

export interface Env {
  // Environment variables
  ENV: string;
  TERMINAL_ORIGIN: string;
  TERMINAL_CONNECT_TOKEN_TTL_SECONDS?: string;
  TERMINAL_BLOCKED_COUNTRIES?: string;
  ALLOWED_ORIGINS?: string;

  // Secrets
  JWT_SECRET: string;
  TERMINAL_SESSION_SECRET: string;

  // KV Namespace
  KV: KVNamespace;
  TERMINAL_LEASES: DurableObjectNamespace;
}

export interface JWTPayload {
  sub: string; // user id
  email?: string;
  role?: string;
  emailVerified?: boolean;
  type?: 'access' | 'refresh';
  iss?: string;
  aud?: string | string[];
  nbf?: number;
  exp?: number;
  iat?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}
