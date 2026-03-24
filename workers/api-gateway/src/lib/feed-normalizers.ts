import { FALLBACK_DATA, TEXT_LIMITS } from '../config/defaults';
import {
  FEED_DEFAULT_COUNT,
  FEED_MAX_COUNT,
  FEED_MAX_PAGES,
  FEED_MAX_SEEN_KEYS,
  FEED_MIN_COUNT,
  LENS_PERSONA_IDS,
  type FeedContext,
  type FeedCursor,
  type LensCard,
  type LensFeedResponse,
  type NormalizedFeedRequestBase,
  type NormalizedLensFeedRequest,
  type NormalizedThoughtFeedRequest,
  type ThoughtCard,
  type ThoughtFeedResponse,
} from './feed-contract';
import { tryParseJson } from './llm';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function safeTruncate(value: string, maxLength: number): string {
  if (!value) return '';
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function clampFeedCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return FEED_DEFAULT_COUNT;
  }
  return Math.max(FEED_MIN_COUNT, Math.min(FEED_MAX_COUNT, Math.floor(value)));
}

function clampPage(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function createStableSeed(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fd-${(hash >>> 0).toString(36)}`;
}

function slugify(value: string, fallback: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return normalized || fallback;
}

function uniqueStrings(values: string[], limit = FEED_MAX_SEEN_KEYS): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of values) {
    const next = toText(value);
    if (!next || seen.has(next)) continue;
    seen.add(next);
    normalized.push(next);
    if (normalized.length >= limit) break;
  }
  return normalized;
}

function normalizeStringArray(value: unknown, max = 5): string[] {
  if (Array.isArray(value)) {
    return value.map(toText).filter(Boolean).slice(0, max);
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/[,|\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, max);
  }
  return [];
}

function normalizeContext(value: unknown): FeedContext | undefined {
  if (!isRecord(value)) return undefined;
  const url = toText(value.url);
  const title = toText(value.title);
  if (!url && !title) return undefined;
  return { url: url || undefined, title: title || undefined };
}

function normalizeCursor(value: unknown, seedSource: string): FeedCursor {
  const record = isRecord(value) ? value : {};
  const seed = toText(record.seed) || createStableSeed(seedSource);
  const page = clampPage(record.page);
  const seenKeys = uniqueStrings(Array.isArray(record.seenKeys) ? record.seenKeys.map(toText) : []);
  return { seed, page, seenKeys };
}

function normalizeRequestBase(raw: unknown): NormalizedFeedRequestBase | null {
  const record = isRecord(raw) ? raw : {};
  const paragraph = safeTruncate(
    toText(record.paragraph ?? record.content ?? record.prompt),
    TEXT_LIMITS.CONTENT
  );

  if (!paragraph) return null;

  const postTitle = toText(record.postTitle ?? record.title) || undefined;
  const seedSource = `${postTitle || ''}\n${paragraph.slice(0, 240)}`;

  return {
    paragraph,
    postTitle,
    count: clampFeedCount(record.count),
    cursor: normalizeCursor(record.cursor, seedSource),
    context: normalizeContext(record.context),
  };
}

export function normalizeLensFeedRequest(raw: unknown): NormalizedLensFeedRequest | null {
  return normalizeRequestBase(raw);
}

export function normalizeThoughtFeedRequest(raw: unknown): NormalizedThoughtFeedRequest | null {
  return normalizeRequestBase(raw);
}

function sentencePoints(text: string, max = 4): string[] {
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, max);
  if (sentences.length > 0) return sentences;
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, max);
}

function splitBlocks(text: string, limit: number): string[] {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function extractItems(raw: unknown, keys: string[]): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    const parsed = tryParseJson(raw);
    return parsed ? extractItems(parsed, keys) : [];
  }
  if (!isRecord(raw)) return [];
  for (const key of keys) {
    if (Array.isArray(raw[key])) return raw[key] as unknown[];
  }
  if ('data' in raw) return extractItems(raw.data, keys);
  if ('result' in raw) return extractItems(raw.result, keys);
  if ('output' in raw) return extractItems(raw.output, keys);
  if ('payload' in raw) return extractItems(raw.payload, keys);
  if ('_raw' in raw) return extractItems(raw._raw, keys);
  return [];
}

function normalizePersonaId(value: unknown, index: number): LensCard['personaId'] {
  const raw = toText(value).toLowerCase();
  if ((LENS_PERSONA_IDS as readonly string[]).includes(raw)) {
    return raw as LensCard['personaId'];
  }
  return LENS_PERSONA_IDS[index % LENS_PERSONA_IDS.length];
}

function normalizeLensCard(
  value: unknown,
  index: number,
  request: NormalizedLensFeedRequest
): LensCard | null {
  if (!isRecord(value)) return null;

  const title =
    toText(value.title ?? value.heading ?? value.name) ||
    `Lens ${request.cursor.page * request.count + index + 1}`;
  const summary = toText(value.summary ?? value.subtitle ?? value.description ?? value.thesis);
  const bullets = normalizeStringArray(value.bullets ?? value.points ?? value.evidence, 5);
  const detail = toText(value.detail ?? value.body ?? value.explanation ?? value.rationale);

  const resolvedSummary = summary || bullets[0] || title;
  const resolvedDetail = detail || [resolvedSummary, ...bullets].join(' ').trim();
  if (!resolvedDetail) return null;

  const keySource =
    toText(value.angleKey ?? value.key ?? value.dedupeKey ?? value.id) ||
    [title, resolvedSummary, ...bullets].join(' ');
  const angleKey = slugify(keySource, `${request.cursor.seed}-lens-${index + 1}`);
  const id = toText(value.id) || `${request.cursor.seed}-${angleKey}`;
  const tags = uniqueStrings(normalizeStringArray(value.tags, 4), 4);

  return {
    id,
    personaId: normalizePersonaId(value.personaId ?? value.persona, index),
    angleKey,
    title: safeTruncate(title, 120),
    summary: safeTruncate(resolvedSummary, 240),
    bullets: bullets.map((item) => safeTruncate(item, 140)).slice(0, 5),
    detail: safeTruncate(resolvedDetail, 700),
    tags,
  };
}

function normalizeThoughtCard(
  value: unknown,
  index: number,
  request: NormalizedThoughtFeedRequest
): ThoughtCard | null {
  if (!isRecord(value)) return null;

  const title =
    toText(value.title ?? value.question ?? value.heading) ||
    `Thought ${request.cursor.page * request.count + index + 1}`;
  const subtitle = toText(value.subtitle ?? value.summary ?? value.hook);
  const body = toText(
    value.body ?? value.detail ?? value.explanation ?? value.why ?? value.summary
  );
  const bullets = normalizeStringArray(value.bullets ?? value.points ?? value.prompts, 5);

  const resolvedBody = body || bullets[0] || title;
  if (!resolvedBody) return null;

  const keySource =
    toText(value.trackKey ?? value.key ?? value.dedupeKey ?? value.id) ||
    [title, subtitle, resolvedBody, ...bullets].filter(Boolean).join(' ');
  const trackKey = slugify(keySource, `${request.cursor.seed}-thought-${index + 1}`);
  const id = toText(value.id) || `${request.cursor.seed}-${trackKey}`;
  const tags = uniqueStrings(normalizeStringArray(value.tags, 4), 4);

  const card: ThoughtCard = {
    id,
    trackKey,
    title: safeTruncate(title, 120),
    body: safeTruncate(resolvedBody, 520),
  };

  if (subtitle) card.subtitle = safeTruncate(subtitle, 180);
  if (bullets.length > 0) card.bullets = bullets.map((item) => safeTruncate(item, 140)).slice(0, 5);
  if (tags.length > 0) card.tags = tags;

  return card;
}

function projectLensCardsFromText(text: string, request: NormalizedLensFeedRequest): LensCard[] {
  const blocks = splitBlocks(text, Math.max(request.count, 3));
  if (blocks.length === 0) {
    return sentencePoints(text, request.count).map((line, index) => {
      const angleKey = slugify(line, `${request.cursor.seed}-lens-${index + 1}`);
      return {
        id: `${request.cursor.seed}-${angleKey}`,
        personaId: LENS_PERSONA_IDS[index % LENS_PERSONA_IDS.length],
        angleKey,
        title: safeTruncate(line, 120),
        summary: safeTruncate(line, 240),
        bullets: sentencePoints(text, 3),
        detail: safeTruncate(text, 700),
        tags: ['fallback'],
      };
    });
  }

  return blocks.map((block, index) => {
    const lines = block
      .split(/\r?\n/)
      .map((line) => line.replace(/^[-*•\d.)\s]+/, '').trim())
      .filter(Boolean);
    const title = lines[0] || `Lens ${index + 1}`;
    const bullets = lines.slice(1, 5);
    const angleKey = slugify(title, `${request.cursor.seed}-lens-${index + 1}`);
    return {
      id: `${request.cursor.seed}-${angleKey}`,
      personaId: LENS_PERSONA_IDS[index % LENS_PERSONA_IDS.length],
      angleKey,
      title: safeTruncate(title, 120),
      summary: safeTruncate(lines[1] || title, 240),
      bullets: bullets.length > 0 ? bullets : sentencePoints(block, 3),
      detail: safeTruncate(block, 700),
      tags: ['projected'],
    };
  });
}

function projectThoughtCardsFromText(
  text: string,
  request: NormalizedThoughtFeedRequest
): ThoughtCard[] {
  const blocks = splitBlocks(text, Math.max(request.count, 3));
  if (blocks.length === 0) {
    return sentencePoints(text, request.count).map((line, index) => {
      const trackKey = slugify(line, `${request.cursor.seed}-thought-${index + 1}`);
      return {
        id: `${request.cursor.seed}-${trackKey}`,
        trackKey,
        title: safeTruncate(line, 120),
        body: safeTruncate(line, 520),
        bullets: sentencePoints(text, 3),
        tags: ['fallback'],
      };
    });
  }

  return blocks.map((block, index) => {
    const lines = block
      .split(/\r?\n/)
      .map((line) => line.replace(/^[-*•\d.)\s]+/, '').trim())
      .filter(Boolean);
    const title = lines[0] || `Thought ${index + 1}`;
    const body = lines.slice(1).join(' ').trim() || title;
    const trackKey = slugify(title, `${request.cursor.seed}-thought-${index + 1}`);
    return {
      id: `${request.cursor.seed}-${trackKey}`,
      trackKey,
      title: safeTruncate(title, 120),
      body: safeTruncate(body, 520),
      bullets: sentencePoints(block, 4),
      tags: ['projected'],
    };
  });
}

function buildNextCursor(cursor: FeedCursor, newKeys: string[]): FeedCursor {
  return {
    seed: cursor.seed,
    page: cursor.page + 1,
    seenKeys: uniqueStrings([...cursor.seenKeys, ...newKeys]),
  };
}

function finalizeFeedResponse<T extends LensCard | ThoughtCard>(
  request: NormalizedFeedRequestBase,
  items: T[],
  sourceCount: number,
  getKey: (item: T) => string
): { items: T[]; nextCursor: FeedCursor | null; exhausted: boolean } {
  const pageLimitReached = request.cursor.page + 1 >= FEED_MAX_PAGES;
  const keys = items.map(getKey);
  const exhausted = pageLimitReached || sourceCount === 0 || items.length === 0;
  return {
    items,
    nextCursor: exhausted ? null : buildNextCursor(request.cursor, keys),
    exhausted,
  };
}

function dedupeBySeenKeys<T>(
  items: T[],
  request: NormalizedFeedRequestBase,
  getKey: (item: T) => string
): T[] {
  const seen = new Set(request.cursor.seenKeys);
  const current = new Set<string>();
  const filtered: T[] = [];

  for (const item of items) {
    const key = getKey(item);
    if (!key || seen.has(key) || current.has(key)) continue;
    filtered.push(item);
    current.add(key);
    if (filtered.length >= request.count) break;
  }

  return filtered;
}

export function normalizeLensFeedResponse(
  raw: unknown,
  request: NormalizedLensFeedRequest
): LensFeedResponse | null {
  const candidates = extractItems(raw, ['items', 'cards', 'lenses', 'facets'])
    .map((item, index) => normalizeLensCard(item, index, request))
    .filter((item): item is LensCard => item !== null);

  const projected =
    candidates.length > 0
      ? candidates
      : typeof raw === 'string'
        ? projectLensCardsFromText(raw, request)
        : [];

  if (projected.length === 0) return null;

  const items = dedupeBySeenKeys(projected, request, (item) => item.angleKey);
  return finalizeFeedResponse(request, items, projected.length, (item) => item.angleKey);
}

export function normalizeThoughtFeedResponse(
  raw: unknown,
  request: NormalizedThoughtFeedRequest
): ThoughtFeedResponse | null {
  const candidates = extractItems(raw, ['items', 'cards', 'thoughts', 'questions'])
    .map((item, index) => normalizeThoughtCard(item, index, request))
    .filter((item): item is ThoughtCard => item !== null);

  const projected =
    candidates.length > 0
      ? candidates
      : typeof raw === 'string'
        ? projectThoughtCardsFromText(raw, request)
        : [];

  if (projected.length === 0) return null;

  const items = dedupeBySeenKeys(projected, request, (item) => item.trackKey);
  return finalizeFeedResponse(request, items, projected.length, (item) => item.trackKey);
}

export function buildLensFeedFallback(request: NormalizedLensFeedRequest): LensFeedResponse {
  const items = FALLBACK_DATA.PRISM.FACETS.map((facet, index) => ({
    id: `${request.cursor.seed}-${slugify(facet.title, `lens-fallback-${index + 1}`)}`,
    personaId: LENS_PERSONA_IDS[index % LENS_PERSONA_IDS.length],
    angleKey: slugify(facet.title, `lens-fallback-${index + 1}`),
    title: facet.title,
    summary: safeTruncate(facet.points[0] || facet.title, 240),
    bullets: facet.points.map((point) => safeTruncate(point, 140)).slice(0, 4),
    detail: safeTruncate(
      `${facet.title}: ${facet.points.join(' ')} ${request.paragraph}`.trim(),
      700
    ),
    tags: ['fallback'],
  }));

  const deduped = dedupeBySeenKeys(items, request, (item) => item.angleKey);
  return {
    items: deduped,
    nextCursor: null,
    exhausted: true,
  };
}

export function buildThoughtFeedFallback(
  request: NormalizedThoughtFeedRequest
): ThoughtFeedResponse {
  const questions = FALLBACK_DATA.CHAIN.QUESTIONS as ReadonlyArray<{
    q: string;
    why: string;
  }>;
  const items = questions.map((question, index) => ({
    id: `${request.cursor.seed}-${slugify(question.q, `thought-fallback-${index + 1}`)}`,
    trackKey: slugify(question.q, `thought-fallback-${index + 1}`),
    title: question.q,
    body: safeTruncate(question.why || question.q, 520),
    bullets: sentencePoints(request.paragraph, 3),
    tags: ['fallback'],
  }));

  const deduped = dedupeBySeenKeys(items, request, (item) => item.trackKey);
  return {
    items: deduped,
    nextCursor: null,
    exhausted: true,
  };
}
