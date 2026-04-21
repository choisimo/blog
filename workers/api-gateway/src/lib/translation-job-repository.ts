import type { D1Database } from '@cloudflare/workers-types';

import type {
  TranslationJobError,
  TranslationJobResultSummary,
  TranslationJobSnapshot,
} from '../routes/lib/translation-jobs';

import { execute, queryOne } from './d1';

type TranslationJobRow = {
  id: string;
  key: string;
  status: TranslationJobSnapshot['status'];
  year: string;
  slug: string;
  target_lang: string;
  source_lang: string | null;
  force_refresh: number;
  content_hash: string;
  created_at: string;
  updated_at: string;
  started_at: string;
  completed_at: string | null;
  status_url: string;
  cache_url: string;
  generate_url: string;
  error_json: string | null;
  result_json: string | null;
  lock_token: string | null;
  lock_expires_at: string | null;
};

type TranslationJobInput = TranslationJobSnapshot & {
  contentHash: string;
};

type TranslationJobLeaseInput = TranslationJobInput & {
  lockToken: string;
  lockExpiresAt: string;
};

export type TranslationJobLeaseClaim = {
  job: TranslationJobSnapshot;
  acquired: boolean;
  reclaimedStaleLease: boolean;
};

function parseJson<T>(value: string | null): T | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

function mapRow(row: TranslationJobRow): TranslationJobSnapshot {
  return {
    id: row.id,
    key: row.key,
    status: row.status,
    year: row.year,
    slug: row.slug,
    targetLang: row.target_lang,
    sourceLang: row.source_lang ?? undefined,
    forceRefresh: row.force_refresh === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? undefined,
    statusUrl: row.status_url,
    cacheUrl: row.cache_url,
    generateUrl: row.generate_url,
    error: parseJson<TranslationJobError>(row.error_json),
    result: parseJson<TranslationJobResultSummary>(row.result_json),
  };
}

function serializeJson(value: TranslationJobError | TranslationJobResultSummary | undefined) {
  return value === undefined ? null : JSON.stringify(value);
}

function bindInput(
  input: TranslationJobInput,
  lock: { lockToken?: string | null; lockExpiresAt?: string | null } = {}
) {
  return [
    input.id,
    input.key,
    input.status,
    input.year,
    input.slug,
    input.targetLang,
    input.sourceLang ?? null,
    input.forceRefresh ? 1 : 0,
    input.contentHash,
    input.createdAt,
    input.updatedAt,
    input.startedAt,
    input.completedAt ?? null,
    input.statusUrl,
    input.cacheUrl,
    input.generateUrl,
    serializeJson(input.error),
    serializeJson(input.result),
    lock.lockToken ?? null,
    lock.lockExpiresAt ?? null,
  ];
}

async function fetchTranslationJobRowById(db: D1Database, id: string) {
  return await queryOne<TranslationJobRow>(
    db,
    `SELECT id, key, status, year, slug, target_lang, source_lang, force_refresh,
            content_hash, created_at, updated_at, started_at, completed_at,
            status_url, cache_url, generate_url, error_json, result_json,
            lock_token, lock_expires_at
       FROM translation_jobs
      WHERE id = ?
      LIMIT 1`,
    id
  );
}

async function fetchTranslationJobRowByScopeHash(
  db: D1Database,
  year: string,
  slug: string,
  targetLang: string,
  contentHash: string
) {
  return await queryOne<TranslationJobRow>(
    db,
    `SELECT id, key, status, year, slug, target_lang, source_lang, force_refresh,
            content_hash, created_at, updated_at, started_at, completed_at,
            status_url, cache_url, generate_url, error_json, result_json,
            lock_token, lock_expires_at
       FROM translation_jobs
      WHERE year = ?
        AND slug = ?
        AND target_lang = ?
        AND content_hash = ?
      LIMIT 1`,
    year,
    slug,
    targetLang,
    contentHash
  );
}

export async function createTranslationJobRow(
  db: D1Database,
  input: TranslationJobInput
): Promise<TranslationJobSnapshot> {
  await execute(
    db,
    `INSERT INTO translation_jobs (
       id, key, status, year, slug, target_lang, source_lang, force_refresh,
       content_hash, created_at, updated_at, started_at, completed_at,
       status_url, cache_url, generate_url, error_json, result_json,
       lock_token, lock_expires_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ...bindInput(input)
  );

  const row = await fetchTranslationJobRowById(db, input.id);
  if (!row) {
    throw new Error(`Failed to fetch translation job row after insert: ${input.id}`);
  }

  return mapRow(row);
}

export async function upsertTranslationJobRow(
  db: D1Database,
  input: TranslationJobInput
): Promise<TranslationJobSnapshot> {
  await execute(
    db,
    `INSERT OR REPLACE INTO translation_jobs (
       id, key, status, year, slug, target_lang, source_lang, force_refresh,
       content_hash, created_at, updated_at, started_at, completed_at,
       status_url, cache_url, generate_url, error_json, result_json,
       lock_token, lock_expires_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ...bindInput(input)
  );

  const row = await fetchTranslationJobRowByScopeHash(
    db,
    input.year,
    input.slug,
    input.targetLang,
    input.contentHash
  );
  if (!row) {
    throw new Error(
      `Failed to fetch translation job row after upsert: ${input.year}/${input.slug}/${input.targetLang}`
    );
  }

  return mapRow(row);
}

export async function fetchTranslationJobById(
  db: D1Database,
  id: string
): Promise<TranslationJobSnapshot | null> {
  const row = await fetchTranslationJobRowById(db, id);
  return row ? mapRow(row) : null;
}

export async function fetchActiveTranslationJob(
  db: D1Database,
  year: string,
  slug: string,
  targetLang: string,
  contentHash: string
): Promise<TranslationJobSnapshot | null> {
  const row = await fetchTranslationJobRowByScopeHash(db, year, slug, targetLang, contentHash);
  return row ? mapRow(row) : null;
}

export async function claimTranslationJobLease(
  db: D1Database,
  input: TranslationJobLeaseInput
): Promise<TranslationJobLeaseClaim> {
  const insertResult = await execute(
    db,
    `INSERT OR IGNORE INTO translation_jobs (
       id, key, status, year, slug, target_lang, source_lang, force_refresh,
       content_hash, created_at, updated_at, started_at, completed_at,
       status_url, cache_url, generate_url, error_json, result_json,
       lock_token, lock_expires_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ...bindInput(input, {
      lockToken: input.lockToken,
      lockExpiresAt: input.lockExpiresAt,
    })
  );

  if ((insertResult.meta?.changes || 0) > 0) {
    const inserted = await fetchTranslationJobRowById(db, input.id);
    if (!inserted) {
      throw new Error(`Failed to fetch translation job after lease insert: ${input.id}`);
    }
    return {
      job: mapRow(inserted),
      acquired: true,
      reclaimedStaleLease: false,
    };
  }

  const reclaimResult = await execute(
    db,
    `UPDATE translation_jobs
        SET id = ?,
            key = ?,
            status = ?,
            source_lang = ?,
            force_refresh = ?,
            created_at = ?,
            updated_at = ?,
            started_at = ?,
            completed_at = ?,
            status_url = ?,
            cache_url = ?,
            generate_url = ?,
            error_json = ?,
            result_json = ?,
            lock_token = ?,
            lock_expires_at = ?
      WHERE year = ?
        AND slug = ?
        AND target_lang = ?
        AND content_hash = ?
        AND (status != 'running' OR lock_expires_at IS NULL OR lock_expires_at < ?)`,
    input.id,
    input.key,
    input.status,
    input.sourceLang ?? null,
    input.forceRefresh ? 1 : 0,
    input.createdAt,
    input.updatedAt,
    input.startedAt,
    input.completedAt ?? null,
    input.statusUrl,
    input.cacheUrl,
    input.generateUrl,
    serializeJson(input.error),
    serializeJson(input.result),
    input.lockToken,
    input.lockExpiresAt,
    input.year,
    input.slug,
    input.targetLang,
    input.contentHash,
    input.updatedAt
  );

  const row = await fetchTranslationJobRowByScopeHash(
    db,
    input.year,
    input.slug,
    input.targetLang,
    input.contentHash
  );
  if (!row) {
    throw new Error(
      `Failed to fetch translation job after lease claim: ${input.year}/${input.slug}/${input.targetLang}`
    );
  }

  return {
    job: mapRow(row),
    acquired: row.lock_token === input.lockToken,
    reclaimedStaleLease: (reclaimResult.meta?.changes || 0) > 0,
  };
}

export async function settleTranslationJobLease(
  db: D1Database,
  input: {
    id: string;
    lockToken: string;
    status: Extract<TranslationJobSnapshot['status'], 'succeeded' | 'failed'>;
    updatedAt: string;
    completedAt: string;
    error?: TranslationJobError;
    result?: TranslationJobResultSummary;
  }
): Promise<TranslationJobSnapshot | null> {
  const result = await execute(
    db,
    `UPDATE translation_jobs
        SET status = ?,
            updated_at = ?,
            completed_at = ?,
            error_json = ?,
            result_json = ?,
            lock_token = NULL,
            lock_expires_at = NULL
      WHERE id = ?
        AND lock_token = ?`,
    input.status,
    input.updatedAt,
    input.completedAt,
    serializeJson(input.error),
    serializeJson(input.result),
    input.id,
    input.lockToken
  );

  if ((result.meta?.changes || 0) === 0) {
    return null;
  }

  return fetchTranslationJobById(db, input.id);
}
