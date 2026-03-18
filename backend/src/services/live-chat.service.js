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
import { createLogger } from "../lib/logger.js";

const logger = createLogger('live-chat');

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------

const liveStreams = new Map();
const liveRooms = new Map();
const liveRoomHistory = new Map();
const liveAgentRounds = new Map();
const liveAgentMemory = new Map();
const roomAgentCursor = new Map();
const LIVE_HISTORY_LIMIT = 30;
const LIVE_AGENT_MEMORY_LIMIT = 6;
const LIVE_TRANSCRIPT_LIMIT = 12;
const LIVE_AGENT_ROUND_LIMIT = 3;

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
const LIVE_AGENT_PERSONA_MAP = new Map(
  LIVE_AGENT_PERSONAS.map((persona) => [persona.name, persona]),
);

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
      clearScheduledAgentRound(stream.room);
      liveAgentMemory.delete(stream.room);
      roomAgentCursor.delete(stream.room);
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

function getAgentPersona(agentName) {
  const normalized = String(agentName || "").trim().toLowerCase();
  return LIVE_AGENT_PERSONA_MAP.get(normalized) || null;
}

function getAgentSessionId(room, agentName) {
  return `agent:${room}:${String(agentName || "").trim().toLowerCase()}`;
}

function ensureAgentMemoryRoom(room) {
  if (!liveAgentMemory.has(room)) {
    liveAgentMemory.set(room, new Map());
  }
  return liveAgentMemory.get(room);
}

function clearScheduledAgentRound(room) {
  const round = liveAgentRounds.get(room);
  if (round?.timer) {
    clearTimeout(round.timer);
  }
  liveAgentRounds.delete(room);
}

function appendAgentMemory(room, entry) {
  const persona = getAgentPersona(entry?.name);
  if (!persona || entry?.senderType !== "agent") return;

  const roomMemory = ensureAgentMemoryRoom(room);
  const bucket = roomMemory.get(persona.name) || [];
  bucket.push({
    name: persona.name,
    text: String(entry.text || "").trim(),
    replyToName:
      typeof entry.replyToName === "string" ? entry.replyToName.trim() : "",
    ts: entry.ts || new Date().toISOString(),
  });

  if (bucket.length > LIVE_AGENT_MEMORY_LIMIT) {
    bucket.splice(0, bucket.length - LIVE_AGENT_MEMORY_LIMIT);
  }

  roomMemory.set(persona.name, bucket);
}

function getAgentRecentMemory(room, agentName, limit = 4) {
  const persona = getAgentPersona(agentName);
  if (!persona) return [];
  const roomMemory = liveAgentMemory.get(room);
  const bucket = roomMemory?.get(persona.name) || [];
  if (bucket.length <= limit) {
    return [...bucket];
  }
  return bucket.slice(-limit);
}

export function recordLiveMessage(room, entry = {}) {
  const normalizedRoom = normalizeRoomKey(room);
  const normalizedEntry = {
    sessionId:
      typeof entry.sessionId === "string" && entry.sessionId.trim()
        ? entry.sessionId.trim()
        : "",
    name:
      typeof entry.name === "string" && entry.name.trim()
        ? entry.name.trim()
        : entry.senderType === "agent"
          ? "agent"
          : "visitor",
    text: String(entry.text || "").trim(),
    senderType: entry.senderType === "agent" ? "agent" : "client",
    ts: entry.ts || new Date().toISOString(),
    replyToName:
      typeof entry.replyToName === "string" && entry.replyToName.trim()
        ? entry.replyToName.trim()
        : undefined,
    turnIndex: Number.isFinite(entry.turnIndex)
      ? Math.max(1, Math.floor(entry.turnIndex))
      : undefined,
    roundId:
      typeof entry.roundId === "string" && entry.roundId.trim()
        ? entry.roundId.trim()
        : undefined,
    personaStyle:
      typeof entry.personaStyle === "string" && entry.personaStyle.trim()
        ? entry.personaStyle.trim()
        : undefined,
    personaTraits:
      typeof entry.personaTraits === "string" && entry.personaTraits.trim()
        ? entry.personaTraits.trim()
        : undefined,
    triggeredByMention: entry.triggeredByMention === true,
    mentionedAgents: Array.isArray(entry.mentionedAgents)
      ? entry.mentionedAgents
          .map((value) => String(value || "").trim().toLowerCase())
          .filter(Boolean)
          .slice(0, LIVE_AGENT_PERSONAS.length)
      : [],
  };

  appendRoomHistory(normalizedRoom, normalizedEntry);
  appendLiveContextMessage({
    sessionId: normalizedEntry.sessionId,
    room: normalizedRoom,
    name: normalizedEntry.name,
    text: normalizedEntry.text,
    senderType: normalizedEntry.senderType,
    ts: normalizedEntry.ts,
  });
  appendAgentMemory(normalizedRoom, normalizedEntry);

  return normalizedEntry;
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
    logger.warn({}, 'Redis hSet/expire failed', { error: err?.message });
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
    logger.warn({}, 'Redis hDel failed', { error: err?.message });
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
          recordLiveMessage(room, payload);
        }

        broadcastRoom(room, payload);
      } catch (err) {
        logger.warn({}, 'Redis payload parse failed', { error: err?.message });
        // ignore malformed redis payload
      }
    });

    liveRedisBridgeReady = true;
    logger.info({}, 'Redis bridge enabled');
  } catch (err) {
    liveRedisBridgeFailed = true;
    logger.warn({}, 'Redis bridge unavailable. Using local-only live fan-out.', { error: err?.message });
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
    logger.warn({}, 'Failed to publish redis live event', { error: err?.message });
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

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractMentionedAgents(text) {
  const value = String(text || "");
  const matches = [];

  for (const persona of LIVE_AGENT_PERSONAS) {
    const pattern = new RegExp(
      `(^|[^a-z0-9])@?${escapeRegExp(persona.name)}(?=$|[^a-z0-9])`,
      "i",
    );
    const index = value.search(pattern);
    if (index >= 0) {
      matches.push({ name: persona.name, index });
    }
  }

  return matches
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.name);
}

function pickRotatingAgents(room, count, excludedNames = []) {
  const excluded = new Set(
    excludedNames.map((value) => String(value || "").trim().toLowerCase()),
  );
  const personas = LIVE_AGENT_PERSONAS;
  const maxCount = Math.max(
    0,
    Math.min(count, personas.length - Math.min(excluded.size, personas.length)),
  );
  if (maxCount === 0) return [];

  let cursor =
    roomAgentCursor.get(room) ?? Math.floor(Math.random() * personas.length);
  const picks = [];
  let attempts = 0;

  while (picks.length < maxCount && attempts < personas.length * 3) {
    cursor = (cursor + 1) % personas.length;
    attempts += 1;
    const persona = personas[cursor];
    if (!persona || excluded.has(persona.name) || picks.includes(persona.name)) {
      continue;
    }
    picks.push(persona.name);
  }

  if (picks.length > 0) {
    const lastIdx = personas.findIndex(
      (persona) => persona.name === picks[picks.length - 1],
    );
    if (lastIdx >= 0) {
      roomAgentCursor.set(room, lastIdx);
    }
  }

  return picks;
}

function buildAutoReplyPlan(room, triggerText, mentionedAgents) {
  const normalizedRoom = normalizeRoomKey(room);
  const normalizedMentions = Array.isArray(mentionedAgents)
    ? mentionedAgents
        .map((value) => String(value || "").trim().toLowerCase())
        .filter((value) => LIVE_AGENT_PERSONA_MAP.has(value))
    : [];
  const hasExplicitMention = normalizedMentions.length > 0;
  const questionLike = /[?？]|(\bwhy\b|\bhow\b|\bwhat\b|\bshould\b|왜|어떻게|뭐|어떤)/i.test(
    triggerText,
  );
  const desiredTurns = hasExplicitMention
    ? Math.min(
        LIVE_AGENT_ROUND_LIMIT,
        Math.max(2, normalizedMentions.length + 1),
      )
    : questionLike || String(triggerText || "").length > 90
      ? Math.min(LIVE_AGENT_ROUND_LIMIT, 3)
      : 2;

  const starters = normalizedMentions.slice(0, LIVE_AGENT_ROUND_LIMIT);
  const fillers = pickRotatingAgents(
    normalizedRoom,
    desiredTurns - starters.length,
    starters,
  );
  return [...starters, ...fillers].slice(0, LIVE_AGENT_ROUND_LIMIT);
}

function formatTranscriptEntry(entry) {
  const replyToName =
    typeof entry?.replyToName === "string" && entry.replyToName.trim()
      ? ` -> ${entry.replyToName.trim()}`
      : "";
  return `${entry?.name || "anonymous"}${replyToName}: ${entry?.text || ""}`;
}

function pickReplyDelay(isFollowUp = false) {
  if (!isFollowUp) {
    return (
      liveAgentPolicy.minDelayMs +
      Math.floor(
        Math.random() *
          Math.max(1, liveAgentPolicy.maxDelayMs - liveAgentPolicy.minDelayMs),
      )
    );
  }

  const followUpMin = Math.max(350, Math.floor(liveAgentPolicy.minDelayMs * 0.45));
  const followUpMax = Math.max(
    followUpMin + 150,
    Math.min(liveAgentPolicy.maxDelayMs, Math.floor(liveAgentPolicy.maxDelayMs * 0.72)),
  );
  return (
    followUpMin +
    Math.floor(Math.random() * Math.max(1, followUpMax - followUpMin))
  );
}

function scheduleAgentRoundStep(room, roundId, delayMs) {
  const round = liveAgentRounds.get(room);
  if (!round || round.roundId !== roundId) return;

  if (round.timer) {
    clearTimeout(round.timer);
  }

  round.timer = setTimeout(() => {
    void runAgentRoundStep(room, roundId);
  }, Math.max(120, Math.floor(delayMs)));
}

export async function buildAutoReplyText(input = {}) {
  const room = normalizeRoomKey(input.room);
  const agentName = String(input.agentName || "").trim().toLowerCase();
  const persona = getAgentPersona(agentName);
  if (!persona) {
    throw new Error(`Unknown live agent persona: ${agentName}`);
  }

  const triggerName =
    typeof input.triggerName === "string" && input.triggerName.trim()
      ? input.triggerName.trim()
      : "visitor";
  const triggerText = String(input.triggerText || "").trim();
  const replyToName =
    typeof input.replyToName === "string" && input.replyToName.trim()
      ? input.replyToName.trim()
      : triggerName;
  const turnIndex = Number.isFinite(input.turnIndex)
    ? Math.max(1, Math.floor(input.turnIndex))
    : 1;
  const roundSize = Number.isFinite(input.roundSize)
    ? Math.max(1, Math.floor(input.roundSize))
    : 1;
  const mentionedAgents = Array.isArray(input.mentionedAgents)
    ? input.mentionedAgents
        .map((value) => String(value || "").trim().toLowerCase())
        .filter((value) => LIVE_AGENT_PERSONA_MAP.has(value))
    : [];

  const history = liveRoomHistory.get(room) || [];
  const transcript = history
    .slice(-LIVE_TRANSCRIPT_LIMIT)
    .map(formatTranscriptEntry)
    .join("\n");
  const agentMemory = getAgentRecentMemory(room, agentName, 4)
    .map((entry) => formatTranscriptEntry(entry))
    .join("\n");
  const otherAgents = LIVE_AGENT_PERSONAS.filter(
    (candidate) => candidate.name !== agentName,
  )
    .map((candidate) => `${candidate.name} (${candidate.style})`)
    .join(", ");

  const isKorean = /[\uAC00-\uD7A3]/.test(triggerText || transcript);
  const langStyle = isKorean ? persona.lang_hint.ko : persona.lang_hint.en;
  const directMentioned = mentionedAgents.includes(agentName);
  const chainGuidance =
    turnIndex < roundSize
      ? "Leave a little room for someone else to jump in after you."
      : "Wrap up your point naturally without sounding like a final summary.";

  const prompt = [
    `You are ${persona.name}, one named participant in a fast live multi-agent room.`,
    `Persona style: ${persona.style}. Traits: ${persona.traits}.`,
    `Reply style: ${langStyle}.`,
    `Other named agents in this room: ${otherAgents || "none"}.`,
    "Stay fully in character as a person in the room.",
    "Reply in the same language as the latest user message.",
    "Write exactly one chat bubble with 1-3 short natural sentences.",
    "Sound spontaneous and conversational, like a real group chat participant.",
    "Do NOT say you are AI, a bot, an assistant, or a language model.",
    "Do NOT add speaker labels, quotes, emojis, or stage directions.",
    "Do NOT repeat the previous speaker verbatim or restate the whole room summary.",
    directMentioned
      ? "You were explicitly called by name, so answer directly before widening the discussion."
      : `You are jumping in after ${replyToName}, so react to their point while keeping the original user message in mind.`,
    chainGuidance,
    "",
    `Room: ${room}`,
    `Original user trigger from ${triggerName}: "${triggerText}"`,
    `Immediate previous speaker: ${replyToName}`,
    mentionedAgents.length > 0
      ? `Explicitly mentioned agents: ${mentionedAgents.join(", ")}`
      : "Explicitly mentioned agents: none",
    `Current turn in the room chain: ${turnIndex}/${roundSize}`,
    "",
    "Your recent messages in this room:",
    agentMemory || "(no prior agent-specific history)",
    "",
    "Recent room transcript:",
    transcript || "(conversation just started)",
    "",
    "Write only the message text.",
  ].join("\n");

  const generated = await aiService.generate(prompt, {
    temperature: Math.min(
      1.2,
      liveAgentPolicy.temperature + (turnIndex > 1 ? 0.18 : 0.08),
    ),
  });

  return normalizeAutoReply(generated);
}

async function runAgentRoundStep(room, roundId) {
  const round = liveAgentRounds.get(room);
  if (!round || round.roundId !== roundId) return;

  round.timer = null;
  const agentName = round.remainingAgents.shift();
  if (!agentName) {
    liveAgentRounds.delete(room);
    return;
  }

  const participantCount = await getRoomParticipantCountGlobal(room);
  if (participantCount > 1 && round.mentionedAgents.length === 0) {
    liveAgentRounds.delete(room);
    return;
  }

  const persona = getAgentPersona(agentName);
  if (!persona) {
    if (round.remainingAgents.length === 0) {
      liveAgentRounds.delete(room);
      return;
    }
    liveAgentRounds.set(room, round);
    scheduleAgentRoundStep(room, roundId, pickReplyDelay(true));
    return;
  }

  const replyToName = round.lastSpeakerName || round.triggerName;

  try {
    const reply = await buildAutoReplyText({
      room,
      agentName,
      triggerName: round.triggerName,
      triggerText: round.triggerText,
      replyToName,
      mentionedAgents: round.mentionedAgents,
      turnIndex: round.turnIndex,
      roundSize: round.roundSize,
    });
    const ts = new Date().toISOString();
    const messagePayload = {
      type: "live_message",
      room,
      sessionId: getAgentSessionId(room, agentName),
      senderType: "agent",
      name: agentName,
      text: reply,
      ts,
      onlineCount: await getRoomParticipantCountGlobal(room),
      replyToName,
      turnIndex: round.turnIndex,
      roundId,
      roundSize: round.roundSize,
      personaStyle: persona.style,
      personaTraits: persona.traits,
      triggeredByMention: round.mentionedAgents.includes(agentName),
      mentionedAgents: round.mentionedAgents,
    };

    recordLiveMessage(room, messagePayload);
    await emitRoomEvent(room, messagePayload);

    notifySession(round.triggerSessionId, {
      level: "info",
      message: `${agentName} replied in the room`,
      room,
    });

    round.lastSpeakerName = agentName;
    round.turnIndex += 1;

    if (round.remainingAgents.length === 0) {
      liveAgentRounds.delete(room);
      return;
    }

    liveAgentRounds.set(room, round);
    scheduleAgentRoundStep(room, roundId, pickReplyDelay(true));
  } catch (err) {
    notifySession(round.triggerSessionId, {
      level: "warn",
      message: "Auto room reply skipped due to temporary AI error",
      room,
    });
    logger.warn({ room, agentName }, "Auto room reply failed", {
      error: err?.message,
    });

    if (round.remainingAgents.length === 0) {
      liveAgentRounds.delete(room);
      return;
    }

    liveAgentRounds.set(room, round);
    scheduleAgentRoundStep(room, roundId, Math.max(250, pickReplyDelay(true) / 2));
  }
}

export function scheduleAutoRoomReply({
  room,
  triggerSessionId,
  triggerName,
  triggerText,
}) {
  const normalizedRoom = normalizeRoomKey(room);
  clearScheduledAgentRound(normalizedRoom);

  if (shouldSkipAutoReply(triggerText)) {
    return;
  }

  const mentionedAgents = extractMentionedAgents(triggerText);
  if (
    mentionedAgents.length === 0 &&
    Math.random() < liveAgentPolicy.silenceProbability
  ) {
    return;
  }

  const plan = buildAutoReplyPlan(normalizedRoom, triggerText, mentionedAgents);
  if (plan.length === 0) return;

  const roundId = `round-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  liveAgentRounds.set(normalizedRoom, {
    roundId,
    room: normalizedRoom,
    triggerSessionId,
    triggerName:
      typeof triggerName === "string" && triggerName.trim()
        ? triggerName.trim()
        : "visitor",
    triggerText: String(triggerText || "").trim(),
    mentionedAgents,
    remainingAgents: [...plan],
    roundSize: plan.length,
    turnIndex: 1,
    lastSpeakerName:
      typeof triggerName === "string" && triggerName.trim()
        ? triggerName.trim()
        : "visitor",
    timer: null,
  });

  scheduleAgentRoundStep(normalizedRoom, roundId, pickReplyDelay(false));
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
