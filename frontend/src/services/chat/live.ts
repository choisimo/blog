import { getApiBaseUrl } from '@/utils/apiBase';

export type LiveChatEvent =
  | {
    type: 'connected';
    room: string;
    sessionId: string;
    onlineCount: number;
    ts?: string;
  }
  | {
    type: 'presence';
    room: string;
    action: 'join' | 'leave';
    senderType?: 'client' | 'agent';
    sessionId: string;
    name: string;
    onlineCount: number;
    ts?: string;
  }
  | {
    type: 'live_message';
    room: string;
    sessionId: string;
    senderType?: 'client' | 'agent';
    name: string;
    text: string;
    onlineCount: number;
    ts?: string;
  }
  | {
    type: 'session_notification';
    sessionId: string;
    level?: 'info' | 'warn' | 'error';
    message: string;
    room?: string;
    ts?: string;
  }
  | {
    type: 'ping';
    ts?: string;
  };

export type LiveAgentPolicy = {
  silenceProbability: number;
  minDelayMs: number;
  maxDelayMs: number;
  maxReplyChars: number;
  temperature: number;
  historyLimit: number;
  redisBridgeEnabled: boolean;
  redisBridgeFailed: boolean;
  redisPresenceTtlSec: number;
};

type LiveChatStreamOptions = {
  sessionId: string;
  room?: string;
  name?: string;
  onEvent: (event: LiveChatEvent) => void;
  onError?: (error: unknown) => void;
};

function getLiveChatBaseUrl(): string {
  return getApiBaseUrl().replace(/\/$/, '');
}

function toSSEHttpUrl(path: string): string {
  const base = getLiveChatBaseUrl();
  return `${base}${path}`;
}

export function connectLiveChatStream(options: LiveChatStreamOptions): () => void {
  const room = options.room?.trim() || 'global';
  const name = options.name?.trim() || '';
  const url = new URL(toSSEHttpUrl('/api/v1/chat/live/stream'));
  url.searchParams.set('sessionId', options.sessionId);
  url.searchParams.set('room', room);
  if (name) url.searchParams.set('name', name);

  const source = new EventSource(url.toString(), { withCredentials: true });

  source.onmessage = (ev) => {
    if (!ev.data) return;
    try {
      const parsed = JSON.parse(ev.data) as LiveChatEvent;
      if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) return;
      options.onEvent(parsed);
    } catch {
      // ignore malformed payload
    }
  };

  source.onerror = (err) => {
    options.onError?.(err);
  };

  return () => {
    source.close();
  };
}

export async function sendLiveChatMessage(input: {
  sessionId: string;
  text: string;
  room?: string;
  name?: string;
  senderType?: 'client' | 'agent';
}): Promise<void> {
  const res = await fetch(toSSEHttpUrl('/api/v1/chat/live/message'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: input.sessionId,
      text: input.text,
      room: input.room || 'global',
      name: input.name || '',
      senderType: input.senderType || 'client',
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(t || `Failed to send live chat message (${res.status})`);
  }
}

export async function getLiveChatConfig(): Promise<LiveAgentPolicy> {
  const res = await fetch(toSSEHttpUrl('/api/v1/chat/live/config'), {
    method: 'GET',
    credentials: 'include',
  });
  const parsed = await res.json().catch(() => null);
  if (!res.ok || !parsed?.ok || !parsed?.data?.policy) {
    throw new Error(parsed?.error || 'Failed to load live chat config');
  }
  return parsed.data.policy as LiveAgentPolicy;
}

export async function updateLiveChatConfig(input: {
  policy: Partial<Pick<LiveAgentPolicy, 'silenceProbability' | 'minDelayMs' | 'maxDelayMs' | 'maxReplyChars' | 'temperature'>>;
  configKey: string;
}): Promise<LiveAgentPolicy> {
  const res = await fetch(toSSEHttpUrl('/api/v1/chat/live/config'), {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Live-Config-Key': input.configKey,
    },
    body: JSON.stringify(input.policy),
  });
  const parsed = await res.json().catch(() => null);
  if (!res.ok || !parsed?.ok || !parsed?.data?.policy) {
    throw new Error(parsed?.error || 'Failed to update live chat config');
  }
  return parsed.data.policy as LiveAgentPolicy;
}

export async function getLiveRoomStats(room: string): Promise<{
  room: string;
  onlineCount: number;
  recent: Array<{ sessionId: string; name: string; text: string; senderType?: 'client' | 'agent'; ts?: string }>;
}> {
  const url = new URL(toSSEHttpUrl('/api/v1/chat/live/room-stats'));
  url.searchParams.set('room', room);

  const res = await fetch(url.toString(), {
    method: 'GET',
    credentials: 'include',
  });
  const parsed = await res.json().catch(() => null);
  if (!res.ok || !parsed?.ok || !parsed?.data) {
    throw new Error(parsed?.error || 'Failed to load live room stats');
  }
  return parsed.data;
}

export type LiveRoom = {
  room: string;
  onlineCount: number;
  messageCount: number;
  lastActivity: string | null;
  lastText: string | null;
};

export async function getLiveRooms(): Promise<LiveRoom[]> {
  const res = await fetch(toSSEHttpUrl('/api/v1/chat/live/rooms'), {
    method: 'GET',
    credentials: 'include',
  });
  const parsed = await res.json().catch(() => null);
  if (!res.ok || !parsed?.ok || !Array.isArray(parsed?.data?.rooms)) {
    throw new Error(parsed?.error || 'Failed to load live rooms');
  }
  return parsed.data.rooms as LiveRoom[];
}
