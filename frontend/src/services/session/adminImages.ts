import { adminFetchRaw } from '@/services/admin/apiClient';
import { getApiBaseUrl } from '@/utils/network/apiBase';

export type AdminAiImageQuality = 'low' | 'medium' | 'high' | 'standard' | 'hd' | 'auto';
export type AdminAiImageSize =
  | '1024x1024'
  | '1536x1024'
  | '1024x1536'
  | '1792x1024'
  | '1024x1792';

export type GeneratePostImagesPayload = {
  year: string | number;
  slug: string;
  prompt: string;
  n?: number;
  size?: AdminAiImageSize;
  quality?: AdminAiImageQuality;
  outputFormat?: 'png';
  alt?: string;
};

export type GeneratedPostImageItem = {
  filename: string;
  path: string;
  url: string;
  variantWebp?: {
    filename: string;
    path: string;
    url: string;
    width?: number;
    sizeBytes?: number;
  } | null;
  alt: string;
  markdown: string;
  source: 'ai-generated';
  width?: number;
  height?: number;
  sizeBytes?: number;
};

export type GeneratePostImagesResponse = {
  dir: string;
  model: string;
  created: number;
  durationMs: number;
  usage: unknown;
  metadata: unknown;
  items: GeneratedPostImageItem[];
};

export type AdminAiImagesHealth = {
  enabled: boolean;
  configured: boolean;
  baseUrlConfigured: boolean;
  apiKeyConfigured: boolean;
  model: string | null;
  maxCount: number;
  timeoutMs: number;
  upstream?: {
    ok: boolean;
    status: string;
    modelAvailable?: boolean | null;
  };
};

const MAX_AI_IMAGE_PROMPT_LENGTH = 4000;
const MAX_AI_IMAGE_ALT_LENGTH = 250;
const MAX_AI_IMAGE_COUNT = 4;
const MAX_AI_IMAGE_PATH_LENGTH = 512;
const AI_IMAGE_YEAR_PATTERN = /^\d{4}$/;
const AI_IMAGE_SLUG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const AI_IMAGE_FILENAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,180}\.(?:png|webp)$/i;
const AI_IMAGE_SIZES: readonly AdminAiImageSize[] = [
  '1024x1024',
  '1536x1024',
  '1024x1536',
  '1792x1024',
  '1024x1792',
];
const SINGLE_LINE_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/g;
const SINGLE_LINE_CONTROL_TEST_PATTERN = /[\u0000-\u001F\u007F]/;
const MULTILINE_CONTROL_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const WHITESPACE_PATTERN = /\s+/g;
const AI_IMAGE_QUALITIES: readonly AdminAiImageQuality[] = [
  'low',
  'medium',
  'high',
  'standard',
  'hd',
  'auto',
];

function createIdempotencyKey(): string {
  const randomId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `admin-ai-image:${randomId}`;
}

function decodeSelector(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return decodeURIComponent(trimmed).trim();
  } catch {
    return trimmed;
  }
}

function normalizeSelector(value: unknown, label: string, pattern: RegExp): string {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error(`Invalid AI image ${label}`);
  }

  const decoded = decodeSelector(String(value));
  if (!decoded || !pattern.test(decoded)) {
    throw new Error(`Invalid AI image ${label}`);
  }

  return decoded;
}

function normalizeMultilineText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string') {
    throw new Error(`Invalid AI image ${label}`);
  }

  const normalized = value
    .replace(/\r\n?/g, '\n')
    .replace(MULTILINE_CONTROL_PATTERN, ' ')
    .trim();
  if (!normalized || normalized.length > maxLength) {
    throw new Error(`Invalid AI image ${label}`);
  }

  return normalized;
}

function normalizeOptionalSingleLineText(value: unknown, label: string, maxLength: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new Error(`Invalid AI image ${label}`);
  }

  const normalized = value
    .replace(SINGLE_LINE_CONTROL_PATTERN, ' ')
    .replace(WHITESPACE_PATTERN, ' ')
    .trim();
  if (!normalized || normalized.length > maxLength) {
    throw new Error(`Invalid AI image ${label}`);
  }

  return normalized;
}

function normalizeImageCount(value: unknown): number {
  if (value === undefined || value === null) return 1;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Invalid AI image count');
  }

  return Math.min(MAX_AI_IMAGE_COUNT, Math.max(1, Math.floor(value)));
}

function normalizeImageSize(value: unknown): AdminAiImageSize {
  if (value === undefined || value === null) return '1024x1024';
  if (AI_IMAGE_SIZES.includes(value as AdminAiImageSize)) {
    return value as AdminAiImageSize;
  }
  throw new Error('Invalid AI image size');
}

function normalizeImageQuality(value: unknown): AdminAiImageQuality {
  if (value === undefined || value === null) return 'medium';
  if (AI_IMAGE_QUALITIES.includes(value as AdminAiImageQuality)) {
    return value as AdminAiImageQuality;
  }
  throw new Error('Invalid AI image quality');
}

function normalizeGeneratePostImagesPayload(
  payload: GeneratePostImagesPayload,
): GeneratePostImagesPayload {
  return {
    year: normalizeSelector(payload.year, 'year', AI_IMAGE_YEAR_PATTERN),
    slug: normalizeSelector(payload.slug, 'slug', AI_IMAGE_SLUG_PATTERN),
    prompt: normalizeMultilineText(payload.prompt, 'prompt', MAX_AI_IMAGE_PROMPT_LENGTH),
    n: normalizeImageCount(payload.n),
    size: normalizeImageSize(payload.size),
    quality: normalizeImageQuality(payload.quality),
    outputFormat: 'png',
    alt: normalizeOptionalSingleLineText(payload.alt, 'alt text', MAX_AI_IMAGE_ALT_LENGTH),
  };
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const record = payload as { error?: unknown; message?: unknown };

  const normalizeErrorText = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined;
    try {
      return normalizeOptionalSingleLineText(value, 'error message', 1000);
    } catch {
      return undefined;
    }
  };

  const errorText = normalizeErrorText(record.error);
  if (errorText) return errorText;
  if (record.error && typeof record.error === 'object') {
    const nested = record.error as { message?: unknown; code?: unknown };
    const nestedMessage = normalizeErrorText(nested.message);
    if (nestedMessage) return nestedMessage;
    const nestedCode = normalizeErrorText(nested.code);
    if (nestedCode) return nestedCode;
  }
  return normalizeErrorText(record.message) ?? fallback;
}

function isSafeImageFilename(value: unknown): value is string {
  return typeof value === 'string' && AI_IMAGE_FILENAME_PATTERN.test(value.trim());
}

function isSafeImagePath(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const normalized = value.trim();
  return (
    normalized === value &&
    normalized.length > 0 &&
    normalized.length <= MAX_AI_IMAGE_PATH_LENGTH &&
    normalized.startsWith('/images/') &&
    !SINGLE_LINE_CONTROL_TEST_PATTERN.test(normalized) &&
    !/%(?:0a|0d)/i.test(normalized) &&
    !normalized.includes('//') &&
    !normalized.includes('/../') &&
    !normalized.endsWith('/..')
  );
}

function isSafeGeneratedText(value: unknown, maxLength: number): value is string {
  return (
    typeof value === 'string' &&
    value.trim() === value &&
    value.length > 0 &&
    value.length <= maxLength &&
    !SINGLE_LINE_CONTROL_TEST_PATTERN.test(value)
  );
}

function isOptionalPositiveNumber(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value) && value >= 0);
}

function isGeneratedPostImageVariant(value: unknown): value is GeneratedPostImageItem['variantWebp'] {
  if (value === undefined || value === null) return true;
  if (!value || typeof value !== 'object') return false;
  const record = value as NonNullable<GeneratedPostImageItem['variantWebp']>;
  return (
    isSafeImageFilename(record.filename) &&
    isSafeImagePath(record.path) &&
    isSafeImagePath(record.url) &&
    isOptionalPositiveNumber(record.width) &&
    isOptionalPositiveNumber(record.sizeBytes)
  );
}

function isGeneratedPostImageItem(value: unknown): value is GeneratedPostImageItem {
  if (!value || typeof value !== 'object') return false;
  const record = value as GeneratedPostImageItem;
  return (
    isSafeImageFilename(record.filename) &&
    isSafeImagePath(record.path) &&
    isSafeImagePath(record.url) &&
    isSafeGeneratedText(record.alt, MAX_AI_IMAGE_ALT_LENGTH) &&
    isSafeGeneratedText(record.markdown, 1024) &&
    record.markdown.includes(record.url) &&
    record.source === 'ai-generated' &&
    isGeneratedPostImageVariant(record.variantWebp) &&
    isOptionalPositiveNumber(record.width) &&
    isOptionalPositiveNumber(record.height) &&
    isOptionalPositiveNumber(record.sizeBytes)
  );
}

function isGeneratePostImagesResponse(
  value: unknown,
): value is GeneratePostImagesResponse {
  if (!value || typeof value !== 'object') return false;
  const record = value as GeneratePostImagesResponse;
  return (
    isSafeImagePath(record.dir) &&
    isSafeGeneratedText(record.model, 200) &&
    typeof record.created === 'number' &&
    Number.isFinite(record.created) &&
    record.created >= 0 &&
    typeof record.durationMs === 'number' &&
    Number.isFinite(record.durationMs) &&
    record.durationMs >= 0 &&
    Array.isArray(record.items) &&
    record.items.every(isGeneratedPostImageItem)
  );
}

function isAdminAiImagesHealth(value: unknown): value is AdminAiImagesHealth {
  if (!value || typeof value !== 'object') return false;
  const record = value as AdminAiImagesHealth;
  return (
    typeof record.enabled === 'boolean' &&
    typeof record.configured === 'boolean' &&
    typeof record.baseUrlConfigured === 'boolean' &&
    typeof record.apiKeyConfigured === 'boolean' &&
    (record.model === null || isSafeGeneratedText(record.model, 200)) &&
    typeof record.maxCount === 'number' &&
    Number.isFinite(record.maxCount) &&
    record.maxCount >= 0 &&
    typeof record.timeoutMs === 'number' &&
    Number.isFinite(record.timeoutMs) &&
    record.timeoutMs >= 0
  );
}

export async function generatePostImages(
  payload: GeneratePostImagesPayload,
  _token?: string,
): Promise<GeneratePostImagesResponse> {
  const normalizedPayload = normalizeGeneratePostImagesPayload(payload);
  const base = getApiBaseUrl();
  const response = await adminFetchRaw(`${base}/api/v1/admin/ai-images/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': createIdempotencyKey(),
    },
    body: JSON.stringify({
      ...normalizedPayload,
    }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json?.ok) {
    throw new Error(getErrorMessage(json, 'Failed to generate image'));
  }
  if (!isGeneratePostImagesResponse(json.data)) {
    throw new Error('AI image generation returned an invalid response');
  }
  return json.data;
}

export async function getAdminAiImagesHealth(
  _token?: string,
): Promise<AdminAiImagesHealth> {
  const base = getApiBaseUrl();
  const response = await adminFetchRaw(`${base}/api/v1/admin/ai-images/health`);
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json?.ok) {
    throw new Error(getErrorMessage(json, 'Failed to load AI image health'));
  }
  if (!isAdminAiImagesHealth(json.data)) {
    throw new Error('AI image health returned an invalid response');
  }
  return json.data;
}
