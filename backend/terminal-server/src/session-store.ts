export interface StoredTerminalSession {
  sessionId: string;
  userId: string;
  clientIP: string;
  email?: string | null;
  requestId?: string | null;
  containerName?: string | null;
  connectedAt: number;
  lastActivity: number;
  state: 'claimed' | 'connected' | 'closed';
}

export interface SessionStore {
  readonly kind: 'memory' | 'redis';
  connect(): Promise<void>;
  close(): Promise<void>;
  claimSession(
    session: StoredTerminalSession,
    ttlSeconds: number,
  ): Promise<{ ok: true } | { ok: false; reason: string }>;
  markConnected(
    sessionId: string,
    userId: string,
    containerName: string,
    ttlSeconds: number,
  ): Promise<void>;
  touchSession(sessionId: string, userId: string, ttlSeconds: number): Promise<void>;
  releaseSession(sessionId: string, userId: string): Promise<void>;
  listSessions(): Promise<StoredTerminalSession[]>;
  health(): Promise<Record<string, unknown>>;
}

function sessionKey(sessionId: string) {
  return `terminal:session:${sessionId}`;
}

function userKey(userId: string) {
  return `terminal:user:${userId}`;
}

export const CLAIM_SESSION_LUA = `
local user_key = KEYS[1]
local session_key = KEYS[2]
local session_id = ARGV[1]
local session_json = ARGV[2]
local ttl_seconds = tonumber(ARGV[3])

local current_session_id = redis.call('GET', user_key)
if current_session_id and current_session_id ~= session_id then
  return {0, 'user-session-active'}
end

redis.call('SET', user_key, session_id, 'EX', ttl_seconds)
redis.call('SET', session_key, session_json, 'EX', ttl_seconds)
return {1, 'claimed'}
`;

export const RELEASE_SESSION_LUA = `
local user_key = KEYS[1]
local session_key = KEYS[2]
local session_id = ARGV[1]

local current_session_id = redis.call('GET', user_key)
if current_session_id == session_id then
  redis.call('DEL', user_key)
end

redis.call('DEL', session_key)
return 1
`;

export const CAS_UPDATE_SESSION_LUA = `
local user_key = KEYS[1]
local session_key = KEYS[2]
local session_id = ARGV[1]
local session_json = ARGV[2]
local ttl_seconds = tonumber(ARGV[3])

local current_session_id = redis.call('GET', user_key)
if current_session_id ~= session_id then
  return 0
end

redis.call('SET', user_key, session_id, 'EX', ttl_seconds)
redis.call('SET', session_key, session_json, 'EX', ttl_seconds)
return 1
`;

class InMemorySessionStore implements SessionStore {
  readonly kind = 'memory' as const;
  private readonly sessions = new Map<string, StoredTerminalSession>();
  private readonly users = new Map<string, string>();

  async connect(): Promise<void> {}
  async close(): Promise<void> {}

  async claimSession(
    session: StoredTerminalSession,
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    const existingSessionId = this.users.get(session.userId);
    if (existingSessionId && existingSessionId !== session.sessionId) {
      return { ok: false, reason: 'user-session-active' };
    }

    this.sessions.set(session.sessionId, session);
    this.users.set(session.userId, session.sessionId);
    return { ok: true };
  }

  async markConnected(sessionId: string, userId: string, containerName: string): Promise<void> {
    if (this.users.get(userId) !== sessionId) return;
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.sessions.set(sessionId, {
      ...session,
      containerName,
      state: 'connected',
      lastActivity: Date.now(),
    });
  }

  async touchSession(sessionId: string, userId: string): Promise<void> {
    if (this.users.get(userId) !== sessionId) return;
    const session = this.sessions.get(sessionId);
    if (!session) return;
    this.sessions.set(sessionId, { ...session, lastActivity: Date.now() });
  }

  async releaseSession(sessionId: string, userId: string): Promise<void> {
    this.sessions.delete(sessionId);
    const current = this.users.get(userId);
    if (current === sessionId) {
      this.users.delete(userId);
    }
  }

  async listSessions(): Promise<StoredTerminalSession[]> {
    return Array.from(this.sessions.values());
  }

  async health(): Promise<Record<string, unknown>> {
    return { ok: true, kind: this.kind, sessions: this.sessions.size };
  }
}

function normalizeEvalResult(value: unknown): [number, string | undefined] {
  if (Array.isArray(value)) {
    const first = Number(value[0]);
    return [Number.isFinite(first) ? first : 0, value[1] === undefined ? undefined : String(value[1])];
  }
  const numeric = Number(value);
  return [Number.isFinite(numeric) ? numeric : 0, undefined];
}

export class RedisSessionStore implements SessionStore {
  readonly kind = 'redis' as const;
  private client: any;

  constructor(client: any) {
    this.client = client;
  }

  async connect(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }

  async close(): Promise<void> {
    if (this.client?.isOpen) {
      await this.client.quit();
    }
  }

  async claimSession(
    session: StoredTerminalSession,
    ttlSeconds: number,
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    const result = await this.client.eval(CLAIM_SESSION_LUA, {
      keys: [userKey(session.userId), sessionKey(session.sessionId)],
      arguments: [session.sessionId, JSON.stringify(session), String(ttlSeconds)],
    });
    const [ok, reason] = normalizeEvalResult(result);
    if (ok === 1) {
      return { ok: true };
    }
    return { ok: false, reason: reason || 'claim-failed' };
  }

  async markConnected(
    sessionId: string,
    userId: string,
    containerName: string,
    ttlSeconds: number,
  ): Promise<void> {
    const raw = await this.client.get(sessionKey(sessionId));
    if (!raw) return;

    const session = JSON.parse(raw) as StoredTerminalSession;
    const nextSession = {
      ...session,
      containerName,
      state: 'connected' as const,
      lastActivity: Date.now(),
    };

    await this.client.eval(CAS_UPDATE_SESSION_LUA, {
      keys: [userKey(userId), sessionKey(sessionId)],
      arguments: [sessionId, JSON.stringify(nextSession), String(ttlSeconds)],
    });
  }

  async touchSession(sessionId: string, userId: string, ttlSeconds: number): Promise<void> {
    const raw = await this.client.get(sessionKey(sessionId));
    if (!raw) return;

    const session = JSON.parse(raw) as StoredTerminalSession;
    const nextSession = { ...session, lastActivity: Date.now() };
    await this.client.eval(CAS_UPDATE_SESSION_LUA, {
      keys: [userKey(userId), sessionKey(sessionId)],
      arguments: [sessionId, JSON.stringify(nextSession), String(ttlSeconds)],
    });
  }

  async releaseSession(sessionId: string, userId: string): Promise<void> {
    await this.client.eval(RELEASE_SESSION_LUA, {
      keys: [userKey(userId), sessionKey(sessionId)],
      arguments: [sessionId],
    });
  }

  async listSessions(): Promise<StoredTerminalSession[]> {
    const keys = await this.client.keys('terminal:session:*');
    if (!keys.length) return [];

    const values = await this.client.mGet(keys);
    return values
      .filter(Boolean)
      .map((value: string) => JSON.parse(value) as StoredTerminalSession);
  }

  async health(): Promise<Record<string, unknown>> {
    const pong = await this.client.ping();
    return { ok: pong === 'PONG', kind: this.kind };
  }
}

export async function createSessionStore(): Promise<SessionStore> {
  if (!process.env.REDIS_URL) {
    return new InMemorySessionStore();
  }

  try {
    const { createClient } = await import('redis');
    const client = createClient({
      url: process.env.REDIS_URL,
      password: process.env.REDIS_PASSWORD || undefined,
      socket: {
        reconnectStrategy(retries: number) {
          return Math.min(1000 * retries, 5000);
        },
      },
    });

    return new RedisSessionStore(client);
  } catch (err) {
    console.warn('Redis session store unavailable, falling back to memory:', err);
    return new InMemorySessionStore();
  }
}
