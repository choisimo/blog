import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  normalizeConsoleStateBody,
  normalizeConsoleStateLine,
  normalizeConsoleStateMessage,
  normalizeConsoleStateTraceEvent,
  useConsoleState,
} from './useConsoleState';

describe('useConsoleState sanitizers', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('normalizes line and body text while stripping ANSI/control characters', () => {
    expect(normalizeConsoleStateLine('\u001b[31mAsk\nnow\u001b[0m\u0000')).toBe(
      'Ask now',
    );
    expect(normalizeConsoleStateBody('\u001b[32mAnswer\r\nbody\u001b[0m\u0000')).toBe(
      'Answer\nbody',
    );
  });

  it('normalizes persisted messages and filters unsafe citation URLs', () => {
    expect(
      normalizeConsoleStateMessage({
        id: '\u001b[33mmsg-1\u001b[0m',
        role: 'assistant',
        content: '\u001b[31mBody\u001b[0m\u0000',
        timestamp: Number.POSITIVE_INFINITY,
        error: '\u001b[31mFailed\u001b[0m\u0000',
        citations: [
          {
            id: 'cite-1',
            title: '\u001b[32mSource\u001b[0m',
            url: 'javascript:alert(1)',
            snippet: 'Snippet\u0000 text',
            score: Number.POSITIVE_INFINITY,
          },
        ],
      }),
    ).toMatchObject({
      id: 'msg-1',
      role: 'assistant',
      content: 'Body',
      error: 'Failed',
      citations: [
        {
          id: 'cite-1',
          title: 'Source',
          snippet: 'Snippet text',
          score: 0,
        },
      ],
    });
  });

  it('normalizes trace events and rejects invalid trace state', () => {
    expect(
      normalizeConsoleStateTraceEvent({
        id: '\u001b[31mtrace-1\u001b[0m',
        type: 'search',
        label: 'Search\u0000 step',
        detail: '\u001b[32mDetail\u001b[0m',
        timestamp: Number.POSITIVE_INFINITY,
        duration: -50,
        status: 'running',
      }),
    ).toMatchObject({
      id: 'trace-1',
      type: 'search',
      label: 'Search step',
      detail: 'Detail',
      duration: 0,
      status: 'running',
    });

    expect(
      normalizeConsoleStateTraceEvent({
        id: 'trace-2',
        type: 'bad',
        label: 'Bad',
        timestamp: 1,
        status: 'running',
      }),
    ).toBeNull();
  });
});

describe('useConsoleState', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('sanitizes public action payloads before storing reducer state', () => {
    const { result } = renderHook(() => useConsoleState());

    act(() => {
      result.current.actions.setInput('\u001b[31mQuestion\r\nbody\u001b[0m\u0000');
      result.current.actions.setCitations([
        {
          id: 'cite-1',
          title: '\u001b[32mSource\u001b[0m',
          url: '/safe-source',
          snippet: 'Snippet\u0000 value',
          score: Number.NaN,
        },
      ]);
      result.current.actions.addUserMessage(
        '\u001b[33muser-1\u001b[0m',
        '\u001b[31mHello\u001b[0m\u0000',
      );
      result.current.actions.addAssistantMessage('assistant-1');
      result.current.actions.appendAssistantContent(
        'assistant-1',
        '\u001b[32m world\u001b[0m\u0000',
      );
      result.current.actions.setError('\u001b[31mConsole\nfailed\u001b[0m\u0000');
    });

    expect(result.current.state.input).toBe('Question\nbody');
    expect(result.current.state.citations[0]).toMatchObject({
      title: 'Source',
      url: '/safe-source',
      snippet: 'Snippet value',
      score: 0,
    });
    expect(result.current.state.messages).toMatchObject([
      {
        id: 'user-1',
        role: 'user',
        content: 'Hello',
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        content: ' world',
        isStreaming: true,
      },
    ]);
    expect(result.current.state.error).toBe('Console failed');
  });

  it('sanitizes trace additions and updates from public actions', () => {
    const { result } = renderHook(() => useConsoleState());

    act(() => {
      result.current.actions.addTrace({
        id: 'trace-1',
        type: 'tool',
        label: '\u001b[32mTool\ncall\u001b[0m',
        detail: 'Starting\u0000',
        timestamp: Number.NaN,
        status: 'running',
      });
      result.current.actions.updateTrace('trace-1', {
        label: '\u001b[31mTool done\u001b[0m',
        detail: 'Complete\u0000',
        duration: -1,
        status: 'done',
      });
    });

    expect(result.current.state.traces[0]).toMatchObject({
      id: 'trace-1',
      type: 'tool',
      label: 'Tool done',
      detail: 'Complete',
      duration: 0,
      status: 'done',
    });
  });
});
