import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLensDeck } from '@/components/features/sentio/hooks/useLensDeck';
import { useThoughtFeed } from '@/components/features/sentio/hooks/useThoughtFeed';

vi.mock('@/services/chat', () => ({
  invokeChatTask: vi.fn(),
  invokeLensFeed: vi.fn(),
  invokeThoughtFeed: vi.fn(),
}));

import {
  invokeChatTask,
  invokeLensFeed,
  invokeThoughtFeed,
} from '@/services/chat';

const lensItems = [
  {
    id: 'lens-1',
    personaId: 'mentor' as const,
    angleKey: 'lens-1',
    title: 'Lens 1',
    summary: 'Summary 1',
    bullets: ['A'],
    detail: 'Detail 1',
    tags: ['feed'],
  },
  {
    id: 'lens-2',
    personaId: 'explorer' as const,
    angleKey: 'lens-2',
    title: 'Lens 2',
    summary: 'Summary 2',
    bullets: ['B'],
    detail: 'Detail 2',
    tags: ['feed'],
  },
  {
    id: 'lens-3',
    personaId: 'analyst' as const,
    angleKey: 'lens-3',
    title: 'Lens 3',
    summary: 'Summary 3',
    bullets: ['C'],
    detail: 'Detail 3',
    tags: ['feed'],
  },
  {
    id: 'lens-4',
    personaId: 'debater' as const,
    angleKey: 'lens-4',
    title: 'Lens 4',
    summary: 'Summary 4',
    bullets: ['D'],
    detail: 'Detail 4',
    tags: ['feed'],
  },
];

const thoughtItems = [
  {
    id: 'thought-1',
    trackKey: 'thought-1',
    title: 'Thought 1',
    subtitle: 'Sub 1',
    body: 'Body 1',
    bullets: ['A'],
    tags: ['feed'],
  },
  {
    id: 'thought-2',
    trackKey: 'thought-2',
    title: 'Thought 2',
    subtitle: 'Sub 2',
    body: 'Body 2',
    bullets: ['B'],
    tags: ['feed'],
  },
];

function LensHarness({
  cacheKey,
  enabled,
}: {
  cacheKey: string;
  enabled: boolean;
}) {
  const { cards, loading } = useLensDeck({
    paragraph: 'Lens paragraph',
    postTitle: 'Lens post',
    cacheKey,
    enabled,
  });

  return (
    <div>{loading ? 'loading' : cards.map(card => card.title).join(',')}</div>
  );
}

function ThoughtHarness({
  cacheKey,
  enabled,
}: {
  cacheKey: string;
  enabled: boolean;
}) {
  const { cards, loading } = useThoughtFeed({
    paragraph: 'Thought paragraph',
    postTitle: 'Thought post',
    cacheKey,
    enabled,
  });

  return (
    <div>{loading ? 'loading' : cards.map(card => card.title).join(',')}</div>
  );
}

describe('sentio feed cache', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.mocked(invokeChatTask).mockReset();
    vi.mocked(invokeLensFeed).mockReset();
    vi.mocked(invokeThoughtFeed).mockReset();

    vi.mocked(invokeLensFeed).mockResolvedValue({
      items: lensItems,
      nextCursor: null,
      exhausted: false,
    });
    vi.mocked(invokeThoughtFeed).mockResolvedValue({
      items: thoughtItems,
      nextCursor: null,
      exhausted: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not refetch lens cards when the same cache key is re-enabled', async () => {
    const { rerender } = render(
      <LensHarness cacheKey='lens:1' enabled={true} />
    );

    expect(await screen.findByText(/Lens 1/)).toBeInTheDocument();
    await waitFor(() => {
      expect(invokeLensFeed).toHaveBeenCalledTimes(1);
    });

    rerender(<LensHarness cacheKey='lens:1' enabled={false} />);
    rerender(<LensHarness cacheKey='lens:1' enabled={true} />);

    await waitFor(() => {
      expect(invokeLensFeed).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText(/Lens 1/)).toBeInTheDocument();
  });

  it('does not refetch thought cards when the same cache key is re-enabled', async () => {
    const { rerender } = render(
      <ThoughtHarness cacheKey='thought:1' enabled={true} />
    );

    expect(await screen.findByText(/Thought 1/)).toBeInTheDocument();
    await waitFor(() => {
      expect(invokeThoughtFeed).toHaveBeenCalledTimes(1);
    });

    rerender(<ThoughtHarness cacheKey='thought:1' enabled={false} />);
    rerender(<ThoughtHarness cacheKey='thought:1' enabled={true} />);

    await waitFor(() => {
      expect(invokeThoughtFeed).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText(/Thought 1/)).toBeInTheDocument();
  });

  it('does not cache warming lens responses as ready feed data', async () => {
    vi.useFakeTimers();
    vi.mocked(invokeLensFeed)
      .mockResolvedValueOnce({
        items: lensItems.slice(0, 2),
        nextCursor: null,
        exhausted: false,
        warming: true,
        source: 'warming-fallback',
      })
      .mockResolvedValueOnce({
        items: lensItems,
        nextCursor: null,
        exhausted: true,
        source: 'snapshot',
      });

    const { rerender } = render(
      <LensHarness cacheKey='lens:warm' enabled={true} />
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(invokeLensFeed).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Lens 1/)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(invokeLensFeed).toHaveBeenCalledTimes(2);

    rerender(<LensHarness cacheKey='lens:warm' enabled={false} />);
    rerender(<LensHarness cacheKey='lens:warm' enabled={true} />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(invokeLensFeed).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/Lens 4/)).toBeInTheDocument();
  });

  it('does not cache warming thought responses as ready feed data', async () => {
    vi.useFakeTimers();
    vi.mocked(invokeThoughtFeed)
      .mockResolvedValueOnce({
        items: thoughtItems.slice(0, 1),
        nextCursor: null,
        exhausted: false,
        warming: true,
        source: 'warming-fallback',
      })
      .mockResolvedValueOnce({
        items: thoughtItems,
        nextCursor: null,
        exhausted: true,
        source: 'snapshot',
      });

    const { rerender } = render(
      <ThoughtHarness cacheKey='thought:warm' enabled={true} />
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(invokeThoughtFeed).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Thought 1/)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(invokeThoughtFeed).toHaveBeenCalledTimes(2);

    rerender(<ThoughtHarness cacheKey='thought:warm' enabled={false} />);
    rerender(<ThoughtHarness cacheKey='thought:warm' enabled={true} />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(invokeThoughtFeed).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/Thought 2/)).toBeInTheDocument();
  });
});
