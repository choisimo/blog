import type {
  SiteContentBlockDraft,
  SiteContentBlockKey,
  SiteContentBlockRecord,
} from '../../domain/site-content/types';

export interface SiteContentRepository {
  getBlock(key: SiteContentBlockKey): Promise<SiteContentBlockRecord | null>;
  saveBlock(
    key: SiteContentBlockKey,
    draft: SiteContentBlockDraft
  ): Promise<SiteContentBlockRecord>;
}
