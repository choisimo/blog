import { describe, expect, it } from 'vitest';

import { createSSEParser, parseSSEFrame } from '@/services/chat/stream';

describe('chat stream parser', () => {
  it('parses SSE frame with CRLF line endings', () => {
    const parsed = parseSSEFrame(
      'event: message\r\ndata: {"type":"text","text":"hello"}\r\n',
    );

    expect(parsed).toEqual({
      event: 'message',
      data: '{"type":"text","text":"hello"}',
    });
  });

  it('parses CRLF chunk boundaries incrementally', () => {
    const parser = createSSEParser();

    const first = parser.processChunk('data: {"type":"text","text":"hel');
    expect(first).toEqual([]);

    const second = parser.processChunk(
      'lo"}\r\n\r\ndata: {"type":"text","text":" world"}\r\n\r\n',
    );
    expect(second).toEqual([
      { type: 'text', text: 'hello' },
      { type: 'text', text: ' world' },
    ]);
  });

  it('flushes trailing frame without final separator', () => {
    const parser = createSSEParser();
    parser.processChunk('data: {"type":"text","text":"tail"}');

    expect(parser.flush()).toEqual([{ type: 'text', text: 'tail' }]);
  });
});
