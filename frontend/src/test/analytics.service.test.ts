import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getEditorPicks,
  getPostStats,
  getRealtimeVisitorsSnapshot,
  getTrendingPosts,
} from '@/services/content/analytics';

describe('analytics service degraded handling', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    (window as Window & {
      APP_CONFIG?: { apiBaseUrl?: string | null };
      __APP_CONFIG?: { apiBaseUrl?: string | null };
    }).APP_CONFIG = {
      apiBaseUrl: 'https://api.nodove.com',
    };
    delete (window as Window & { __APP_CONFIG?: unknown }).__APP_CONFIG;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('preserves degraded stats responses instead of collapsing them to null', async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: false,
          degraded: true,
          sourceStatus: 503,
          error: { message: 'Analytics backend unavailable' },
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    ) as typeof fetch;

    const result = await getPostStats('2026', 'refactor-audit');

    expect(result.data).toBeNull();
    expect(result.degraded).toBe(true);
    expect(result.errorMessage).toBe('Analytics backend unavailable');
    expect(result.sourceStatus).toBe(503);
  });

  it('marks editor picks as degraded when the request fails and keeps the fallback data empty', async () => {
    global.fetch = vi.fn(async () => new Response(null, { status: 503 })) as typeof fetch;

    const result = await getEditorPicks(3);

    expect(result.data).toEqual([]);
    expect(result.degraded).toBe(true);
    expect(result.errorMessage).toBe('Editor picks unavailable');
    expect(result.sourceStatus).toBe(503);
  });

  it('returns trending payloads without losing the total count', async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            trending: [
              {
                post_slug: 'terminal-lease',
                year: '2026',
                recent_views: 12,
                total_views: 88,
              },
            ],
            total: 1,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    ) as typeof fetch;

    const result = await getTrendingPosts(5, 7);

    expect(result.degraded).toBe(false);
    expect(result.data.total).toBe(1);
    expect(result.data.trending).toHaveLength(1);
  });

  it('preserves realtime visitor snapshots and degraded state', async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            activeVisitors: 17,
            timestamp: 1760000000000,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    ) as typeof fetch;

    const result = await getRealtimeVisitorsSnapshot();

    expect(result.degraded).toBe(false);
    expect(result.data.activeVisitors).toBe(17);
    expect(result.data.timestamp).toBe(1760000000000);
  });

  it('marks realtime visitor reads as degraded when the backend is unavailable', async () => {
    global.fetch = vi.fn(async () => new Response(null, { status: 503 })) as typeof fetch;

    const result = await getRealtimeVisitorsSnapshot();

    expect(result.data.activeVisitors).toBe(0);
    expect(result.data.timestamp).toBeNull();
    expect(result.degraded).toBe(true);
    expect(result.errorMessage).toBe('Realtime visitor analytics unavailable');
    expect(result.sourceStatus).toBe(503);
  });
});
