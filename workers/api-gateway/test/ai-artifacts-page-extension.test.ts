import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import { getArtifactPageForVersion, storeReadyArtifactPages } from '../src/lib/ai-artifacts';
import type { FeedCursor, ThoughtCard, ThoughtFeedResponse } from '../src/lib/feed-contract';

const pageOneCursor: FeedCursor = {
  seed: 'fd-extension',
  page: 1,
  seenKeys: ['thought-page-0'],
};

function buildPage(
  id: string,
  nextCursor: FeedCursor | null,
  exhausted: boolean
): ThoughtFeedResponse {
  const item: ThoughtCard = {
    id,
    trackKey: id,
    title: id,
    body: `${id} body`,
    bullets: [`${id} bullet`],
    tags: ['test'],
  };

  return {
    items: [item],
    nextCursor,
    exhausted,
  };
}

describe('AI artifact page extension', () => {
  it('extends an existing generation version with later feed pages', async () => {
    const suffix = crypto.randomUUID();
    const scopeKey = `test-scope-${suffix}`;
    const generationVersionHash = `sha256:test-generation-${suffix}`;
    const baseInput = {
      artifactType: 'feed.thought' as const,
      scopeKey,
      scopeType: 'post_segment',
      sourceRef: JSON.stringify({ postTitle: 'Post', paragraph: 'Paragraph' }),
      sourceHash: `sha256:test-source-${suffix}`,
      promptVersion: 'feed-thought-test',
      schemaVersion: '2',
      modelRoute: 'test-model',
      generationVersionHash,
      meta: { test: true },
    };

    const firstVersionId = await storeReadyArtifactPages<ThoughtCard>(env.DB, {
      ...baseInput,
      pages: [
        {
          pageNo: 0,
          payload: buildPage('thought-page-0', pageOneCursor, false),
          logicalKeys: ['thought-page-0'],
          itemHashes: ['hash-page-0'],
          exhausted: false,
        },
      ],
    });

    const secondVersionId = await storeReadyArtifactPages<ThoughtCard>(env.DB, {
      ...baseInput,
      pages: [
        {
          pageNo: 1,
          payload: buildPage('thought-page-1', null, true),
          logicalKeys: ['thought-page-1'],
          itemHashes: ['hash-page-1'],
          exhausted: true,
        },
      ],
    });

    expect(secondVersionId).toBe(firstVersionId);

    const page0 = await getArtifactPageForVersion<ThoughtCard>(
      env.DB,
      'feed.thought',
      scopeKey,
      generationVersionHash,
      0
    );
    const page1 = await getArtifactPageForVersion<ThoughtCard>(
      env.DB,
      'feed.thought',
      scopeKey,
      generationVersionHash,
      1
    );

    expect(page0?.payload.items[0]?.trackKey).toBe('thought-page-0');
    expect(page1?.payload.items[0]?.trackKey).toBe('thought-page-1');
    expect(page1?.exhausted).toBe(true);

    const versionCount = await env.DB.prepare(
      `SELECT COUNT(*) AS count
         FROM ai_artifact_versions
        WHERE artifact_type = ?
          AND scope_key = ?
          AND generation_version_hash = ?`
    )
      .bind('feed.thought', scopeKey, generationVersionHash)
      .first<{ count: number }>();

    expect(versionCount?.count).toBe(1);
  });
});
