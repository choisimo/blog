import type { BlogPost, BlogTag } from '@/types/blog';
import type { SiteContentBlock } from '@/services/content/site-content';

export type HomeSectionLoadState = 'loading' | 'ready' | 'error';

export interface HomeCategorySummary {
  name: string;
  count: number;
}

export interface HomeEditorPicksSectionProps {
  posts: BlogPost[];
  state: HomeSectionLoadState;
  notice: string | null;
  isTerminal: boolean;
}

export interface HomeCategoryStripProps {
  categories: HomeCategorySummary[];
  state: HomeSectionLoadState;
  isTerminal: boolean;
}

export interface HomeLatestPostsSectionProps {
  posts: BlogPost[];
  tags: BlogTag[];
  state: HomeSectionLoadState;
  error: string | null;
  isTerminal: boolean;
}

export interface HomeMarkdownCtaProps {
  block: SiteContentBlock | null;
  state: HomeSectionLoadState;
  isTerminal: boolean;
}
