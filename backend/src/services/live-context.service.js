/**
 * Live Context Service
 *
 * Keeps lightweight per-session snapshots of `/live` messages so
 * non-live AI responses can reuse recent real-time discussion context.
 */

const MAX_SESSIONS = Math.max(
  50,
  Number.parseInt(process.env.LIVE_CONTEXT_MAX_SESSIONS || '500', 10)
);

const MAX_MESSAGES_PER_SESSION = Math.max(
  5,
  Number.parseInt(process.env.LIVE_CONTEXT_MAX_MESSAGES || '40', 10)
);

const MAX_CONTEXT_TEXT = Math.max(
  80,
  Number.parseInt(process.env.LIVE_CONTEXT_MAX_TEXT || '320', 10)
);

const _sessionLiveMessages = new Map();

function normalizeText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CONTEXT_TEXT);
}

function clampLimit(limit, fallback = 8) {
  if (!Number.isFinite(limit)) return fallback;
  return Math.max(1, Math.min(30, Math.floor(limit)));
}

function ensureSessionEntry(sessionId) {
  if (!_sessionLiveMessages.has(sessionId)) {
    _sessionLiveMessages.set(sessionId, []);
  }
  return _sessionLiveMessages.get(sessionId);
}

function evictOldSessionsIfNeeded() {
  if (_sessionLiveMessages.size <= MAX_SESSIONS) return;

  const sessions = Array.from(_sessionLiveMessages.entries())
    .map(([sessionId, entries]) => ({
      sessionId,
      lastTs: entries[entries.length - 1]?.ts || '',
    }))
    .sort((a, b) => String(a.lastTs).localeCompare(String(b.lastTs)));

  const overflow = _sessionLiveMessages.size - MAX_SESSIONS;
  for (let i = 0; i < overflow; i += 1) {
    const target = sessions[i];
    if (!target) break;
    _sessionLiveMessages.delete(target.sessionId);
  }
}

/**
 * Append one `/live` chat event to per-session cache.
 */
export function appendLiveContextMessage(input = {}) {
  const sessionId = typeof input.sessionId === 'string' ? input.sessionId.trim() : '';
  const text = normalizeText(input.text);
  if (!sessionId || !text) return;

  const senderType = input.senderType === 'agent' ? 'agent' : 'client';
  const entry = {
    sessionId,
    room: typeof input.room === 'string' ? input.room.trim() : 'room:lobby',
    name: typeof input.name === 'string' && input.name.trim() ? input.name.trim() : senderType,
    text,
    senderType,
    ts: input.ts || new Date().toISOString(),
  };

  const bucket = ensureSessionEntry(sessionId);
  bucket.push(entry);

  if (bucket.length > MAX_MESSAGES_PER_SESSION) {
    bucket.splice(0, bucket.length - MAX_MESSAGES_PER_SESSION);
  }

  evictOldSessionsIfNeeded();
}

/**
 * Return recent live messages for a session.
 */
export function getLiveContextMessages(sessionId, options = {}) {
  const sid = typeof sessionId === 'string' ? sessionId.trim() : '';
  if (!sid) return [];

  const entries = _sessionLiveMessages.get(sid) || [];
  if (entries.length === 0) return [];

  const {
    limit = 8,
    includeAgents = false,
  } = options;

  const take = clampLimit(limit, 8);
  const filtered = includeAgents
    ? entries
    : entries.filter((entry) => entry.senderType === 'client');

  if (filtered.length <= take) {
    return [...filtered];
  }

  return filtered.slice(-take);
}

/**
 * Build system context text from recent `/live` history.
 */
export function buildLiveContextPrompt(sessionId, options = {}) {
  const messages = getLiveContextMessages(sessionId, options);
  if (messages.length === 0) return null;

  const lines = messages.map((entry, index) => {
    const roomLabel = String(entry.room || 'room:lobby').replace(/^room:/, '');
    return `${index + 1}. [${roomLabel}] ${entry.name}: ${entry.text}`;
  });

  return [
    '다음은 사용자가 /live 명령으로 남긴 최근 실시간 대화 메시지입니다.',
    '현재 답변 시 필요한 경우 아래 맥락을 참고하세요.',
    ...lines,
  ].join('\n');
}

export function clearLiveContextSession(sessionId) {
  const sid = typeof sessionId === 'string' ? sessionId.trim() : '';
  if (!sid) return;
  _sessionLiveMessages.delete(sid);
}

export function getLiveContextStats() {
  return {
    sessionCount: _sessionLiveMessages.size,
    maxSessions: MAX_SESSIONS,
    maxMessagesPerSession: MAX_MESSAGES_PER_SESSION,
  };
}
