import { buildLensFeedPrompt, buildThoughtFeedPrompt } from '../src/lib/feed-prompts';
import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import {
  normalizeLensFeedRequest,
  normalizeLensFeedResponse,
  normalizeThoughtFeedRequest,
  normalizeThoughtFeedResponse,
} from '../src/lib/feed-normalizers';
import { normalizeTaskDataForMode, tryParseJson } from '../src/lib/llm';
import { tryParseJson as parseServiceJson } from '../src/lib/ai-service';
import {
  buildFeedScopeKey,
  buildFeedSourceHash,
  buildGenerationVersionHash,
  storeReadyArtifactPages,
} from '../src/lib/ai-artifacts';
import { getServeableFeedPage } from '../src/lib/ai-artifact-outbox';
import { getAiDefaultModel } from '../src/lib/config';

const lens = {
  id: 'lens-1',
  personaId: 'analyst',
  angleKey: 'evidence',
  title: 'Unequal starting points',
  summary: 'Access differs.',
  bullets: ['74 percent connected', '2.2 billion remain offline'],
  detail: 'A first line.\nA second line.',
  tags: ['access'],
};
const thought = {
  id: 'thought-1',
  trackKey: 'access',
  title: 'Who can access intelligence?',
  body: 'Access depends on infrastructure.',
  bullets: ['Consider connectivity.'],
};
const lensRequest = normalizeLensFeedRequest({ paragraph: 'Internet access varies.', count: 4 })!;
const thoughtRequest = normalizeThoughtFeedRequest({
  paragraph: 'Internet access varies.',
  count: 4,
})!;

describe('structured AI response boundaries', () => {
  it('recovers literal newlines inside feed JSON without displaying serialized fields', () => {
    const raw = JSON.stringify({ items: [lens] }).replace('\\n', '\n');
    expect(normalizeLensFeedResponse(raw, lensRequest)?.items[0]).toMatchObject(lens);
    expect(parseServiceJson(raw)).toEqual(tryParseJson(raw));
  });

  it('unwraps encoded feed envelopes including text and _raw', () => {
    expect(
      normalizeThoughtFeedResponse(
        { data: { _raw: { text: JSON.stringify({ items: [thought] }) } } },
        thoughtRequest
      )?.items[0]
    ).toMatchObject(thought);
  });

  it.each(['{"items":[{"title":"unfinished', '```json\n{"items": [', '{"items":[]}'])(
    'never projects structured feed output into prose: %s',
    (raw) => {
      expect(normalizeLensFeedResponse(raw, lensRequest)).toBeNull();
      expect(normalizeThoughtFeedResponse(raw, thoughtRequest)).toBeNull();
    }
  );

  it('rejects JSON already projected into stored display fields', () => {
    const raw = '{"items": [{"personaId":"analyst", "title":"unfinished...';
    expect(normalizeLensFeedResponse({ items: [{ ...lens, title: raw }] }, lensRequest)).toBeNull();
    expect(
      normalizeThoughtFeedResponse({ items: [{ ...thought, body: raw }] }, thoughtRequest)
    ).toBeNull();
  });

  it('retains ordinary prose fallback and structured card pagination', () => {
    expect(
      normalizeLensFeedResponse('A useful angle\nEvidence from the paragraph.', lensRequest)
        ?.items[0].title
    ).toBe('A useful angle');
    const response = normalizeLensFeedResponse({ items: [lens, lens] }, lensRequest)!;
    expect(response.items).toHaveLength(1);
    expect(response.nextCursor?.seenKeys).toContain('evidence');
  });

  it.each([
    ['sketch', { mood: 'analytical', bullets: ['A useful observation'] }],
    ['prism', { facets: [{ title: 'Access', points: ['Infrastructure matters'] }] }],
    ['chain', { questions: [{ q: 'Who is excluded?', why: 'Access differs' }] }],
    ['summary', { summary: 'Access is uneven', keyPoints: ['Connectivity'] }],
    ['quiz', { quiz: [{ type: 'explain', question: 'What differs?', answer: 'Access' }] }],
  ] as const)('validates %s task wrappers and rejects serialized display text', (mode, data) => {
    expect(
      normalizeTaskDataForMode(mode, { data: { _raw: { text: JSON.stringify(data) } } })
    ).toEqual(data);
    const poisoned = JSON.parse(JSON.stringify(data).replace('Access', '{\\"items\\":['));
    if (mode !== 'sketch') expect(normalizeTaskDataForMode(mode, poisoned)).toBeNull();
    expect(normalizeTaskDataForMode(mode, { text: '{"items": [' })).toBeNull();
  });
});

describe('stored feed contamination', () => {
  it.each(['feed.lens', 'feed.thought'] as const)(
    'does not serve malformed exact or stale %s snapshots',
    async (artifactType) => {
      const paragraph = `Stored response ${crypto.randomUUID()}`;
      const scopeKey = await buildFeedScopeKey(paragraph);
      const sourceHash = await buildFeedSourceHash(paragraph);
      const modelRoute = (await getAiDefaultModel(env)) || 'default';
      const promptVersion = artifactType === 'feed.lens' ? 'feed-lens-v1' : 'feed-thought-v1';
      const generationVersionHash = await buildGenerationVersionHash({
        sourceHash,
        artifactType,
        promptVersion,
        schemaVersion: '3',
        modelRoute,
      });
      for (const version of [generationVersionHash, 'stale-generation']) {
        const card =
          artifactType === 'feed.lens'
            ? { ...lens, title: '{"items": [unfinished' }
            : { ...thought, body: '{"items": [unfinished' };
        await storeReadyArtifactPages(env.DB, {
          artifactType,
          scopeKey,
          scopeType: 'post_segment',
          sourceRef: paragraph,
          sourceHash,
          promptVersion,
          schemaVersion: '3',
          modelRoute,
          generationVersionHash: version,
          pages: [
            {
              pageNo: 0,
              payload: { items: [card], nextCursor: null, exhausted: true },
              logicalKeys: ['access'],
              itemHashes: ['hash'],
              exhausted: true,
            },
          ],
        });
        const served = await getServeableFeedPage(env, {
          artifactType,
          sessionId: 'test-reader',
          paragraph,
          pageNo: 0,
        });
        expect(served.page).toBeNull();
        expect(served.warming).toBe(true);
      }
    }
  );
});


describe('feed output capacity', () => {
  it('scales output capacity with requested card count within the backend limit', () => {
    for (const build of [buildLensFeedPrompt, buildThoughtFeedPrompt]) {
      const one = build({ ...lensRequest, count: 1 });
      const six = build({ ...lensRequest, count: 6 });
      expect(six.maxTokens).toBeGreaterThan(one.maxTokens);
      expect(six.maxTokens).toBeLessThanOrEqual(16000);
      expect(six.user).toContain('characters');
    }
  });
});


describe('review regressions', () => {
  it('blocks malformed JSON after a response introduction', () => {
    const raw = 'Here is the response {"items":[{"title":"cut';
    expect(normalizeLensFeedResponse(raw, lensRequest)).toBeNull();
    expect(normalizeThoughtFeedResponse(raw, thoughtRequest)).toBeNull();
  });
  it('preserves prose containing an unrelated JSON example', () => {
    const prose = 'Use {"name":"Alice"} as an example.';
    expect(normalizeLensFeedResponse(prose, lensRequest)?.items[0].title).toBe(prose);
    expect(normalizeThoughtFeedResponse(prose, thoughtRequest)?.items[0].title).toBe(prose);
  });
  it('rejects nested fallback quiz envelopes', () => {
    expect(normalizeTaskDataForMode('quiz', { result: { _fallback: true, quiz: [{ question: 'Why?', answer: 'Because' }] } })).toBeNull();
  });
});

it.each(['`JSON.parse` decodes a JSON string.', '[RFC 8259](https://example.invalid) defines JSON.'])('preserves Markdown prose: %s', prose => {
  expect(normalizeLensFeedResponse(prose, lensRequest)?.items[0].title).toBe(prose);
  expect(normalizeThoughtFeedResponse(prose, thoughtRequest)?.items[0].title).toBe(prose);
});
