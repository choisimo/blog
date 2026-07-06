import {
  HOME_AI_CTA_BLOCK_KEY,
  type SiteContentBlock,
  type SiteContentBlockDraft,
  type SiteContentBlockKey,
} from './types';
import { adminApiFetch } from '@/services/admin/apiClient';
import { getApiBaseUrl } from '@/utils/network/apiBase';

type SiteContentBlockResponse = {
  block: SiteContentBlock;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function normalizeSiteContentKey(value: unknown): SiteContentBlockKey | null {
  return value === HOME_AI_CTA_BLOCK_KEY ? HOME_AI_CTA_BLOCK_KEY : null;
}

function decodeSiteContentValue(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

const CTA_HREF_UNSAFE_CHAR_PATTERN = /[\u0000-\u001F\u007F\\]/;

function hasUnsafeLineOrPathChars(value: string): boolean {
  const decoded = decodeSiteContentValue(value);
  return !decoded || [value, decoded].some(candidate => CTA_HREF_UNSAFE_CHAR_PATTERN.test(candidate));
}

function normalizeCtaLabel(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const cleaned = value.replace(/[\r\n]+/g, ' ').trim();
  return cleaned || null;
}

function normalizeCtaHref(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (!trimmed || hasUnsafeLineOrPathChars(trimmed)) return null;
  if (trimmed.startsWith('//')) return null;
  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('?') ||
    trimmed.startsWith('#')
  ) {
    return trimmed;
  }
  if (/^https:\/\/[^\s]+$/.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return parsed.username || parsed.password ? null : trimmed;
    } catch {
      return null;
    }
  }
  return null;
}

function isSiteContentBlock(value: unknown): value is SiteContentBlock {
  if (!isRecord(value)) return false;

  return (
    value.key === HOME_AI_CTA_BLOCK_KEY &&
    typeof value.markdown === 'string' &&
    isNullableString(value.ctaLabel) &&
    isNullableString(value.ctaHref) &&
    typeof value.enabled === 'boolean' &&
    isNullableString(value.updatedAt)
  );
}

function normalizeSiteContentBlock(block: SiteContentBlock): SiteContentBlock {
  return {
    ...block,
    ctaLabel: normalizeCtaLabel(block.ctaLabel),
    ctaHref: normalizeCtaHref(block.ctaHref),
  };
}

function parseSiteContentBlockResponse(
  value: unknown
): SiteContentBlock | null {
  if (!isRecord(value)) return null;
  return isSiteContentBlock(value.block)
    ? normalizeSiteContentBlock(value.block)
    : null;
}

type SiteContentEnvelope = {
  data?: SiteContentBlockResponse;
};

function parseSiteContentEnvelope(value: unknown): SiteContentBlock | null {
  if (!isRecord(value)) return null;
  return parseSiteContentBlockResponse(value.data);
}

export async function getSiteContentBlock(
  key: SiteContentBlockKey
): Promise<SiteContentBlock | null> {
  const safeKey = normalizeSiteContentKey(key);
  if (!safeKey) return null;

  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/site-content/${safeKey}`, {
      cache: 'no-cache',
    });
    if (!response.ok) return null;
    const json = (await response.json()) as SiteContentEnvelope;
    return parseSiteContentEnvelope(json);
  } catch {
    return null;
  }
}

export async function getAdminSiteContentBlock(
  key: SiteContentBlockKey
): Promise<SiteContentBlock | null> {
  const safeKey = normalizeSiteContentKey(key);
  if (!safeKey) {
    throw new Error('Invalid site content block key');
  }

  const result = await adminApiFetch<SiteContentBlockResponse>(
    `/admin/${safeKey}`,
    {
      pathPrefix: '/api/v1/site-content',
    }
  );
  if (!result.ok) {
    throw new Error(result.error || 'Failed to load site content block');
  }
  return parseSiteContentBlockResponse(result.data);
}

export async function saveSiteContentBlock(
  key: SiteContentBlockKey,
  draft: SiteContentBlockDraft
): Promise<SiteContentBlock> {
  const safeKey = normalizeSiteContentKey(key);
  if (!safeKey) {
    throw new Error('Invalid site content block key');
  }

  const safeCtaHref =
    draft.ctaHref === undefined ? undefined : normalizeCtaHref(draft.ctaHref);
  if (draft.ctaHref !== undefined && draft.ctaHref && !safeCtaHref) {
    throw new Error('Invalid site content CTA href');
  }

  const safeDraft: SiteContentBlockDraft = {
    ...draft,
    ...(draft.ctaLabel !== undefined
      ? { ctaLabel: normalizeCtaLabel(draft.ctaLabel) }
      : {}),
    ...(draft.ctaHref !== undefined ? { ctaHref: safeCtaHref } : {}),
  };

  const result = await adminApiFetch<SiteContentBlockResponse>(
    `/admin/${safeKey}`,
    {
      pathPrefix: '/api/v1/site-content',
      method: 'PUT',
      body: safeDraft,
    }
  );
  const block = parseSiteContentBlockResponse(result.data);
  if (!result.ok || !block) {
    throw new Error(result.error || 'Failed to save site content block');
  }
  return block;
}
