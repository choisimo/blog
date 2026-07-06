import { describe, expect, it } from 'vitest';
import { normalizeMemoSource } from '@/services/personal/userContent';

describe('user content memo source boundaries', () => {
  it('normalizes memo source fields once and drops empty sources', () => {
    expect(
      normalizeMemoSource({
        conversationId: ' conversation-1 ',
      conversationTitle: ' Conversation Title ',
        messageId: 'message-1',
      })
    ).toEqual({
      conversationId: 'conversation-1',
      conversationTitle: 'Conversation Title',
      messageId: 'message-1',
    });

    expect(normalizeMemoSource({})).toBeUndefined();
  });

  it('rejects malformed memo source selectors', () => {
    expect(() =>
      normalizeMemoSource({
        conversationId: 'bad%0aid',
      })
    ).toThrow('Invalid user content conversation id');
    expect(() => normalizeMemoSource([])).toThrow(
      'Invalid user content memo source'
    );
  });
});
