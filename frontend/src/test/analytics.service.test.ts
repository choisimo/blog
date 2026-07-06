import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getEditorPicks,
  getPostStats,
  getRealtimeVisitorsSnapshot,
  getTrendingPosts,
  recordView,
  sendHeartbeat,
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

  it('rejects blank record-view identifiers before network', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    await expect(recordView('  ', 'refactor-audit')).resolves.toBe(false);
    await expect(recordView('2026', ' \n\t ')).resolves.toBe(false);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects unsafe record-view selectors before network', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    await expect(recordView('20\n26', 'refactor-audit')).resolves.toBe(false);
    await expect(recordView('2026', '../refactor-audit')).resolves.toBe(false);
    await expect(recordView('2026', 'refactor%0aaudit')).resolves.toBe(false);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('trims record-view identifiers before posting', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    global.fetch = fetchMock as typeof fetch;

    await expect(recordView(' 2026 ', ' refactor-audit ')).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.nodove.com/api/v1/analytics/view',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          year: '2026',
          slug: 'refactor-audit',
        }),
      })
    );
  });

  it('rejects blank post-stats identifiers before network', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    await expect(getPostStats(' ', 'refactor-audit')).resolves.toMatchObject({
      data: null,
      degraded: true,
      errorMessage: 'Invalid post analytics identifier',
    });
    await expect(getPostStats('2026', '\n\t')).resolves.toMatchObject({
      data: null,
      degraded: true,
      errorMessage: 'Invalid post analytics identifier',
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects unsafe post-stats selectors before network', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    await expect(getPostStats('2026', 'refactor/audit')).resolves.toMatchObject({
      data: null,
      degraded: true,
      errorMessage: 'Invalid post analytics identifier',
    });
    await expect(getPostStats('2026', 'refactor%0aaudit')).resolves.toMatchObject({
      data: null,
      degraded: true,
      errorMessage: 'Invalid post analytics identifier',
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('trims safe post-stats path identifiers before requesting', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            stats: {
              total_views: 10,
              views_7d: 4,
              views_30d: 9,
            },
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );
    global.fetch = fetchMock as typeof fetch;

    await expect(getPostStats(' 2026 ', ' refactor.audit_1 ')).resolves.toMatchObject({
      data: {
        total_views: 10,
        views_7d: 4,
        views_30d: 9,
      },
      degraded: false,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.nodove.com/api/v1/analytics/stats/2026/refactor.audit_1'
    );
  });

  it('normalizes editor-picks query limits before requesting', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            picks: [],
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );
    global.fetch = fetchMock as typeof fetch;

    await expect(getEditorPicks(-3)).resolves.toMatchObject({
      data: [],
      degraded: false,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.nodove.com/api/v1/analytics/editor-picks?limit=1'
    );
  });

  it('clamps editor-picks query limits before requesting', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            picks: [],
          },
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    );
    global.fetch = fetchMock as typeof fetch;

    await expect(getEditorPicks(500)).resolves.toMatchObject({
      data: [],
      degraded: false,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.nodove.com/api/v1/analytics/editor-picks?limit=50'
    );
  });

  it('normalizes trending query limit and day parameters before requesting', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            trending: [],
            total: 0,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );
    global.fetch = fetchMock as typeof fetch;

    await expect(getTrendingPosts(Number.NaN, -7)).resolves.toMatchObject({
      data: { trending: [], total: 0 },
      degraded: false,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.nodove.com/api/v1/analytics/trending?limit=5&days=1'
    );
  });

  it('clamps trending query limit and day parameters before requesting', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            trending: [],
            total: 0,
          },
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    );
    global.fetch = fetchMock as typeof fetch;

    await expect(getTrendingPosts(500, 900)).resolves.toMatchObject({
      data: { trending: [], total: 0 },
      degraded: false,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.nodove.com/api/v1/analytics/trending?limit=50&days=365'
    );
  });

  it('trims persisted visitor IDs before sending heartbeat payloads', async () => {
    localStorage.setItem('analytics.visitorId', ' visitor-1 ');
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    global.fetch = fetchMock as typeof fetch;

    await expect(sendHeartbeat()).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.nodove.com/api/v1/analytics/heartbeat',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ visitorId: 'visitor-1' }),
      })
    );
  });

  it('replaces persisted unsafe visitor IDs before sending heartbeat payloads', async () => {
    localStorage.setItem('analytics.visitorId', 'visitor%0a1');
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('visitor-safe-2' as `${string}-${string}-${string}-${string}-${string}`);
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    global.fetch = fetchMock as typeof fetch;

    await expect(sendHeartbeat()).resolves.toBe(true);

    expect(localStorage.getItem('analytics.visitorId')).toBe('visitor-safe-2');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.nodove.com/api/v1/analytics/heartbeat',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ visitorId: 'visitor-safe-2' }),
      })
    );
  });

  it('rejects blank generated visitor IDs before sending heartbeat payloads', async () => {
    localStorage.removeItem('analytics.visitorId');
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('   ' as `${string}-${string}-${string}-${string}-${string}`);
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    await expect(sendHeartbeat()).resolves.toBe(false);

    expect(fetchMock).not.toHaveBeenCalled();
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

  it('marks malformed successful stats payloads as degraded', async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            stats: {
              total_views: 10,
              views_7d: '4',
              views_30d: 9,
            },
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    ) as typeof fetch;

    const result = await getPostStats('2026', 'refactor-audit');

    expect(result.data).toBeNull();
    expect(result.degraded).toBe(true);
    expect(result.errorMessage).toBe('Invalid post analytics response');
  });

  it('marks editor picks as degraded when the request fails and keeps the fallback data empty', async () => {
    global.fetch = vi.fn(async () => new Response(null, { status: 503 })) as typeof fetch;

    const result = await getEditorPicks(3);

    expect(result.data).toEqual([]);
    expect(result.degraded).toBe(true);
    expect(result.errorMessage).toBe('Editor picks unavailable');
    expect(result.sourceStatus).toBe(503);
  });

  it('marks malformed successful editor picks payloads as degraded', async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            picks: [
              {
                post_slug: 'editor-pick',
                year: '2026',
                title: 'Editor Pick',
                cover_image: null,
                category: null,
                rank: '1',
                score: 0.98,
                reason: null,
              },
            ],
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    ) as typeof fetch;

    const result = await getEditorPicks(3);

    expect(result.data).toEqual([]);
    expect(result.degraded).toBe(true);
    expect(result.errorMessage).toBe('Invalid editor picks analytics response');
  });

  it('marks editor picks with unsafe selectors as degraded', async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            picks: [
              {
                post_slug: '../terminal-lease',
                year: '2026',
                title: 'Terminal lease',
                cover_image: null,
                category: 'Architecture',
                rank: 1,
                score: 0.9,
                reason: 'High signal',
              },
            ],
          },
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    ) as typeof fetch;

    const result = await getEditorPicks(3);

    expect(result.data).toEqual([]);
    expect(result.degraded).toBe(true);
    expect(result.errorMessage).toBe('Invalid editor picks analytics response');
  });

  it('marks editor picks with unsafe display text controls as degraded', async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            picks: [
              {
                post_slug: 'terminal-lease',
                year: '2026',
                title: 'Terminal\u0000lease',
                cover_image: null,
                category: 'Architecture',
                rank: 1,
                score: 0.9,
                reason: 'High signal',
              },
            ],
          },
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    ) as typeof fetch;

    const result = await getEditorPicks(3);

    expect(result.data).toEqual([]);
    expect(result.degraded).toBe(true);
    expect(result.errorMessage).toBe('Invalid editor picks analytics response');
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

  it('marks malformed successful trending payloads as degraded', async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            trending: [
              {
                post_slug: 'terminal-lease',
                year: '2026',
                recent_views: '12',
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

    expect(result.data).toEqual({ trending: [], total: 0 });
    expect(result.degraded).toBe(true);
    expect(result.errorMessage).toBe('Invalid trending analytics response');
  });

  it('marks trending payloads with unsafe selectors as degraded', async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            trending: [
              {
                post_slug: 'terminal%0alease',
                year: '2026',
                recent_views: 12,
                total_views: 20,
              },
            ],
            total: 1,
          },
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    ) as typeof fetch;

    const result = await getTrendingPosts(5, 7);

    expect(result.data).toEqual({ trending: [], total: 0 });
    expect(result.degraded).toBe(true);
    expect(result.errorMessage).toBe('Invalid trending analytics response');
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

  it('marks malformed successful realtime visitor snapshots as degraded', async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            activeVisitors: -1,
            timestamp: Number.NaN,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    ) as typeof fetch;

    const result = await getRealtimeVisitorsSnapshot();

    expect(result.data).toEqual({ activeVisitors: 0, timestamp: null });
    expect(result.degraded).toBe(true);
    expect(result.errorMessage).toBe('Invalid realtime visitor analytics response');
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
