import { queryAll, queryOne } from "../lib/d1.js";

export const MEMORY_EMBEDDING_STREAM = "memory.embedding";

export async function getDomainOutboxSummary(stream = MEMORY_EMBEDDING_STREAM) {
  const counts = await queryAll(
    `SELECT status, COUNT(*) as count
       FROM domain_outbox
      WHERE stream = ?
      GROUP BY status`,
    stream,
  );

  const oldestPending = await queryOne(
    `SELECT created_at
       FROM domain_outbox
      WHERE stream = ?
        AND status = 'pending'
      ORDER BY created_at ASC
      LIMIT 1`,
    stream,
  );

  const oldestDeadLetter = await queryOne(
    `SELECT created_at
       FROM domain_outbox
      WHERE stream = ?
        AND status = 'dead_letter'
      ORDER BY created_at ASC
      LIMIT 1`,
    stream,
  );

  const summary = {
    stream,
    pending: 0,
    processing: 0,
    processed: 0,
    deadLetter: 0,
    oldestPendingAt: oldestPending?.created_at ?? null,
    oldestDeadLetterAt: oldestDeadLetter?.created_at ?? null,
  };

  for (const row of counts) {
    if (row.status === "pending") summary.pending = row.count;
    if (row.status === "processing") summary.processing = row.count;
    if (row.status === "processed") summary.processed = row.count;
    if (row.status === "dead_letter") summary.deadLetter = row.count;
  }

  return summary;
}

export async function listStuckDomainOutboxEvents({
  stream = MEMORY_EMBEDDING_STREAM,
  olderThanMinutes = 15,
  limit = 25,
} = {}) {
  const safeMinutes = Math.max(
    1,
    Math.min(24 * 60, Number(olderThanMinutes) || 15),
  );
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 25));
  const cutoff = new Date(Date.now() - safeMinutes * 60_000).toISOString();

  return queryAll(
    `SELECT id, stream, aggregate_id, event_type, status, retry_count,
            created_at, available_at, last_attempt_at, processed_at, last_error
       FROM domain_outbox
      WHERE stream = ?
        AND (
          status = 'dead_letter'
          OR (
            status = 'processing'
            AND COALESCE(last_attempt_at, created_at) <= ?
          )
          OR (
            status = 'pending'
            AND retry_count > 0
            AND COALESCE(last_attempt_at, created_at) <= ?
          )
        )
      ORDER BY COALESCE(last_attempt_at, created_at) ASC
      LIMIT ?`,
    stream,
    cutoff,
    cutoff,
    safeLimit,
  );
}

export async function findMemoryEmbeddingConsistencyGaps(limit = 25) {
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 25));

  return queryAll(
    `SELECT id, user_id, memory_type, category, is_active, updated_at
       FROM user_memories AS memories
      WHERE (
        memories.is_active = 1
        AND NOT EXISTS (
          SELECT 1
            FROM domain_outbox AS outbox
           WHERE outbox.stream = ?
             AND outbox.aggregate_id = memories.id
             AND outbox.event_type = 'memory.embedding.upsert'
             AND outbox.status = 'processed'
             AND outbox.created_at >= memories.updated_at
        )
      ) OR (
        memories.is_active = 0
        AND NOT EXISTS (
          SELECT 1
            FROM domain_outbox AS outbox
           WHERE outbox.stream = ?
             AND outbox.aggregate_id = memories.id
             AND outbox.event_type = 'memory.embedding.delete'
             AND outbox.status = 'processed'
             AND outbox.created_at >= memories.updated_at
        )
      )
      ORDER BY memories.updated_at DESC
      LIMIT ?`,
    MEMORY_EMBEDDING_STREAM,
    MEMORY_EMBEDDING_STREAM,
    safeLimit,
  );
}
