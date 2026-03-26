import type { JsonSchema, PromptConfig } from './prompts';

export type FeedContext = {
  url?: string;
  title?: string;
};

export type FeedCursor = {
  seed: string;
  page: number;
  seenKeys: string[];
};

export type LensCard = {
  id: string;
  personaId: 'mentor' | 'debater' | 'explorer' | 'analyst';
  angleKey: string;
  title: string;
  summary: string;
  bullets: string[];
  detail: string;
  tags: string[];
};

export type ThoughtCard = {
  id: string;
  trackKey: string;
  title: string;
  subtitle?: string;
  body: string;
  bullets?: string[];
  tags?: string[];
};

export type LensFeedRequest = {
  paragraph?: string;
  content?: string;
  postTitle?: string;
  title?: string;
  cursor?: FeedCursor | null;
  count?: number;
  context?: FeedContext;
};

export type ThoughtFeedRequest = LensFeedRequest;

export type FeedResponseSource = 'snapshot' | 'snapshot-stale' | 'warming-fallback';

export type LensFeedResponse = {
  items: LensCard[];
  nextCursor: FeedCursor | null;
  exhausted: boolean;
  warming?: boolean;
  stale?: boolean;
  source?: FeedResponseSource;
};

export type ThoughtFeedResponse = {
  items: ThoughtCard[];
  nextCursor: FeedCursor | null;
  exhausted: boolean;
  warming?: boolean;
  stale?: boolean;
  source?: FeedResponseSource;
};

export type NormalizedFeedRequestBase = {
  paragraph: string;
  postTitle?: string;
  count: number;
  cursor: FeedCursor;
  context?: FeedContext;
};

export type NormalizedLensFeedRequest = NormalizedFeedRequestBase;
export type NormalizedThoughtFeedRequest = NormalizedFeedRequestBase;

export type FeedPromptConfig = PromptConfig;

export const FEED_DEFAULT_COUNT = 4;
export const FEED_MIN_COUNT = 1;
export const FEED_MAX_COUNT = 6;
export const FEED_MAX_PAGES = 8;
export const FEED_MAX_SEEN_KEYS = 128;

export const LENS_PERSONA_IDS = ['mentor', 'debater', 'explorer', 'analyst'] as const;

export const LENS_FEED_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          personaId: {
            type: 'string',
            enum: [...LENS_PERSONA_IDS],
          },
          angleKey: { type: 'string' },
          title: { type: 'string' },
          summary: { type: 'string' },
          bullets: { type: 'array', items: { type: 'string' } },
          detail: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'personaId', 'angleKey', 'title', 'summary', 'bullets', 'detail', 'tags'],
      },
    },
  },
  required: ['items'],
};

export const THOUGHT_FEED_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          trackKey: { type: 'string' },
          title: { type: 'string' },
          subtitle: { type: 'string' },
          body: { type: 'string' },
          bullets: { type: 'array', items: { type: 'string' } },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'trackKey', 'title', 'body'],
      },
    },
  },
  required: ['items'],
};
