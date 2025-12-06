import { getApiBaseUrl } from '@/utils/apiBase';

// Available emoji reactions
export const ALLOWED_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '💡'] as const;
export type ReactionEmoji = typeof ALLOWED_EMOJIS[number];

export interface ReactionCount {
  emoji: string;
  count: number;
}

// Generate a simple fingerprint for anonymous reaction tracking
export function getFingerprint(): string {
  // Try to get existing fingerprint from localStorage
  const stored = localStorage.getItem('comment.fingerprint');
  if (stored) return stored;

  // Generate new fingerprint based on browser characteristics
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx?.fillText('fingerprint', 10, 10);
  const canvasData = canvas.toDataURL();

  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    new Date().getTimezoneOffset(),
    canvasData.slice(-50),
  ];

  // Simple hash function
  const hash = components.join('|');
  let result = 0;
  for (let i = 0; i < hash.length; i++) {
    const char = hash.charCodeAt(i);
    result = ((result << 5) - result) + char;
    result = result & result;
  }
  const fingerprint = Math.abs(result).toString(36);

  localStorage.setItem('comment.fingerprint', fingerprint);
  return fingerprint;
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
  } catch {}
}
