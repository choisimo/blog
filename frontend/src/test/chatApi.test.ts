import { describe, expect, it } from 'vitest';
import { normalizeChatMultilineText } from '@/services/chat/api';
import { ChatError } from '@/services/chat/types';

describe('normalizeChatMultilineText', () => {
  it('normalizes multiline chat text while preserving line breaks', () => {
    expect(normalizeChatMultilineText(' hello\r\nworld ', 'message')).toBe(
      'hello\nworld'
    );
  });

  it('rejects non-string, blank, and oversized chat text', () => {
    expect(() => normalizeChatMultilineText(null, 'message')).toThrow(
      ChatError
    );
    expect(() => normalizeChatMultilineText('   ', 'message')).toThrow(
      'Invalid chat message'
    );
    expect(() =>
      normalizeChatMultilineText('a'.repeat(20001), 'message')
    ).toThrow('Invalid chat message');
  });
});
