import { env, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  FeedCursor,
  LensCard,
  LensFeedResponse,
  ThoughtCard,
  ThoughtFeedResponse,
} from '../src/lib/feed-contract';

const staleCursor: FeedCursor = {
  seed: 'fd-stale',
  page: 1,
  seenKeys: ['already-seen'],
};

const staleLensItems: LensCard[] = [
  {
    id: 'lens-stale-1',
    personaId: 'mentor',
    angleKey: 'lens-stale-1',
    title: 'Stale Lens 1',
    summary: 'Stale summary 1',
    bullets: ['Stale bullet 1'],
    detail: 'Stale detail 1',
    tags: ['snapshot'],
  },
];

const staleThoughtItems: ThoughtCard[] = [
  {
    id: 'thought-stale-1',
    trackKey: 'thought-stale-1',
    title: 'Stale Thought 1',
    body: 'Stale body 1',
    bullets: ['Stale bullet 1'],
    tags: ['snapshot'],
  },
];

function expectHarnessBindings() {
  expect(env.DB).toBeDefined();
  expect(SELF).toBeDefined();
}

const outboxMocks = {
  enqueueFeedArtifactGeneration: vi.fn(),
  generateAndStoreInitialFeedArtifact: vi.fn(),
  getServeableFeedPage: vi.fn(),
};

async function loadChatRouter() {
  vi.resetModules();
  vi.doMock('../src/lib/ai-artifact-outbox', async () => {
    const actual = await vi.importActual<typeof import('../src/lib/ai-artifact-outbox')>(
      '../src/lib/ai-artifact-outbox',
    );

    return {
      ...actual,
      enqueueFeedArtifactGeneration: outboxMocks.enqueueFeedArtifactGeneration,
      generateAndStoreInitialFeedArtifact: outboxMocks.generateAndStoreInitialFeedArtifact,
      getServeableFeedPage: outboxMocks.getServeableFeedPage,
    };
  });

  const mod = await import('../src/routes/chat');
  return mod.default;
}

async function postFeed(path: string, body: object) {
  const chat = await loadChatRouter();
  return chat.request(`https://example.com${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }, env);
}

describe('prism/chain warming transport baseline', () => {
  beforeEach(() => {
    expectHarnessBindings();
    vi.clearAllMocks();
    outboxMocks.enqueueFeedArtifactGeneration.mockReset();
    outboxMocks.generateAndStoreInitialFeedArtifact.mockReset();
    outboxMocks.getServeableFeedPage.mockReset();
    outboxMocks.enqueueFeedArtifactGeneration.mockResolvedValue(undefined);
    outboxMocks.generateAndStoreInitialFeedArtifact.mockResolvedValue(undefined);
  });

  it.each([
    {
      artifactType: 'feed.lens',
      path: '/session/session-1/lens-feed',
      payload: {
        items: staleLensItems,
        nextCursor: staleCursor,
        exhausted: true,
      } satisfies LensFeedResponse,
    },
    {
      artifactType: 'feed.thought',
      path: '/session/session-1/thought-feed',
      payload: {
        items: staleThoughtItems,
        nextCursor: staleCursor,
        exhausted: true,
      } satisfies ThoughtFeedResponse,
    },
  ])(
    'returns snapshot-stale when a stale %s snapshot is serveable',
    async ({ artifactType, path, payload }) => {
      outboxMocks.getServeableFeedPage.mockResolvedValueOnce({
        page: {
          versionId: 'stale-version-1',
          payload,
        },
        scopeKey: 'scope-key',
        sourceHash: 'source-hash',
        generationVersionHash: 'generation-hash-1',
        readState: {
          unreadCount: 2,
          itemStates: [
            {
              logicalKey: 'state-1',
              itemHash: 'hash-1',
              isRead: false,
              firstReadAt: null,
              lastUpdatedAt: null,
            },
          ],
        },
        stale: true,
        warming: true,
      });

      const response = await postFeed(path, {
        paragraph: 'Current paragraph baseline',
        postTitle: 'Current post',
        count: 4,
        cursor: { seed: 'fd-1', page: 0, seenKeys: [] },
      });
      const json = await response.json<{
        ok: boolean;
        data: {
          items: Array<LensCard | ThoughtCard>;
          source: string;
          stale: boolean;
          warming: boolean;
          exhausted: boolean;
          nextCursor: FeedCursor;
        };
      }>();

      expect(response.status).toBe(200);
      expect(json.ok).toBe(true);
      expect(json.data.source).toBe('snapshot-stale');
      expect(json.data.stale).toBe(true);
      expect(json.data.warming).toBe(true);
      expect(json.data.items).toEqual(payload.items);
      expect(json.data.exhausted).toBe(false);
      expect(json.data.nextCursor).toBeNull();
      expect(outboxMocks.enqueueFeedArtifactGeneration).toHaveBeenCalledTimes(1);
      expect(outboxMocks.enqueueFeedArtifactGeneration).toHaveBeenCalledWith(
        env,
        expect.objectContaining({ artifactType }),
      );
    },
  );

  it.each([
    {
      artifactType: 'feed.lens',
      path: '/session/session-2/lens-feed',
      firstExpectedTag: 'fallback',
    },
    {
      artifactType: 'feed.thought',
      path: '/session/session-2/thought-feed',
      firstExpectedTag: 'fallback',
    },
  ])(
    'returns warming-fallback with generated fallback items when no %s page is serveable',
    async ({ artifactType, path, firstExpectedTag }) => {
      outboxMocks.getServeableFeedPage.mockResolvedValueOnce({
        page: null,
        scopeKey: 'scope-key',
        sourceHash: 'source-hash',
        generationVersionHash: 'generation-hash-2',
        readState: { unreadCount: 0, itemStates: [] },
        stale: false,
        warming: true,
      });

      const response = await postFeed(path, {
        paragraph: 'Warming fallback paragraph',
        postTitle: 'Fallback post',
        count: 4,
        cursor: { seed: 'fd-warm', page: 1, seenKeys: [] },
      });
      const json = await response.json<{
        ok: boolean;
        data: {
          items: Array<LensCard | ThoughtCard>;
          source: string;
          stale: boolean;
          warming: boolean;
        };
      }>();

      expect(response.status).toBe(200);
      expect(response.headers.get('Retry-After')).toBe('3');
      expect(json.ok).toBe(true);
      expect(json.data.source).toBe('warming-fallback');
      expect(json.data.stale).toBe(false);
      expect(json.data.warming).toBe(true);
      expect(json.data.items.length).toBeGreaterThan(0);
      expect(json.data.items[0]?.tags).toContain(firstExpectedTag);
      expect(outboxMocks.generateAndStoreInitialFeedArtifact).not.toHaveBeenCalled();
      expect(outboxMocks.enqueueFeedArtifactGeneration).toHaveBeenCalledTimes(1);
      expect(outboxMocks.enqueueFeedArtifactGeneration).toHaveBeenCalledWith(
        env,
        expect.objectContaining({ artifactType }),
      );
    },
  );
});
