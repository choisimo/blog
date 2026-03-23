import crypto from "node:crypto";
import { execute, queryAll, queryOne, isD1Configured } from "../lib/d1.js";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("domain-outbox-repository");

export const MEMORY_EMBEDDING_STREAM = "memory.embedding";
export const NOTIFICATION_DELIVERY_STREAM = "notifications.delivery";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const DEFAULT_LOCK_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_BASE_DELAY_MS = 5 * 1000;
const DEFAULT_MAX_ATTEMPTS = 5;
const TERMINAL_STATUSES = new Set(["succeeded", "dead_letter"]);

function nowIso() {
  return new Date().toISOString();
}

function addMs(dateValue, ms) {
  return new Date(new Date(dateValue).getTime() + ms).toISOString();
}

function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function normalizeText(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizeOptionalText(value, maxLength) {
  const normalized = normalizeText(value, maxLength);
  return normalized || null;
}

function normalizeLimit(value, defaultValue = DEFAULT_LIMIT) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.max(1, Math.min(MAX_LIMIT, parsed));
}

function serializePayload(payload) {
  try {
    return JSON.stringify(payload ?? null);
  } catch {
    return JSON.stringify({ value: String(payload) });
  }
}

function parsePayload(payloadJson) {
  if (!payloadJson) return null;
  try {
    return JSON.parse(payloadJson);
  } catch {
    return null;
  }
}

function mapRow(row) {
  if (!row) return null;

  return {
    id: String(row.id),
    stream: String(row.stream),
    aggregateId: String(row.aggregate_id),
    eventType: String(row.event_type),
    payload: parsePayload(row.payload_json ?? row.payload),
    status: row.status === "processed" ? "succeeded" : String(row.status),
    retryCount: Number(row.retry_count || 0),
    nextAttemptAt: String(row.next_attempt_at || row.available_at || row.created_at),
    lockedAt: row.locked_at ? String(row.locked_at) : row.last_attempt_at ? String(row.last_attempt_at) : null,
    consumerId: row.consumer_id ? String(row.consumer_id) : null,
    lastError: row.last_error ? String(row.last_error) : null,
    idempotencyKey: row.idempotency_key ? String(row.idempotency_key) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at || row.last_attempt_at || row.created_at),
    processedAt: row.processed_at ? String(row.processed_at) : null,
  };
}

function buildRecord(input = {}) {
  const stream = normalizeText(input.stream, 128);
  const aggregateId = normalizeText(input.aggregateId, 256);
  const eventType = normalizeText(input.eventType, 128);

  if (!stream) throw new Error("stream is required");
  if (!aggregateId) throw new Error("aggregateId is required");
  if (!eventType) throw new Error("eventType is required");

  return {
    stream,
    aggregateId,
    eventType,
    payload: input.payload ?? null,
    idempotencyKey: normalizeOptionalText(input.idempotencyKey, 256),
  };
}

class DomainOutboxRepository {
  constructor() {
    this._d1Available = null;
    this._schemaPromise = null;
    this._fallbackEvents = [];
  }

  async _isD1Available() {
    if (this._d1Available !== null) {
      return this._d1Available;
    }

    try {
      this._d1Available = isD1Configured();
      return this._d1Available;
    } catch {
      this._d1Available = false;
      return false;
    }
  }

  async getStorageMode() {
    const isAvailable = await this._isD1Available();
    return isAvailable ? "d1" : "memory";
  }

  async _ensureSchema() {
    const isAvailable = await this._isD1Available();
    if (!isAvailable) return false;

    if (this._schemaPromise) {
      return this._schemaPromise;
    }

    this._schemaPromise = (async () => {
      await execute(
        `CREATE TABLE IF NOT EXISTS domain_outbox (
          id TEXT PRIMARY KEY,
          stream TEXT NOT NULL,
          aggregate_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          retry_count INTEGER NOT NULL DEFAULT 0,
          next_attempt_at TEXT NOT NULL,
          locked_at TEXT,
          consumer_id TEXT,
          last_error TEXT,
          idempotency_key TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          processed_at TEXT
        )`,
      );
      await this._upgradeLegacySchema();
      await execute(
        `CREATE INDEX IF NOT EXISTS idx_domain_outbox_stream_status_attempt
         ON domain_outbox (stream, status, next_attempt_at, created_at)`,
      );
      await execute(
        `CREATE INDEX IF NOT EXISTS idx_domain_outbox_stream_locked
         ON domain_outbox (stream, locked_at, status)`,
      );
      await execute(
        `CREATE INDEX IF NOT EXISTS idx_domain_outbox_aggregate
         ON domain_outbox (stream, aggregate_id, created_at DESC)`,
      );
      await execute(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_domain_outbox_stream_idempotency
         ON domain_outbox (stream, idempotency_key)
         WHERE idempotency_key IS NOT NULL`,
      );
      return true;
    })().catch((error) => {
      logger.error({}, "Domain outbox schema init failed; falling back to memory", {
        error: error?.message,
      });
      this._d1Available = false;
      this._schemaPromise = null;
      return false;
    });

    return this._schemaPromise;
  }

  async _upgradeLegacySchema() {
    const columns = await queryAll(`PRAGMA table_info(domain_outbox)`);
    const columnNames = new Set(columns.map((column) => String(column.name)));

    if (!columnNames.has("payload_json")) {
      await execute(`ALTER TABLE domain_outbox ADD COLUMN payload_json TEXT`);
    }
    if (!columnNames.has("next_attempt_at")) {
      await execute(`ALTER TABLE domain_outbox ADD COLUMN next_attempt_at TEXT`);
    }
    if (!columnNames.has("locked_at")) {
      await execute(`ALTER TABLE domain_outbox ADD COLUMN locked_at TEXT`);
    }
    if (!columnNames.has("consumer_id")) {
      await execute(`ALTER TABLE domain_outbox ADD COLUMN consumer_id TEXT`);
    }
    if (!columnNames.has("updated_at")) {
      await execute(`ALTER TABLE domain_outbox ADD COLUMN updated_at TEXT`);
    }
    if (!columnNames.has("processed_at")) {
      await execute(`ALTER TABLE domain_outbox ADD COLUMN processed_at TEXT`);
    }
    if (!columnNames.has("last_error")) {
      await execute(`ALTER TABLE domain_outbox ADD COLUMN last_error TEXT`);
    }
    if (!columnNames.has("idempotency_key")) {
      await execute(`ALTER TABLE domain_outbox ADD COLUMN idempotency_key TEXT`);
    }

    await execute(
      `UPDATE domain_outbox
       SET payload_json = COALESCE(payload_json, payload, 'null')`,
    );
    await execute(
      `UPDATE domain_outbox
       SET next_attempt_at = COALESCE(next_attempt_at, available_at, created_at)`,
    );
    await execute(
      `UPDATE domain_outbox
       SET updated_at = COALESCE(updated_at, processed_at, last_attempt_at, created_at)`,
    );
    await execute(
      `UPDATE domain_outbox
       SET status = 'succeeded'
       WHERE status = 'processed'`,
    );
  }

  async append(input = {}) {
    const record = buildRecord(input);

    try {
      const schemaReady = await this._ensureSchema();
      if (schemaReady) {
        if (record.idempotencyKey) {
          const existing = await queryOne(
            `SELECT * FROM domain_outbox WHERE stream = ? AND idempotency_key = ?`,
            record.stream,
            record.idempotencyKey,
          );
          if (existing) {
            return mapRow(existing);
          }
        }

        const createdAt = nowIso();
        const id = createId("dout");
        await execute(
          `INSERT INTO domain_outbox (
             id, stream, aggregate_id, event_type, payload_json, status,
             retry_count, next_attempt_at, locked_at, consumer_id, last_error,
             idempotency_key, created_at, updated_at, processed_at
           ) VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, NULL, NULL, NULL, ?, ?, ?, NULL)`,
          id,
          record.stream,
          record.aggregateId,
          record.eventType,
          serializePayload(record.payload),
          createdAt,
          record.idempotencyKey,
          createdAt,
          createdAt,
        );

        return {
          id,
          stream: record.stream,
          aggregateId: record.aggregateId,
          eventType: record.eventType,
          payload: record.payload,
          status: "pending",
          retryCount: 0,
          nextAttemptAt: createdAt,
          lockedAt: null,
          consumerId: null,
          lastError: null,
          idempotencyKey: record.idempotencyKey,
          createdAt,
          updatedAt: createdAt,
          processedAt: null,
        };
      }
    } catch (error) {
      logger.error({}, "append failed; using memory fallback", {
        error: error?.message,
        stream: record.stream,
        eventType: record.eventType,
      });
      this._d1Available = false;
    }

    return this._fallbackAppend(record);
  }

  _fallbackAppend(record) {
    const existing = record.idempotencyKey
      ? this._fallbackEvents.find(
          (item) =>
            item.stream === record.stream &&
            item.idempotencyKey === record.idempotencyKey,
        )
      : null;

    if (existing) {
      return { ...existing, payload: parsePayload(serializePayload(existing.payload)) };
    }

    const createdAt = nowIso();
    const item = {
      id: createId("dout"),
      stream: record.stream,
      aggregateId: record.aggregateId,
      eventType: record.eventType,
      payload: parsePayload(serializePayload(record.payload)),
      status: "pending",
      retryCount: 0,
      nextAttemptAt: createdAt,
      lockedAt: null,
      consumerId: null,
      lastError: null,
      idempotencyKey: record.idempotencyKey,
      createdAt,
      updatedAt: createdAt,
      processedAt: null,
    };

    this._fallbackEvents.unshift(item);
    return { ...item, payload: parsePayload(serializePayload(item.payload)) };
  }

  async claimPending({
    stream,
    consumerId,
    limit = DEFAULT_LIMIT,
    lockTimeoutMs = DEFAULT_LOCK_TIMEOUT_MS,
  }) {
    const normalizedStream = normalizeText(stream, 128);
    const normalizedConsumerId =
      normalizeOptionalText(consumerId, 128) || createId("consumer");
    const normalizedLimit = normalizeLimit(limit);

    if (!normalizedStream) {
      return [];
    }

    try {
      const schemaReady = await this._ensureSchema();
      if (schemaReady) {
        const now = nowIso();
        const staleBefore = addMs(now, -lockTimeoutMs);
        const rows = await queryAll(
          `SELECT *
           FROM domain_outbox
           WHERE stream = ?
             AND status IN ('pending', 'failed')
             AND next_attempt_at <= ?
             AND (locked_at IS NULL OR locked_at <= ?)
           ORDER BY created_at ASC
           LIMIT ?`,
          normalizedStream,
          now,
          staleBefore,
          normalizedLimit,
        );

        const claimed = [];
        for (const row of rows) {
          const updatedAt = nowIso();
          const result = await execute(
            `UPDATE domain_outbox
             SET status = 'processing',
                 locked_at = ?,
                 consumer_id = ?,
                 updated_at = ?
             WHERE id = ?
               AND stream = ?
               AND status IN ('pending', 'failed')
               AND next_attempt_at <= ?
               AND (locked_at IS NULL OR locked_at <= ?)`,
            updatedAt,
            normalizedConsumerId,
            updatedAt,
            row.id,
            normalizedStream,
            updatedAt,
            addMs(updatedAt, -lockTimeoutMs),
          );

          if (!result?.changes) {
            continue;
          }

          claimed.push(
            mapRow({
              ...row,
              status: "processing",
              locked_at: updatedAt,
              consumer_id: normalizedConsumerId,
              updated_at: updatedAt,
            }),
          );
        }

        return claimed;
      }
    } catch (error) {
      logger.error({}, "claimPending failed; using memory fallback", {
        error: error?.message,
        stream: normalizedStream,
      });
      this._d1Available = false;
    }

    return this._fallbackClaimPending({
      stream: normalizedStream,
      consumerId: normalizedConsumerId,
      limit: normalizedLimit,
      lockTimeoutMs,
    });
  }

  _fallbackClaimPending({ stream, consumerId, limit, lockTimeoutMs }) {
    const now = nowIso();
    const staleBefore = addMs(now, -lockTimeoutMs);
    const claimed = [];

    for (const item of this._fallbackEvents) {
      if (claimed.length >= limit) break;
      if (item.stream !== stream) continue;
      if (!["pending", "failed"].includes(item.status)) continue;
      if (item.nextAttemptAt > now) continue;
      if (item.lockedAt && item.lockedAt > staleBefore) continue;

      item.status = "processing";
      item.lockedAt = now;
      item.consumerId = consumerId;
      item.updatedAt = now;
      claimed.push({ ...item, payload: parsePayload(serializePayload(item.payload)) });
    }

    return claimed;
  }

  async markSucceeded(id) {
    const normalizedId = normalizeOptionalText(id, 256);
    if (!normalizedId) return null;

    try {
      const schemaReady = await this._ensureSchema();
      if (schemaReady) {
        const updatedAt = nowIso();
        await execute(
          `UPDATE domain_outbox
           SET status = 'succeeded',
               locked_at = NULL,
               consumer_id = NULL,
               last_error = NULL,
               updated_at = ?,
               processed_at = ?
           WHERE id = ?`,
          updatedAt,
          updatedAt,
          normalizedId,
        );
        const row = await queryOne(`SELECT * FROM domain_outbox WHERE id = ?`, normalizedId);
        return mapRow(row);
      }
    } catch (error) {
      logger.error({}, "markSucceeded failed; using memory fallback", {
        error: error?.message,
        outboxId: normalizedId,
      });
      this._d1Available = false;
    }

    return this._fallbackTransition(normalizedId, {
      status: "succeeded",
      lockedAt: null,
      consumerId: null,
      lastError: null,
      processedAt: nowIso(),
    });
  }

  async markFailed(
    id,
    {
      error,
      maxAttempts = DEFAULT_MAX_ATTEMPTS,
      baseDelayMs = DEFAULT_BASE_DELAY_MS,
    } = {},
  ) {
    const normalizedId = normalizeOptionalText(id, 256);
    if (!normalizedId) return null;

    const lastError = normalizeOptionalText(error, 4000) || "Outbox consumer failed";

    try {
      const schemaReady = await this._ensureSchema();
      if (schemaReady) {
        const current = await queryOne(`SELECT * FROM domain_outbox WHERE id = ?`, normalizedId);
        if (!current) return null;

        const retryCount = Number(current.retry_count || 0) + 1;
        const updatedAt = nowIso();
        const terminal = retryCount >= maxAttempts;
        const nextAttemptAt = terminal
          ? updatedAt
          : addMs(updatedAt, baseDelayMs * retryCount);

        await execute(
          `UPDATE domain_outbox
           SET status = ?,
               retry_count = ?,
               next_attempt_at = ?,
               locked_at = NULL,
               consumer_id = NULL,
               last_error = ?,
               updated_at = ?,
               processed_at = ?
           WHERE id = ?`,
          terminal ? "dead_letter" : "failed",
          retryCount,
          nextAttemptAt,
          lastError,
          updatedAt,
          terminal ? updatedAt : null,
          normalizedId,
        );

        const row = await queryOne(`SELECT * FROM domain_outbox WHERE id = ?`, normalizedId);
        return mapRow(row);
      }
    } catch (repoError) {
      logger.error({}, "markFailed failed; using memory fallback", {
        error: repoError?.message,
        outboxId: normalizedId,
      });
      this._d1Available = false;
    }

    const current = this._fallbackEvents.find((item) => item.id === normalizedId);
    if (!current) return null;

    const retryCount = Number(current.retryCount || 0) + 1;
    const updatedAt = nowIso();
    const terminal = retryCount >= maxAttempts;
    current.status = terminal ? "dead_letter" : "failed";
    current.retryCount = retryCount;
    current.nextAttemptAt = terminal
      ? updatedAt
      : addMs(updatedAt, baseDelayMs * retryCount);
    current.lockedAt = null;
    current.consumerId = null;
    current.lastError = lastError;
    current.updatedAt = updatedAt;
    current.processedAt = terminal ? updatedAt : null;
    return { ...current, payload: parsePayload(serializePayload(current.payload)) };
  }

  async replay(id) {
    const normalizedId = normalizeOptionalText(id, 256);
    if (!normalizedId) return null;

    try {
      const schemaReady = await this._ensureSchema();
      if (schemaReady) {
        const updatedAt = nowIso();
        await execute(
          `UPDATE domain_outbox
           SET status = 'pending',
               next_attempt_at = ?,
               locked_at = NULL,
               consumer_id = NULL,
               last_error = NULL,
               updated_at = ?,
               processed_at = NULL
           WHERE id = ?`,
          updatedAt,
          updatedAt,
          normalizedId,
        );
        const row = await queryOne(`SELECT * FROM domain_outbox WHERE id = ?`, normalizedId);
        return mapRow(row);
      }
    } catch (error) {
      logger.error({}, "replay failed; using memory fallback", {
        error: error?.message,
        outboxId: normalizedId,
      });
      this._d1Available = false;
    }

    return this._fallbackTransition(normalizedId, {
      status: "pending",
      nextAttemptAt: nowIso(),
      lockedAt: null,
      consumerId: null,
      lastError: null,
      processedAt: null,
    });
  }

  async getById(id) {
    const normalizedId = normalizeOptionalText(id, 256);
    if (!normalizedId) return null;

    try {
      const schemaReady = await this._ensureSchema();
      if (schemaReady) {
        const row = await queryOne(`SELECT * FROM domain_outbox WHERE id = ?`, normalizedId);
        return mapRow(row);
      }
    } catch (error) {
      logger.error({}, "getById failed; using memory fallback", {
        error: error?.message,
        outboxId: normalizedId,
      });
      this._d1Available = false;
    }

    const item = this._fallbackEvents.find((entry) => entry.id === normalizedId);
    return item ? { ...item, payload: parsePayload(serializePayload(item.payload)) } : null;
  }

  async listEvents({
    stream,
    status,
    limit = DEFAULT_LIMIT,
    includePayload = true,
  } = {}) {
    const normalizedStream = normalizeOptionalText(stream, 128);
    const normalizedStatus = normalizeOptionalText(status, 64);
    const normalizedLimit = normalizeLimit(limit);

    try {
      const schemaReady = await this._ensureSchema();
      if (schemaReady) {
        const where = [];
        const params = [];

        if (normalizedStream) {
          where.push(`stream = ?`);
          params.push(normalizedStream);
        }
        if (normalizedStatus) {
          where.push(`status = ?`);
          params.push(normalizedStatus);
        }

        const rows = await queryAll(
          `SELECT *
           FROM domain_outbox
           ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
           ORDER BY created_at DESC
           LIMIT ?`,
          ...params,
          normalizedLimit,
        );

        return rows.map((row) => {
          const item = mapRow(row);
          if (!includePayload && item) {
            item.payload = null;
          }
          return item;
        });
      }
    } catch (error) {
      logger.error({}, "listEvents failed; using memory fallback", {
        error: error?.message,
        stream: normalizedStream,
      });
      this._d1Available = false;
    }

    return this._fallbackEvents
      .filter((item) => (normalizedStream ? item.stream === normalizedStream : true))
      .filter((item) => (normalizedStatus ? item.status === normalizedStatus : true))
      .slice(0, normalizedLimit)
      .map((item) => ({
        ...item,
        payload: includePayload ? parsePayload(serializePayload(item.payload)) : null,
      }));
  }

  async getStats({
    stream,
    lockTimeoutMs = DEFAULT_LOCK_TIMEOUT_MS,
  } = {}) {
    const normalizedStream = normalizeOptionalText(stream, 128);
    const empty = {
      stream: normalizedStream,
      pending: 0,
      processing: 0,
      failed: 0,
      deadLetter: 0,
      succeeded: 0,
      stuck: 0,
    };

    try {
      const schemaReady = await this._ensureSchema();
      if (schemaReady) {
        const params = [];
        const where = normalizedStream ? `WHERE stream = ?` : "";
        if (normalizedStream) {
          params.push(normalizedStream);
        }

        const rows = await queryAll(
          `SELECT status, COUNT(*) AS total
           FROM domain_outbox
           ${where}
           GROUP BY status`,
          ...params,
        );

        const stuckParams = [];
        const stuckWhere = [];
        if (normalizedStream) {
          stuckWhere.push(`stream = ?`);
          stuckParams.push(normalizedStream);
        }
        stuckWhere.push(`status = 'processing'`);
        stuckWhere.push(`locked_at IS NOT NULL`);
        stuckWhere.push(`locked_at <= ?`);
        stuckParams.push(addMs(nowIso(), -lockTimeoutMs));

        const stuckRow = await queryOne(
          `SELECT COUNT(*) AS total
           FROM domain_outbox
           WHERE ${stuckWhere.join(" AND ")}`,
          ...stuckParams,
        );

        const stats = { ...empty };
        for (const row of rows) {
          if (row.status === "pending") stats.pending = Number(row.total || 0);
          if (row.status === "processing") stats.processing = Number(row.total || 0);
          if (row.status === "failed") stats.failed = Number(row.total || 0);
          if (row.status === "dead_letter") stats.deadLetter = Number(row.total || 0);
          if (row.status === "succeeded") stats.succeeded = Number(row.total || 0);
        }
        stats.stuck = Number(stuckRow?.total || 0);
        return stats;
      }
    } catch (error) {
      logger.error({}, "getStats failed; using memory fallback", {
        error: error?.message,
        stream: normalizedStream,
      });
      this._d1Available = false;
    }

    const staleBefore = addMs(nowIso(), -lockTimeoutMs);
    const stats = { ...empty };
    for (const item of this._fallbackEvents) {
      if (normalizedStream && item.stream !== normalizedStream) continue;
      if (item.status === "pending") stats.pending += 1;
      if (item.status === "processing") stats.processing += 1;
      if (item.status === "failed") stats.failed += 1;
      if (item.status === "dead_letter") stats.deadLetter += 1;
      if (item.status === "succeeded") stats.succeeded += 1;
      if (
        item.status === "processing" &&
        item.lockedAt &&
        item.lockedAt <= staleBefore
      ) {
        stats.stuck += 1;
      }
    }
    return stats;
  }

  _fallbackTransition(id, nextValues) {
    const item = this._fallbackEvents.find((entry) => entry.id === id);
    if (!item) return null;

    Object.assign(item, nextValues, { updatedAt: nowIso() });
    if (TERMINAL_STATUSES.has(item.status) && !item.processedAt) {
      item.processedAt = nowIso();
    }

    return { ...item, payload: parsePayload(serializePayload(item.payload)) };
  }
}

let _repository = null;

export function getDomainOutboxRepository() {
  if (!_repository) {
    _repository = new DomainOutboxRepository();
  }
  return _repository;
}

export function createDomainOutboxRepository() {
  return new DomainOutboxRepository();
}

export async function getDomainOutboxSummary(stream = MEMORY_EMBEDDING_STREAM) {
  const summary = await getDomainOutboxRepository().getStats({ stream });
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

  return {
    stream,
    pending: summary.pending,
    processing: summary.processing,
    processed: summary.succeeded,
    deadLetter: summary.deadLetter,
    oldestPendingAt: oldestPending?.created_at ?? null,
    oldestDeadLetterAt: oldestDeadLetter?.created_at ?? null,
  };
}

export async function listStuckDomainOutboxEvents({
  stream = MEMORY_EMBEDDING_STREAM,
  olderThanMinutes = 15,
  limit = 25,
} = {}) {
  const safeMinutes = Math.max(1, Math.min(24 * 60, Number(olderThanMinutes) || 15));
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 25));
  const cutoff = new Date(Date.now() - safeMinutes * 60_000).toISOString();

  return queryAll(
    `SELECT id, stream, aggregate_id, event_type, status, retry_count,
            created_at,
            COALESCE(next_attempt_at, available_at, created_at) AS available_at,
            COALESCE(locked_at, last_attempt_at) AS last_attempt_at,
            processed_at, last_error
       FROM domain_outbox
      WHERE stream = ?
        AND (
          status = 'dead_letter'
          OR (
            status = 'processing'
            AND COALESCE(locked_at, last_attempt_at, created_at) <= ?
          )
          OR (
            status IN ('pending', 'failed')
            AND retry_count > 0
            AND COALESCE(next_attempt_at, available_at, created_at) <= ?
          )
        )
      ORDER BY COALESCE(locked_at, last_attempt_at, created_at) ASC
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
             AND outbox.status IN ('succeeded', 'processed')
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
             AND outbox.status IN ('succeeded', 'processed')
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

export { normalizeLimit, DEFAULT_LOCK_TIMEOUT_MS };

export default DomainOutboxRepository;
