import { getApiBaseUrl } from '@/utils/network/apiBase';
import { getCachedAdvancedVisitorId, getAdvancedFingerprint } from '@/services/session/fingerprint';

const ADVANCED_FINGERPRINT_KEY = 'nodove_adv_fingerprint';
const PENDING_FINGERPRINT_KEY = 'nodove_adv_fingerprint_pending';
const COMMENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const MAX_BATCH_COMMENT_IDS = 100;
const MAX_FINGERPRINT_LENGTH = 256;

// Available emoji reactions
export const ALLOWED_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '💡'] as const;
export type ReactionEmoji = typeof ALLOWED_EMOJIS[number];

export interface ReactionCount {
  emoji: string;
  count: number;
}

function decodeSelector(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return decodeURIComponent(trimmed).trim();
  } catch {
    return trimmed;
  }
}

function normalizeCommentId(value: string): string | null {
  const normalized = decodeSelector(value);
  if (!normalized) return null;
  return COMMENT_ID_PATTERN.test(normalized) ? normalized : null;
}

function normalizeFingerprint(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  if (!normalized || normalized.length > MAX_FINGERPRINT_LENGTH || /[\r\n]/.test(normalized)) {
    return null;
  }

  return normalized;
}

function isReactionEmoji(value: unknown): value is ReactionEmoji {
  return typeof value === 'string' && (ALLOWED_EMOJIS as readonly string[]).includes(value);
}

function normalizeReactionCount(value: unknown): ReactionCount | null {
  if (!value || typeof value !== 'object') return null;
  const count = (value as { count?: unknown }).count;
  const emoji = (value as { emoji?: unknown }).emoji;

  if (!isReactionEmoji(emoji) || typeof count !== 'number' || !Number.isFinite(count)) {
    return null;
  }

  const normalizedCount = Math.floor(count);
  if (normalizedCount <= 0) return null;

  return {
    emoji,
    count: normalizedCount,
  };
}

function normalizeReactionCounts(values: unknown[]): ReactionCount[] {
  const countsByEmoji = new Map<string, number>();

  for (const value of values) {
    const count = normalizeReactionCount(value);
    if (!count) continue;
    countsByEmoji.set(count.emoji, (countsByEmoji.get(count.emoji) ?? 0) + count.count);
  }

  return Array.from(countsByEmoji, ([emoji, count]) => ({ emoji, count }));
}

function getUserReactionStorageKey(commentId: string): string | null {
  const normalizedCommentId = normalizeCommentId(commentId);
  return normalizedCommentId ? `comment.reactions.${normalizedCommentId}` : null;
}

// Use the advanced hybrid fingerprint for reaction tracking.
// Prefers the cached synchronous value for performance; falls back to async.
function readFingerprintKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeFingerprintKey(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    void 0;
  }
}

function clearFingerprintKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    void 0;
  }
}

function getStablePendingFingerprint(): string {
  const cached = normalizeFingerprint(readFingerprintKey(PENDING_FINGERPRINT_KEY));
  if (cached) return cached;

  clearFingerprintKey(PENDING_FINGERPRINT_KEY);
  const created =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? `pending_${crypto.randomUUID()}`
      : `pending_${Date.now().toString(36)}`;
  writeFingerprintKey(PENDING_FINGERPRINT_KEY, created);
  return created;
}

export function getFingerprint(): string {
  // Fast path: return cached advanced visitor ID
  const cached = normalizeFingerprint(getCachedAdvancedVisitorId());
  if (cached) return cached;

  // Fallback: legacy localStorage key (will be populated once async init runs)
  const stored = normalizeFingerprint(readFingerprintKey(ADVANCED_FINGERPRINT_KEY));
  if (stored) return stored;
  clearFingerprintKey(ADVANCED_FINGERPRINT_KEY);

  // Trigger async generation, but keep a stable fallback so rapid reactions
  // stay tied to one pending identity until the real fingerprint resolves.
  void getAdvancedFingerprint()
    .then((fingerprint) => {
      const normalized = normalizeFingerprint(fingerprint.advancedVisitorId);
      if (normalized) {
        writeFingerprintKey(ADVANCED_FINGERPRINT_KEY, normalized);
        clearFingerprintKey(PENDING_FINGERPRINT_KEY);
      }
    })
    .catch(() => {
      void 0;
    });

  return getStablePendingFingerprint();
}

function unwrapMutationData(payload: unknown): unknown {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data?: unknown }).data;
  }
  return payload;
}

function isAddedReactionResponse(value: unknown): value is { added: boolean } {
  return Boolean(value) && typeof value === 'object' && typeof (value as { added?: unknown }).added === 'boolean';
}

function isRemovedReactionResponse(value: unknown): value is { removed: boolean } {
  return Boolean(value) && typeof value === 'object' && typeof (value as { removed?: unknown }).removed === 'boolean';
}

function parseReactionsBatchPayload(
  payload: unknown,
  commentIds: string[]
): Record<string, ReactionCount[]> {
  const source = payload && typeof payload === 'object' && 'data' in payload
    ? (payload as { data?: { reactions?: unknown } }).data?.reactions
    : (payload as { reactions?: unknown })?.reactions;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};

  return commentIds.reduce<Record<string, ReactionCount[]>>((acc, commentId) => {
    const rawCounts = (source as Record<string, unknown>)[commentId];
    if (!Array.isArray(rawCounts)) {
      return acc;
    }

    acc[commentId] = normalizeReactionCounts(rawCounts);
    return acc;
  }, {});
}

// Fetch reactions for multiple comments
export async function fetchReactionsBatch(
  commentIds: string[]
): Promise<Record<string, ReactionCount[]>> {
  const safeCommentIds = [...new Set(
    commentIds
      .map(normalizeCommentId)
      .filter((commentId): commentId is string => Boolean(commentId))
  )].slice(0, MAX_BATCH_COMMENT_IDS);
  if (safeCommentIds.length === 0) return {};

  const base = getApiBaseUrl().replace(/\/$/, '');
  const url = `${base}/api/v1/comments/reactions/batch?commentIds=${safeCommentIds.join(',')}`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    return parseReactionsBatchPayload(data, safeCommentIds);
  } catch (err) {
    console.warn('Failed to fetch reactions:', err);
    return {};
  }
}

// Add a reaction to a comment
export async function addReaction(
  commentId: string,
  emoji: ReactionEmoji
): Promise<{ added: boolean }> {
  const safeCommentId = normalizeCommentId(commentId);
  if (!safeCommentId) throw new Error('Invalid reaction comment id');
  if (!isReactionEmoji(emoji)) throw new Error('Invalid reaction emoji');

  const base = getApiBaseUrl().replace(/\/$/, '');
  const url = `${base}/api/v1/comments/${encodeURIComponent(safeCommentId)}/reactions`;
  const fingerprint = getFingerprint();
  if (!fingerprint) throw new Error('Reaction fingerprint unavailable');

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emoji, fingerprint }),
  });

  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  const result = unwrapMutationData(data);
  if (!isAddedReactionResponse(result)) {
    throw new Error('Reaction add returned an invalid response');
  }
  return result;
}

// Remove a reaction from a comment
export async function removeReaction(
  commentId: string,
  emoji: ReactionEmoji
): Promise<{ removed: boolean }> {
  const safeCommentId = normalizeCommentId(commentId);
  if (!safeCommentId) throw new Error('Invalid reaction comment id');
  if (!isReactionEmoji(emoji)) throw new Error('Invalid reaction emoji');

  const base = getApiBaseUrl().replace(/\/$/, '');
  const url = `${base}/api/v1/comments/${encodeURIComponent(safeCommentId)}/reactions`;
  const fingerprint = getFingerprint();
  if (!fingerprint) throw new Error('Reaction fingerprint unavailable');

  const resp = await fetch(url, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emoji, fingerprint }),
  });

  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  const result = unwrapMutationData(data);
  if (!isRemovedReactionResponse(result)) {
    throw new Error('Reaction remove returned an invalid response');
  }
  return result;
}

// Get user's reactions for a comment (from localStorage)
export function getUserReactions(commentId: string): Set<ReactionEmoji> {
  try {
    const storageKey = getUserReactionStorageKey(commentId);
    if (!storageKey) return new Set();

    const stored = localStorage.getItem(storageKey);
    if (!stored) return new Set();
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return new Set();

    return new Set(parsed.filter(isReactionEmoji));
  } catch {
    return new Set();
  }
}

// Save user's reactions for a comment (to localStorage)
export function setUserReactions(commentId: string, emojis: Set<ReactionEmoji>): void {
  try {
    const storageKey = getUserReactionStorageKey(commentId);
    if (!storageKey) return;

    localStorage.setItem(
      storageKey,
      JSON.stringify([...emojis].filter(isReactionEmoji))
    );
  } catch { void 0; }
}
