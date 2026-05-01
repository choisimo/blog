import crypto from 'node:crypto';
import { execute, queryOne } from './d1.js';

const DEFAULT_TTL_SECONDS = 24 * 60 * 60;
const DEFAULT_LOCK_SECONDS = 5 * 60;
const MAX_KEY_LENGTH = 256;

let _schemaReady = false;

function nowIso() {
  return new Date().toISOString();
}

function expiresAtIso(ttlSeconds = DEFAULT_TTL_SECONDS) {
  return new Date(Date.now() + ttlSeconds * 1000).toISOString();
}

function stableJson(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const entries = Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`);
  return `{${entries.join(',')}}`;
}

export function hashIdempotencyPayload(value) {
  return crypto.createHash('sha256').update(stableJson(value)).digest('hex');
}

export function getIdempotencyKey(req) {
  const value = req?.headers?.['idempotency-key'];
  const raw = Array.isArray(value) ? value[0] : value;
  const normalized = String(raw || '').trim();
  return normalized ? normalized.slice(0, MAX_KEY_LENGTH) : null;
}

async function ensureSchema() {
  if (_schemaReady) return;
  await execute(
    `CREATE TABLE IF NOT EXISTS idempotency_records (
      scope TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      request_hash TEXT,
      status_code INTEGER NOT NULL,
      response_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT,
      PRIMARY KEY (scope, idempotency_key)
    )`,
  );
  await execute(
    `CREATE INDEX IF NOT EXISTS idx_idempotency_records_expires
       ON idempotency_records (expires_at)`,
  );
  const stateColumn = await queryOne(
    `SELECT COUNT(*) AS total FROM pragma_table_info('idempotency_records') WHERE name = 'state'`,
  );
  if (Number(stateColumn?.total || 0) === 0) {
    await execute(`ALTER TABLE idempotency_records ADD COLUMN state TEXT`);
  }
  const lockedUntilColumn = await queryOne(
    `SELECT COUNT(*) AS total FROM pragma_table_info('idempotency_records') WHERE name = 'locked_until'`,
  );
  if (Number(lockedUntilColumn?.total || 0) === 0) {
    await execute(`ALTER TABLE idempotency_records ADD COLUMN locked_until TEXT`);
  }
  await execute(
    `UPDATE idempotency_records
        SET state = COALESCE(state, 'completed')
      WHERE state IS NULL`,
  );
  _schemaReady = true;
}

function parseResponseJson(value) {
  try {
    return JSON.parse(String(value || '{}'));
  } catch {
    return { ok: false, error: 'Cached idempotency response is invalid' };
  }
}

async function getRecord(scope, key) {
  await ensureSchema();
  const row = await queryOne(
    `SELECT scope, idempotency_key, request_hash, status_code, response_json,
            expires_at, state, locked_until
       FROM idempotency_records
      WHERE scope = ? AND idempotency_key = ?
        AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))`,
    scope,
    key,
  );
  if (!row) return null;
  return {
    requestHash: row.request_hash || null,
    statusCode: Number(row.status_code || 200),
    response: parseResponseJson(row.response_json),
    state: row.state || 'completed',
    lockedUntil: row.locked_until || null,
  };
}

async function storeRecord(scope, key, requestHash, statusCode, response, ttlSeconds) {
  await ensureSchema();
  await execute(
    `UPDATE idempotency_records
        SET request_hash = ?,
            status_code = ?,
            response_json = ?,
            expires_at = ?,
            state = 'completed',
            locked_until = NULL
      WHERE scope = ? AND idempotency_key = ?`,
    requestHash,
    statusCode,
    JSON.stringify(response),
    expiresAtIso(ttlSeconds),
    scope,
    key,
  );
}

async function claimRecord(scope, key, requestHash, options = {}) {
  await ensureSchema();
  const createdAt = nowIso();
  const lockSeconds = options.lockSeconds || DEFAULT_LOCK_SECONDS;
  const lockedUntil = new Date(Date.now() + lockSeconds * 1000).toISOString();
  const expiresAt = expiresAtIso(options.ttlSeconds || DEFAULT_TTL_SECONDS);

  const inserted = await execute(
    `INSERT OR IGNORE INTO idempotency_records (
       scope, idempotency_key, request_hash, status_code, response_json,
       created_at, expires_at, state, locked_until
     ) VALUES (?, ?, ?, 0, 'null', ?, ?, 'processing', ?)`,
    scope,
    key,
    requestHash,
    createdAt,
    expiresAt,
    lockedUntil,
  );
  if (inserted.changes === 1) return { claimed: true };

  const existing = await getRecord(scope, key);
  if (!existing) {
    await execute(
      `DELETE FROM idempotency_records
        WHERE scope = ? AND idempotency_key = ?
          AND expires_at IS NOT NULL
          AND datetime(expires_at) <= datetime('now')`,
      scope,
      key,
    );
    return claimRecord(scope, key, requestHash, options);
  }
  if (existing.requestHash && existing.requestHash !== requestHash) {
    return { conflict: true };
  }
  if (existing.state === 'completed') {
    return { cached: existing };
  }

  const reclaimed = await execute(
    `UPDATE idempotency_records
        SET state = 'processing',
            locked_until = ?,
            expires_at = ?
      WHERE scope = ? AND idempotency_key = ?
        AND state = 'processing'
        AND (locked_until IS NULL OR datetime(locked_until) <= datetime('now'))`,
    lockedUntil,
    expiresAt,
    scope,
    key,
  );
  if (reclaimed.changes === 1) return { claimed: true };

  return { inProgress: true, lockedUntil: existing.lockedUntil };
}

async function releaseRecord(scope, key, requestHash) {
  await ensureSchema();
  await execute(
    `DELETE FROM idempotency_records
      WHERE scope = ? AND idempotency_key = ?
        AND request_hash = ?
        AND state = 'processing'`,
    scope,
    key,
    requestHash,
  );
}

export async function claimIdempotencyRecord(scope, key, requestPayload, options = {}) {
  const requestHash = hashIdempotencyPayload(requestPayload);
  const claim = await claimRecord(scope, key, requestHash, options);
  return { ...claim, requestHash };
}

export async function storeIdempotencyRecord(
  scope,
  key,
  requestHash,
  statusCode,
  response,
  ttlSeconds = DEFAULT_TTL_SECONDS,
) {
  return storeRecord(scope, key, requestHash, statusCode, response, ttlSeconds);
}

export async function releaseIdempotencyRecord(scope, key, requestHash) {
  return releaseRecord(scope, key, requestHash);
}

export async function runIdempotent(req, res, scope, requestPayload, handler, options = {}) {
  const key = getIdempotencyKey(req);
  if (!key) {
    const result = await handler();
    const statusCode = result?.statusCode || 200;
    const response = result?.response ?? result;
    return res.status(statusCode).json(response);
  }

  const requestHash = hashIdempotencyPayload(requestPayload);
  const claim = await claimRecord(scope, key, requestHash, options);
  if (claim.conflict) {
    res.setHeader('Idempotency-Key', key);
    return res.status(409).json({
      ok: false,
      error: {
        code: 'IDEMPOTENCY_KEY_REUSED',
        message: 'Idempotency-Key was reused with a different request payload',
      },
    });
  }
  if (claim.cached) {
    const cached = claim.cached;
    res.setHeader('Idempotency-Key', key);
    res.setHeader('Idempotency-Replayed', 'true');
    return res.status(cached.statusCode).json(cached.response);
  }
  if (claim.inProgress) {
    res.setHeader('Idempotency-Key', key);
    res.setHeader('Retry-After', '3');
    return res.status(409).json({
      ok: false,
      error: {
        code: 'IDEMPOTENCY_IN_PROGRESS',
        message: 'A request with this Idempotency-Key is already in progress',
      },
    });
  }

  let result;
  try {
    result = await handler();
  } catch (error) {
    await releaseRecord(scope, key, requestHash);
    throw error;
  }
  const statusCode = result?.statusCode || 200;
  const response = result?.response ?? result;

  await storeRecord(
    scope,
    key,
    requestHash,
    statusCode,
    response,
    options.ttlSeconds || DEFAULT_TTL_SECONDS,
  );

  const finalRecord = await getRecord(scope, key);
  res.setHeader('Idempotency-Key', key);
  if (finalRecord && finalRecord.response && JSON.stringify(finalRecord.response) !== JSON.stringify(response)) {
    res.setHeader('Idempotency-Replayed', 'true');
    return res.status(finalRecord.statusCode).json(finalRecord.response);
  }

  return res.status(statusCode).json(response);
}
