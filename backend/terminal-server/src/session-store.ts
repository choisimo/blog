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
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.sessions.set(sessionId, {
      ...session,
      containerName,
      state: 'connected',
      lastActivity: Date.now(),
    });
    this.users.set(userId, sessionId);
  }

  async touchSession(sessionId: string): Promise<void> {
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

class RedisSessionStore implements SessionStore {
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
    const existingSessionId = await this.client.get(userKey(session.userId));
    if (existingSessionId && existingSessionId !== session.sessionId) {
      return { ok: false, reason: 'user-session-active' };
    }

    const multi = this.client.multi();
    multi.set(userKey(session.userId), session.sessionId, { EX: ttlSeconds });
    multi.set(sessionKey(session.sessionId), JSON.stringify(session), { EX: ttlSeconds });
    await multi.exec();
    return { ok: true };
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
    const multi = this.client.multi();
    multi.set(userKey(userId), sessionId, { EX: ttlSeconds });
    multi.set(sessionKey(sessionId), JSON.stringify(nextSession), { EX: ttlSeconds });
    await multi.exec();
  }

  async touchSession(sessionId: string, userId: string, ttlSeconds: number): Promise<void> {
    const raw = await this.client.get(sessionKey(sessionId));
    if (!raw) return;

    const session = JSON.parse(raw) as StoredTerminalSession;
    const nextSession = { ...session, lastActivity: Date.now() };
    const multi = this.client.multi();
    multi.set(userKey(userId), sessionId, { EX: ttlSeconds });
    multi.set(sessionKey(sessionId), JSON.stringify(nextSession), { EX: ttlSeconds });
    await multi.exec();
  }

  async releaseSession(sessionId: string, userId: string): Promise<void> {
    const multi = this.client.multi();
    multi.del(userKey(userId));
    multi.del(sessionKey(sessionId));
    await multi.exec();
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
