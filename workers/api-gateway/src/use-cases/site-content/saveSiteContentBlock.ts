import type {
  SiteContentBlock,
  SiteContentBlockDraft,
  SiteContentBlockKey,
} from '../../domain/site-content/types';
import type { SiteContentRepository } from '../../ports/site-content/SiteContentRepository';
import { mapSiteContentRecord } from './getSiteContentBlock';

const MAX_MARKDOWN_LENGTH = 20_000;
const MAX_CTA_LABEL_LENGTH = 80;
const MAX_CTA_HREF_LENGTH = 2_048;

export class SiteContentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SiteContentValidationError';
  }
}

function normalizeOptionalText(
  value: unknown,
  maxLength: number,
  fieldName: string
): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new SiteContentValidationError(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) {
    throw new SiteContentValidationError(`${fieldName} is too long`);
  }
  return trimmed;
}

function isSafeCtaHref(value: string): boolean {
  return (
    /^\/(?!\/)/.test(value) ||
    value.startsWith('#') ||
    value.startsWith('https://') ||
    value.startsWith('http://') ||
    value.startsWith('mailto:')
  );
}

function normalizeDraft(draft: SiteContentBlockDraft): SiteContentBlockDraft {
  if (typeof draft.markdown !== 'string') {
    throw new SiteContentValidationError('markdown must be a string');
  }

  const markdown = draft.markdown.trim();
  if (!markdown) {
    throw new SiteContentValidationError('markdown is required');
  }
  if (markdown.length > MAX_MARKDOWN_LENGTH) {
    throw new SiteContentValidationError('markdown is too long');
  }

  const ctaLabel = normalizeOptionalText(draft.ctaLabel, MAX_CTA_LABEL_LENGTH, 'ctaLabel');
  const ctaHref = normalizeOptionalText(draft.ctaHref, MAX_CTA_HREF_LENGTH, 'ctaHref');

  if (ctaHref && !isSafeCtaHref(ctaHref)) {
    throw new SiteContentValidationError(
      'ctaHref must be an http(s), mailto, hash, or root-relative URL'
    );
  }

  return {
    markdown,
    ctaLabel,
    ctaHref,
    enabled: draft.enabled !== false,
    changedBy: normalizeOptionalText(draft.changedBy, 256, 'changedBy'),
  };
}

export async function saveSiteContentBlock(
  repository: SiteContentRepository,
  key: SiteContentBlockKey,
  draft: SiteContentBlockDraft
): Promise<SiteContentBlock> {
  const normalized = normalizeDraft(draft);
  const record = await repository.saveBlock(key, normalized);
  return mapSiteContentRecord(record);
}
