import type {
  SelectedBlockAttachment,
  SelectedBlockEventPayload,
} from './types';

export const SELECTED_BLOCK_ATTACHMENT_NAME = 'selected-block.md';
export const MAX_SELECTED_BLOCK_CHARS = 6000;
const PREVIEW_CHARS = 360;

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

function normalizePreview(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, PREVIEW_CHARS);
}

function truncateMarkdown(value: string): {
  markdown: string;
  truncated: boolean;
} {
  const trimmed = value.trim();
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
      url: detail.url,
      title: detail.title || detail.post?.title,
      year: detail.post?.year,
      slug: detail.post?.slug,
    },
  };
}

export function buildSelectedBlockFallbackPrompt(
  detail: SelectedBlockEventPayload
): string | undefined {
  const message = detail.message?.trim();
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
