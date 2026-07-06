import { describe, expect, it } from 'vitest';

import {
  createSSEParser,
  parseSSEFrame,
  parseStreamObject,
} from '@/services/chat/stream';

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

  it('normalizes SSE error event payloads before emitting them', () => {
    const parser = createSSEParser();

    expect(
      parser.processChunk('event: error\ndata: Stream failed \n\n'),
    ).toEqual([{ type: 'error', message: 'Stream failed' }]);
  });

  it('falls back for multiline SSE error event payloads', () => {
    const parser = createSSEParser();

    expect(
      parser.processChunk(
        'event: error\ndata: bad\ndata: X-Injected: yes\n\n',
      ),
    ).toEqual([{ type: 'error', message: 'Chat failed' }]);
  });

  it('filters malformed source and followup metadata entries', () => {
    expect(
      parseStreamObject({
        sources: [
          ' https://example.com/source ',
          123,
          null,
          'bad\r\nX-Injected: yes',
        ],
        followups: [
          ' What next? ',
          { text: 'bad' },
          'Summarize this',
          'bad\r\nX-Injected: yes',
        ],
      }),
    ).toEqual([
      { type: 'sources', sources: ['https://example.com/source'] },
      { type: 'followups', questions: ['What next?', 'Summarize this'] },
    ]);

    expect(
      parseStreamObject({
        sources: [123, null],
        followups: [{ text: 'bad' }],
      }),
    ).toEqual([]);
  });

  it('normalizes valid session stream events before emitting them', () => {
    expect(
      parseStreamObject({
        type: 'session',
        sessionId: ' session-1 ',
      }),
    ).toEqual([{ type: 'session', sessionId: 'session-1' }]);
  });

  it('drops header-breaking session stream events', () => {
    expect(
      parseStreamObject({
        type: 'session',
        sessionId: 'session-1\r\nX-Injected: yes',
      }),
    ).toEqual([]);
  });

  it('normalizes stream error metadata', () => {
    expect(
      parseStreamObject({
        type: 'error',
        message: ' Stream failed ',
        code: ' BAD_REQUEST ',
      }),
    ).toEqual([
      {
        type: 'error',
        message: 'Stream failed',
        code: 'BAD_REQUEST',
      },
    ]);
  });
});
