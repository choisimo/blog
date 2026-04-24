import type { D1Database } from '@cloudflare/workers-types';

import { execute, executeBatch, queryOne } from './d1';

const TOTP_STATE_ID = 'global';
const TOTP_STATE_TTL_SECONDS = 30 * 24 * 60 * 60;

export type RefreshTokenStatus = 'active' | 'rotated' | 'revoked';

export type RefreshTokenRecord = {
  jti: string;
  familyId: string;
  sub: string;
  email?: string;
  status: RefreshTokenStatus;
  createdAt: string;
  rotatedAt?: string;
  replacedBy?: string;
  reason?: string;
  expiresAt: string;
};

export type RefreshFamilyRecord = {
  familyId: string;
  revokedAt: string;
  reason: string;
  lastJti?: string;
  expiresAt: string;
};

type RefreshTokenRow = {
  jti: string;
  family_id: string;
  sub: string;
  email: string | null;
  status: RefreshTokenStatus;
  created_at: string;
  rotated_at: string | null;
  replaced_by: string | null;
  reason: string | null;
  expires_at: string;
};

type RefreshFamilyRow = {
  family_id: string;
  revoked_at: string;
  reason: string;
  last_jti: string | null;
  expires_at: string;
};

type RotateRefreshTokenCasInput = {
  currentJti: string;
  familyId: string;
  replacement: RefreshTokenRecord;
  rotatedAt: string;
};

export type RotateRefreshTokenCasResult =
  | {
      ok: true;
      replacement: RefreshTokenRecord;
    }
  | {
      ok: false;
      current: RefreshTokenRecord | null;
      family: RefreshFamilyRecord | null;
    };

function addSeconds(date: Date, seconds: number): string {
  return new Date(date.getTime() + seconds * 1000).toISOString();
}

function mapRefreshTokenRow(row: RefreshTokenRow): RefreshTokenRecord {
  return {
    jti: row.jti,
    familyId: row.family_id,
    sub: row.sub,
    email: row.email ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    rotatedAt: row.rotated_at ?? undefined,
    replacedBy: row.replaced_by ?? undefined,
    reason: row.reason ?? undefined,
    expiresAt: row.expires_at,
  };
}

function mapRefreshFamilyRow(row: RefreshFamilyRow): RefreshFamilyRecord {
  return {
    familyId: row.family_id,
    revokedAt: row.revoked_at,
    reason: row.reason,
    lastJti: row.last_jti ?? undefined,
    expiresAt: row.expires_at,
  };
}

export function buildRefreshTokenExpiresAt(now: Date, ttlSeconds: number): string {
  return addSeconds(now, ttlSeconds);
}

export async function createRefreshTokenRecord(
  db: D1Database,
  record: RefreshTokenRecord
): Promise<void> {
  await execute(
    db,
    `INSERT INTO auth_refresh_tokens (
       jti, family_id, sub, email, status, created_at, rotated_at,
       replaced_by, reason, expires_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    record.jti,
    record.familyId,
    record.sub,
    record.email ?? null,
    record.status,
    record.createdAt,
    record.rotatedAt ?? null,
    record.replacedBy ?? null,
    record.reason ?? null,
    record.expiresAt
  );
}

export async function insertRefreshTokenRecordIfMissing(
  db: D1Database,
  record: RefreshTokenRecord
): Promise<void> {
  await execute(
    db,
    `INSERT OR IGNORE INTO auth_refresh_tokens (
       jti, family_id, sub, email, status, created_at, rotated_at,
       replaced_by, reason, expires_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    record.jti,
    record.familyId,
    record.sub,
    record.email ?? null,
    record.status,
    record.createdAt,
    record.rotatedAt ?? null,
    record.replacedBy ?? null,
    record.reason ?? null,
    record.expiresAt
  );
}

export async function getRefreshTokenRecord(
  db: D1Database,
  jti: string
): Promise<RefreshTokenRecord | null> {
  const row = await queryOne<RefreshTokenRow>(
    db,
    `SELECT jti, family_id, sub, email, status, created_at, rotated_at,
            replaced_by, reason, expires_at
       FROM auth_refresh_tokens
      WHERE jti = ?
        AND expires_at > ?
      LIMIT 1`,
    jti,
    new Date().toISOString()
  );

  return row ? mapRefreshTokenRow(row) : null;
}

export async function getRefreshFamilyRecord(
  db: D1Database,
  familyId: string
): Promise<RefreshFamilyRecord | null> {
  const row = await queryOne<RefreshFamilyRow>(
    db,
    `SELECT family_id, revoked_at, reason, last_jti, expires_at
       FROM auth_refresh_families
      WHERE family_id = ?
        AND expires_at > ?
      LIMIT 1`,
    familyId,
    new Date().toISOString()
  );

  return row ? mapRefreshFamilyRow(row) : null;
}

export async function revokeRefreshFamily(
  db: D1Database,
  input: {
    familyId: string;
    reason: string;
    lastJti?: string;
    expiresAt: string;
    revokedAt?: string;
  }
): Promise<void> {
  const revokedAt = input.revokedAt || new Date().toISOString();
  await executeBatch(db, [
    db.prepare(
      `INSERT INTO auth_refresh_families (
         family_id, revoked_at, reason, last_jti, expires_at
       ) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(family_id) DO UPDATE SET
         revoked_at = excluded.revoked_at,
         reason = excluded.reason,
         last_jti = excluded.last_jti,
         expires_at = excluded.expires_at`
    ).bind(
      input.familyId,
      revokedAt,
      input.reason,
      input.lastJti ?? null,
      input.expiresAt
    ),
    db.prepare(
      `UPDATE auth_refresh_tokens
          SET status = 'revoked',
              reason = ?
        WHERE family_id = ?
          AND status = 'active'`
    ).bind(input.reason, input.familyId),
  ]);
}

export async function markRefreshTokenRevoked(
  db: D1Database,
  jti: string,
  reason: string
): Promise<void> {
  await execute(
    db,
    `UPDATE auth_refresh_tokens
        SET status = 'revoked',
            reason = ?
      WHERE jti = ?`,
    reason,
    jti
  );
}

export async function rotateRefreshTokenCas(
  db: D1Database,
  input: RotateRefreshTokenCasInput
): Promise<RotateRefreshTokenCasResult> {
  const replacement = input.replacement;
  const results = await executeBatch(db, [
    db.prepare(
      `UPDATE auth_refresh_tokens
          SET status = 'rotated',
              rotated_at = ?,
              replaced_by = ?
        WHERE jti = ?
          AND family_id = ?
          AND status = 'active'
          AND expires_at > ?
          AND NOT EXISTS (
            SELECT 1
              FROM auth_refresh_families
             WHERE family_id = ?
               AND expires_at > ?
          )`
    ).bind(
      input.rotatedAt,
      replacement.jti,
      input.currentJti,
      input.familyId,
      input.rotatedAt,
      input.familyId,
      input.rotatedAt
    ),
    db.prepare(
      `INSERT INTO auth_refresh_tokens (
         jti, family_id, sub, email, status, created_at, rotated_at,
         replaced_by, reason, expires_at
       )
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE EXISTS (
          SELECT 1
            FROM auth_refresh_tokens
           WHERE jti = ?
             AND family_id = ?
             AND status = 'rotated'
             AND replaced_by = ?
        )
          AND NOT EXISTS (
            SELECT 1
              FROM auth_refresh_families
             WHERE family_id = ?
               AND expires_at > ?
          )`
    ).bind(
      replacement.jti,
      replacement.familyId,
      replacement.sub,
      replacement.email ?? null,
      replacement.status,
      replacement.createdAt,
      replacement.rotatedAt ?? null,
      replacement.replacedBy ?? null,
      replacement.reason ?? null,
      replacement.expiresAt,
      input.currentJti,
      input.familyId,
      replacement.jti,
      input.familyId,
      input.rotatedAt
    ),
  ]);

  const oldUpdated = results[0]?.meta?.changes || 0;
  const replacementInserted = results[1]?.meta?.changes || 0;

  if (oldUpdated === 1 && replacementInserted === 1) {
    return {
      ok: true,
      replacement,
    };
  }

  return {
    ok: false,
    current: await getRefreshTokenRecord(db, input.currentJti),
    family: await getRefreshFamilyRecord(db, input.familyId),
  };
}

export async function consumeTotpStepOnce(
  db: D1Database,
  step: number,
  now: Date = new Date()
): Promise<boolean> {
  if (!Number.isSafeInteger(step) || step < 0) {
    return false;
  }

  const nowIso = now.toISOString();
  const expiresAt = addSeconds(now, TOTP_STATE_TTL_SECONDS);

  await execute(
    db,
    `INSERT OR IGNORE INTO auth_totp_state (id, last_step, consumed_at, expires_at)
     VALUES (?, -1, ?, ?)`,
    TOTP_STATE_ID,
    nowIso,
    expiresAt
  );

  const result = await execute(
    db,
    `UPDATE auth_totp_state
        SET last_step = ?,
            consumed_at = ?,
            expires_at = ?
      WHERE id = ?
        AND last_step < ?`,
    step,
    nowIso,
    expiresAt,
    TOTP_STATE_ID,
    step
  );

  return (result.meta?.changes || 0) === 1;
}
