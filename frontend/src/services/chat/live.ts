import { getApiBaseUrl } from "@/utils/network/apiBase";
import { bearerAuth } from "@/lib/auth";
import {
  findSSEFrameBoundary,
  parseSSEFrame as parseRawSSEFrame,
} from "@/services/core/sse-frame";

type LiveSourceLink = {
  title?: string;
  url?: string;
  score?: number;
  snippet?: string;
};

export type LiveChatEvent =
  | {
      type: "connected";
      room: string;
      sessionId: string;
      onlineCount: number;
      ts?: string;
    }
  | {
      type: "presence";
      room: string;
      action: "join" | "leave";
      senderType?: "client" | "agent";
      sessionId: string;
      name: string;
      onlineCount: number;
      ts?: string;
    }
  | {
      type: "live_message";
      room: string;
      sessionId: string;
      senderType?: "client" | "agent";
      name: string;
      text: string;
      onlineCount: number;
      replyToName?: string;
      turnIndex?: number;
      roundId?: string;
      roundSize?: number;
      personaStyle?: string;
      personaTraits?: string;
      triggeredByMention?: boolean;
      mentionedAgents?: string[];
      contextKinds?: string[];
      sources?: LiveSourceLink[];
      ts?: string;
    }
  | {
      type: "session_notification";
      sessionId: string;
      level?: "info" | "warn" | "error";
      message: string;
      room?: string;
      ts?: string;
    }
  | {
      type: "ping";
      ts?: string;
    };

export type LiveAgentPolicy = {
  silenceProbability: number;
  minDelayMs: number;
  maxDelayMs: number;
  maxReplyChars: number;
  temperature: number;
  historyLimit: number;
  maxRoundTurns: number;
  liveResearchEnabled: boolean;
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
  return getApiBaseUrl().replace(/\/$/, "");
}

function toSSEHttpUrl(path: string): string {
  const base = getLiveChatBaseUrl();
  return `${base}${path}`;
}

function readStoredSessionToken(): string | null {
  try {
    return localStorage.getItem("nodove_session_token");
  } catch {
    return null;
  }
}

function parseLiveChatEventFrame(frame: string): LiveChatEvent | null {
  const parsedFrame = parseRawSSEFrame(frame);
  if (!parsedFrame?.data) return null;
  try {
    const parsed = JSON.parse(parsedFrame.data) as LiveChatEvent;
    if (!parsed || typeof parsed !== "object" || !("type" in parsed))
      return null;
    return parsed;
  } catch {
    return null;
  }
}

export function connectLiveChatStream(
  options: LiveChatStreamOptions,
): () => void {
  const room = options.room?.trim() || "global";
  const name = options.name?.trim() || "";
  let closed = false;
  const controller = new AbortController();
  const run = async () => {
    let attempt = 0;

    while (!closed) {
      const sessionToken = readStoredSessionToken();
      const url = new URL(toSSEHttpUrl("/api/v1/chat/live/stream"));
      url.searchParams.set("room", room);
      if (name) url.searchParams.set("name", name);
      if (!sessionToken && options.sessionId?.trim()) {
        // Backwards compatibility path when session token is not available.
        url.searchParams.set("sessionId", options.sessionId.trim());
      }

      try {
        const headers: Record<string, string> = {};
        if (sessionToken) {
          headers["Authorization"] = bearerAuth(sessionToken).Authorization;
        }

        const response = await fetch(url.toString(), {
          headers,
          credentials: "include",
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`SSE connection failed: ${response.status}`);
        }

        attempt = 0;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!closed) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          while (true) {
            const boundary = findSSEFrameBoundary(buffer);
            if (!boundary) break;
            const frame = buffer.slice(0, boundary.index);
            buffer = buffer.slice(boundary.index + boundary.size);
            const event = parseLiveChatEventFrame(frame);
            if (event) {
              options.onEvent(event);
            }
          }
        }

        try {
          reader.releaseLock();
        } catch {
          // ignore stream lock release errors
        }

        if (closed) break;
        throw new Error("SSE stream disconnected");
      } catch (err) {
        if (closed || (err as Error)?.name === "AbortError") break;
        options.onError?.(err);
        attempt += 1;
        const backoffMs = Math.min(10_000, 800 * 2 ** Math.min(attempt, 4));
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  };

  void run();

  return () => {
    closed = true;
    controller.abort();
  };
}

export async function sendLiveChatMessage(input: {
  sessionId: string;
  text: string;
  room?: string;
  name?: string;
  senderType?: "client" | "agent";
}): Promise<void> {
  const sessionToken = readStoredSessionToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (sessionToken) {
    headers["Authorization"] = bearerAuth(sessionToken).Authorization;
  }

  const payload: Record<string, string> = {
    text: input.text,
    room: input.room || "global",
    name: input.name || "",
    senderType: input.senderType || "client",
  };
  if (!sessionToken) {
    payload.sessionId = input.sessionId;
  }

  const res = await fetch(toSSEHttpUrl("/api/v1/chat/live/message"), {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `Failed to send live chat message (${res.status})`);
  }
}

export async function getLiveChatConfig(): Promise<LiveAgentPolicy> {
  const res = await fetch(toSSEHttpUrl("/api/v1/chat/live/config"), {
    method: "GET",
    credentials: "include",
  });
  const parsed = await res.json().catch(() => null);
  if (!res.ok || !parsed?.ok || !parsed?.data?.policy) {
    throw new Error(parsed?.error || "Failed to load live chat config");
  }
  return parsed.data.policy as LiveAgentPolicy;
}

export async function updateLiveChatConfig(input: {
  policy: Partial<
    Pick<
      LiveAgentPolicy,
      | "silenceProbability"
      | "minDelayMs"
      | "maxDelayMs"
      | "maxReplyChars"
      | "temperature"
    >
  >;
  configKey: string;
}): Promise<LiveAgentPolicy> {
  const res = await fetch(toSSEHttpUrl("/api/v1/chat/live/config"), {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Live-Config-Key": input.configKey,
    },
    body: JSON.stringify(input.policy),
  });
  const parsed = await res.json().catch(() => null);
  if (!res.ok || !parsed?.ok || !parsed?.data?.policy) {
    throw new Error(parsed?.error || "Failed to update live chat config");
  }
  return parsed.data.policy as LiveAgentPolicy;
}

export async function getLiveRoomStats(room: string): Promise<{
  room: string;
  onlineCount: number;
  recent: Array<{
    sessionId: string;
    name: string;
    text: string;
    senderType?: "client" | "agent";
    ts?: string;
  }>;
}> {
  const url = new URL(toSSEHttpUrl("/api/v1/chat/live/room-stats"));
  url.searchParams.set("room", room);

  const res = await fetch(url.toString(), {
    method: "GET",
    credentials: "include",
  });
  const parsed = await res.json().catch(() => null);
  if (!res.ok || !parsed?.ok || !parsed?.data) {
    throw new Error(parsed?.error || "Failed to load live room stats");
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
  const res = await fetch(toSSEHttpUrl("/api/v1/chat/live/rooms"), {
    method: "GET",
    credentials: "include",
  });
  const parsed = await res.json().catch(() => null);
  if (!res.ok || !parsed?.ok || !Array.isArray(parsed?.data?.rooms)) {
    throw new Error(parsed?.error || "Failed to load live rooms");
  }
  return parsed.data.rooms as LiveRoom[];
}
