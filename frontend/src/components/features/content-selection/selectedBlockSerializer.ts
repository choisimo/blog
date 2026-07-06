import type {
  SelectedBlockAttachment,
  SelectedBlockEventPayload,
} from './types';

export const SELECTED_BLOCK_ATTACHMENT_NAME = 'selected-block.md';
export const MAX_SELECTED_BLOCK_CHARS = 6000;
const PREVIEW_CHARS = 360;
const MAX_SOURCE_FIELD_CHARS = 300;
const ANSI_ESCAPE_PATTERN =
  /\u001B(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001B\\))/g;
const SINGLE_LINE_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/g;
const MULTILINE_CONTROL_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const HAS_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/;
const MALFORMED_PERCENT_PATTERN = /%(?![0-9A-Fa-f]{2})/;
const ENCODED_CONTROL_PATTERN = /%(?:0[0-9A-Fa-f]|1[0-9A-Fa-f]|7[Ff])/;
const ENCODED_SEPARATOR_PATTERN = /%(?:2[Ff]|5[Cc])/;
const WHITESPACE_PATTERN = /\s+/g;
const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:']);

function createAttachmentId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `selected-block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function estimateBytes(value: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).byteLength;
  }
  return value.length;
}

export function normalizeSelectedBlockLine(
  value: unknown,
  maxLength = MAX_SOURCE_FIELD_CHARS,
): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;

  const normalized = String(value)
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(SINGLE_LINE_CONTROL_PATTERN, ' ')
    .replace(WHITESPACE_PATTERN, ' ')
    .trim()
    .slice(0, maxLength)
    .trim();

  return normalized || undefined;
}

export function normalizeSelectedBlockMarkdown(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '';

  return String(value)
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(/\r\n?/g, '\n')
    .replace(MULTILINE_CONTROL_PATTERN, ' ')
    .trim();
}

export function normalizeSelectedBlockSourceUrl(value: unknown): string | undefined {
  const url = normalizeSelectedBlockLine(value, 1000);
  if (!url) return undefined;
  if (
    url.includes('\\') ||
    MALFORMED_PERCENT_PATTERN.test(url) ||
    ENCODED_CONTROL_PATTERN.test(url) ||
    ENCODED_SEPARATOR_PATTERN.test(url)
  ) {
    return undefined;
  }

  if (url.startsWith('/') && !url.startsWith('//')) {
    return url;
  }

  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) return undefined;
    return SAFE_LINK_PROTOCOLS.has(parsed.protocol) ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

function normalizePathSegment(value: unknown): string | undefined {
  const normalized = normalizeSelectedBlockLine(value, 128);
  if (
    !normalized ||
    normalized.includes('/') ||
    normalized.includes('\\') ||
    MALFORMED_PERCENT_PATTERN.test(normalized)
  ) {
    return undefined;
  }

  let decoded = normalized;
  try {
    decoded = decodeURIComponent(normalized);
  } catch {
    return undefined;
  }

  if (
    !decoded.trim() ||
    HAS_CONTROL_PATTERN.test(decoded) ||
    decoded.includes('/') ||
    decoded.includes('\\')
  ) {
    return undefined;
  }
  return encodeURIComponent(decoded.trim());
}

function normalizePreview(value: unknown): string {
  return normalizeSelectedBlockLine(value, PREVIEW_CHARS) ?? '';
}

function truncateMarkdown(value: string): {
  markdown: string;
  truncated: boolean;
} {
  const trimmed = normalizeSelectedBlockMarkdown(value);
  if (trimmed.length <= MAX_SELECTED_BLOCK_CHARS) {
    return { markdown: trimmed, truncated: false };
  }
  return {
    markdown: `${trimmed.slice(0, MAX_SELECTED_BLOCK_CHARS)}\n...(truncated)`,
    truncated: true,
  };
}

export function createSelectedBlockAttachment(
  detail: SelectedBlockEventPayload
): SelectedBlockAttachment | null {
  const sourceText = detail.markdown || detail.text || '';
  const { markdown, truncated } = truncateMarkdown(sourceText);
  if (!markdown) return null;
  const title = normalizeSelectedBlockLine(detail.title || detail.post?.title);
  const year = normalizePathSegment(detail.post?.year);
  const slug = normalizePathSegment(detail.post?.slug);

  return {
    kind: 'selected-block',
    id: createAttachmentId(),
    name: SELECTED_BLOCK_ATTACHMENT_NAME,
    contentType: 'text/markdown',
    markdown,
    textPreview: normalizePreview(detail.text || markdown),
    sizeBytes: estimateBytes(markdown),
    truncated,
    persistRaw: false,
    source: {
      url: normalizeSelectedBlockSourceUrl(detail.url),
      title,
      year,
      slug,
    },
  };
}

export function buildSelectedBlockFallbackPrompt(
  detail: SelectedBlockEventPayload
): string | undefined {
  const message = normalizeSelectedBlockLine(detail.message, 2000);
  if (message) return message;

  const attachment = createSelectedBlockAttachment(detail);
  if (!attachment) return undefined;

  const source = attachment.source ?? {};
  const path =
    source.year && source.slug ? `${source.year}/${source.slug}` : undefined;

  return [
    '아래 선택한 블록을 현재 글의 문맥에 맞춰 설명해줘.',
    '필요하면 사용 예시, 관련 개념, 주의할 점까지 정리해줘.',
    '',
    source.title ? `[현재 글] ${source.title}` : null,
    path ? `[경로] ${path}` : null,
    '',
    '[선택한 블록]',
    '```md',
    attachment.markdown,
    '```',
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}
