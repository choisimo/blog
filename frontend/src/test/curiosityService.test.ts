import { afterEach, describe, expect, it, vi } from 'vitest';

describe('curiosity service', () => {
  afterEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it('filters malformed stored and imported curiosity events', async () => {
    localStorage.setItem(
      'curiosity.events',
      JSON.stringify([
        {
          id: 'valid-event',
          type: 'post_view',
          ts: Date.now(),
          context: { postId: '2026/test-post' },
          meta: { version: 1 },
        },
        {
          id: 'invalid-type',
          type: 'not_real',
          ts: Date.now(),
          context: {},
          meta: { version: 1 },
        },
        {
          id: 'missing-meta',
          type: 'search',
          ts: Date.now(),
          context: {},
        },
      ]),
    );

    const { curiosityTracker } = await import('@/services/engagement/curiosity');

    expect(curiosityTracker.getEvents().map(event => event.id)).toEqual([
      'valid-event',
    ]);

    expect(
      curiosityTracker.importData(
        JSON.stringify([
          {
            id: 'valid-import',
            type: 'search',
            ts: Date.now(),
            context: { queryHash: 'hash:1' },
            meta: { version: 1 },
          },
          {
            id: 'invalid-import',
            type: 'unknown',
            ts: Date.now(),
            context: {},
            meta: { version: 1 },
          },
        ]),
      ),
    ).toBe(true);
    expect(curiosityTracker.getEvents().map(event => event.id)).toEqual([
      'valid-event',
      'valid-import',
    ]);
  });

  it('normalizes stored curiosity events and ignores unsafe context fields', async () => {
    localStorage.setItem(
      'curiosity.events',
      JSON.stringify([
        {
          id: ' valid-event ',
          type: 'tag_click',
          ts: Date.now(),
          context: {
            tag: ' TypeScript ',
            tags: [' react ', 'bad\ntag', 'bad\u0000tag'],
            snippet: ' First\u0000line\r\nSecond\tline ',
          },
          meta: {
            version: 1.9,
            ua: 'Browser\r\nInjected',
            ref: 'external',
          },
        },
      ]),
    );

    const { curiosityTracker } = await import('@/services/engagement/curiosity');

    expect(curiosityTracker.getEvents()).toEqual([
      expect.objectContaining({
        id: 'valid-event',
        type: 'tag_click',
        context: {
          tag: 'TypeScript',
          tags: ['react'],
          snippet: 'First line\nSecond line',
        },
        meta: {
          version: 1,
        },
      }),
    ]);
  });

  it('normalizes tracked curiosity events and skips blank inputs', async () => {
    const { curiosityTracker } = await import('@/services/engagement/curiosity');

    curiosityTracker.updateSettings({
      storeSearchText: true,
      maxEvents: Number.NaN,
      retentionDays: -7,
    });
    curiosityTracker.trackTagClick(' \n\t ');
    curiosityTracker.trackCategoryFilter(' Engineering ');
    curiosityTracker.trackSearch(' first line\r\nsecond line ');

    expect(curiosityTracker.getSettings()).toMatchObject({
      storeSearchText: true,
      maxEvents: 1500,
      retentionDays: 90,
    });
    expect(curiosityTracker.getEvents().map(event => event.type)).toEqual([
      'category_filter',
      'search',
    ]);
    expect(curiosityTracker.getEvents()[0].context.category).toBe('Engineering');
    expect(curiosityTracker.getEvents()[1].context.queryText).toBe(
      'first line\nsecond line',
    );
    expect(curiosityTracker.getRecentEvents(-10)).toHaveLength(1);
    expect(curiosityTracker.getEventsByTimeRange(100, 1)).toEqual([]);
  });
});
