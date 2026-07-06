import { describe, expect, it } from 'vitest';
import { normalizeMentionedAgents } from '@/services/chat/live';

describe('normalizeMentionedAgents', () => {
  it('normalizes agent mentions before they are sent in live chat payloads', () => {
    expect(
      normalizeMentionedAgents([
        ' Alice ',
        'alice',
        'BOB',
        '',
        ' bad\nagent ',
        'encoded%0aagent',
        'x'.repeat(65),
      ])
    ).toEqual(['alice', 'bob']);
  });

  it('returns an empty list for missing or malformed mention collections', () => {
    expect(normalizeMentionedAgents(undefined)).toEqual([]);
    expect(normalizeMentionedAgents('alice' as unknown as string[])).toEqual([]);
  });
});
