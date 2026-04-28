import type {
  SiteContentBlock,
  SiteContentBlockKey,
  SiteContentBlockRecord,
} from '../../domain/site-content/types';
import { DEFAULT_SITE_CONTENT_BLOCKS } from '../../domain/site-content/types';
import type { SiteContentRepository } from '../../ports/site-content/SiteContentRepository';

export function mapSiteContentRecord(record: SiteContentBlockRecord): SiteContentBlock {
  return {
    key: record.key,
    markdown: record.markdown,
    ctaLabel: record.cta_label,
    ctaHref: record.cta_href,
    enabled: record.enabled === 1,
    updatedAt: record.updated_at,
  };
}

export async function getSiteContentBlock(
  repository: SiteContentRepository,
  key: SiteContentBlockKey
): Promise<SiteContentBlock> {
  const record = await repository.getBlock(key);
  if (!record) {
    return DEFAULT_SITE_CONTENT_BLOCKS[key];
  }
  return mapSiteContentRecord(record);
}
