import { getApiBaseUrl } from '@/utils/network/apiBase';
import { getCachedAdvancedVisitorId, getAdvancedFingerprint } from '@/services/session/fingerprint';

const ADVANCED_FINGERPRINT_KEY = 'nodove_adv_fingerprint';
const PENDING_FINGERPRINT_KEY = 'nodove_adv_fingerprint_pending';

// Available emoji reactions
export const ALLOWED_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '💡'] as const;
export type ReactionEmoji = typeof ALLOWED_EMOJIS[number];

export interface ReactionCount {
  emoji: string;
  count: number;
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
  const cached = readFingerprintKey(PENDING_FINGERPRINT_KEY);
  if (cached) return cached;

  const created =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? `pending_${crypto.randomUUID()}`
      : `pending_${Date.now().toString(36)}`;
  writeFingerprintKey(PENDING_FINGERPRINT_KEY, created);
  return created;
}

export function getFingerprint(): string {
  // Fast path: return cached advanced visitor ID
  const cached = getCachedAdvancedVisitorId();
  if (cached) return cached;

  // Fallback: legacy localStorage key (will be populated once async init runs)
  const stored = readFingerprintKey(ADVANCED_FINGERPRINT_KEY);
  if (stored) return stored;

  // Trigger async generation, but keep a stable fallback so rapid reactions
  // stay tied to one pending identity until the real fingerprint resolves.
  void getAdvancedFingerprint()
    .then((fingerprint) => {
      writeFingerprintKey(ADVANCED_FINGERPRINT_KEY, fingerprint.advancedVisitorId);
      clearFingerprintKey(PENDING_FINGERPRINT_KEY);
    })
    .catch(() => {
      void 0;
    });

  return getStablePendingFingerprint();
}

// Fetch reactions for multiple comments
export async function fetchReactionsBatch(
  commentIds: string[]
): Promise<Record<string, ReactionCount[]>> {
  if (commentIds.length === 0) return {};

  const base = getApiBaseUrl().replace(/\/$/, '');
  const url = `${base}/api/v1/comments/reactions/batch?commentIds=${commentIds.join(',')}`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    return data?.reactions || data?.data?.reactions || {};
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
  const base = getApiBaseUrl().replace(/\/$/, '');
  const url = `${base}/api/v1/comments/${commentId}/reactions`;
  const fingerprint = getFingerprint();

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emoji, fingerprint }),
  });

  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  return data?.data || data;
}

// Remove a reaction from a comment
export async function removeReaction(
  commentId: string,
  emoji: ReactionEmoji
): Promise<{ removed: boolean }> {
  const base = getApiBaseUrl().replace(/\/$/, '');
  const url = `${base}/api/v1/comments/${commentId}/reactions`;
  const fingerprint = getFingerprint();

  const resp = await fetch(url, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emoji, fingerprint }),
  });

  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  return data?.data || data;
}

// Get user's reactions for a comment (from localStorage)
export function getUserReactions(commentId: string): Set<ReactionEmoji> {
  try {
    const stored = localStorage.getItem(`comment.reactions.${commentId}`);
    if (!stored) return new Set();
    return new Set(JSON.parse(stored));
  } catch {
    return new Set();
  }
}

// Save user's reactions for a comment (to localStorage)
export function setUserReactions(commentId: string, emojis: Set<ReactionEmoji>): void {
  try {
    localStorage.setItem(`comment.reactions.${commentId}`, JSON.stringify([...emojis]));
  } catch { void 0; }
}
