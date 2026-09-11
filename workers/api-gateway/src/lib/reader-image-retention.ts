import type { Env } from '../types';
import { IMAGE_RETENTION_MS } from './reader-image-policy';
export async function cleanupReaderImages(env: Env, now = Date.now()) {
  if (!env.READER_IMAGES_R2) return 0;
  // Include unknown/failed rows: a successful R2 write may precede a failed D1 finalize.
  const rows = await env.DB.prepare(`SELECT id, owner FROM reader_image_jobs
    WHERE created_at < ? AND object_deleted_at IS NULL ORDER BY created_at LIMIT 200`)
    .bind(now - IMAGE_RETENTION_MS).all<{id: string; owner: string}>();
  for (const row of rows.results || []) {
    await env.READER_IMAGES_R2.delete(`private/reader-images/${row.owner}/${row.id}.png`);
    await env.DB.prepare('UPDATE reader_image_jobs SET result_json = NULL, object_deleted_at = ? WHERE id = ?')
      .bind(now, row.id).run();
  }
  // Tombstones survive for 30 days; never delete the last pointer to an uncollected object.
  await env.DB.prepare('DELETE FROM reader_image_jobs WHERE created_at < ? AND object_deleted_at IS NOT NULL')
    .bind(now - 30 * 86400000).run();
  return rows.results?.length || 0;
}
