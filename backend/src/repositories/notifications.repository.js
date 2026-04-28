import crypto from "node:crypto";
import { execute, queryAll, queryOne, isD1Configured } from "../lib/d1.js";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("notifications-repository");

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const FALLBACK_OUTBOX_LIMIT = 1000;
const FALLBACK_INBOX_LIMIT = 500;

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function normalizeText(value, maxLength) {
  if (value === null || value === undefined) return "";
  return String(value).trim().slice(0, maxLength);
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
  if (payload === undefined || payload === null) return null;
  try {
    return JSON.stringify(payload);
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

function clonePayload(payload) {
  if (payload === null || payload === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(payload));
  } catch {
    return null;
  }
}

function mapInboxRow(row) {
  if (!row) return null;

  return {
    id: String(row.id),
    outboxId: String(row.outbox_id),
    userId: String(row.user_id),
    eventName: String(row.event_name || "notification"),
    type: String(row.notification_type || "info"),
    title: String(row.title || ""),
    message: String(row.message || ""),
    payload: parsePayload(row.payload_json),
    sourceId: row.source_id ? String(row.source_id) : null,
    createdAt: String(row.created_at),
    readAt: row.read_at ? String(row.read_at) : null,
    read: Boolean(row.read_at),
  };
}

function mapOutboxRow(row) {
  if (!row) return null;

  return {
    id: String(row.id),
    eventName: String(row.event_name || "notification"),
    type: String(row.notification_type || "info"),
    title: String(row.title || ""),
    message: String(row.message || ""),
    payload: parsePayload(row.payload_json),
    targetUserId: row.target_user_id ? String(row.target_user_id) : null,
    sourceId: row.source_id ? String(row.source_id) : null,
    dedupeKey: row.dedupe_key ? String(row.dedupe_key) : null,
    createdAt: String(row.created_at),
    broadcastedAt: row.broadcasted_at ? String(row.broadcasted_at) : null,
    deliveryStatus: row.delivery_status
      ? String(row.delivery_status)
      : row.broadcasted_at
        ? "broadcasted"
        : "pending",
    broadcastAttempts: Number(row.broadcast_attempts || 0),
    lastAttemptAt: row.last_attempt_at ? String(row.last_attempt_at) : null,
    lastError: row.last_error ? String(row.last_error) : null,
  };
}

function buildNotificationRecord(input = {}) {
  return {
    eventName: normalizeText(input.eventName || "notification", 64) || "notification",
    type: normalizeText(input.type || "info", 64) || "info",
    title: normalizeText(input.title || "알림", 256) || "알림",
    message: normalizeText(input.message || "", 4000),
    payload: input.payload ?? null,
    targetUserId: normalizeOptionalText(input.targetUserId, 256),
    sourceId: normalizeOptionalText(input.sourceId, 256),
    dedupeKey: normalizeOptionalText(input.dedupeKey, 256),
  };
}

class NotificationsRepository {
  constructor() {
    this._d1Available = null;
    this._schemaPromise = null;
    this._fallbackOutbox = [];
    this._fallbackInbox = new Map();
    this._fallbackDedupeIndex = new Map();
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
        `CREATE TABLE IF NOT EXISTS notification_outbox (
          id TEXT PRIMARY KEY,
          event_name TEXT NOT NULL,
          notification_type TEXT NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          payload_json TEXT,
          target_user_id TEXT,
          source_id TEXT,
          dedupe_key TEXT,
          created_at TEXT NOT NULL,
          broadcasted_at TEXT,
          delivery_status TEXT NOT NULL DEFAULT 'pending',
          broadcast_attempts INTEGER NOT NULL DEFAULT 0,
          last_attempt_at TEXT,
          last_error TEXT,
          updated_at TEXT
        )`,
      );
      const outboxColumns = await queryAll(`PRAGMA table_info(notification_outbox)`);
      const outboxColumnNames = new Set(outboxColumns.map((column) => column.name));
      if (!outboxColumnNames.has("delivery_status")) {
        await execute(`ALTER TABLE notification_outbox ADD COLUMN delivery_status TEXT`);
      }
      if (!outboxColumnNames.has("broadcast_attempts")) {
        await execute(`ALTER TABLE notification_outbox ADD COLUMN broadcast_attempts INTEGER NOT NULL DEFAULT 0`);
      }
      if (!outboxColumnNames.has("last_attempt_at")) {
        await execute(`ALTER TABLE notification_outbox ADD COLUMN last_attempt_at TEXT`);
      }
      if (!outboxColumnNames.has("last_error")) {
        await execute(`ALTER TABLE notification_outbox ADD COLUMN last_error TEXT`);
      }
      if (!outboxColumnNames.has("updated_at")) {
        await execute(`ALTER TABLE notification_outbox ADD COLUMN updated_at TEXT`);
      }
      await execute(
        `UPDATE notification_outbox
            SET delivery_status = CASE
                  WHEN broadcasted_at IS NOT NULL THEN 'broadcasted'
                  ELSE COALESCE(delivery_status, 'pending')
                END,
                broadcast_attempts = COALESCE(broadcast_attempts, 0),
                updated_at = COALESCE(updated_at, created_at)
          WHERE delivery_status IS NULL
             OR broadcast_attempts IS NULL
             OR updated_at IS NULL`,
      );
      await execute(
        `CREATE TABLE IF NOT EXISTS notification_inbox (
          id TEXT PRIMARY KEY,
          outbox_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          event_name TEXT NOT NULL,
          notification_type TEXT NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          payload_json TEXT,
          source_id TEXT,
          created_at TEXT NOT NULL,
          read_at TEXT,
          FOREIGN KEY (outbox_id) REFERENCES notification_outbox(id) ON DELETE CASCADE,
          UNIQUE (outbox_id, user_id)
        )`,
      );
      await execute(
        `CREATE INDEX IF NOT EXISTS idx_notification_outbox_target_created
         ON notification_outbox (target_user_id, created_at DESC)`,
      );
      await execute(
        `CREATE INDEX IF NOT EXISTS idx_notification_inbox_user_created
         ON notification_inbox (user_id, created_at DESC)`,
      );
      await execute(
        `CREATE INDEX IF NOT EXISTS idx_notification_inbox_user_read_created
         ON notification_inbox (user_id, read_at, created_at DESC)`,
      );
      await execute(
        `CREATE INDEX IF NOT EXISTS idx_notification_outbox_delivery_status
         ON notification_outbox (delivery_status, broadcasted_at, last_attempt_at)`,
      );
      try {
        await execute(
          `CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_outbox_dedupe_key
             ON notification_outbox (dedupe_key)
           WHERE dedupe_key IS NOT NULL`,
        );
      } catch (error) {
        logger.warn({}, "Notification dedupe index unavailable; continuing with read-before-write dedupe", {
          error: error?.message,
        });
      }

      return true;
    })().catch((error) => {
      logger.error({}, "Notifications schema init failed; falling back to memory", {
        error: error?.message,
      });
      this._d1Available = false;
      this._schemaPromise = null;
      return false;
    });

    return this._schemaPromise;
  }

  async _findOutboxByDedupeKey(dedupeKey) {
    const normalizedDedupeKey = normalizeOptionalText(dedupeKey, 256);
    if (!normalizedDedupeKey) {
      return null;
    }

    const row = await queryOne(
      `SELECT *
         FROM notification_outbox
        WHERE dedupe_key = ?
        ORDER BY created_at DESC
        LIMIT 1`,
      normalizedDedupeKey,
    );

    return mapOutboxRow(row);
  }

  async appendOutbox(input) {
    const record = buildNotificationRecord(input);

    try {
      const schemaReady = await this._ensureSchema();
      if (schemaReady) {
        if (record.dedupeKey) {
          const existing = await this._findOutboxByDedupeKey(record.dedupeKey);
          if (existing) {
            return existing;
          }
        }

        const outboxId = createId("nout");
        const createdAt = nowIso();
        const payloadJson = serializePayload(record.payload);

        try {
          await execute(
            `INSERT INTO notification_outbox (
               id, event_name, notification_type, title, message, payload_json,
               target_user_id, source_id, dedupe_key, created_at, broadcasted_at,
               delivery_status, broadcast_attempts, last_attempt_at, last_error, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending', 0, NULL, NULL, ?)`,
            outboxId,
            record.eventName,
            record.type,
            record.title,
            record.message,
            payloadJson,
            record.targetUserId,
            record.sourceId,
            record.dedupeKey,
            createdAt,
            createdAt,
          );
        } catch (error) {
          if (record.dedupeKey) {
            const existing = await this._findOutboxByDedupeKey(record.dedupeKey);
            if (existing) {
              return existing;
            }
          }
          throw error;
        }

        return {
          id: outboxId,
          eventName: record.eventName,
          type: record.type,
          title: record.title,
          message: record.message,
          payload: clonePayload(record.payload),
          targetUserId: record.targetUserId,
          sourceId: record.sourceId,
          dedupeKey: record.dedupeKey,
          createdAt,
          broadcastedAt: null,
          deliveryStatus: "pending",
          broadcastAttempts: 0,
          lastAttemptAt: null,
          lastError: null,
        };
      }
    } catch (error) {
      logger.error({}, "appendOutbox failed; using memory fallback", {
        error: error?.message,
      });
      this._d1Available = false;
    }

    return this._fallbackAppendOutbox(record);
  }

  _fallbackAppendOutbox(record) {
    if (record.dedupeKey) {
      const existing = this._fallbackDedupeIndex.get(record.dedupeKey);
      if (existing) {
        return existing;
      }
    }

    const outbox = {
      id: createId("nout"),
      eventName: record.eventName,
      type: record.type,
      title: record.title,
      message: record.message,
      payload: clonePayload(record.payload),
      targetUserId: record.targetUserId,
      sourceId: record.sourceId,
      dedupeKey: record.dedupeKey,
      createdAt: nowIso(),
      broadcastedAt: null,
      deliveryStatus: "pending",
      broadcastAttempts: 0,
      lastAttemptAt: null,
      lastError: null,
    };

    this._fallbackOutbox.unshift(outbox);
    if (this._fallbackOutbox.length > FALLBACK_OUTBOX_LIMIT) {
      this._fallbackOutbox.length = FALLBACK_OUTBOX_LIMIT;
    }
    if (record.dedupeKey) {
      this._fallbackDedupeIndex.set(record.dedupeKey, outbox);
    }

    return outbox;
  }

  async materializeInbox(outbox, userId) {
    const normalizedUserId = normalizeOptionalText(userId, 256);
    if (!normalizedUserId) return null;

    try {
      const schemaReady = await this._ensureSchema();
      if (schemaReady) {
        const inboxId = createId("nin");
        const createdAt = nowIso();

        await execute(
          `INSERT OR IGNORE INTO notification_inbox (
             id, outbox_id, user_id, event_name, notification_type, title, message,
             payload_json, source_id, created_at, read_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
          inboxId,
          outbox.id,
          normalizedUserId,
          outbox.eventName,
          outbox.type,
          outbox.title,
          outbox.message,
          serializePayload(outbox.payload),
          outbox.sourceId,
          createdAt,
        );

        const row = await queryOne(
          `SELECT * FROM notification_inbox WHERE outbox_id = ? AND user_id = ?`,
          outbox.id,
          normalizedUserId,
        );

        return mapInboxRow(row);
      }
    } catch (error) {
      logger.error({}, "materializeInbox failed; using memory fallback", {
        error: error?.message,
      });
      this._d1Available = false;
    }

    return this._fallbackMaterializeInbox(outbox, normalizedUserId);
  }

  _fallbackMaterializeInbox(outbox, userId) {
    const existing = (this._fallbackInbox.get(userId) || []).find(
      (item) => item.outboxId === outbox.id,
    );
    if (existing) {
      return existing;
    }

    const item = {
      id: createId("nin"),
      outboxId: outbox.id,
      userId,
      eventName: outbox.eventName,
      type: outbox.type,
      title: outbox.title,
      message: outbox.message,
      payload: clonePayload(outbox.payload),
      sourceId: outbox.sourceId,
      createdAt: nowIso(),
      readAt: null,
      read: false,
    };

    const items = this._fallbackInbox.get(userId) || [];
    items.unshift(item);
    if (items.length > FALLBACK_INBOX_LIMIT) {
      items.length = FALLBACK_INBOX_LIMIT;
    }
    this._fallbackInbox.set(userId, items);

    return item;
  }

  async markOutboxBroadcasted(outboxId) {
    const normalizedOutboxId = normalizeOptionalText(outboxId, 256);
    if (!normalizedOutboxId) return;

    try {
      const schemaReady = await this._ensureSchema();
      if (schemaReady) {
        await execute(
          `UPDATE notification_outbox
           SET broadcasted_at = COALESCE(broadcasted_at, ?),
               delivery_status = 'broadcasted',
               last_error = NULL,
               updated_at = ?
           WHERE id = ?`,
          nowIso(),
          nowIso(),
          normalizedOutboxId,
        );
        return;
      }
    } catch (error) {
      logger.error({}, "markOutboxBroadcasted failed; using memory fallback", {
        error: error?.message,
      });
      this._d1Available = false;
    }

    const item = this._fallbackOutbox.find((entry) => entry.id === normalizedOutboxId);
    if (item && !item.broadcastedAt) {
      item.broadcastedAt = nowIso();
      item.deliveryStatus = "broadcasted";
      item.lastError = null;
    }
  }

  async claimOutboxForBroadcast(outboxId, options = {}) {
    const normalizedOutboxId = normalizeOptionalText(outboxId, 256);
    if (!normalizedOutboxId) return null;
    const staleSeconds = Math.max(1, Number.parseInt(String(options.staleSeconds || 300), 10));

    try {
      const schemaReady = await this._ensureSchema();
      if (schemaReady) {
        const claimedAt = nowIso();
        const result = await execute(
          `UPDATE notification_outbox
              SET delivery_status = 'broadcasting',
                  broadcast_attempts = COALESCE(broadcast_attempts, 0) + 1,
                  last_attempt_at = ?,
                  last_error = NULL,
                  updated_at = ?
            WHERE id = ?
              AND broadcasted_at IS NULL
              AND (
                COALESCE(delivery_status, 'pending') IN ('pending', 'failed')
                OR (
                  delivery_status = 'broadcasting'
                  AND (
                    last_attempt_at IS NULL
                    OR datetime(last_attempt_at) <= datetime('now', ?)
                  )
                )
              )`,
          claimedAt,
          claimedAt,
          normalizedOutboxId,
          `-${staleSeconds} seconds`,
        );

        if (Number(result?.changes ?? 0) !== 1) {
          return null;
        }
        const row = await queryOne(
          `SELECT * FROM notification_outbox WHERE id = ?`,
          normalizedOutboxId,
        );
        return mapOutboxRow(row);
      }
    } catch (error) {
      logger.error({}, "claimOutboxForBroadcast failed; using memory fallback", {
        error: error?.message,
      });
      this._d1Available = false;
    }

    const item = this._fallbackOutbox.find((entry) => entry.id === normalizedOutboxId);
    if (!item || item.broadcastedAt || item.deliveryStatus === "broadcasting") {
      return null;
    }
    item.deliveryStatus = "broadcasting";
    item.broadcastAttempts = Number(item.broadcastAttempts || 0) + 1;
    item.lastAttemptAt = nowIso();
    item.lastError = null;
    return { ...item };
  }

  async markOutboxBroadcastFailed(outboxId, error) {
    const normalizedOutboxId = normalizeOptionalText(outboxId, 256);
    if (!normalizedOutboxId) return;
    const message = normalizeText(error?.message || error || "notification broadcast failed", 1000);

    try {
      const schemaReady = await this._ensureSchema();
      if (schemaReady) {
        const failedAt = nowIso();
        await execute(
          `UPDATE notification_outbox
              SET delivery_status = 'failed',
                  last_attempt_at = ?,
                  last_error = ?,
                  updated_at = ?
            WHERE id = ?
              AND broadcasted_at IS NULL`,
          failedAt,
          message,
          failedAt,
          normalizedOutboxId,
        );
        return;
      }
    } catch (failure) {
      logger.error({}, "markOutboxBroadcastFailed failed; using memory fallback", {
        error: failure?.message,
      });
      this._d1Available = false;
    }

    const item = this._fallbackOutbox.find((entry) => entry.id === normalizedOutboxId);
    if (item && !item.broadcastedAt) {
      item.deliveryStatus = "failed";
      item.lastAttemptAt = nowIso();
      item.lastError = message;
    }
  }

  async listUnread(userId, options = {}) {
    const normalizedUserId = normalizeOptionalText(userId, 256);
    const limit = normalizeLimit(options.limit);
    if (!normalizedUserId) {
      return { items: [], total: 0, limit };
    }

    try {
      const schemaReady = await this._ensureSchema();
      if (schemaReady) {
        const rows = await queryAll(
          `SELECT *
           FROM notification_inbox
           WHERE user_id = ? AND read_at IS NULL
           ORDER BY created_at DESC
           LIMIT ?`,
          normalizedUserId,
          limit,
        );
        const countRow = await queryOne(
          `SELECT COUNT(*) AS total
           FROM notification_inbox
           WHERE user_id = ? AND read_at IS NULL`,
          normalizedUserId,
        );

        return {
          items: rows.map(mapInboxRow),
          total: Number(countRow?.total || 0),
          limit,
        };
      }
    } catch (error) {
      logger.error({}, "listUnread failed; using memory fallback", {
        error: error?.message,
      });
      this._d1Available = false;
    }

    const items = (this._fallbackInbox.get(normalizedUserId) || []).filter(
      (item) => !item.readAt,
    );
    return {
      items: items.slice(0, limit).map((item) => ({ ...item })),
      total: items.length,
      limit,
    };
  }

  async listHistory(userId, options = {}) {
    const normalizedUserId = normalizeOptionalText(userId, 256);
    const limit = normalizeLimit(options.limit);
    if (!normalizedUserId) {
      return { items: [], total: 0, limit };
    }

    try {
      const schemaReady = await this._ensureSchema();
      if (schemaReady) {
        const rows = await queryAll(
          `SELECT *
           FROM notification_inbox
           WHERE user_id = ?
           ORDER BY created_at DESC
           LIMIT ?`,
          normalizedUserId,
          limit,
        );
        const countRow = await queryOne(
          `SELECT COUNT(*) AS total
           FROM notification_inbox
           WHERE user_id = ?`,
          normalizedUserId,
        );

        return {
          items: rows.map(mapInboxRow),
          total: Number(countRow?.total || 0),
          limit,
        };
      }
    } catch (error) {
      logger.error({}, "listHistory failed; using memory fallback", {
        error: error?.message,
      });
      this._d1Available = false;
    }

    const items = this._fallbackInbox.get(normalizedUserId) || [];
    return {
      items: items.slice(0, limit).map((item) => ({ ...item })),
      total: items.length,
      limit,
    };
  }

  async markRead(userId, notificationId) {
    const normalizedUserId = normalizeOptionalText(userId, 256);
    const normalizedNotificationId = normalizeOptionalText(notificationId, 256);

    if (!normalizedUserId || !normalizedNotificationId) {
      return null;
    }

    try {
      const schemaReady = await this._ensureSchema();
      if (schemaReady) {
        const existing = await queryOne(
          `SELECT *
           FROM notification_inbox
           WHERE id = ? AND user_id = ?`,
          normalizedNotificationId,
          normalizedUserId,
        );

        if (!existing) {
          return null;
        }

        if (!existing.read_at) {
          await execute(
            `UPDATE notification_inbox SET read_at = ? WHERE id = ? AND user_id = ?`,
            nowIso(),
            normalizedNotificationId,
            normalizedUserId,
          );
        }

        const updated = await queryOne(
          `SELECT *
           FROM notification_inbox
           WHERE id = ? AND user_id = ?`,
          normalizedNotificationId,
          normalizedUserId,
        );

        return mapInboxRow(updated);
      }
    } catch (error) {
      logger.error({}, "markRead failed; using memory fallback", {
        error: error?.message,
      });
      this._d1Available = false;
    }

    const items = this._fallbackInbox.get(normalizedUserId) || [];
    const existing = items.find((item) => item.id === normalizedNotificationId);
    if (!existing) {
      return null;
    }

    if (!existing.readAt) {
      existing.readAt = nowIso();
      existing.read = true;
    }

    return { ...existing };
  }
}

let _repository = null;

export function getNotificationsRepository() {
  if (!_repository) {
    _repository = new NotificationsRepository();
  }
  return _repository;
}

export function createNotificationsRepository() {
  return new NotificationsRepository();
}

export { normalizeLimit };

export default NotificationsRepository;
