import { GUEST_IMAGE_LIMIT, IMAGE_COUNTED_STATES } from './reader-image-policy';
export type ImageJob = {
  id: string; owner: string; network_key: string; day: string; input_hash: string;
  state: 'reserved' | 'complete' | 'failed' | 'unknown';
  created_at: number; updated_at: number; result_json: string | null; error_code: string | null;
};
export async function findImageJob(db: D1Database, id: string, owner: string) {
  return db.prepare('SELECT * FROM reader_image_jobs WHERE id = ? AND owner = ?')
    .bind(id, owner).first<ImageJob>();
}
export async function imageUsage(db: D1Database, owner: string, network: string, day: string, member: boolean) {
  const row = await db.prepare(`SELECT
    SUM(CASE WHEN owner = ? AND state IN (${IMAGE_COUNTED_STATES}) THEN 1 ELSE 0 END) AS own,
    SUM(CASE WHEN network_key = ? AND state IN (${IMAGE_COUNTED_STATES}) THEN 1 ELSE 0 END) AS network
    FROM reader_image_jobs WHERE day = ? AND (owner = ? OR network_key = ?)`)
    .bind(owner, network, day, owner, network).first<{own: number; network: number}>();
  return { used: Number(row?.own || 0), networkUsed: member ? 0 : Number(row?.network || 0) };
}
// A single conditional INSERT runs atomically in D1/SQLite. Checking then inserting
// in two requests would overrun the budget with simultaneous browser tabs.
export async function reserveImageJob(db: D1Database, input: {
  id: string; owner: string; network: string; day: string; hash: string;
  limit: number; globalLimit: number; member: boolean; now: number;
}) {
  const { id, owner, network, day, hash, limit, globalLimit, member, now } = input;
  const result = await db.prepare(`INSERT OR IGNORE INTO reader_image_jobs
    (id, owner, network_key, day, input_hash, state, created_at, updated_at)
    SELECT ?, ?, ?, ?, ?, 'reserved', ?, ?
    WHERE (SELECT COUNT(*) FROM reader_image_jobs WHERE owner = ? AND day = ? AND state IN (${IMAGE_COUNTED_STATES})) < ?
    AND (? = 1 OR (SELECT COUNT(*) FROM reader_image_jobs WHERE network_key = ? AND day = ? AND state IN (${IMAGE_COUNTED_STATES})) < ?)
    AND (SELECT COUNT(*) FROM reader_image_jobs WHERE day = ? AND state IN (${IMAGE_COUNTED_STATES})) < ?
    AND (SELECT COUNT(*) FROM reader_image_jobs WHERE (owner = ? OR network_key = ?) AND created_at > ?) < 5`)
    .bind(id, owner, network, day, hash, now, now,
      owner, day, limit, member ? 1 : 0, network, day, GUEST_IMAGE_LIMIT,
      day, globalLimit, owner, network, now - 60000).run();
  return Number(result.meta.changes || 0) === 1;
}
export async function finishImageJob(db: D1Database, id: string,
  state: 'complete' | 'failed' | 'unknown', result: unknown = null, errorCode: string | null = null) {
  return db.prepare(`UPDATE reader_image_jobs SET state = ?, result_json = ?, error_code = ?, updated_at = ?
    WHERE id = ? AND state = 'reserved'`).bind(state, result ? JSON.stringify(result) : null,
      errorCode, Date.now(), id).run();
}
