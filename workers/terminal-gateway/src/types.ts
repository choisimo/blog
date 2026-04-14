/**
 * Terminal Gateway - Type Definitions
 */

export interface Env {
  ENV: string;
  TERMINAL_ORIGIN: string;
  JWT_SECRET: string;
  TERMINAL_SESSION_SECRET: string;
  TERMINAL_CONNECT_TOKEN_TTL_SECONDS?: string;
  TERMINAL_BLOCKED_COUNTRIES?: string;
  KV: KVNamespace;
}

export interface JWTPayload {
  sub: string;
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
  sessionId: string;
  userId: string;
  clientIP: string;
  userAgentHash?: string | null;
  connectedAt: number;
  lastActivity: number;
}

export interface TerminalAdmissionClaims {
  iss: 'terminal-gateway';
  aud: 'terminal-server';
  scope: 'terminal.connect';
  sid: string;
  sub: string;
  email?: string;
  ip: string;
  ua?: string | null;
  iat: number;
  nbf: number;
  exp: number;
}
