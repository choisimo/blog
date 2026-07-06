import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/network/apiBase', () => ({
  getApiBaseUrl: vi.fn(() => 'https://api.example.com'),
}));

vi.mock('@/services/session/fingerprint', () => ({
  getAdvancedFingerprint: vi.fn(),
  getCachedAdvancedVisitorId: vi.fn(() => 'stable-fingerprint'),
}));

import {
  addReaction,
  fetchReactionsBatch,
  getUserReactions,
  removeReaction,
  setUserReactions,
  type ReactionEmoji,
} from '@/services/engagement/reactions';

describe('reactions service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('rejects unsafe mutation inputs before network', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    await expect(addReaction('../comment-1', '👍')).rejects.toThrow(
      'Invalid reaction comment id',
    );
    await expect(addReaction('comment-1', 'x' as never)).rejects.toThrow(
      'Invalid reaction emoji',
    );
    await expect(removeReaction('comment%0a1', '👍')).rejects.toThrow(
      'Invalid reaction comment id',
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normalizes safe mutation inputs before sending reaction payloads', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { added: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(addReaction(' comment-1 ', '👍')).resolves.toEqual({ added: true });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/comments/comment-1/reactions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          emoji: '👍',
          fingerprint: 'stable-fingerprint',
        }),
      }),
    );
  });

  it('filters unsafe batch ids and malformed reaction counts', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            reactions: {
              'comment-1': [
                { emoji: '👍', count: 2 },
                { emoji: 'x', count: 9 },
                { emoji: '🔥', count: 1.9 },
                { emoji: '❤️', count: -1 },
              ],
              'comment-2': [{ emoji: '🎉', count: 0 }],
              '../comment-3': [{ emoji: '👍', count: 99 }],
            },
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(
      fetchReactionsBatch([' comment-1 ', '../comment-3', 'comment%0a4', 'comment-2']),
    ).resolves.toEqual({
      'comment-1': [
        { emoji: '👍', count: 2 },
        { emoji: '🔥', count: 1 },
      ],
      'comment-2': [{ emoji: '🎉', count: 0 }],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/comments/reactions/batch?commentIds=comment-1,comment-2',
    );
  });

  it('filters local reaction storage by safe comment ids and allowed emojis', () => {
    localStorage.setItem(
      'comment.reactions.comment-1',
      JSON.stringify(['👍', 'x', '🔥']),
    );

    expect([...getUserReactions(' comment-1 ')]).toEqual(['👍', '🔥']);

    setUserReactions('../comment-2', new Set<ReactionEmoji>(['👍']));
    expect(localStorage.getItem('comment.reactions.../comment-2')).toBeNull();

    const mixedEmojis = new Set<ReactionEmoji>(['👍', 'x' as ReactionEmoji, '💡']);
    setUserReactions('comment-2', mixedEmojis);
    expect(JSON.parse(localStorage.getItem('comment.reactions.comment-2') || '[]')).toEqual([
      '👍',
      '💡',
    ]);
  });

  it('fails closed when add reaction success data is malformed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(addReaction('comment-1', '👍')).rejects.toThrow(
      'Reaction add returned an invalid response',
    );
  });

  it('fails closed when remove reaction success data is malformed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(removeReaction('comment-1', '👍')).rejects.toThrow(
      'Reaction remove returned an invalid response',
    );
  });
});
