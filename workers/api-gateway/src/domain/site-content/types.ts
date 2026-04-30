export const HOME_AI_CTA_BLOCK_KEY = 'home_ai_cta' as const;

export type SiteContentBlockKey = typeof HOME_AI_CTA_BLOCK_KEY;

export const SITE_CONTENT_BLOCK_KEYS = [HOME_AI_CTA_BLOCK_KEY] as const;

export const DEFAULT_SITE_CONTENT_BLOCKS: Record<SiteContentBlockKey, SiteContentBlock> = {
  [HOME_AI_CTA_BLOCK_KEY]: {
    key: HOME_AI_CTA_BLOCK_KEY,
    markdown:
      '### AI Chat & Writing Assistant\n\n아이디어를 정리하고, 글을 작성하고, 코드 설계를 함께 다듬어보세요.',
    ctaLabel: 'AI 도구 열기',
    ctaHref: '/?ai=chat',
    enabled: true,
    updatedAt: null,
  },
};

export interface SiteContentBlockRecord {
  key: SiteContentBlockKey;
  markdown: string;
  cta_label: string | null;
  cta_href: string | null;
  enabled: number;
  created_at: string;
  updated_at: string;
  changed_by: string | null;
}

export interface SiteContentBlock {
  key: SiteContentBlockKey;
  markdown: string;
  ctaLabel: string | null;
  ctaHref: string | null;
  enabled: boolean;
  updatedAt: string | null;
}

export interface SiteContentBlockDraft {
  markdown: string;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  enabled?: boolean;
  changedBy?: string | null;
}

export function parseSiteContentBlockKey(value: string): SiteContentBlockKey | null {
  return SITE_CONTENT_BLOCK_KEYS.includes(value as SiteContentBlockKey)
    ? (value as SiteContentBlockKey)
    : null;
}
