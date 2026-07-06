import { describe, expect, it } from 'vitest';

import { normalizeMinimapChatSession } from '@/components/features/navigation/VisitedPostsMinimap';

describe('VisitedPostsMinimap helpers', () => {
  it('normalizes graph chat session metadata before rendering or aggregation', () => {
    expect(
      normalizeMinimapChatSession({
        id: ' session-1 ',
        title: ' Session\r\nTitle ',
        articleTitle: ' Article\nTitle ',
        articleUrl: ' https://example.com/blog/2026/post ',
        updatedAt: ' 2026-07-03\r\n ',
      }),
    ).toEqual({
      id: 'session-1',
      title: 'Session Title',
      articleTitle: 'Article Title',
      articleUrl: 'https://example.com/blog/2026/post',
      updatedAt: '2026-07-03',
    });
  });

  it('rejects polluted session ids and unsafe article urls', () => {
    expect(
      normalizeMinimapChatSession({
        id: 'session-1%09Injected',
        title: 'Bad session',
      }),
    ).toBeNull();

    expect(
      normalizeMinimapChatSession({
        id: 'session-2',
        title: 'Safe session',
        articleUrl: 'javascript:alert(1)',
      }),
    ).toEqual({
      id: 'session-2',
      title: 'Safe session',
    });

    expect(
      normalizeMinimapChatSession({
        id: 'session-3',
        title: 'Control\u0000Session',
        articleUrl: 'https://user:pass@example.com/blog/2026/post',
      }),
    ).toEqual({
      id: 'session-3',
      title: 'Control Session',
    });

    expect(
      normalizeMinimapChatSession({
        id: 'session-4',
        title: 'Encoded URL',
        articleUrl: 'https://example.com/blog/%09post',
      }),
    ).toEqual({
      id: 'session-4',
      title: 'Encoded URL',
    });
  });
});
