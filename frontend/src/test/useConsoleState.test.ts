import { describe, expect, it } from 'vitest';

import { normalizeConsoleStateMessage } from '@/components/features/console/useConsoleState';

describe('useConsoleState helpers', () => {
  it('normalizes persisted console messages before state hydration', () => {
    expect(
      normalizeConsoleStateMessage({
        id: ' message-1\r\nInjected ',
        role: 'assistant',
        content: ' hello\u0000\r\nworld ',
        timestamp: Number.NaN,
        isStreaming: true,
        citations: [
          {
            id: ' cite-1\r\nInjected ',
            title: ' Citation\nTitle ',
            url: ' https://example.com/post ',
            snippet: ' snippet\u0000 ',
            score: Number.NaN,
          },
        ],
      }),
    ).toMatchObject({
      id: 'message-1 Injected',
      role: 'assistant',
      content: 'hello\nworld',
      isStreaming: true,
      citations: [
        {
          id: 'cite-1 Injected',
          title: 'Citation Title',
          url: 'https://example.com/post',
          snippet: 'snippet',
          score: 0,
        },
      ],
    });
  });

  it('rejects invalid message roles and unsafe citation urls', () => {
    expect(
      normalizeConsoleStateMessage({
        id: 'message-1',
        role: 'hacker',
        content: 'hello',
      }),
    ).toBeNull();

    expect(
      normalizeConsoleStateMessage({
        id: 'message-2',
        role: 'assistant',
        content: 'hello',
        timestamp: 1,
        citations: [
          {
            id: 'cite-1',
            title: 'Unsafe URL',
            url: 'javascript:alert(1)',
            snippet: 'snippet',
            score: 1,
          },
        ],
      }),
    ).toEqual({
      id: 'message-2',
      role: 'assistant',
      content: 'hello',
      timestamp: 1,
      citations: [
        {
          id: 'cite-1',
          title: 'Unsafe URL',
          snippet: 'snippet',
          score: 1,
        },
      ],
    });
  });

  it('strips ANSI escapes and rejects encoded or credentialed citation urls during state normalization', () => {
    const normalized = normalizeConsoleStateMessage({
      id: 'message-3',
      role: 'assistant',
      content: '\u001B[31mhello\u001B[0m',
      timestamp: 1,
      citations: [
        {
          id: 'cite-1',
          title: '\u001B[31mEncoded URL\u001B[0m',
          url: '/blog/2026/post%00x',
          snippet: '\u001B[31msnippet\u001B[0m',
          score: 1,
        },
        {
          id: 'cite-2',
          title: 'Credentialed URL',
          url: 'https://user@example.com/blog/2026/post',
          snippet: 'snippet',
          score: 1,
        },
      ],
    });

    expect(normalized).toMatchObject({
      content: 'hello',
      citations: [
        {
          title: 'Encoded URL',
          snippet: 'snippet',
        },
        {
          title: 'Credentialed URL',
        },
      ],
    });
    expect(normalized?.citations?.[0]).not.toHaveProperty('url');
    expect(normalized?.citations?.[1]).not.toHaveProperty('url');
  });
});
