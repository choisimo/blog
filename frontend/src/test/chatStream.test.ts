import { describe, expect, it } from 'vitest';
import {
  createJSONParser,
  createNDJSONParser,
  createSSEParser,
  MAX_STREAM_BUFFER_CHARS,
} from '@/services/chat/stream';

describe('chat stream parser buffer boundaries', () => {
  it('emits an error and clears SSE buffer when an unterminated frame grows too large', () => {
    const parser = createSSEParser();
    const events = parser.processChunk('x'.repeat(MAX_STREAM_BUFFER_CHARS + 1));

    expect(events).toEqual([
      {
        type: 'error',
        message: 'Chat stream frame exceeded maximum size',
      },
    ]);
    expect(parser.flush()).toEqual([]);
  });

  it('emits an error and clears NDJSON buffer when an unterminated line grows too large', () => {
    const parser = createNDJSONParser();
    const events = parser.processChunk('x'.repeat(MAX_STREAM_BUFFER_CHARS + 1));

    expect(events).toEqual([
      {
        type: 'error',
        message: 'Chat stream frame exceeded maximum size',
      },
    ]);
    expect(parser.flush()).toEqual([]);
  });

  it('emits an error and clears JSON buffer when a response body grows too large', () => {
    const parser = createJSONParser();
    const events = parser.processChunk('x'.repeat(MAX_STREAM_BUFFER_CHARS + 1));

    expect(events).toEqual([
      {
        type: 'error',
        message: 'Chat stream frame exceeded maximum size',
      },
    ]);
    expect(parser.flush()).toEqual([]);
  });
});
