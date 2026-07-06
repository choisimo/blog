import { describe, expect, it } from 'vitest';
import {
  findSSEFrameBoundary,
  MAX_SSE_FRAME_CHARS,
  parseSSEFrame,
} from '@/services/core/sse-frame';

describe('core SSE frame parser', () => {
  it('parses event and multi-line data frames', () => {
    expect(parseSSEFrame('event: live_message\ndata: hello\ndata: world')).toEqual({
      event: 'live_message',
      data: 'hello\nworld',
    });
  });

  it('rejects oversized completed frames before parsing fields', () => {
    expect(parseSSEFrame(`data: ${'x'.repeat(MAX_SSE_FRAME_CHARS)}`)).toBeNull();
  });

  it('finds the earliest CRLF or LF frame boundary', () => {
    expect(findSSEFrameBoundary('data: one\r\n\r\ndata: two\n\n')).toEqual({
      index: 9,
      size: 4,
    });
  });
});
