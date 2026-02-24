import { Router } from 'express';
import { WebSocketServer } from 'ws';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { aiService, tryParseJson } from '../lib/ai-service.js';
import { getRedisClient, getRedisSubscriber } from '../lib/redis-client.js';
import { config } from '../config.js';
import { openaiEmbeddings } from '../lib/openai-compat-client.js';
import openNotebook from '../services/open-notebook.service.js';
import {
  CHROMA,
  AI_TEMPERATURES,
  TEXT_LIMITS,
  STREAMING,
  VALID_TASK_MODES,
  FALLBACK_DATA,
} from '../config/constants.js';

const router = Router();

const ragCollectionCache = new Map();

function getChromaCollectionsBase() {
  return `${config.rag.chromaUrl}/api/v2/tenants/${CHROMA.TENANT}/databases/${CHROMA.DATABASE}/collections`;
}

async function getCollectionUUID(collectionName) {
  if (ragCollectionCache.has(collectionName)) {
    return ragCollectionCache.get(collectionName);
  }
  
  try {
    const collectionsUrl = getChromaCollectionsBase();
    const listResp = await fetch(collectionsUrl, { method: 'GET' });
    
    if (!listResp.ok) return null;
    
    const collections = await listResp.json();
    const collection = collections.find(c => c.name === collectionName);
    
    if (collection) {
      ragCollectionCache.set(collectionName, collection.id);
      return collection.id;
    }
  } catch {
    return null;
  }
  return null;
}

async function getEmbeddings(texts) {
  const result = await openaiEmbeddings(texts, {
    model: config.rag.embeddingModel,
    baseUrl: config.rag.embeddingUrl,
    apiKey: config.rag.embeddingApiKey,
  });

  return result.embeddings;
}

async function queryChroma(embedding, nResults = 5) {
  const collectionName = config.rag.chromaCollection;
  const collectionsBase = getChromaCollectionsBase();
  
  const collectionUUID = await getCollectionUUID(collectionName);
  if (!collectionUUID) {
    throw new Error(`Collection not found: ${collectionName}`);
  }
  
  const queryUrl = `${collectionsBase}/${collectionUUID}/query`;
  const response = await fetch(queryUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query_embeddings: [embedding],
      n_results: nResults,
      include: ['documents', 'metadatas', 'distances'],
    }),
  });
  
  if (!response.ok) {
    throw new Error(`ChromaDB error: ${response.status}`);
  }
  
  return response.json();
}

async function performRAGSearch(query, topK = 5) {
  try {
    const [embedding] = await getEmbeddings([query]);
    const chromaResult = await queryChroma(embedding, topK);
    
    const sources = [];
    const contextParts = [];
    
    if (chromaResult.documents && chromaResult.documents[0]) {
      const docs = chromaResult.documents[0];
      const metas = chromaResult.metadatas?.[0] || [];
      const dists = chromaResult.distances?.[0] || [];
      
      for (let i = 0; i < docs.length; i++) {
        const meta = metas[i] || {};
        const distance = dists[i];
        const score = distance != null ? Math.max(0, 1 - distance) : null;
        
        sources.push({
          title: meta.title || meta.post_title || 'Untitled',
          url: meta.slug ? `/posts/${meta.year || new Date().getFullYear()}/${meta.slug}` : undefined,
          score,
          snippet: docs[i]?.slice(0, 200) || '',
        });
        
        const title = meta.title || meta.post_title || '';
        contextParts.push(`[${i + 1}] ${title ? `"${title}": ` : ''}${docs[i]}`);
      }
    }
    
    const context = contextParts.length > 0
      ? `다음은 관련 블로그 포스트에서 발췌한 내용입니다:\n\n${contextParts.join('\n\n')}\n\n위 내용을 참고하여 답변해주세요.`
      : null;
    
    return { context, sources };
  } catch (err) {
    console.warn('RAG search failed:', err.message);
    return { context: null, sources: [] };
  }
}

function extractMeaningfulLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line !== '---')
    .filter((line) => !/^```/.test(line));
}

function sentencePoints(text, max = 4) {
  const candidates = String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?。！？])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max);

  if (candidates.length > 0) return candidates;

  return extractMeaningfulLines(text)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, max);
}

function toText(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function clampQuizCount(value, fallback = 2) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(6, Math.floor(value)));
}

function normalizeQuizTags(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((tag) => (typeof tag === 'string' ? tag.trim().toLowerCase() : ''))
    .filter(Boolean)
    .slice(0, 24);
}

function hasStudyTagTrigger(tags) {
  const triggers = [
    'study',
    '학습',
    'algorithm',
    '알고리즘',
    'problem-solving',
    'problem_solving',
    'coding-test',
    '코딩테스트',
    'data-structure',
    '자료구조',
  ];
  return tags.some((tag) => triggers.some((trigger) => tag.includes(trigger)));
}

function normalizeQuizType(value) {
  if (typeof value !== 'string') return 'explain';
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === 'fillblank') return 'fill_blank';
  if (normalized === 'multiplechoice') return 'multiple_choice';
  if (normalized === 'code_transform') return 'transform';
  if (['fill_blank', 'multiple_choice', 'transform', 'explain'].includes(normalized)) {
    return normalized;
  }
  return 'explain';
}

function normalizeQuizQuestion(value) {
  if (!value || typeof value !== 'object') return null;

  const question = toText(value.question ?? value.q ?? value.prompt ?? value.title);
  const answer = toText(value.answer ?? value.correctAnswer ?? value.correct ?? value.solution ?? value.a);
  if (!question || !answer) return null;

  const optionsSource =
    (Array.isArray(value.options) ? value.options : null) ||
    (Array.isArray(value.choices) ? value.choices : null) ||
    (Array.isArray(value.candidates) ? value.candidates : null);

  const options = Array.isArray(optionsSource)
    ? optionsSource.map(toText).filter(Boolean).slice(0, 6)
    : [];

  const explanation = toText(value.explanation ?? value.reason ?? value.why ?? value.hint);
  const type = normalizeQuizType(value.type ?? (options.length > 0 ? 'multiple_choice' : 'explain'));

  const normalized = {
    type,
    question,
    answer,
  };

  if (options.length > 0) normalized.options = options;
  if (explanation) normalized.explanation = explanation;

  return normalized;
}

function extractQuizItems(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const parsed = tryParseJson(value);
    return parsed ? extractQuizItems(parsed) : [];
  }
  if (!value || typeof value !== 'object') return [];

  if (Array.isArray(value.quiz)) return value.quiz;
  if (Array.isArray(value.questions)) return value.questions;
  if (Array.isArray(value.items)) return value.items;

  if ('data' in value) return extractQuizItems(value.data);
  if ('result' in value) return extractQuizItems(value.result);
  if ('_raw' in value) {
    const rawData = value._raw;
    if (typeof rawData === 'string') return extractQuizItems(rawData);
    if (rawData && typeof rawData === 'object' && typeof rawData.text === 'string') {
      return extractQuizItems(rawData.text);
    }
  }

  return [];
}

function normalizeQuizData(value, maxQuestions = 2) {
  const quiz = extractQuizItems(value)
    .map(normalizeQuizQuestion)
    .filter(Boolean)
    .slice(0, Math.max(1, maxQuestions));

  if (!quiz.length) return null;
  return { quiz };
}

function normalizeTaskData(mode, value, payload = {}) {
  if (mode !== 'quiz') return value;
  return normalizeQuizData(value, clampQuizCount(payload.quizCount, 2));
}

function projectTaskDataFromText(mode, text, payload) {
  const rawText = String(text || '').trim();
  if (!rawText) {
    return getFallbackData(mode, payload);
  }

  const lines = extractMeaningfulLines(rawText);
  const cleanedLines = lines
    .map((line) => line.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter(Boolean);

  switch (mode) {
    case 'sketch': {
      const moodMatch = rawText.match(/(?:mood|톤|감정)\s*[:：]\s*([^\n]+)/i);
      const mood = moodMatch?.[1]?.trim() || FALLBACK_DATA.MOOD || 'insightful';
      const bullets = cleanedLines.slice(0, 6);
      return {
        mood,
        bullets: bullets.length > 0 ? bullets : sentencePoints(rawText, 4),
      };
    }

    case 'prism': {
      const points = sentencePoints(rawText, 4);
      return {
        facets: [
          {
            title: 'AI 분석',
            points: points.length > 0 ? points : ['핵심 내용을 추출하지 못했습니다.'],
          },
        ],
      };
    }

    case 'chain': {
      const questionLines = cleanedLines
        .filter((line) => /\?$|？$/.test(line))
        .slice(0, 6);
      const baseQuestions = questionLines.length > 0 ? questionLines : sentencePoints(rawText, 4);

      return {
        questions: baseQuestions.map((q) => ({
          q: q.endsWith('?') || q.endsWith('？') ? q : `${q}?`,
          why: '핵심 논점을 더 깊게 이해하기 위해',
        })),
      };
    }

    case 'quiz': {
      const quizCount = clampQuizCount(payload.quizCount, 2);
      const templates = [
        {
          type: 'multiple_choice',
          question: '이 내용의 핵심 코드 흐름에서 가장 중요한 분기 조건은 무엇인가요?',
          answer: '핵심 분기 조건을 다시 확인해보세요.',
          options: ['입력 검증', '분기 처리', '반복 종료', '예외 처리'],
          explanation: 'AI가 서술형으로 응답해 퀴즈 형식으로 변환했습니다.',
        },
        {
          type: 'fill_blank',
          question: '본문 코드의 핵심 로직을 한 줄로 요약하면 ___ 입니다.',
          answer: '입력 처리 후 핵심 연산을 수행하는 흐름',
          explanation: '코드의 입력-처리-출력 흐름을 따라가며 빈칸을 채워보세요.',
        },
        {
          type: 'explain',
          question: '핵심 함수의 실행 순서를 단계별로 설명해보세요.',
          answer: rawText.slice(0, 800) || '입력 정규화 → 핵심 연산 → 결과 반환',
          explanation: '정답 문구보다 단계별 흐름을 설명하는 것이 중요합니다.',
        },
      ];

      const quiz = Array.from({ length: quizCount }, (_, idx) => {
        const base = templates[idx % templates.length];
        if (idx < templates.length) return base;
        return {
          ...base,
          question: `${base.question} (심화 ${idx + 1})`,
        };
      });

      return {
        quiz,
      };
    }

    case 'summary':
      return { summary: rawText };

    case 'catalyst': {
      const ideas = sentencePoints(rawText, 3);
      return {
        suggestions:
          ideas.length > 0
            ? ideas.map((idea) => ({
                idea,
                reason: 'AI 응답에서 추출한 제안입니다.',
              }))
            : [
                {
                  idea: '핵심 쟁점을 다시 정리해보세요.',
                  reason: '논점을 구조화하면 다음 선택이 쉬워집니다.',
                },
              ],
      };
    }

    case 'custom':
    default:
      return { text: rawText };
  }
}

// In-memory session storage (for simplicity - use Redis in production)
const sessions = new Map();
const notebookBootstrapJobs = new Map();
let postsCorpusCache = null;

const NOTEBOOK_BOOTSTRAP = {
  CHUNK_SIZE: 3200,
  CHUNK_OVERLAP: 200,
  MAX_CHUNKS_PER_POST: 80,
};

// In-memory live chat streams (single-process only)
const liveStreams = new Map();
const liveRooms = new Map();
const liveRoomHistory = new Map();
const liveAgentTimers = new Map();
const LIVE_HISTORY_LIMIT = 30;
const LIVE_AGENT_NAME = 'room-companion';

// Multi-persona agent pool — names look like real users, not bots
const LIVE_AGENT_PERSONAS = [
  {
    name: 'alex',
    style: 'casual',
    traits: 'curious, asks follow-up questions, uses occasional humor',
    lang_hint: { ko: '반말 가능, 짧고 자연스럽게', en: 'casual short replies' },
  },
  {
    name: 'jamie',
    style: 'thoughtful',
    traits: 'analytical, references interesting angles, sometimes plays devil\'s advocate',
    lang_hint: { ko: '논리적이고 간결하게', en: 'thoughtful concise replies' },
  },
  {
    name: 'sam',
    style: 'friendly',
    traits: 'warm, encouraging, uses simple language, relates to personal experience',
    lang_hint: { ko: '친근하고 공감하는 말투', en: 'warm empathetic tone' },
  },
  {
    name: 'quinn',
    style: 'direct',
    traits: 'brief, opinionated, sometimes challenges assumptions, no fluff',
    lang_hint: { ko: '짧고 직설적으로', en: 'short direct opinionated' },
  },
  {
    name: 'morgan',
    style: 'creative',
    traits: 'lateral thinker, draws unexpected comparisons, asks thought-provoking questions',
    lang_hint: { ko: '창의적이고 흥미로운 시각', en: 'creative lateral thinking' },
  },
];

// Map: room -> last persona index (rotate personas per room)
const roomPersonaIndex = new Map();
const LIVE_REDIS_CHANNEL = 'livechat:events';
const LIVE_INSTANCE_ID = `live-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const LIVE_REDIS_PRESENCE_PREFIX = 'livechat:presence';
const LIVE_REDIS_PRESENCE_TTL_SEC = Math.max(
  60,
  Number.parseInt(process.env.LIVE_REDIS_PRESENCE_TTL_SEC || '180', 10)
);

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function parseLivePolicyFromEnv() {
  const minDelayMs = clampNumber(
    Number.parseInt(process.env.LIVE_AGENT_MIN_DELAY_MS || '1200', 10),
    600,
    10_000
  );
  const maxDelayCandidate = clampNumber(
    Number.parseInt(process.env.LIVE_AGENT_MAX_DELAY_MS || '3400', 10),
    800,
    20_000
  );

  return {
    silenceProbability: clampNumber(
      Number.parseFloat(process.env.LIVE_AGENT_SILENCE_PROBABILITY || '0.1'),
      0,
      0.9
    ),
    minDelayMs,
    maxDelayMs: Math.max(minDelayMs + 200, maxDelayCandidate),
    maxReplyChars: clampNumber(
      Number.parseInt(process.env.LIVE_AGENT_MAX_REPLY_CHARS || '320', 10),
      120,
      1200
    ),
    temperature: clampNumber(
      Number.parseFloat(process.env.LIVE_AGENT_TEMPERATURE || String(AI_TEMPERATURES.CATALYST || 0.7)),
      0,
      1.5
    ),
  };
}

const liveAgentPolicy = parseLivePolicyFromEnv();

let liveRedisBridgeReady = false;
let liveRedisBridgeFailed = false;

function normalizeRoomKey(rawRoom) {
  const fallback = 'room:lobby';
  if (typeof rawRoom !== 'string') return fallback;

  const trimmed = rawRoom.trim().toLowerCase();
  if (!trimmed) return fallback;

  const normalized = trimmed
    .replace(/[^a-z0-9:_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);

  if (!normalized.startsWith('room:')) {
    return `room:${normalized}`;
  }
  return normalized;
}

function ensureLiveRoom(room) {
  if (!liveRooms.has(room)) {
    liveRooms.set(room, new Set());
  }
  return liveRooms.get(room);
}

function getPresenceKey(room) {
  return `${LIVE_REDIS_PRESENCE_PREFIX}:${room}`;
}

async function touchRedisPresence(room, sessionId) {
  if (!liveRedisBridgeReady || !room || !sessionId) return;
  try {
    const redis = await getRedisClient();
    const key = getPresenceKey(room);
    const ts = String(Date.now());
    await redis.hSet(key, sessionId, ts);
    await redis.expire(key, LIVE_REDIS_PRESENCE_TTL_SEC);
  } catch {
    // ignore redis presence failures
  }
}

async function removeRedisPresence(room, sessionId) {
  if (!liveRedisBridgeReady || !room || !sessionId) return;
  try {
    const redis = await getRedisClient();
    const key = getPresenceKey(room);
    await redis.hDel(key, sessionId);
  } catch {
    // ignore redis presence failures
  }
}

async function getRoomParticipantCountGlobal(room) {
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

function registerLiveStream(stream) {
  liveStreams.set(stream.id, stream);
  ensureLiveRoom(stream.room).add(stream.id);
}

function unregisterLiveStream(streamId) {
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

function getRoomParticipantCount(room) {
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

function sendSSE(res, payload) {
  try {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  } catch {
    // ignore closed stream
  }
}

function broadcastRoom(room, payload) {
  const roomStreams = liveRooms.get(room);
  if (!roomStreams || roomStreams.size === 0) return;

  for (const streamId of roomStreams) {
    const stream = liveStreams.get(streamId);
    if (!stream) continue;
    sendSSE(stream.res, payload);
  }
}

function appendRoomHistory(room, entry) {
  const prev = liveRoomHistory.get(room) || [];
  const next = [...prev, entry].slice(-LIVE_HISTORY_LIMIT);
  liveRoomHistory.set(room, next);
}

async function ensureLiveRedisBridge() {
  if (liveRedisBridgeReady || liveRedisBridgeFailed) return;

  try {
    const subscriber = await getRedisSubscriber();
    await subscriber.subscribe(LIVE_REDIS_CHANNEL, (message) => {
      try {
        const parsed = JSON.parse(message);
        if (!parsed || parsed.source === LIVE_INSTANCE_ID) return;
        const room = normalizeRoomKey(parsed.room);
        const payload = parsed.payload;
        if (!payload || typeof payload !== 'object') return;

        if (payload.type === 'live_message') {
          appendRoomHistory(room, {
            sessionId: payload.sessionId,
            name: payload.name,
            text: payload.text,
            senderType: payload.senderType || 'client',
            ts: payload.ts || new Date().toISOString(),
          });
        }

        broadcastRoom(room, payload);
      } catch {
        // ignore malformed redis payload
      }
    });

    liveRedisBridgeReady = true;
    console.log('[LiveChat] Redis bridge enabled');
  } catch (err) {
    liveRedisBridgeFailed = true;
    console.warn('[LiveChat] Redis bridge unavailable. Using local-only live fan-out.');
    console.warn('[LiveChat] Bridge error:', err?.message || err);
  }
}

async function publishLiveEvent(room, payload) {
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
      })
    );
  } catch (err) {
    console.warn('[LiveChat] Failed to publish redis live event:', err?.message || err);
  }
}

async function emitRoomEvent(room, payload) {
  broadcastRoom(room, payload);
  await publishLiveEvent(room, payload);
}

function shouldSkipAutoReply(text) {
  const value = String(text || '').trim();
  if (!value) return true;
  if (value.startsWith('/')) return true;
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

function normalizeAutoReply(text) {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Interesting point. What part do you want to dig into next?';

  const softened = cleaned
    .replace(/\b(as an?|i am an?)\s+ai\b/gi, 'from my side')
    .replace(/\blanguage model\b/gi, 'companion')
    .replace(/\bi cannot\b/gi, "I can't");

  return softened.slice(0, liveAgentPolicy.maxReplyChars);
}

function getLivePolicySnapshot() {
  return {
    ...liveAgentPolicy,
    historyLimit: LIVE_HISTORY_LIMIT,
    redisBridgeEnabled: liveRedisBridgeReady,
    redisBridgeFailed: liveRedisBridgeFailed,
    redisPresenceTtlSec: LIVE_REDIS_PRESENCE_TTL_SEC,
  };
}

function validateAndApplyLivePolicyUpdate(input) {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'payload must be an object' };
  }

  const next = { ...liveAgentPolicy };

  if (input.silenceProbability !== undefined) {
    const value = Number(input.silenceProbability);
    if (!Number.isFinite(value) || value < 0 || value > 0.95) {
      return { ok: false, error: 'silenceProbability must be between 0 and 0.95' };
    }
    next.silenceProbability = value;
  }

  if (input.minDelayMs !== undefined) {
    const value = Number(input.minDelayMs);
    if (!Number.isFinite(value) || value < 300 || value > 20000) {
      return { ok: false, error: 'minDelayMs must be between 300 and 20000' };
    }
    next.minDelayMs = Math.floor(value);
  }

  if (input.maxDelayMs !== undefined) {
    const value = Number(input.maxDelayMs);
    if (!Number.isFinite(value) || value < 500 || value > 25000) {
      return { ok: false, error: 'maxDelayMs must be between 500 and 25000' };
    }
    next.maxDelayMs = Math.floor(value);
  }

  if (input.maxReplyChars !== undefined) {
    const value = Number(input.maxReplyChars);
    if (!Number.isFinite(value) || value < 80 || value > 2000) {
      return { ok: false, error: 'maxReplyChars must be between 80 and 2000' };
    }
    next.maxReplyChars = Math.floor(value);
  }

  if (input.temperature !== undefined) {
    const value = Number(input.temperature);
    if (!Number.isFinite(value) || value < 0 || value > 2) {
      return { ok: false, error: 'temperature must be between 0 and 2' };
    }
    next.temperature = value;
  }

  if (next.maxDelayMs <= next.minDelayMs) {
    return { ok: false, error: 'maxDelayMs must be greater than minDelayMs' };
  }

  Object.assign(liveAgentPolicy, next);
  return { ok: true, policy: getLivePolicySnapshot() };
}

function isLivePolicyWriteAuthorized(req) {
  const expected = process.env.LIVE_CONFIG_KEY || '';
  if (!expected) return false;
  const provided = req.get('X-Live-Config-Key') || '';
  return provided && provided === expected;
}

async function buildAutoReplyText(room, triggerName, triggerText) {
  // Pick persona (rotate per room so multiple messages use different voices)
  const personas = LIVE_AGENT_PERSONAS;
  const prevIdx = roomPersonaIndex.get(room) ?? Math.floor(Math.random() * personas.length);
  // Skip to a different persona than last time
  const nextIdx = (prevIdx + 1 + Math.floor(Math.random() * (personas.length - 1))) % personas.length;
  roomPersonaIndex.set(room, nextIdx);
  const persona = personas[nextIdx];

  const history = liveRoomHistory.get(room) || [];
  const transcript = history
    .slice(-10)
    .map((msg) => `${msg.name}: ${msg.text}`)
    .join('\n');

  // Detect language from trigger text (simple heuristic: Korean unicode range)
  const isKorean = /[\uAC00-\uD7A3]/.test(triggerText);
  const langStyle = isKorean ? persona.lang_hint.ko : persona.lang_hint.en;

  const prompt = [
    `You are ${persona.name}, a real participant in an online community room.`,
    `Your personality: ${persona.traits}.`,
    `Reply style: ${langStyle}.`,
    'Reply in the same language as the latest user message.',
    'Write 1-3 short natural sentences like a real community member would.',
    'Do NOT say you are AI. Do NOT mention being a bot or assistant.',
    'Do NOT use formal greetings. Just respond naturally to the conversation.',
    '',
    `Room: ${room}`,
    `${triggerName} just said: "${triggerText}"`,
    '',
    'Recent chat context:',
    transcript || '(conversation just started)',
    '',
    'Write only your reply. Be natural, brief, and conversational.',
  ].join('\n');

  const generated = await aiService.generate(prompt, {
    temperature: Math.min(1.2, liveAgentPolicy.temperature + 0.15),
  });

  return normalizeAutoReply(generated);
}

// Pick agent display name from persona (used for emitted messages)
function getAgentPersonaName(room) {
  const idx = roomPersonaIndex.get(room);
  if (idx === undefined || idx < 0 || idx >= LIVE_AGENT_PERSONAS.length) {
    return LIVE_AGENT_PERSONAS[0].name;
  }
  return LIVE_AGENT_PERSONAS[idx].name;
}

function scheduleAutoRoomReply({ room, triggerSessionId, triggerName, triggerText }) {
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
    Math.floor(Math.random() * (liveAgentPolicy.maxDelayMs - liveAgentPolicy.minDelayMs));
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
        senderType: 'agent',
        ts,
      });

      const onlineCount = await getRoomParticipantCountGlobal(room);
      await emitRoomEvent(room, {
        type: 'live_message',
        room,
        sessionId: agentSessionId,
        senderType: 'agent',
        name: getAgentPersonaName(room),
        text: reply,
        ts,
        onlineCount,
      });

      notifySession(triggerSessionId, {
        level: 'info',
        message: `${getAgentPersonaName(room)} replied in the room`,
        room,
      });
    } catch (err) {
      notifySession(triggerSessionId, {
        level: 'warn',
        message: 'Auto room reply skipped due to temporary AI error',
        room,
      });
      console.warn('Auto room reply failed:', err?.message || err);
    }
  }, jitterMs);

  liveAgentTimers.set(room, timer);
}

function notifySession(sessionId, payload) {
  if (!sessionId) return;
  for (const stream of liveStreams.values()) {
    if (stream.sessionId !== sessionId) continue;
    sendSSE(stream.res, {
      type: 'session_notification',
      sessionId,
      ...payload,
      ts: new Date().toISOString(),
    });
  }
}

/**
 * Helper: Create a new session
 */
function createSession(title = '') {
  const sessionId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  sessions.set(sessionId, {
    id: sessionId,
    title: title || `Session ${sessionId.slice(-6)}`,
    messages: [],
    createdAt: new Date().toISOString(),
    notebookId: null,
    notebookReady: false,
    notebookBootstrappedAt: null,
    notebookError: null,
  });
  return sessionId;
}

/**
 * Helper: Get session
 */
function getSession(sessionId) {
  return sessions.get(sessionId);
}

function getPostsDirectoryCandidates() {
  const candidates = [];

  if (config.content?.postsDir) {
    candidates.push(config.content.postsDir);
  }

  if (config.content?.publicDir) {
    candidates.push(path.join(config.content.publicDir, 'posts'));
  }

  candidates.push(path.resolve(process.cwd(), '../frontend/public/posts'));

  return [...new Set(candidates)];
}

async function listMarkdownFiles(rootDir) {
  const files = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const dir = stack.pop();
    if (!dir) continue;

    let entries = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function chunkText(text) {
  const chunks = [];
  const chunkSize = NOTEBOOK_BOOTSTRAP.CHUNK_SIZE;
  const overlap = NOTEBOOK_BOOTSTRAP.CHUNK_OVERLAP;

  if (!text || typeof text !== 'string') {
    return chunks;
  }

  let cursor = 0;
  while (cursor < text.length && chunks.length < NOTEBOOK_BOOTSTRAP.MAX_CHUNKS_PER_POST) {
    const end = Math.min(text.length, cursor + chunkSize);
    const piece = text.slice(cursor, end).trim();
    if (piece) {
      chunks.push(piece);
    }

    if (end >= text.length) break;
    cursor = Math.max(end - overlap, cursor + 1);
  }

  return chunks;
}

function postMetaFromPath(filePath, rootDir) {
  const rel = path.relative(rootDir, filePath).replace(/\\/g, '/');
  const parts = rel.split('/');

  const year = parts[0] || '';
  const maybeLang = parts[1] === 'ko' || parts[1] === 'en' ? parts[1] : '';
  const filename = parts[parts.length - 1] || '';
  const slug = filename.replace(/\.md$/i, '');

  return { rel, year, lang: maybeLang, slug };
}

async function loadPostsCorpus() {
  if (postsCorpusCache) {
    return postsCorpusCache;
  }

  const candidates = getPostsDirectoryCandidates();

  for (const rootDir of candidates) {
    const files = await listMarkdownFiles(rootDir);
    if (files.length === 0) continue;

    const posts = [];
    for (const filePath of files) {
      try {
        const raw = await readFile(filePath, 'utf-8');
        const parsed = matter(raw);
        const content = String(parsed.content || '').trim();
        if (!content) continue;

        const meta = postMetaFromPath(filePath, rootDir);
        posts.push({
          title: String(parsed.data?.title || meta.slug || 'Untitled'),
          description: String(parsed.data?.description || parsed.data?.snippet || ''),
          tags: Array.isArray(parsed.data?.tags) ? parsed.data.tags.map(String) : [],
          date: String(parsed.data?.date || ''),
          ...meta,
          content,
        });
      } catch {
        // Skip unreadable markdown file.
      }
    }

    if (posts.length > 0) {
      postsCorpusCache = posts;
      return postsCorpusCache;
    }
  }

  postsCorpusCache = [];
  return postsCorpusCache;
}

function buildCatalogNotes(posts) {
  if (!Array.isArray(posts) || posts.length === 0) {
    return [];
  }

  const notes = [];

  for (const post of posts) {
    const chunks = chunkText(post.content);
    if (chunks.length === 0) continue;

    for (let idx = 0; idx < chunks.length; idx += 1) {
      const header = [
        `Title: ${post.title}`,
        post.slug ? `Slug: ${post.slug}` : null,
        post.year ? `Year: ${post.year}` : null,
        post.lang ? `Lang: ${post.lang}` : null,
        post.date ? `Date: ${post.date}` : null,
        post.tags.length > 0 ? `Tags: ${post.tags.join(', ')}` : null,
        post.description ? `Summary: ${post.description}` : null,
        `SourcePath: ${post.rel}`,
        `Chunk: ${idx + 1}/${chunks.length}`,
      ].filter(Boolean).join('\n');

      notes.push({
        title: `post:${post.slug || post.title}:chunk-${idx + 1}`,
        content: `${header}\n\n${chunks[idx]}`,
      });
    }
  }

  return notes;
}

async function bootstrapSessionNotebook(session) {
  const posts = await loadPostsCorpus();
  const notes = buildCatalogNotes(posts);

  if (notes.length === 0) {
    await openNotebook.createNote('No post content was available during notebook bootstrap.', {
      title: 'blog-catalog-empty',
      notebookId: session.notebookId,
    });
    return;
  }

  for (const note of notes) {
    await openNotebook.createNote(note.content, {
      title: note.title,
      notebookId: session.notebookId,
    });
  }
}

async function ensureSessionNotebook(sessionId) {
  if (!openNotebook.isEnabled()) {
    return null;
  }

  const session = getSession(sessionId);
  if (!session) {
    return null;
  }

  if (session.notebookId && session.notebookReady) {
    return session.notebookId;
  }

  if (notebookBootstrapJobs.has(sessionId)) {
    await notebookBootstrapJobs.get(sessionId);
    return session.notebookId || null;
  }

  const job = (async () => {
    if (!session.notebookId) {
      const notebookName = `chat-${session.id}`;
      const notebookDescription = `Isolated notebook for chat session ${session.id}`;
      const notebook = await openNotebook.createNotebook(notebookName, notebookDescription);
      session.notebookId = notebook?.id || null;
    }

    if (!session.notebookId) {
      throw new Error('Failed to provision session notebook');
    }

    if (!session.notebookReady) {
      await bootstrapSessionNotebook(session);
      session.notebookReady = true;
      session.notebookBootstrappedAt = new Date().toISOString();
    }

    return session.notebookId;
  })()
    .catch((err) => {
      session.notebookReady = false;
      session.notebookError = err?.message || 'Notebook bootstrap failed';
      throw err;
    })
    .finally(() => {
      notebookBootstrapJobs.delete(sessionId);
    });

  notebookBootstrapJobs.set(sessionId, job);
  await job;

  return session.notebookId;
}

async function buildNotebookContext(query, session) {
  if (!openNotebook.isEnabled() || !session?.id) {
    return null;
  }

  try {
    const notebookId = await ensureSessionNotebook(session.id);
    if (!notebookId) return null;

    const notebookResult = await openNotebook.ask(query, { notebookId });
    if (!notebookResult?.answer) return null;

    return `다음은 사용자 세션 전용 노트북 기반 참고 지식입니다:\n\n${notebookResult.answer}`;
  } catch (err) {
    console.warn('Open Notebook context build failed:', err?.message || err);
    return null;
  }
}

async function reinforceSessionNotebook(session, userMessage, assistantMessage) {
  if (!openNotebook.isEnabled() || !session?.id) {
    return;
  }

  try {
    const notebookId = await ensureSessionNotebook(session.id);
    if (!notebookId) return;

    const content = [
      `User: ${userMessage}`,
      `Assistant: ${assistantMessage}`,
    ].join('\n\n');

    await openNotebook.createNote(content, {
      title: `chat-turn-${Date.now()}`,
      notebookId,
      noteType: 'ai',
    });
  } catch (err) {
    console.warn('Open Notebook reinforcement failed:', err?.message || err);
  }
}

/**
 * Helper: Validate task mode
 */
function isValidTaskMode(mode) {
  return VALID_TASK_MODES.includes(mode);
}

/**
 * Helper: Build prompt for task
 */
function buildTaskPrompt(mode, payload) {
  const {
    paragraph,
    content,
    postTitle,
    persona,
    prompt,
    batchIndex,
    previousQuestions,
    quizCount,
    studyMode,
    postTags,
  } = payload;
  const text = paragraph || content || prompt || '';
  const title = postTitle || '';
  const quizBatchIndex = Number.isFinite(Number(batchIndex)) ? Math.max(0, Number(batchIndex)) : 0;
  const requestedQuizCount = clampQuizCount(quizCount, 2);
  const normalizedPostTags = normalizeQuizTags(postTags);
  const effectiveStudyMode = studyMode === true || hasStudyTagTrigger(normalizedPostTags);
  const askedQuestions = Array.isArray(previousQuestions)
    ? previousQuestions.filter((q) => typeof q === 'string' && q.trim()).slice(0, 12)
    : [];

  switch (mode) {
    case 'sketch':
      return {
        prompt: [
          'You are a helpful writing companion. Return STRICT JSON only matching the schema.',
          '{"mood":"string","bullets":["string", "string", "..."]}',
          '',
          `Persona: ${persona || FALLBACK_DATA.PERSONA}`,
          `Post: ${title.slice(0, TEXT_LIMITS.TASK_TITLE)}`,
          'Paragraph:',
          text.slice(0, TEXT_LIMITS.TASK_PARAGRAPH),
          '',
          'Task: Capture the emotional sketch. Select a concise mood (e.g., curious, excited, skeptical) and 3-6 short bullets in the original language of the text.',
        ].join('\n'),
        temperature: AI_TEMPERATURES.SKETCH,
      };

    case 'prism':
      return {
        prompt: [
          'Return STRICT JSON only for idea facets.',
          '{"facets":[{"title":"string","points":["string","string"]}]}',
          `Post: ${title.slice(0, TEXT_LIMITS.TASK_TITLE)}`,
          'Paragraph:',
          text.slice(0, TEXT_LIMITS.TASK_PARAGRAPH),
          '',
          'Task: Provide 2-3 facets (titles) with 2-4 concise points each, in the original language.',
        ].join('\n'),
        temperature: AI_TEMPERATURES.PRISM,
      };

    case 'chain':
      return {
        prompt: [
          'Return STRICT JSON only for tail questions.',
          '{"questions":[{"q":"string","why":"string"}]}',
          `Post: ${title.slice(0, TEXT_LIMITS.TASK_TITLE)}`,
          'Paragraph:',
          text.slice(0, TEXT_LIMITS.TASK_PARAGRAPH),
          '',
          'Task: Generate 3-5 short follow-up questions and a brief why for each, in the original language.',
        ].join('\n'),
        temperature: AI_TEMPERATURES.CHAIN,
      };

    case 'summary':
      return {
        prompt: `Summarize the following content in Korean, concise but faithful to key points.\n\n${text}`,
        temperature: AI_TEMPERATURES.SUMMARY,
      };

    case 'quiz': {
      const batchStart = quizBatchIndex * requestedQuizCount + 1;
      const batchEnd = batchStart + requestedQuizCount - 1;
      const duplicateGuard = askedQuestions.length
        ? [
            'Do NOT repeat already asked questions:',
            ...askedQuestions.map((q, i) => `${i + 1}. ${q}`),
            '',
          ]
        : [];

      return {
        prompt: [
          'Return STRICT JSON only for technical learning quiz questions.',
          '{"quiz":[{"type":"fill_blank|multiple_choice|transform|explain","question":"string","answer":"string","options":["string"],"explanation":"string"}]}',
          `Post: ${title.slice(0, TEXT_LIMITS.TASK_TITLE)}`,
          `Batch: ${quizBatchIndex + 1} (generate questions ${batchStart}-${batchEnd})`,
          normalizedPostTags.length > 0
            ? `Post Tags: ${normalizedPostTags.join(', ')}`
            : 'Post Tags: (none)',
          effectiveStudyMode
            ? 'Study Mode: ON (increase difficulty diversity and conceptual coverage while staying grounded in code).'
            : 'Study Mode: OFF',
          'Paragraph:',
          text.slice(0, TEXT_LIMITS.TASK_PARAGRAPH),
          '',
          ...duplicateGuard,
          `Task: Generate EXACTLY ${requestedQuizCount} concise quiz questions in the original language.`,
          'Each question must be grounded in concrete code details from the paragraph.',
        ].join('\n'),
        temperature: effectiveStudyMode
          ? Math.min(AI_TEMPERATURES.QUIZ + 0.1, 0.8)
          : AI_TEMPERATURES.QUIZ,
      };
    }

    case 'catalyst':
      return {
        prompt: [
          'Return STRICT JSON for catalyst suggestions.',
          '{"suggestions":[{"idea":"string","reason":"string"}]}',
          `Post: ${title.slice(0, TEXT_LIMITS.TASK_TITLE)}`,
          'Content:',
          text.slice(0, TEXT_LIMITS.TASK_PARAGRAPH),
          '',
          'Task: Provide 2-4 creative suggestions or alternative perspectives, in the original language.',
        ].join('\n'),
        temperature: AI_TEMPERATURES.CATALYST,
      };

    case 'custom':
    default:
      return {
        prompt: text,
        temperature: AI_TEMPERATURES.CUSTOM,
      };
  }
}

// ----------------------------------------------------------------------------
// WebSocket Chat Streaming
// ----------------------------------------------------------------------------
export function initChatWebSocket(server) {
  if (!server?.on) return null;

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url || '/', `http://${request.headers.host}`);
      if (url.pathname !== '/api/v1/chat/ws') return;

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, url);
      });
    } catch {
      socket.destroy();
    }
  });

  wss.on('connection', (ws, _request, url) => {
    let busy = false;
    let closed = false;

    const send = (payload) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(payload));
      }
    };

    ws.on('message', async (data) => {
      if (busy || closed) {
        send({ type: 'error', error: 'busy' });
        return;
      }

      let payload = null;
      try {
        const raw = typeof data === 'string' ? data : data.toString();
        payload = JSON.parse(raw);
      } catch {
        send({ type: 'error', error: 'invalid_json' });
        return;
      }

      if (!payload || payload.type !== 'message') {
        if (payload?.type === 'ping') {
          send({ type: 'pong' });
          return;
        }
        send({ type: 'error', error: 'invalid_type' });
        return;
      }

      busy = true;
      try {
        let sessionId = payload.sessionId || url?.searchParams?.get('sessionId');
        let session = sessionId ? getSession(sessionId) : null;

        if (!session) {
          sessionId = createSession(payload.title);
          session = getSession(sessionId);
          if (openNotebook.isEnabled()) {
            void ensureSessionNotebook(sessionId).catch((err) => {
              console.warn('Session notebook bootstrap failed:', err?.message || err);
            });
          }
        }

        let userMessage = '';
        if (Array.isArray(payload.parts)) {
          userMessage = payload.parts
            .filter((p) => p?.type === 'text')
            .map((p) => p.text)
            .join('\n');
        } else if (typeof payload.parts === 'string') {
          userMessage = payload.parts;
        } else if (typeof payload.text === 'string') {
          userMessage = payload.text;
        }

        if (!userMessage.trim()) {
          send({ type: 'error', error: 'No message content' });
          return;
        }

        const pageContext = payload.context?.page || payload.context;
        if (pageContext?.url || pageContext?.title) {
          userMessage = `[Context: ${pageContext.title || ''} - ${pageContext.url || ''}]\n\n${userMessage}`;
        }

        session.messages.push({ role: 'user', content: userMessage });
        send({ type: 'session', sessionId });

        const messagesWithContext = [...session.messages];
        const notebookContext = await buildNotebookContext(userMessage, session);
        if (notebookContext) {
          const lastIdx = messagesWithContext.length - 1;
          if (lastIdx >= 0 && messagesWithContext[lastIdx].role === 'user') {
            messagesWithContext[lastIdx] = {
              ...messagesWithContext[lastIdx],
              content: `${notebookContext}\n\n---\n\n사용자 질문: ${messagesWithContext[lastIdx].content}`,
            };
          }
        }

        const result = await aiService.chat(messagesWithContext, { model: payload.model });
        const text = result.content || '';
        const chunkSize = STREAMING.WS_CHUNK_SIZE;

        for (let i = 0; i < text.length; i += chunkSize) {
          if (closed || ws.readyState !== ws.OPEN) break;
          const chunk = text.slice(i, i + chunkSize);
          send({ type: 'text', text: chunk });
          await new Promise((r) => setTimeout(r, STREAMING.WS_CHUNK_DELAY));
        }

        session.messages.push({ role: 'assistant', content: text });
        void reinforceSessionNotebook(session, userMessage, text);
        notifySession(sessionId, {
          level: 'info',
          message: 'AI response completed',
        });
        send({ type: 'done' });
      } catch (err) {
        send({ type: 'error', error: err?.message || 'chat failed' });
      } finally {
        busy = false;
      }
    });

    ws.on('close', () => {
      closed = true;
    });

    ws.on('error', () => {
      closed = true;
    });
  });

  return wss;
}

/**
 * Helper: Get fallback data for task
 */
function getFallbackData(mode, payload) {
  const text = payload.paragraph || payload.content || payload.prompt || '';
  const sentences = text
    .replace(/\n+/g, ' ')
    .split(/[.!?]\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  switch (mode) {
    case 'sketch':
      return {
        mood: FALLBACK_DATA.MOOD,
        bullets: sentences.slice(0, 4).map((s) => (s.length > TEXT_LIMITS.BULLET_TEXT ? `${s.slice(0, TEXT_LIMITS.BULLET_TEXT - 2)}...` : s)),
      };
    case 'prism':
      return {
        facets: FALLBACK_DATA.FACETS,
      };
    case 'chain':
      return {
        questions: FALLBACK_DATA.QUESTIONS,
      };
    case 'summary':
      return { summary: text.slice(0, FALLBACK_DATA.SUMMARY_LENGTH) + (text.length > FALLBACK_DATA.SUMMARY_LENGTH ? '...' : '') };
    case 'catalyst':
      return {
        suggestions: [
          { idea: '다른 관점에서 접근', reason: '새로운 시각 제공' },
        ],
      };
    case 'quiz':
      {
        const quizCount = clampQuizCount(payload.quizCount, 2);
        const templates = [
          {
            type: 'multiple_choice',
            question: '이 내용의 핵심 코드 흐름에서 가장 중요한 분기 조건은 무엇인가요?',
            answer: '핵심 분기 조건을 다시 확인해보세요.',
            options: ['입력 검증', '분기 처리', '반복 종료', '예외 처리'],
            explanation: 'AI 응답이 일시적으로 지연되어 기본 퀴즈가 표시됩니다.',
          },
          {
            type: 'fill_blank',
            question: '본문 코드의 핵심 로직을 한 줄로 요약하면 ___ 입니다.',
            answer: '입력 처리 후 핵심 연산을 수행하는 흐름',
            explanation: '코드의 입력-처리-출력 흐름을 다시 정리해보세요.',
          },
          {
            type: 'explain',
            question: '핵심 함수의 실행 순서를 단계별로 설명해보세요.',
            answer: '입력 정규화 → 핵심 연산 → 결과 반환',
            explanation: '핵심 로직을 단계별로 요약하는 것이 학습에 도움이 됩니다.',
          },
        ];

        const quiz = Array.from({ length: quizCount }, (_, idx) => {
          const base = templates[idx % templates.length];
          if (idx < templates.length) return base;
          return {
            ...base,
            question: `${base.question} (심화 ${idx + 1})`,
          };
        });

      return {
          quiz,
        };
      };
    default:
      return { text: 'Unable to process request' };
  }
}

/**
 * POST /api/v1/chat/session
 * Create new chat session
 */
router.post('/session', async (req, res, next) => {
  try {
    const { title } = req.body || {};
    const sessionId = createSession(title);
    const session = getSession(sessionId);

    if (openNotebook.isEnabled()) {
      try {
        await ensureSessionNotebook(sessionId);
      } catch (err) {
        console.warn('Notebook provisioning during session creation failed:', err?.message || err);
      }
    }
    
    return res.json({
      ok: true,
      data: {
        sessionID: sessionId,
        id: sessionId,
        notebookId: session?.notebookId || null,
        notebookReady: session?.notebookReady === true,
      },
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/v1/chat/session/:sessionId/message
 * Send chat message (SSE streaming)
 */
router.post('/session/:sessionId/message', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { parts, context, model, enableRag } = req.body || {};
    let effectiveSessionId = sessionId;

    // Get or create session
    let session = getSession(sessionId);
    if (!session) {
      effectiveSessionId = createSession();
      session = getSession(effectiveSessionId);
      if (openNotebook.isEnabled()) {
        void ensureSessionNotebook(effectiveSessionId).catch((err) => {
          console.warn('Session notebook bootstrap failed:', err?.message || err);
        });
      }
    }

    // Extract text from parts
    let userMessage = '';
    if (Array.isArray(parts)) {
      userMessage = parts
        .filter((p) => p.type === 'text')
        .map((p) => p.text)
        .join('\n');
    } else if (typeof parts === 'string') {
      userMessage = parts;
    }

    if (!userMessage.trim()) {
      return res.status(400).json({ ok: false, error: 'No message content' });
    }

    // Add context if available
    const pageContext = context?.page;
    if (pageContext?.url || pageContext?.title) {
      userMessage = `[Context: ${pageContext.title || ''} - ${pageContext.url || ''}]\n\n${userMessage}`;
    }

    // Store message
    session.messages.push({ role: 'user', content: userMessage });

    // Set up SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const send = (data) => {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      res.write(`data: ${payload}\n\n`);
    };

    send({ type: 'session', sessionId: effectiveSessionId });

    let closed = false;
    req.on('close', () => {
      closed = true;
    });

    const heartbeatInterval = setInterval(() => {
      if (!closed) {
        send({ type: 'heartbeat', ts: Date.now() });
      }
    }, 15000);

    try {
      let ragContext = null;
      let ragSources = [];
      const userQuery = parts
        ?.filter((p) => p.type === 'text')
        ?.map((p) => p.text)
        ?.find((t) => t && !t.startsWith('[') && t.length > 5) || userMessage;
      const notebookContext = await buildNotebookContext(userQuery, session);

      if (enableRag) {
        const ragResult = await performRAGSearch(userQuery, 5);
        ragContext = ragResult.context;
        ragSources = ragResult.sources;

        if (ragSources.length > 0) {
          send({ type: 'sources', sources: ragSources });
        }
      }

      const messagesWithContext = [...session.messages];
      if (ragContext || notebookContext) {
        const contextParts = [ragContext, notebookContext].filter(Boolean);
        const lastIdx = messagesWithContext.length - 1;
        if (lastIdx >= 0 && messagesWithContext[lastIdx].role === 'user') {
          messagesWithContext[lastIdx] = {
            ...messagesWithContext[lastIdx],
            content: `${contextParts.join('\n\n')}` + `\n\n---\n\n사용자 질문: ${messagesWithContext[lastIdx].content}`,
          };
        }
      }

      const result = await aiService.chat(messagesWithContext, { model });

      if (closed) return;

      const text = result.content || '';
      
      const chunkSize = STREAMING.CHUNK_SIZE;
      for (let i = 0; i < text.length; i += chunkSize) {
        if (closed) break;
        const chunk = text.slice(i, i + chunkSize);
        send({ type: 'text', text: chunk });
        await new Promise((r) => setTimeout(r, STREAMING.CHUNK_DELAY));
      }

      session.messages.push({ role: 'assistant', content: text });
      void reinforceSessionNotebook(session, userMessage, text);

      notifySession(effectiveSessionId, {
        level: 'info',
        message: 'AI response completed',
      });

      send({ type: 'done' });
    } catch (err) {
      console.error('Chat streaming error:', err);
      send({ type: 'error', error: err.message || 'Chat failed' });
    }

    clearInterval(heartbeatInterval);
    res.end();
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/v1/chat/live/stream
 * Live visitor chat stream (SSE)
 */
router.get('/live/stream', async (req, res, next) => {
  try {
    await ensureLiveRedisBridge();

    const roomRaw = typeof req.query.room === 'string' ? req.query.room : 'room:lobby';
    const room = normalizeRoomKey(roomRaw);
    const sessionIdRaw = typeof req.query.sessionId === 'string' ? req.query.sessionId : '';
    const sessionId = sessionIdRaw.trim();
    const nameRaw = typeof req.query.name === 'string' ? req.query.name : '';
    const name = nameRaw.trim().slice(0, 40) || `visitor-${Math.random().toString(36).slice(2, 6)}`;

    if (!sessionId) {
      return res.status(400).json({ ok: false, error: 'sessionId is required' });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const streamId = `stream-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    registerLiveStream({ id: streamId, room, sessionId, name, res });
    await touchRedisPresence(room, sessionId);

    const connectedCount = await getRoomParticipantCountGlobal(room);

    sendSSE(res, {
      type: 'connected',
      room,
      sessionId,
      senderType: 'client',
      onlineCount: connectedCount,
      ts: new Date().toISOString(),
    });

    const joinedCount = await getRoomParticipantCountGlobal(room);
    await emitRoomEvent(room, {
      type: 'presence',
      room,
      action: 'join',
      senderType: 'client',
      sessionId,
      name,
      onlineCount: joinedCount,
      ts: new Date().toISOString(),
    });

    const keepAlive = setInterval(() => {
      void touchRedisPresence(room, sessionId);
      sendSSE(res, { type: 'ping', ts: new Date().toISOString() });
    }, 25_000);

    req.on('close', async () => {
      clearInterval(keepAlive);
      unregisterLiveStream(streamId);
      await removeRedisPresence(room, sessionId);
      const leaveCount = await getRoomParticipantCountGlobal(room);
      await emitRoomEvent(room, {
        type: 'presence',
        room,
        action: 'leave',
        senderType: 'client',
        sessionId,
        name,
        onlineCount: leaveCount,
        ts: new Date().toISOString(),
      });
      try {
        res.end();
      } catch {
        // ignore
      }
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/v1/chat/live/message
 * Send live visitor chat message
 */
router.post('/live/message', async (req, res, next) => {
  try {
    await ensureLiveRedisBridge();

    const body = req.body || {};
    const roomRaw = typeof body.room === 'string' ? body.room : 'room:lobby';
    const room = normalizeRoomKey(roomRaw);
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const senderTypeRaw = typeof body.senderType === 'string' ? body.senderType : 'client';
    const senderType = senderTypeRaw === 'agent' ? 'agent' : 'client';
    const nameRaw = typeof body.name === 'string' ? body.name : '';
    const name = nameRaw.trim().slice(0, 40) || `visitor-${Math.random().toString(36).slice(2, 6)}`;

    if (!sessionId) {
      return res.status(400).json({ ok: false, error: 'sessionId is required' });
    }

    if (!text) {
      return res.status(400).json({ ok: false, error: 'text is required' });
    }

    if (text.length > 600) {
      return res.status(400).json({ ok: false, error: 'text is too long' });
    }

    const ts = new Date().toISOString();
    appendRoomHistory(room, {
      sessionId,
      name,
      text,
      senderType,
      ts,
    });

    const messagePayload = {
      type: 'live_message',
      room,
      sessionId,
      senderType,
      name,
      text,
      ts,
      onlineCount: await getRoomParticipantCountGlobal(room),
    };

    await emitRoomEvent(room, messagePayload);

    notifySession(sessionId, {
      level: 'info',
      message: 'Your live message was delivered',
      room,
    });

    if (senderType === 'client' && (await getRoomParticipantCountGlobal(room)) <= 1) {
      scheduleAutoRoomReply({
        room,
        triggerSessionId: sessionId,
        triggerName: name,
        triggerText: text,
      });
    }

    return res.json({
      ok: true,
      data: {
        delivered: true,
        room,
        onlineCount: await getRoomParticipantCountGlobal(room),
      },
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/v1/chat/live/config
 * Live auto-responder tunables (read-only)
 */
router.get('/live/config', async (req, res, next) => {
  try {
    await ensureLiveRedisBridge();
    return res.json({
      ok: true,
      data: {
        policy: getLivePolicySnapshot(),
      },
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * PUT /api/v1/chat/live/config
 * Update live auto-responder tunables (requires X-Live-Config-Key)
 */
router.put('/live/config', async (req, res, next) => {
  try {
    if (!isLivePolicyWriteAuthorized(req)) {
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }

    const result = validateAndApplyLivePolicyUpdate(req.body || {});
    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.error });
    }

    return res.json({
      ok: true,
      data: {
        policy: result.policy,
      },
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/v1/chat/live/room-stats?room=<room>
 */
router.get('/live/room-stats', async (req, res, next) => {
  try {
    await ensureLiveRedisBridge();
    const roomRaw = typeof req.query.room === 'string' ? req.query.room : 'room:lobby';
    const room = normalizeRoomKey(roomRaw);

    const onlineCount = await getRoomParticipantCountGlobal(room);
    const recent = (liveRoomHistory.get(room) || []).slice(-10);

    return res.json({
      ok: true,
      data: {
        room,
        onlineCount,
        recent,
      },
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/live/rooms', async (req, res, next) => {
  try {
    await ensureLiveRedisBridge();
    // Collect all rooms that have had activity (in-memory history)
    const rooms = [];
    for (const [roomKey, history] of liveRoomHistory.entries()) {
      if (history.length === 0) continue;
      const onlineCount = await getRoomParticipantCountGlobal(roomKey);
      const lastMsg = history[history.length - 1];
      rooms.push({
        room: roomKey,
        onlineCount,
        messageCount: history.length,
        lastActivity: lastMsg?.ts || null,
        lastText: lastMsg?.text ? lastMsg.text.slice(0, 60) : null,
      });
    }
    // Also include rooms with active SSE connections but no history yet
    for (const stream of liveStreams.values()) {
      if (!rooms.some((r) => r.room === stream.room)) {
        const onlineCount = await getRoomParticipantCountGlobal(stream.room);
        if (onlineCount > 0) {
          rooms.push({
            room: stream.room,
            onlineCount,
            messageCount: 0,
            lastActivity: null,
            lastText: null,
          });
        }
      }
    }
    rooms.sort((a, b) => (b.onlineCount - a.onlineCount) || (b.messageCount - a.messageCount));
    return res.json({ ok: true, data: { rooms } });
  } catch (err) {
    return next(err);
  }
});
/**
 * POST /api/v1/chat/session/:sessionId/task
 * Execute inline AI task (sketch, prism, chain, etc.)
 */
router.post('/session/:sessionId/task', async (req, res, next) => {
  try {
    const { mode, payload, context, prompt: legacyPrompt } = req.body || {};

    // Validate mode
    const taskMode = isValidTaskMode(mode) ? mode : 'custom';
    const taskPayload = payload || {};

    // Legacy compatibility
    if (legacyPrompt && legacyPrompt.trim() && taskMode === 'custom') {
      taskPayload.prompt = legacyPrompt;
    }

    // Validate content
    const content = taskPayload.paragraph || taskPayload.content || taskPayload.prompt || '';
    if (!content.trim()) {
      return res.status(400).json({ ok: false, error: 'No content provided for task' });
    }

    try {
      // Build prompt
      const { prompt, temperature } = buildTaskPrompt(taskMode, taskPayload);

      // Execute via aiService
      const text = await aiService.generate(prompt, { temperature });

      // Debug: log raw AI response
      console.log(`[Task:${taskMode}] Raw AI response (first 500 chars):`, text?.slice(0, 500));

      // Parse response based on mode
      let data;
      if (taskMode === 'custom' || taskMode === 'summary') {
        data = taskMode === 'summary' ? { summary: text } : { text };
      } else {
        const json = tryParseJson(text);
        if (json) {
          const normalized = normalizeTaskData(taskMode, json, taskPayload);
          if (normalized) {
            data = normalized;
            console.log(`[Task:${taskMode}] Successfully parsed and normalized JSON:`, JSON.stringify(data).slice(0, 200));
          } else {
            console.warn(`[Task:${taskMode}] Parsed JSON failed schema validation, projecting text result`);
            data = projectTaskDataFromText(taskMode, text, taskPayload);
          }
        } else {
          console.warn(`[Task:${taskMode}] JSON parse failed, projecting text result`);
          data = projectTaskDataFromText(taskMode, text, taskPayload);
        }
      }

      return res.json({
        ok: true,
        data,
        mode: taskMode,
        source: 'ai-service',
      });
    } catch (err) {
      console.warn('Task execution failed, returning fallback:', err.message);
      const fallbackData = getFallbackData(taskMode, taskPayload);
      return res.json({
        ok: true,
        data: fallbackData,
        mode: taskMode,
        source: 'fallback',
        _fallback: true,
      });
    }
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/v1/chat/aggregate
 * Aggregate multiple session summaries
 */
router.post('/aggregate', async (req, res, next) => {
  try {
    const { prompt } = req.body || {};

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ ok: false, error: 'prompt is required' });
    }

    const systemPrompt = [
      '다음 입력에는 여러 대화 세션의 요약과 사용자의 통합 질문이 함께 포함되어 있습니다.',
      '먼저 세션 요약들을 충분히 이해한 뒤, 사용자의 요청에 따라 전체를 한 번에 통합하여 답변해 주세요.',
      '- 공통된 핵심 아이디어',
      '- 서로 다른 관점이나 긴장 지점',
      '- 다음 액션/실천 아이디어',
      '를 중심으로 한국어로 정리해 주세요.',
      '',
      '---',
      '',
      prompt.trim(),
    ].join('\n');

    const text = await aiService.generate(systemPrompt, { temperature: AI_TEMPERATURES.AGGREGATE });
    return res.json({ ok: true, data: { text } });
  } catch (err) {
    return next(err);
  }
});

export default router;
