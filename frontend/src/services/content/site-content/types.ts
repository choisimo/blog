export const HOME_AI_CTA_BLOCK_KEY = 'home_ai_cta' as const;

export type SiteContentBlockKey = typeof HOME_AI_CTA_BLOCK_KEY;

export const DEFAULT_HOME_AI_CTA_BLOCK: SiteContentBlock = {
  key: HOME_AI_CTA_BLOCK_KEY,
  markdown:
    '### AI Chat & Writing Assistant\n\n아이디어를 정리하고, 글을 작성하고, 코드 설계를 함께 다듬어보세요.',
  ctaLabel: 'AI 도구 열기',
  ctaHref: '/?ai=chat',
  enabled: true,
  updatedAt: null,
};

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
}
