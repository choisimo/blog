import { AI_TEMPERATURES, MAX_TOKENS, TEXT_LIMITS } from '../config/defaults';
import type {
  FeedPromptConfig,
  NormalizedLensFeedRequest,
  NormalizedThoughtFeedRequest,
} from './feed-contract';
import { LENS_FEED_SCHEMA, THOUGHT_FEED_SCHEMA } from './feed-contract';

const FEED_SYSTEM = `You are a helpful AI assistant for an inline reading experience.
Always respond in the same language as the source text.
Return STRICT JSON matching the schema provided.
Do not wrap the response in markdown fences.`;

function safeTruncate(value: string | undefined, maxLength: number): string {
  if (!value) return '';
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}\n...(truncated)`;
}

function formatSeenKeys(seenKeys: string[]): string {
  if (seenKeys.length === 0) return '(none)';
  return seenKeys.map((key, index) => `${index + 1}. ${key}`).join('\n');
}

function formatContext(
  context?: { url?: string; title?: string },
  postTitle?: string
): string {
  const lines: string[] = [];
  if (postTitle) lines.push(`- Post Title: "${postTitle}"`);
  if (context?.title) lines.push(`- Page Title: "${context.title}"`);
  if (context?.url) lines.push(`- Page URL: ${context.url}`);
  return lines.join('\n');
}

export function buildLensFeedPrompt(
  input: NormalizedLensFeedRequest
): FeedPromptConfig {
  const pageNumber = input.cursor.page + 1;
  const contextBlock = formatContext(input.context, input.postTitle);
  const user = `Task: Generate EXACTLY ${input.count} lens cards for an inline multi-angle feed.

Feed Cursor:
- Seed: ${input.cursor.seed}
- Page: ${pageNumber}
- Avoid repeating these angle keys:
${formatSeenKeys(input.cursor.seenKeys)}

${contextBlock ? `Context:\n${contextBlock}\n` : ''}Source Text:
"${safeTruncate(input.paragraph, TEXT_LIMITS.CONTENT)}"

Rules:
1. Each item must present a meaningfully different analytical angle.
2. angleKey must be short kebab-case text and MUST NOT reuse the seen keys above.
3. personaId must be one of: mentor, debater, explorer, analyst.
4. summary should be 1-2 concise sentences.
5. bullets should contain 3-5 evidence-backed points.
6. detail should expand the reasoning with concrete support from the source text.
7. tags should contain 1-4 short labels.
8. Avoid generic repetition across items. Make page ${pageNumber} feel like a continuation, not a reset.

Response Schema:
${JSON.stringify(LENS_FEED_SCHEMA, null, 2)}`;

  return {
    system: FEED_SYSTEM,
    user,
    temperature: AI_TEMPERATURES.PRISM,
    maxTokens: Math.max(MAX_TOKENS.PRISM, 2048),
    schema: LENS_FEED_SCHEMA,
  };
}

export function buildThoughtFeedPrompt(
  input: NormalizedThoughtFeedRequest
): FeedPromptConfig {
  const pageNumber = input.cursor.page + 1;
  const contextBlock = formatContext(input.context, input.postTitle);
  const user = `Task: Generate EXACTLY ${input.count} thought cards for an inline exploratory feed.

Feed Cursor:
- Seed: ${input.cursor.seed}
- Page: ${pageNumber}
- Avoid repeating these track keys:
${formatSeenKeys(input.cursor.seenKeys)}

${contextBlock ? `Context:\n${contextBlock}\n` : ''}Source Text:
"${safeTruncate(input.paragraph, TEXT_LIMITS.CONTENT)}"

Rules:
1. Each item must open a distinct line of thought or question track.
2. trackKey must be short kebab-case text and MUST NOT reuse the seen keys above.
3. title should feel like a strong prompt for reflection.
4. subtitle is optional, but if present it should sharpen the angle.
5. body should contain a short thesis or explanation grounded in the source text.
6. bullets should contain 3-5 concrete sub-questions or reasoning cues when useful.
7. tags should contain 1-4 short labels.
8. Avoid debate-room language and avoid CTA phrasing. These cards should stand alone inside the feed.

Response Schema:
${JSON.stringify(THOUGHT_FEED_SCHEMA, null, 2)}`;

  return {
    system: FEED_SYSTEM,
    user,
    temperature: Math.max(AI_TEMPERATURES.CHAIN, 0.25),
    maxTokens: Math.max(MAX_TOKENS.CHAIN, 2048),
    schema: THOUGHT_FEED_SCHEMA,
  };
}
