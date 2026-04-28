import type { SiteContentRepository } from '../../ports/site-content/SiteContentRepository';
import type {
  SiteContentBlockDraft,
  SiteContentBlockKey,
  SiteContentBlockRecord,
} from '../../domain/site-content/types';
import { queryOne } from '../../lib/d1';

export function createD1SiteContentRepository(db: D1Database): SiteContentRepository {
  return {
    async getBlock(key: SiteContentBlockKey): Promise<SiteContentBlockRecord | null> {
      return queryOne<SiteContentBlockRecord>(
        db,
        `SELECT key, markdown, cta_label, cta_href, enabled, created_at, updated_at, changed_by
         FROM site_content_blocks
         WHERE key = ?`,
        key
      );
    },

    async saveBlock(
      key: SiteContentBlockKey,
      draft: SiteContentBlockDraft
    ): Promise<SiteContentBlockRecord> {
      const enabled = draft.enabled === false ? 0 : 1;
      const changedBy = draft.changedBy ?? null;

      await db
        .prepare(
          `INSERT INTO site_content_blocks (
             key, markdown, cta_label, cta_href, enabled, changed_by, created_at, updated_at
           )
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
           ON CONFLICT(key)
           DO UPDATE SET
             markdown = excluded.markdown,
             cta_label = excluded.cta_label,
             cta_href = excluded.cta_href,
             enabled = excluded.enabled,
             changed_by = excluded.changed_by,
             updated_at = datetime('now')`
        )
        .bind(
          key,
          draft.markdown,
          draft.ctaLabel ?? null,
          draft.ctaHref ?? null,
          enabled,
          changedBy
        )
        .run();

      const saved = await this.getBlock(key);
      if (!saved) {
        throw new Error(`site content block save failed for ${key}`);
      }
      return saved;
    },
  };
}
