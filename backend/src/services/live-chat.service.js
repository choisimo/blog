/**
 * Live Chat Service — live room infrastructure, SSE fan-out, Redis bridge,
 * auto-reply agents, and policy management.
 *
 * Extracted from routes/chat.js to keep route handlers thin.
 */

import { aiService } from "../lib/ai-service.js";
import { getRedisClient, getRedisSubscriber } from "../lib/redis-client.js";
import { AI_TEMPERATURES } from "../config/constants.js";
import { appendLiveContextMessage } from "../services/live-context.service.js";

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------

const liveStreams = new Map();
const liveRooms = new Map();
const liveRoomHistory = new Map();
const liveAgentTimers = new Map();
const LIVE_HISTORY_LIMIT = 30;

// ---------------------------------------------------------------------------
// Multi-persona agent pool
// ---------------------------------------------------------------------------

const LIVE_AGENT_PERSONAS = [
  {
    name: "alex",
    style: "casual",
    traits: "curious, asks follow-up questions, uses occasional humor",
    lang_hint: { ko: "반말 가능, 짧고 자연스럽게", en: "casual short replies" },
  },
  {
    name: "jamie",
    style: "thoughtful",
    traits:
      "analytical, references interesting angles, sometimes plays devil's advocate",
    lang_hint: { ko: "논리적이고 간결하게", en: "thoughtful concise replies" },
  },
  {
    name: "sam",
    style: "friendly",
    traits:
      "warm, encouraging, uses simple language, relates to personal experience",
    lang_hint: { ko: "친근하고 공감하는 말투", en: "warm empathetic tone" },
  },
  {
    name: "quinn",
    style: "direct",
    traits: "brief, opinionated, sometimes challenges assumptions, no fluff",
    lang_hint: { ko: "짧고 직설적으로", en: "short direct opinionated" },
  },
  {
    name: "morgan",
    style: "creative",
    traits:
      "lateral thinker, draws unexpected comparisons, asks thought-provoking questions",
    lang_hint: {
      ko: "창의적이고 흥미로운 시각",
      en: "creative lateral thinking",
    },
  },
];

// ---------------------------------------------------------------------------
// Room persona rotation state
// ---------------------------------------------------------------------------

const roomPersonaIndex = new Map();

// ---------------------------------------------------------------------------
// Redis bridge constants & state
// ---------------------------------------------------------------------------

const LIVE_REDIS_CHANNEL = "livechat:events";
const LIVE_INSTANCE_ID = `live-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const LIVE_REDIS_PRESENCE_PREFIX = "livechat:presence";
const LIVE_REDIS_PRESENCE_TTL_SEC = Math.max(
  60,
  Number.parseInt(process.env.LIVE_REDIS_PRESENCE_TTL_SEC || "180", 10),
);

let liveRedisBridgeReady = false;
let liveRedisBridgeFailed = false;

// ---------------------------------------------------------------------------
// Agent policy (parsed from env, mutable at runtime via PUT /live/config)
// ---------------------------------------------------------------------------

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function parseLivePolicyFromEnv() {
  const minDelayMs = clampNumber(
    Number.parseInt(process.env.LIVE_AGENT_MIN_DELAY_MS || "1200", 10),
    600,
    10_000,
  );
  const maxDelayCandidate = clampNumber(
    Number.parseInt(process.env.LIVE_AGENT_MAX_DELAY_MS || "3400", 10),
    800,
    20_000,
  );

  return {
    silenceProbability: clampNumber(
      Number.parseFloat(process.env.LIVE_AGENT_SILENCE_PROBABILITY || "0.1"),
      0,
      0.9,
    ),
    minDelayMs,
    maxDelayMs: Math.max(minDelayMs + 200, maxDelayCandidate),
    maxReplyChars: clampNumber(
      Number.parseInt(process.env.LIVE_AGENT_MAX_REPLY_CHARS || "320", 10),
      120,
      1200,
    ),
    temperature: clampNumber(
      Number.parseFloat(
        process.env.LIVE_AGENT_TEMPERATURE ||
          String(AI_TEMPERATURES.CATALYST || 0.7),
      ),
      0,
      1.5,
    ),
  };
}

const liveAgentPolicy = parseLivePolicyFromEnv();

// ---------------------------------------------------------------------------
// Room key helpers
// ---------------------------------------------------------------------------

export function normalizeRoomKey(rawRoom) {
  const fallback = "room:lobby";
  if (typeof rawRoom !== "string") return fallback;

  const trimmed = rawRoom.trim().toLowerCase();
  if (!trimmed) return fallback;

  const normalized = trimmed
    .replace(/[^a-z0-9:_-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);

  if (!normalized.startsWith("room:")) {
    return `room:${normalized}`;
  }
  return normalized;
}

export function ensureLiveRoom(room) {
  if (!liveRooms.has(room)) {
    liveRooms.set(room, new Set());
  }
  return liveRooms.get(room);
}

// ---------------------------------------------------------------------------
// Stream registration
// ---------------------------------------------------------------------------

export function registerLiveStream(stream) {
  liveStreams.set(stream.id, stream);
  ensureLiveRoom(stream.room).add(stream.id);
}

export function unregisterLiveStream(streamId) {
  const stream = liveStreams.get(streamId);
  if (!stream) return;

  liveStreams.delete(streamId);
  const room = liveRooms.get(stream.room);
  if (room) {
    room.delete(streamId);
    if (room.size === 0) {
      liveRooms.delete(stream.room);
      liveRoomHistory.delete(stream.room);
      const timer = liveAgentTimers.get(stream.room);
      if (timer) {
        clearTimeout(timer);
        liveAgentTimers.delete(stream.room);
      }
    }
  }
}

export function getRoomParticipantCount(room) {
  const roomStreams = liveRooms.get(room);
  if (!roomStreams || roomStreams.size === 0) return 0;

  const sessionsInRoom = new Set();
  for (const streamId of roomStreams) {
    const stream = liveStreams.get(streamId);
    if (stream?.sessionId) {
      sessionsInRoom.add(stream.sessionId);
    }
  }
  return sessionsInRoom.size;
}

// ---------------------------------------------------------------------------
// SSE helpers
// ---------------------------------------------------------------------------

export function sendSSE(res, payload) {
  try {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  } catch {
    // ignore closed stream
  }
}

export function broadcastRoom(room, payload) {
  const roomStreams = liveRooms.get(room);
  if (!roomStreams || roomStreams.size === 0) return;

  for (const streamId of roomStreams) {
    const stream = liveStreams.get(streamId);
    if (!stream) continue;
    sendSSE(stream.res, payload);
  }
}

export function appendRoomHistory(room, entry) {
  const prev = liveRoomHistory.get(room) || [];
  const next = [...prev, entry].slice(-LIVE_HISTORY_LIMIT);
  liveRoomHistory.set(room, next);
}

// ---------------------------------------------------------------------------
// Redis presence
// ---------------------------------------------------------------------------

export function getPresenceKey(room) {
  return `${LIVE_REDIS_PRESENCE_PREFIX}:${room}`;
}

export async function touchRedisPresence(room, sessionId) {
  if (!liveRedisBridgeReady || !room || !sessionId) return;
  try {
    const redis = await getRedisClient();
    const key = getPresenceKey(room);
    const ts = String(Date.now());
    await redis.hSet(key, sessionId, ts);
    await redis.expire(key, LIVE_REDIS_PRESENCE_TTL_SEC);
  } catch (err) {
    console.warn('[chat] Redis hSet/expire failed:', err?.message || err);
    // ignore redis presence failures
  }
}

export async function removeRedisPresence(room, sessionId) {
  if (!liveRedisBridgeReady || !room || !sessionId) return;
  try {
    const redis = await getRedisClient();
    const key = getPresenceKey(room);
    await redis.hDel(key, sessionId);
  } catch (err) {
    console.warn('[chat] Redis hDel failed:', err?.message || err);
    // ignore redis presence failures
  }
}

export async function getRoomParticipantCountGlobal(room) {
  if (!liveRedisBridgeReady || !room) {
    return getRoomParticipantCount(room);
  }

  try {
    const redis = await getRedisClient();
    const key = getPresenceKey(room);
    const all = await redis.hGetAll(key);
    const cutoff = Date.now() - LIVE_REDIS_PRESENCE_TTL_SEC * 1000;
    let count = 0;

    const stale = [];
    for (const [sessionId, ts] of Object.entries(all || {})) {
      const n = Number.parseInt(ts, 10);
      if (!Number.isFinite(n) || n < cutoff) {
        stale.push(sessionId);
        continue;
      }
      count += 1;
    }

    if (stale.length > 0) {
      await redis.hDel(key, ...stale);
    }

    return count;
  } catch {
    return getRoomParticipantCount(room);
  }
}

// ---------------------------------------------------------------------------
// Redis bridge (cross-instance fan-out)
// ---------------------------------------------------------------------------

export async function ensureLiveRedisBridge() {
  if (liveRedisBridgeReady || liveRedisBridgeFailed) return;

  try {
    const subscriber = await getRedisSubscriber();
    await subscriber.subscribe(LIVE_REDIS_CHANNEL, (message) => {
      try {
        const parsed = JSON.parse(message);
        if (!parsed || parsed.source === LIVE_INSTANCE_ID) return;
        const room = normalizeRoomKey(parsed.room);
        const payload = parsed.payload;
        if (!payload || typeof payload !== "object") return;

        if (payload.type === "live_message") {
          appendRoomHistory(room, {
            sessionId: payload.sessionId,
            name: payload.name,
            text: payload.text,
            senderType: payload.senderType || "client",
            ts: payload.ts || new Date().toISOString(),
          });
          appendLiveContextMessage({
            sessionId: payload.sessionId,
            room,
            name: payload.name,
            text: payload.text,
            senderType: payload.senderType || "client",
            ts: payload.ts || new Date().toISOString(),
          });
        }

        broadcastRoom(room, payload);
      } catch (err) {
        console.warn('[chat] Redis payload parse failed:', err?.message || err);
        // ignore malformed redis payload
      }
    });

    liveRedisBridgeReady = true;
    console.log("[LiveChat] Redis bridge enabled");
  } catch (err) {
    liveRedisBridgeFailed = true;
    console.warn(
      "[LiveChat] Redis bridge unavailable. Using local-only live fan-out.",
    );
    console.warn("[LiveChat] Bridge error:", err?.message || err);
  }
}

export async function publishLiveEvent(room, payload) {
  if (!liveRedisBridgeReady) return;
  try {
    const publisher = await getRedisClient();
    await publisher.publish(
      LIVE_REDIS_CHANNEL,
      JSON.stringify({
        source: LIVE_INSTANCE_ID,
        room,
        payload,
        ts: new Date().toISOString(),
      }),
    );
  } catch (err) {
    console.warn(
      "[LiveChat] Failed to publish redis live event:",
      err?.message || err,
    );
  }
}

export async function emitRoomEvent(room, payload) {
  broadcastRoom(room, payload);
  await publishLiveEvent(room, payload);
}

// ---------------------------------------------------------------------------
// Session notification (targets a specific sessionId across all SSE streams)
// ---------------------------------------------------------------------------

export function notifySession(sessionId, payload) {
  if (!sessionId) return;
  for (const stream of liveStreams.values()) {
    if (stream.sessionId !== sessionId) continue;
    sendSSE(stream.res, {
      type: "session_notification",
      sessionId,
      ...payload,
      ts: new Date().toISOString(),
    });
  }
}

// ---------------------------------------------------------------------------
// Auto-reply logic
// ---------------------------------------------------------------------------

export function shouldSkipAutoReply(text) {
  const value = String(text || "").trim();
  if (!value) return true;
  if (value.startsWith("/")) return true;
  if (value.length < 1) return true;
  if ((value.match(/https?:\/\//g) || []).length >= 2) return true;

  const blockedPatterns = [
    /kill\s+yourself/i,
    /suicide/i,
    /racial\s+slur/i,
    /nazi/i,
    /terror/i,
    /credit\s*card/i,
    /password/i,
    /api\s*key/i,
    /private\s*key/i,
  ];

  return blockedPatterns.some((re) => re.test(value));
}

export function normalizeAutoReply(text) {
  const cleaned = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned)
    return "Interesting point. What part do you want to dig into next?";

  const softened = cleaned
    .replace(/\b(as an?|i am an?)\s+ai\b/gi, "from my side")
    .replace(/\blanguage model\b/gi, "companion")
    .replace(/\bi cannot\b/gi, "I can't");

  return softened.slice(0, liveAgentPolicy.maxReplyChars);
}

export async function buildAutoReplyText(room, triggerName, triggerText) {
  // Pick persona (rotate per room so multiple messages use different voices)
  const personas = LIVE_AGENT_PERSONAS;
  const prevIdx =
    roomPersonaIndex.get(room) ?? Math.floor(Math.random() * personas.length);
  // Skip to a different persona than last time
  const nextIdx =
    (prevIdx + 1 + Math.floor(Math.random() * (personas.length - 1))) %
    personas.length;
  roomPersonaIndex.set(room, nextIdx);
  const persona = personas[nextIdx];

  const history = liveRoomHistory.get(room) || [];
  const transcript = history
    .slice(-10)
    .map((msg) => `${msg.name}: ${msg.text}`)
    .join("\n");

  // Detect language from trigger text (simple heuristic: Korean unicode range)
  const isKorean = /[\uAC00-\uD7A3]/.test(triggerText);
  const langStyle = isKorean ? persona.lang_hint.ko : persona.lang_hint.en;

  const prompt = [
    `You are ${persona.name}, a real participant in an online community room.`,
    `Your personality: ${persona.traits}.`,
    `Reply style: ${langStyle}.`,
    "Reply in the same language as the latest user message.",
    "Write 1-3 short natural sentences like a real community member would.",
    "Do NOT say you are AI. Do NOT mention being a bot or assistant.",
    "Do NOT use formal greetings. Just respond naturally to the conversation.",
    "",
    `Room: ${room}`,
    `${triggerName} just said: "${triggerText}"`,
    "",
    "Recent chat context:",
    transcript || "(conversation just started)",
    "",
    "Write only your reply. Be natural, brief, and conversational.",
  ].join("\n");

  const generated = await aiService.generate(prompt, {
    temperature: Math.min(1.2, liveAgentPolicy.temperature + 0.15),
  });

  return normalizeAutoReply(generated);
}

export function getAgentPersonaName(room) {
  const idx = roomPersonaIndex.get(room);
  if (idx === undefined || idx < 0 || idx >= LIVE_AGENT_PERSONAS.length) {
    return LIVE_AGENT_PERSONAS[0].name;
  }
  return LIVE_AGENT_PERSONAS[idx].name;
}

export function scheduleAutoRoomReply({
  room,
  triggerSessionId,
  triggerName,
  triggerText,
}) {
  const existingTimer = liveAgentTimers.get(room);
  if (existingTimer) {
    clearTimeout(existingTimer);
    liveAgentTimers.delete(room);
  }

  if (Math.random() < liveAgentPolicy.silenceProbability) {
    return;
  }

  if (shouldSkipAutoReply(triggerText)) {
    return;
  }

  const jitterMs =
    liveAgentPolicy.minDelayMs +
    Math.floor(
      Math.random() * (liveAgentPolicy.maxDelayMs - liveAgentPolicy.minDelayMs),
    );
  const timer = setTimeout(async () => {
    liveAgentTimers.delete(room);

    const participantCount = await getRoomParticipantCountGlobal(room);
    if (participantCount > 1) return;

    try {
      const reply = await buildAutoReplyText(room, triggerName, triggerText);
      const agentSessionId = `agent:${room}:${getAgentPersonaName(room)}`;
      const ts = new Date().toISOString();

      appendRoomHistory(room, {
        sessionId: agentSessionId,
        name: getAgentPersonaName(room),
        text: reply,
        senderType: "agent",
        ts,
      });
      appendLiveContextMessage({
        sessionId: agentSessionId,
        room,
        name: getAgentPersonaName(room),
        text: reply,
        senderType: "agent",
        ts,
      });

      const onlineCount = await getRoomParticipantCountGlobal(room);
      await emitRoomEvent(room, {
        type: "live_message",
        room,
        sessionId: agentSessionId,
        senderType: "agent",
        name: getAgentPersonaName(room),
        text: reply,
        ts,
        onlineCount,
      });

      notifySession(triggerSessionId, {
        level: "info",
        message: `${getAgentPersonaName(room)} replied in the room`,
        room,
      });
    } catch (err) {
      notifySession(triggerSessionId, {
        level: "warn",
        message: "Auto room reply skipped due to temporary AI error",
        room,
      });
      console.warn("Auto room reply failed:", err?.message || err);
    }
  }, jitterMs);

  liveAgentTimers.set(room, timer);
}

// ---------------------------------------------------------------------------
// Policy management
// ---------------------------------------------------------------------------

export function getLivePolicySnapshot() {
  return {
    ...liveAgentPolicy,
    historyLimit: LIVE_HISTORY_LIMIT,
    redisBridgeEnabled: liveRedisBridgeReady,
    redisBridgeFailed: liveRedisBridgeFailed,
    redisPresenceTtlSec: LIVE_REDIS_PRESENCE_TTL_SEC,
  };
}

export function validateAndApplyLivePolicyUpdate(input) {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "payload must be an object" };
  }

  const next = { ...liveAgentPolicy };

  if (input.silenceProbability !== undefined) {
    const value = Number(input.silenceProbability);
    if (!Number.isFinite(value) || value < 0 || value > 0.95) {
      return {
        ok: false,
        error: "silenceProbability must be between 0 and 0.95",
      };
    }
    next.silenceProbability = value;
  }

  if (input.minDelayMs !== undefined) {
    const value = Number(input.minDelayMs);
    if (!Number.isFinite(value) || value < 300 || value > 20000) {
      return { ok: false, error: "minDelayMs must be between 300 and 20000" };
    }
    next.minDelayMs = Math.floor(value);
  }

  if (input.maxDelayMs !== undefined) {
    const value = Number(input.maxDelayMs);
    if (!Number.isFinite(value) || value < 500 || value > 25000) {
      return { ok: false, error: "maxDelayMs must be between 500 and 25000" };
    }
    next.maxDelayMs = Math.floor(value);
  }

  if (input.maxReplyChars !== undefined) {
    const value = Number(input.maxReplyChars);
    if (!Number.isFinite(value) || value < 80 || value > 2000) {
      return { ok: false, error: "maxReplyChars must be between 80 and 2000" };
    }
    next.maxReplyChars = Math.floor(value);
  }

  if (input.temperature !== undefined) {
    const value = Number(input.temperature);
    if (!Number.isFinite(value) || value < 0 || value > 2) {
      return { ok: false, error: "temperature must be between 0 and 2" };
    }
    next.temperature = value;
  }

  if (next.maxDelayMs <= next.minDelayMs) {
    return { ok: false, error: "maxDelayMs must be greater than minDelayMs" };
  }

  Object.assign(liveAgentPolicy, next);
  return { ok: true, policy: getLivePolicySnapshot() };
}

export function isLivePolicyWriteAuthorized(req) {
  const expected = process.env.LIVE_CONFIG_KEY || "";
  if (!expected) return false;
  const provided = req.get("X-Live-Config-Key") || "";
  return provided && provided === expected;
}

// ---------------------------------------------------------------------------
// Expose room history for route handlers
// ---------------------------------------------------------------------------

export function getRoomHistory(room) {
  return liveRoomHistory.get(room) || [];
}

export function getLiveRoomKeys() {
  return [...liveRooms.keys()];
}

export function getAllRoomHistoryEntries() {
  return [...liveRoomHistory.entries()];
}

export function getAllActiveStreamRooms() {
  const rooms = new Set();
  for (const stream of liveStreams.values()) {
    rooms.add(stream.room);
  }
  return [...rooms];
}
