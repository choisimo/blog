import { execute, queryAll, queryOne } from './d1';

export type DomainOutboxStatus = 'pending' | 'processing' | 'processed' | 'dead_letter';

export type DomainOutboxEvent<TPayload = unknown> = {
  id: string;
  stream: string;
  aggregateId: string;
  eventType: string;
  payload: TPayload;
  idempotencyKey: string | null;
  status: DomainOutboxStatus;
  retryCount: number;
  createdAt: string;
  availableAt: string;
  lastAttemptAt: string | null;
  processedAt: string | null;
  lastError: string | null;
};

type DomainOutboxRow = {
  id: string;
  stream: string;
  aggregate_id: string;
  event_type: string;
  payload: string;
  idempotency_key: string | null;
  status: DomainOutboxStatus;
  retry_count: number;
  created_at: string;
  available_at: string;
  last_attempt_at: string | null;
  processed_at: string | null;
  last_error: string | null;
};

type AppendDomainOutboxInput<TPayload> = {
  stream: string;
  aggregateId: string;
  eventType: string;
  payload: TPayload;
  idempotencyKey?: string | null;
  availableAt?: string;
};

type ListDomainOutboxInput = {
  stream?: string;
  status?: DomainOutboxStatus;
  limit?: number;
};

type ClaimDomainOutboxInput = {
  stream: string;
  limit?: number;
  now?: string;
};

type FailDomainOutboxInput = {
  id: string;
  lastError: string;
  now?: string;
  maxRetries?: number;
  retryDelayMs?: number;
};

type ListStuckDomainOutboxInput = {
  stream: string;
  olderThanMinutes?: number;
  limit?: number;
};

type DomainOutboxStatusCountRow = {
  status: DomainOutboxStatus;
  count: number;
};

export type DomainOutboxSummary = {
  stream: string;
  pending: number;
  processing: number;
  processed: number;
  deadLetter: number;
  oldestPendingAt: string | null;
  oldestDeadLetterAt: string | null;
};

const schemaInit = new WeakMap<D1Database, Promise<void>>();

function normalizeLimit(limit?: number) {
  const safe = Math.trunc(limit ?? 100);
  return Math.max(1, Math.min(200, safe));
}

function parsePayload(payload: string) {
  try {
    return JSON.parse(payload);
  } catch {
    return payload;
  }
}

function mapRow(row: DomainOutboxRow): DomainOutboxEvent {
  return {
    id: row.id,
    stream: row.stream,
    aggregateId: row.aggregate_id,
    eventType: row.event_type,
    payload: parsePayload(row.payload),
    idempotencyKey: row.idempotency_key,
    status: row.status,
    retryCount: row.retry_count,
    createdAt: row.created_at,
    availableAt: row.available_at,
    lastAttemptAt: row.last_attempt_at,
    processedAt: row.processed_at,
    lastError: row.last_error,
  };
}

export function computeDomainOutboxBackoffMs(retryCount: number) {
  const attempt = Math.max(1, retryCount);
  return Math.min(300_000, 5_000 * 2 ** (attempt - 1));
}

export async function ensureDomainOutboxSchema(db: D1Database) {
  const existing = schemaInit.get(db);
  if (existing) {
    await existing;
    return;
  }

  const initPromise = (async () => {
    await execute(
      db,
      `CREATE TABLE IF NOT EXISTS domain_outbox (
         id TEXT PRIMARY KEY,
         stream TEXT NOT NULL,
         aggregate_id TEXT NOT NULL,
         event_type TEXT NOT NULL,
         payload TEXT NOT NULL,
         idempotency_key TEXT,
         status TEXT NOT NULL DEFAULT 'pending',
         retry_count INTEGER NOT NULL DEFAULT 0,
         created_at TEXT NOT NULL,
         available_at TEXT NOT NULL,
         last_attempt_at TEXT,
         processed_at TEXT,
         last_error TEXT
       )`
    );
    await execute(
      db,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_domain_outbox_idempotency
         ON domain_outbox (stream, idempotency_key)
       WHERE idempotency_key IS NOT NULL`
    );
    await execute(
      db,
      `CREATE INDEX IF NOT EXISTS idx_domain_outbox_pending
         ON domain_outbox (stream, status, available_at, created_at)`
    );
    await execute(
      db,
      `CREATE INDEX IF NOT EXISTS idx_domain_outbox_aggregate
         ON domain_outbox (stream, aggregate_id, created_at DESC)`
    );
  })();

  schemaInit.set(db, initPromise);
  try {
    await initPromise;
  } catch (error) {
    schemaInit.delete(db);
    throw error;
  }
}

export async function appendDomainOutboxEvent<TPayload>(
  db: D1Database,
  input: AppendDomainOutboxInput<TPayload>
): Promise<DomainOutboxEvent<TPayload>> {
  await ensureDomainOutboxSchema(db);

  const id = `outbox-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const availableAt = input.availableAt || now;
  const payload = JSON.stringify(input.payload);

  await execute(
    db,
    `INSERT INTO domain_outbox (
       id, stream, aggregate_id, event_type, payload, idempotency_key,
       status, retry_count, created_at, available_at, last_attempt_at,
       processed_at, last_error
     ) VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, NULL, NULL, NULL)`,
    id,
    input.stream,
    input.aggregateId,
    input.eventType,
    payload,
    input.idempotencyKey ?? null,
    now,
    availableAt
  );

  return {
    id,
    stream: input.stream,
    aggregateId: input.aggregateId,
    eventType: input.eventType,
    payload: input.payload,
    idempotencyKey: input.idempotencyKey ?? null,
    status: 'pending',
    retryCount: 0,
    createdAt: now,
    availableAt,
    lastAttemptAt: null,
    processedAt: null,
    lastError: null,
  };
}

export async function listDomainOutboxEvents(
  db: D1Database,
  input: ListDomainOutboxInput = {}
): Promise<DomainOutboxEvent[]> {
  await ensureDomainOutboxSchema(db);

  const where: string[] = [];
  const params: unknown[] = [];

  if (input.stream) {
    where.push('stream = ?');
    params.push(input.stream);
  }

  if (input.status) {
    where.push('status = ?');
    params.push(input.status);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = await queryAll<DomainOutboxRow>(
    db,
    `SELECT id, stream, aggregate_id, event_type, payload, idempotency_key,
            status, retry_count, created_at, available_at, last_attempt_at,
            processed_at, last_error
       FROM domain_outbox
       ${whereSql}
      ORDER BY created_at ASC
      LIMIT ?`,
    ...params,
    normalizeLimit(input.limit)
  );

  return rows.map(mapRow);
}

export async function getDomainOutboxEvent(
  db: D1Database,
  id: string
): Promise<DomainOutboxEvent | null> {
  await ensureDomainOutboxSchema(db);

  const row = await queryOne<DomainOutboxRow>(
    db,
    `SELECT id, stream, aggregate_id, event_type, payload, idempotency_key,
            status, retry_count, created_at, available_at, last_attempt_at,
            processed_at, last_error
       FROM domain_outbox
      WHERE id = ?`,
    id
  );

  return row ? mapRow(row) : null;
}

export async function markDomainOutboxProcessed(db: D1Database, id: string) {
  await ensureDomainOutboxSchema(db);

  await execute(
    db,
    `UPDATE domain_outbox
        SET status = 'processed',
            processed_at = ?,
            last_attempt_at = ?,
            last_error = NULL
      WHERE id = ?`,
    new Date().toISOString(),
    new Date().toISOString(),
    id
  );
}

export async function markDomainOutboxPending(
  db: D1Database,
  id: string,
  lastError?: string | null
) {
  await ensureDomainOutboxSchema(db);

  await execute(
    db,
    `UPDATE domain_outbox
        SET status = 'pending',
            last_attempt_at = ?,
            last_error = ?
      WHERE id = ?`,
    new Date().toISOString(),
    lastError ?? null,
    id
  );
}

export async function claimDomainOutboxEvents(
  db: D1Database,
  input: ClaimDomainOutboxInput
): Promise<DomainOutboxEvent[]> {
  await ensureDomainOutboxSchema(db);

  const now = input.now || new Date().toISOString();
  const rows = await queryAll<DomainOutboxRow>(
    db,
    `SELECT id, stream, aggregate_id, event_type, payload, idempotency_key,
            status, retry_count, created_at, available_at, last_attempt_at,
            processed_at, last_error
       FROM domain_outbox
      WHERE stream = ?
        AND status = 'pending'
        AND available_at <= ?
      ORDER BY created_at ASC
      LIMIT ?`,
    input.stream,
    now,
    normalizeLimit(input.limit)
  );

  const claimed: DomainOutboxEvent[] = [];
  for (const row of rows) {
    const result = await execute(
      db,
      `UPDATE domain_outbox
          SET status = 'processing',
              last_attempt_at = ?
        WHERE id = ?
          AND status = 'pending'
          AND available_at <= ?`,
      now,
      row.id,
      now
    );

    if ((result.meta?.changes || 0) > 0) {
      claimed.push(
        mapRow({
          ...row,
          status: 'processing',
          last_attempt_at: now,
        })
      );
    }
  }

  return claimed;
}

export async function markDomainOutboxFailed(db: D1Database, input: FailDomainOutboxInput) {
  await ensureDomainOutboxSchema(db);

  const row = await queryOne<Pick<DomainOutboxRow, 'id' | 'retry_count'>>(
    db,
    `SELECT id, retry_count
       FROM domain_outbox
      WHERE id = ?`,
    input.id
  );

  if (!row) {
    return { status: 'missing' as const, retryCount: 0 };
  }

  const now = input.now || new Date().toISOString();
  const retryCount = row.retry_count + 1;
  const maxRetries = Math.max(1, input.maxRetries ?? 5);
  const retryDelayMs = input.retryDelayMs ?? computeDomainOutboxBackoffMs(retryCount);
  const nextStatus: DomainOutboxStatus = retryCount >= maxRetries ? 'dead_letter' : 'pending';
  const availableAt =
    nextStatus === 'dead_letter' ? now : new Date(Date.parse(now) + retryDelayMs).toISOString();

  await execute(
    db,
    `UPDATE domain_outbox
        SET status = ?,
            retry_count = ?,
            available_at = ?,
            last_attempt_at = ?,
            last_error = ?,
            processed_at = CASE WHEN ? = 'dead_letter' THEN NULL ELSE processed_at END
      WHERE id = ?`,
    nextStatus,
    retryCount,
    availableAt,
    now,
    input.lastError,
    nextStatus,
    input.id
  );

  return {
    status: nextStatus,
    retryCount,
    availableAt,
  };
}

export async function replayDomainOutboxEvent(db: D1Database, id: string) {
  await ensureDomainOutboxSchema(db);

  const now = new Date().toISOString();
  await execute(
    db,
    `UPDATE domain_outbox
        SET status = 'pending',
            retry_count = 0,
            available_at = ?,
            last_attempt_at = NULL,
            processed_at = NULL,
            last_error = NULL
      WHERE id = ?`,
    now,
    id
  );
}

export async function getDomainOutboxSummary(
  db: D1Database,
  stream: string
): Promise<DomainOutboxSummary> {
  await ensureDomainOutboxSchema(db);

  const counts = await queryAll<DomainOutboxStatusCountRow>(
    db,
    `SELECT status, COUNT(*) as count
       FROM domain_outbox
      WHERE stream = ?
      GROUP BY status`,
    stream
  );

  const oldestPending = await queryOne<{ created_at: string }>(
    db,
    `SELECT created_at
       FROM domain_outbox
      WHERE stream = ?
        AND status = 'pending'
      ORDER BY created_at ASC
      LIMIT 1`,
    stream
  );

  const oldestDeadLetter = await queryOne<{ created_at: string }>(
    db,
    `SELECT created_at
       FROM domain_outbox
      WHERE stream = ?
        AND status = 'dead_letter'
      ORDER BY created_at ASC
      LIMIT 1`,
    stream
  );

  const summary: DomainOutboxSummary = {
    stream,
    pending: 0,
    processing: 0,
    processed: 0,
    deadLetter: 0,
    oldestPendingAt: oldestPending?.created_at ?? null,
    oldestDeadLetterAt: oldestDeadLetter?.created_at ?? null,
  };

  for (const row of counts) {
    if (row.status === 'pending') summary.pending = row.count;
    if (row.status === 'processing') summary.processing = row.count;
    if (row.status === 'processed') summary.processed = row.count;
    if (row.status === 'dead_letter') summary.deadLetter = row.count;
  }

  return summary;
}

export async function listStuckDomainOutboxEvents(
  db: D1Database,
  input: ListStuckDomainOutboxInput
): Promise<DomainOutboxEvent[]> {
  await ensureDomainOutboxSchema(db);

  const olderThanMinutes = Math.max(1, Math.min(24 * 60, input.olderThanMinutes ?? 15));
  const limit = normalizeLimit(input.limit);
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000).toISOString();

  const rows = await queryAll<DomainOutboxRow>(
    db,
    `SELECT id, stream, aggregate_id, event_type, payload, idempotency_key,
            status, retry_count, created_at, available_at, last_attempt_at,
            processed_at, last_error
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
    input.stream,
    cutoff,
    cutoff,
    limit
  );

  return rows.map(mapRow);
}
