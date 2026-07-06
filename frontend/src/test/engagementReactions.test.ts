import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchReactionsBatch } from '@/services/engagement/reactions';

vi.mock('@/utils/network/apiBase', () => ({
  getApiBaseUrl: () => 'https://api.example.test/',
}));

vi.mock('@/services/session/fingerprint', () => ({
  getCachedAdvancedVisitorId: vi.fn(),
  getAdvancedFingerprint: vi.fn(),
}));

describe('engagement reactions service', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes batch reaction counts to positive merged allowed emoji counts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            reactions: {
              'comment-1': [
                { emoji: '🔥', count: 2.9 },
                { emoji: '🔥', count: 3 },
                { emoji: '👍', count: 0 },
                { emoji: '💡', count: 0.5 },
                { emoji: '❤️', count: -1 },
                { emoji: '😂', count: Number.NaN },
                { emoji: '🚫', count: 10 },
              ],
            },
          },
        }),
      })
    );

    await expect(fetchReactionsBatch(['comment-1'])).resolves.toEqual({
      'comment-1': [{ emoji: '🔥', count: 5 }],
    });
  });
});
