import type { Context } from 'hono';
import type { HonoEnv } from '../types';

const DEFAULT_TTL_SECONDS = 24 * 60 * 60;
const DEFAULT_LOCK_SECONDS = 5 * 60;
const MAX_KEY_LENGTH = 256;

type IdempotencyRecord = {
  request_hash: string | null;
  status_code: number;
  response_json: string;
  state?: string | null;
  locked_until?: string | null;
};

function stableJson(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const objectValue = value as Record<string, unknown>;
  return `{${Object.keys(objectValue)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(objectValue[key])}`)
    .join(',')}}`;
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashIdempotencyPayload(value: unknown): Promise<string> {
  return sha256Hex(stableJson(value));
}

export function getIdempotencyKey(c: Context<HonoEnv>): string | null {
  const raw = String(c.req.header('Idempotency-Key') || '').trim();
  return raw ? raw.slice(0, MAX_KEY_LENGTH) : null;
}

async function ensureSchema(db: D1Database): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS idempotency_records (
        scope TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        request_hash TEXT,
        status_code INTEGER NOT NULL,
        response_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT,
        PRIMARY KEY (scope, idempotency_key)
      )`
    )
    .run();
  const columns = await db.prepare(`PRAGMA table_info(idempotency_records)`).all<{ name: string }>();
  const names = new Set((columns.results || []).map((column) => column.name));
  if (!names.has('state')) {
    await db.prepare(`ALTER TABLE idempotency_records ADD COLUMN state TEXT`).run();
  }
  if (!names.has('locked_until')) {
    await db.prepare(`ALTER TABLE idempotency_records ADD COLUMN locked_until TEXT`).run();
  }
  await db
    .prepare(
      `UPDATE idempotency_records
          SET state = COALESCE(state, 'completed')
        WHERE state IS NULL`
    )
    .run();
}

function parseCachedResponse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return {
      ok: false,
      error: {
        code: 'IDEMPOTENCY_CACHE_CORRUPT',
        message: 'Cached idempotency response is invalid',
      },
    };
  }
}

export async function getCachedIdempotencyResponse(
  c: Context<HonoEnv>,
  scope: string,
  requestPayload: unknown
): Promise<Response | null> {
  const key = getIdempotencyKey(c);
  if (!key) return null;

  const db = c.env.DB;
  await ensureSchema(db);
  const requestHash = await hashIdempotencyPayload(requestPayload);
  const expiresAt = new Date(Date.now() + DEFAULT_TTL_SECONDS * 1000).toISOString();
  const lockedUntil = new Date(Date.now() + DEFAULT_LOCK_SECONDS * 1000).toISOString();
  const inserted = await db
    .prepare(
      `INSERT OR IGNORE INTO idempotency_records (
        scope, idempotency_key, request_hash, status_code, response_json,
        created_at, expires_at, state, locked_until
      ) VALUES (?, ?, ?, 0, 'null', datetime('now'), ?, 'processing', ?)`
    )
    .bind(scope, key, requestHash, expiresAt, lockedUntil)
    .run();

  c.header('Idempotency-Key', key);
  if (Number(inserted.meta?.changes ?? 0) === 1) {
    return null;
  }

  const row = await db
    .prepare(
      `SELECT request_hash, status_code, response_json, state, locked_until
         FROM idempotency_records
        WHERE scope = ? AND idempotency_key = ?
          AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))`
    )
    .bind(scope, key)
    .first<IdempotencyRecord>();

  if (!row) return null;

  if (row.request_hash && row.request_hash !== requestHash) {
    return c.json(
      {
        ok: false,
        error: {
          code: 'IDEMPOTENCY_KEY_REUSED',
          message: 'Idempotency-Key was reused with a different request payload',
        },
      },
      409
    );
  }

  if ((row.state || 'completed') !== 'completed') {
    const reclaimed = await db
      .prepare(
        `UPDATE idempotency_records
            SET state = 'processing',
                locked_until = ?,
                expires_at = ?
          WHERE scope = ? AND idempotency_key = ?
            AND state = 'processing'
            AND (locked_until IS NULL OR datetime(locked_until) <= datetime('now'))`
      )
      .bind(lockedUntil, expiresAt, scope, key)
      .run();
    if (Number(reclaimed.meta?.changes ?? 0) === 1) {
      return null;
    }

    c.header('Retry-After', '3');
    return c.json(
      {
        ok: false,
        error: {
          code: 'IDEMPOTENCY_IN_PROGRESS',
          message: 'A request with this Idempotency-Key is already in progress',
        },
      },
      409
    );
  }

  c.header('Idempotency-Replayed', 'true');
  return c.json(parseCachedResponse(row.response_json), row.status_code as 200);
}

export async function storeIdempotencyResponse(
  c: Context<HonoEnv>,
  scope: string,
  requestPayload: unknown,
  statusCode: number,
  responsePayload: unknown,
  ttlSeconds = DEFAULT_TTL_SECONDS
): Promise<void> {
  const key = getIdempotencyKey(c);
  if (!key) return;

  const db = c.env.DB;
  await ensureSchema(db);
  const requestHash = await hashIdempotencyPayload(requestPayload);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const result = await db
    .prepare(
      `UPDATE idempotency_records
          SET request_hash = ?,
              status_code = ?,
              response_json = ?,
              expires_at = ?,
              state = 'completed',
              locked_until = NULL
        WHERE scope = ? AND idempotency_key = ?`
    )
    .bind(requestHash, statusCode, JSON.stringify(responsePayload), expiresAt, scope, key)
    .run();
  if (Number(result.meta?.changes ?? 0) === 0) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO idempotency_records (
          scope, idempotency_key, request_hash, status_code, response_json,
          created_at, expires_at, state, locked_until
        ) VALUES (?, ?, ?, ?, ?, datetime('now'), ?, 'completed', NULL)`
      )
      .bind(scope, key, requestHash, statusCode, JSON.stringify(responsePayload), expiresAt)
      .run();
  }
  c.header('Idempotency-Key', key);
}

export async function releaseIdempotencyClaim(
  c: Context<HonoEnv>,
  scope: string,
  requestPayload: unknown
): Promise<void> {
  const key = getIdempotencyKey(c);
  if (!key) return;
  const db = c.env.DB;
  await ensureSchema(db);
  const requestHash = await hashIdempotencyPayload(requestPayload);
  await db
    .prepare(
      `DELETE FROM idempotency_records
        WHERE scope = ? AND idempotency_key = ?
          AND request_hash = ?
          AND state = 'processing'`
    )
    .bind(scope, key, requestHash)
    .run();
}

export async function idempotentJson(
  c: Context<HonoEnv>,
  scope: string,
  requestPayload: unknown,
  statusCode: number,
  responsePayload: unknown
): Promise<Response> {
  await storeIdempotencyResponse(c, scope, requestPayload, statusCode, responsePayload);
  return c.json(responsePayload, statusCode as 200);
}
