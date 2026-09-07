import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ExplorationTurn } from '@/services/discovery/cardExploration';
const mocks = vi.hoisted(() => ({ stream: vi.fn() }));
vi.mock('@/services/discovery/cardExploration', () => ({
  streamCardExploration: mocks.stream,
}));
vi.mock('@/stores/runtime/useFeatureFlagsStore', () => ({
  useFeatureFlagsStore: (
    select: (s: {
      flags: { aiEnabled: boolean; ragEnabled: boolean };
    }) => unknown
  ) => select({ flags: { aiEnabled: true, ragEnabled: false } }),
}));
import { useCardExploration } from './useCardExploration';

type Frame = Pick<ExplorationTurn, 'body' | 'questions'>;
function controlledStream() {
  let resolve: ((value: Frame | Error | null) => void) | undefined;
  return {
    push(value: Frame | Error | null) {
      if (!resolve) throw new Error('stream not waiting');
      const notify = resolve;
      resolve = undefined;
      notify(value);
    },
    async *iterate() {
      while (true) {
        const value = await new Promise<Frame | Error | null>(r => {
          resolve = r;
        });
        if (value === null) return;
        if (value instanceof Error) throw value;
        yield value;
      }
    },
  };
}
const seed = { id: 'a', title: 'Card A', body: 'Original A' };
const options = {
  scopeKey: 'post:paragraph',
  paragraph: 'Paragraph',
  enabled: true,
};

beforeEach(() => {
  vi.useFakeTimers();
  mocks.stream.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

it('updates one card incrementally and retains its completed history for the next question', async () => {
  const stream = controlledStream();
  mocks.stream.mockImplementation(() => stream.iterate());
  const { result } = renderHook(() => useCardExploration(options));
  let request: Promise<void>;
  act(() => {
    request = result.current.explore(seed, 'Why?');
  });
  await act(async () => {
    stream.push({ body: 'First tokens', questions: [] });
    await vi.advanceTimersByTimeAsync(60);
  });
  expect(result.current.states.a.draft?.body).toBe('First tokens');
  expect(result.current.states.a.status).toBe('streaming');
  expect(result.current.states.b).toBeUndefined();
  await act(async () => {
    stream.push({ body: 'Completed answer', questions: ['How?'] });
    await vi.advanceTimersByTimeAsync(60);
    stream.push(null);
    await request;
  });
  expect(result.current.states.a.turns[0].body).toBe('Completed answer');
  const next = controlledStream();
  mocks.stream.mockImplementation(() => next.iterate());
  act(() => {
    void result.current.explore(seed, 'How?');
  });
  expect(mocks.stream.mock.calls[1][0].history).toEqual([
    { question: 'Why?', body: 'Completed answer', questions: ['How?'] },
  ]);
  act(() => result.current.stop('a'));
  expect(result.current.states.a.status).toBe('stopped');
});

it('cancels an obsolete request and prevents its late tokens from overwriting another direction', async () => {
  const old = controlledStream();
  const next = controlledStream();
  mocks.stream
    .mockImplementationOnce(() => old.iterate())
    .mockImplementationOnce(() => next.iterate());
  const { result } = renderHook(() => useCardExploration(options));
  act(() => {
    void result.current.explore(seed, 'Old direction');
  });
  const signal = mocks.stream.mock.calls[0][0].signal;
  act(() => {
    void result.current.explore(seed, 'New direction');
  });
  expect(signal.aborted).toBe(true);
  await act(async () => {
    old.push({ body: 'Obsolete tokens', questions: [] });
    next.push({ body: 'Fresh tokens', questions: [] });
    await vi.advanceTimersByTimeAsync(60);
  });
  expect(result.current.states.a.draft).toMatchObject({
    question: 'New direction',
    body: 'Fresh tokens',
  });
});

it('keeps other cards independent and abandons the draft when returning to the previous content', async () => {
  mocks.stream.mockImplementation(async function* ({
    question,
  }: {
    question: string;
  }) {
    yield { body: `${question  } answer`, questions: [] };
  });
  const { result } = renderHook(() => useCardExploration(options));
  await act(async () => {
    await result.current.explore(seed, 'First');
    await result.current.explore({ ...seed, id: 'b' }, 'Other card');
    await result.current.explore(seed, 'Second');
  });
  act(() => result.current.back('a'));
  expect(result.current.states.a.turns).toHaveLength(1);
  expect(result.current.states.a.turns[0].question).toBe('First');
  expect(result.current.states.b.turns[0].question).toBe('Other card');
  await act(async () => {
    await result.current.explore(seed, 'New branch');
  });
  expect(
    mocks.stream.mock.calls
      .at(-1)?.[0]
      .history.map((t: ExplorationTurn) => t.question)
  ).toEqual(['First']);
});

it('retains partial output on error, supports retry and aborts on hiding or changing the paragraph', async () => {
  const stream = controlledStream();
  mocks.stream.mockImplementationOnce(() => stream.iterate());
  const { result, rerender } = renderHook(props => useCardExploration(props), {
    initialProps: options,
  });
  let request: Promise<void>;
  act(() => {
    request = result.current.explore(seed, 'Question');
  });
  await act(async () => {
    stream.push({ body: 'Partial', questions: [] });
    await vi.advanceTimersByTimeAsync(60);
    stream.push(new Error('network'));
    await request;
  });
  expect(result.current.states.a).toMatchObject({
    status: 'error',
    draft: { body: 'Partial' },
  });
  const retry = controlledStream();
  mocks.stream.mockImplementationOnce(() => retry.iterate());
  act(() => {
    void result.current.explore(seed, 'Question');
  });
  expect(mocks.stream.mock.calls[1][0].history).toEqual([]);
  rerender({ ...options, enabled: false });
  expect(mocks.stream.mock.calls[1][0].signal.aborted).toBe(true);
  expect(result.current.states.a.status).toBe('stopped');
  rerender({ ...options, scopeKey: 'another-paragraph' });
  expect(result.current.states).toEqual({});
});

it('times out a hung request and prevents an empty completed card', async () => {
  const hanging = controlledStream();
  mocks.stream.mockImplementationOnce(() => hanging.iterate());
  const { result } = renderHook(() => useCardExploration(options));
  act(() => {
    void result.current.explore(seed, 'Question');
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(120001);
  });
  expect(result.current.states.a.status).toBe('error');
  expect(mocks.stream.mock.calls[0][0].signal.aborted).toBe(true);
  mocks.stream.mockImplementationOnce(async function* () {
    yield { body: '', questions: [] };
  });
  await act(async () => {
    await result.current.explore(seed, 'Retry');
  });
  expect(result.current.states.a.status).toBe('error');
});
