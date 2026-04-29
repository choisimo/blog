import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FALLBACK_DATA } from '@/config/defaults';
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
  type FeedCursor,
  type LensFeedResponse,
  type ThoughtFeedResponse,
} from '@/services/chat';

const nextCursor: FeedCursor = {
  seed: 'fd-baseline',
  page: 1,
  seenKeys: ['baseline-1'],
};

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

function LensStateHarness({
  cacheKey,
  enabled,
}: {
  cacheKey: string;
  enabled: boolean;
}) {
  const { cards, currentIndex, goNext, loading, source, status } = useLensDeck({
    paragraph: 'Lens paragraph',
    postTitle: 'Lens post',
    cacheKey,
    enabled,
  });

  return (
    <div>
      <div data-testid='lens-loading'>{loading ? 'loading' : 'idle'}</div>
      <div data-testid='lens-source'>{source ?? 'null'}</div>
      <div data-testid='lens-status'>{status}</div>
      <div data-testid='lens-index'>{String(currentIndex)}</div>
      <div data-testid='lens-cards'>
        {cards.map(card => card.title).join(',')}
      </div>
      <button onClick={goNext} type='button'>
        next-card
      </button>
    </div>
  );
}

function ThoughtStateHarness({
  cacheKey,
  enabled,
}: {
  cacheKey: string;
  enabled: boolean;
}) {
  const { cards, loading, source, status, loadMore } = useThoughtFeed({
    paragraph: 'Thought paragraph',
    postTitle: 'Thought post',
    cacheKey,
    enabled,
  });

  return (
    <div>
      <div data-testid='thought-loading'>{loading ? 'loading' : 'idle'}</div>
      <div data-testid='thought-source'>{source ?? 'null'}</div>
      <div data-testid='thought-status'>{status}</div>
      <div data-testid='thought-cards'>
        {cards.map(card => card.title).join(',')}
      </div>
      <button onClick={() => void loadMore()} type='button'>
        load-more
      </button>
    </div>
  );
}

describe('sentio feed warming baseline', () => {
  beforeEach(() => {
    vi.mocked(invokeChatTask).mockReset();
    vi.mocked(invokeLensFeed).mockReset();
    vi.mocked(invokeThoughtFeed).mockReset();
    vi.mocked(invokeChatTask).mockRejectedValue(new Error('task unavailable'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('treats lens warming responses with empty items as loading state', async () => {
    vi.mocked(invokeLensFeed).mockResolvedValueOnce({
      items: [],
      nextCursor: null,
      exhausted: false,
      warming: true,
      source: 'warming',
    } satisfies LensFeedResponse);

    render(
      <LensStateHarness cacheKey='lens:warming-collapse' enabled={true} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('lens-source')).toHaveTextContent('warming');
    });
    expect(screen.getByTestId('lens-status')).toHaveTextContent('warming');
    expect(screen.getByTestId('lens-cards')).toHaveTextContent('');
  });

  it('treats thought warming responses with empty items as loading state', async () => {
    vi.mocked(invokeThoughtFeed).mockResolvedValueOnce({
      items: [],
      nextCursor: null,
      exhausted: false,
      warming: true,
      source: 'warming',
    } satisfies ThoughtFeedResponse);

    render(
      <ThoughtStateHarness cacheKey='thought:warming-collapse' enabled={true} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('thought-source')).toHaveTextContent('warming');
    });
    expect(screen.getByTestId('thought-status')).toHaveTextContent('warming');
    expect(screen.getByTestId('thought-cards')).toHaveTextContent('');
  });

  it('uses locally generated prism fallback cards when the lens request fails', async () => {
    vi.mocked(invokeLensFeed).mockRejectedValueOnce(new Error('lens boom'));

    render(<LensStateHarness cacheKey='lens:local-fallback' enabled={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('lens-source')).toHaveTextContent('fallback');
    });
    expect(screen.getByTestId('lens-status')).toHaveTextContent(
      'fallback-hard'
    );
    expect(screen.getByTestId('lens-cards')).toHaveTextContent(
      FALLBACK_DATA.PRISM.FACETS[0].title
    );
  });

  it('recovers lens cards through the chat task endpoint when lens feed is unavailable', async () => {
    vi.mocked(invokeLensFeed).mockRejectedValueOnce(new Error('lens missing'));
    vi.mocked(invokeChatTask).mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: {
        facets: [{ title: 'AI angle', points: ['Point A', 'Point B'] }],
      },
      raw: { ok: true, source: 'ai-service' },
    });

    render(<LensStateHarness cacheKey='lens:task-recovery' enabled={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('lens-source')).toHaveTextContent('feed');
    });
    expect(screen.getByTestId('lens-status')).toHaveTextContent('ready');
    expect(screen.getByTestId('lens-cards')).toHaveTextContent('AI angle');
    expect(invokeChatTask).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'prism',
        payload: {
          paragraph: 'Lens paragraph',
          postTitle: 'Lens post',
        },
      })
    );
  });

  it('uses locally generated chain fallback cards when the thought request fails', async () => {
    vi.mocked(invokeThoughtFeed).mockRejectedValueOnce(
      new Error('thought boom')
    );

    render(
      <ThoughtStateHarness cacheKey='thought:local-fallback' enabled={true} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('thought-source')).toHaveTextContent(
        'fallback'
      );
    });
    expect(screen.getByTestId('thought-status')).toHaveTextContent(
      'fallback-hard'
    );
    expect(screen.getByTestId('thought-cards')).toHaveTextContent(
      FALLBACK_DATA.CHAIN.QUESTIONS[0].q
    );
  });

  it('recovers thought cards through the chat task endpoint when thought feed is unavailable', async () => {
    vi.mocked(invokeThoughtFeed).mockRejectedValueOnce(
      new Error('thought missing')
    );
    vi.mocked(invokeChatTask).mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: {
        questions: [{ q: 'What follows?', why: 'It extends the idea.' }],
      },
      raw: { ok: true, source: 'ai-service' },
    });

    render(
      <ThoughtStateHarness cacheKey='thought:task-recovery' enabled={true} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('thought-source')).toHaveTextContent('feed');
    });
    expect(screen.getByTestId('thought-status')).toHaveTextContent('ready');
    expect(screen.getByTestId('thought-cards')).toHaveTextContent(
      'What follows?'
    );
    expect(invokeChatTask).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'chain',
        payload: {
          paragraph: 'Thought paragraph',
          postTitle: 'Thought post',
        },
      })
    );
  });

  it('does not persist initial lens warming responses as ready cache entries', async () => {
    vi.mocked(invokeLensFeed).mockResolvedValue({
      items: [],
      nextCursor: null,
      exhausted: false,
      warming: true,
      source: 'warming',
    } satisfies LensFeedResponse);

    const { rerender } = render(
      <LensStateHarness cacheKey='lens:warming-cache-a' enabled={true} />
    );

    await waitFor(() => {
      expect(invokeLensFeed).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId('lens-source')).toHaveTextContent('warming');

    rerender(
      <LensStateHarness cacheKey='lens:warming-cache-b' enabled={true} />
    );

    await waitFor(() => {
      expect(invokeLensFeed).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByTestId('lens-source')).toHaveTextContent('warming');

    rerender(
      <LensStateHarness cacheKey='lens:warming-cache-a' enabled={true} />
    );

    await waitFor(() => {
      expect(invokeLensFeed).toHaveBeenCalledTimes(3);
    });
    expect(screen.getByTestId('lens-source')).toHaveTextContent('warming');
  });

  it('does not persist initial thought warming responses as ready cache entries', async () => {
    vi.mocked(invokeThoughtFeed).mockResolvedValue({
      items: [],
      nextCursor: null,
      exhausted: false,
      warming: true,
      source: 'warming',
    } satisfies ThoughtFeedResponse);

    const { rerender } = render(
      <ThoughtStateHarness cacheKey='thought:warming-cache-a' enabled={true} />
    );

    await waitFor(() => {
      expect(invokeThoughtFeed).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId('thought-source')).toHaveTextContent('warming');

    rerender(
      <ThoughtStateHarness cacheKey='thought:warming-cache-b' enabled={true} />
    );

    await waitFor(() => {
      expect(invokeThoughtFeed).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByTestId('thought-source')).toHaveTextContent('warming');

    rerender(
      <ThoughtStateHarness cacheKey='thought:warming-cache-a' enabled={true} />
    );

    await waitFor(() => {
      expect(invokeThoughtFeed).toHaveBeenCalledTimes(3);
    });
    expect(screen.getByTestId('thought-source')).toHaveTextContent('warming');
  });

  it('keeps the current lens feed state ready when append returns an empty warming response', async () => {
    const lensCardsBeforeAppend = [
      ...lensItems,
      {
        id: 'lens-4',
        personaId: 'analyst' as const,
        angleKey: 'lens-4',
        title: 'Lens 4',
        summary: 'Summary 4',
        bullets: ['D'],
        detail: 'Detail 4',
        tags: ['feed'],
      },
    ];

    vi.mocked(invokeLensFeed)
      .mockResolvedValueOnce({
        items: lensCardsBeforeAppend,
        nextCursor,
        exhausted: false,
        source: 'snapshot',
      } satisfies LensFeedResponse)
      .mockResolvedValueOnce({
        items: [],
        nextCursor: {
          seed: 'fd-baseline',
          page: 2,
          seenKeys: ['baseline-1', 'baseline-2'],
        },
        exhausted: false,
        warming: true,
        source: 'warming',
      } satisfies LensFeedResponse)
      .mockResolvedValueOnce({
        items: [],
        nextCursor: null,
        exhausted: true,
        source: 'snapshot',
      } satisfies LensFeedResponse);

    const { rerender } = render(
      <LensStateHarness cacheKey='lens:append-warming' enabled={true} />
    );

    await waitFor(() => {
      expect(invokeLensFeed).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'next-card' }));
    fireEvent.click(screen.getByRole('button', { name: 'next-card' }));

    await waitFor(() => {
      expect(invokeLensFeed).toHaveBeenCalledTimes(3);
    });
    expect(screen.getByTestId('lens-source')).toHaveTextContent('feed');
    expect(screen.getByTestId('lens-status')).toHaveTextContent('ready');
    expect(screen.getByTestId('lens-index')).toHaveTextContent('2');
    expect(screen.getByTestId('lens-cards')).toHaveTextContent(
      'Lens 1,Lens 2,Lens 3,Lens 4'
    );

    rerender(
      <LensStateHarness cacheKey='lens:append-warming' enabled={false} />
    );
    rerender(
      <LensStateHarness cacheKey='lens:append-warming' enabled={true} />
    );

    await waitFor(() => {
      expect(invokeLensFeed).toHaveBeenCalledTimes(3);
    });
    expect(screen.getByTestId('lens-source')).toHaveTextContent('feed');
  });

  it('keeps the current thought feed state ready when append returns an empty warming response', async () => {
    vi.mocked(invokeThoughtFeed)
      .mockResolvedValueOnce({
        items: thoughtItems,
        nextCursor,
        exhausted: false,
        source: 'snapshot',
      } satisfies ThoughtFeedResponse)
      .mockResolvedValueOnce({
        items: [],
        nextCursor: {
          seed: 'fd-baseline',
          page: 2,
          seenKeys: ['baseline-1', 'baseline-2'],
        },
        exhausted: false,
        warming: true,
        source: 'warming',
      } satisfies ThoughtFeedResponse);

    const { rerender } = render(
      <ThoughtStateHarness cacheKey='thought:append-warming' enabled={true} />
    );

    await waitFor(() => {
      expect(invokeThoughtFeed).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'load-more' }));

    await waitFor(() => {
      expect(invokeThoughtFeed).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByTestId('thought-source')).toHaveTextContent('feed');
    expect(screen.getByTestId('thought-status')).toHaveTextContent('ready');
    expect(screen.getByTestId('thought-cards')).toHaveTextContent(
      'Thought 1,Thought 2'
    );

    rerender(
      <ThoughtStateHarness cacheKey='thought:append-warming' enabled={false} />
    );
    rerender(
      <ThoughtStateHarness cacheKey='thought:append-warming' enabled={true} />
    );

    await waitFor(() => {
      expect(invokeThoughtFeed).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByTestId('thought-source')).toHaveTextContent('feed');
  });
});
