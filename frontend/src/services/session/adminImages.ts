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

function createIdempotencyKey(): string {
  const randomId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `admin-ai-image:${randomId}`;
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const record = payload as { error?: unknown; message?: unknown };
  if (typeof record.error === 'string') return record.error;
  if (record.error && typeof record.error === 'object') {
    const nested = record.error as { message?: unknown; code?: unknown };
    if (typeof nested.message === 'string') return nested.message;
    if (typeof nested.code === 'string') return nested.code;
  }
  if (typeof record.message === 'string') return record.message;
  return fallback;
}

export async function generatePostImages(
  payload: GeneratePostImagesPayload,
  _token?: string,
): Promise<GeneratePostImagesResponse> {
  const base = getApiBaseUrl();
  const response = await adminFetchRaw(`${base}/api/v1/admin/ai-images/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': createIdempotencyKey(),
    },
    body: JSON.stringify({
      ...payload,
      year: String(payload.year),
      n: payload.n ?? 1,
      size: payload.size ?? '1024x1024',
      quality: payload.quality ?? 'medium',
      outputFormat: payload.outputFormat ?? 'png',
    }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json?.ok) {
    throw new Error(getErrorMessage(json, 'Failed to generate image'));
  }
  return json.data as GeneratePostImagesResponse;
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
  return json.data as AdminAiImagesHealth;
}
