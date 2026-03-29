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
};

type TranslationJobInput = TranslationJobSnapshot & {
  contentHash: string;
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
    type: 'translation.generate',
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

async function fetchTranslationJobRowById(db: D1Database, id: string) {
  return await queryOne<TranslationJobRow>(
    db,
    `SELECT id, key, status, year, slug, target_lang, source_lang, force_refresh,
            content_hash, created_at, updated_at, started_at, completed_at,
            status_url, cache_url, generate_url, error_json, result_json
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
            status_url, cache_url, generate_url, error_json, result_json
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

function bindInput(input: TranslationJobInput) {
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
  ];
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
       status_url, cache_url, generate_url, error_json, result_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    `INSERT INTO translation_jobs (
       id, key, status, year, slug, target_lang, source_lang, force_refresh,
       content_hash, created_at, updated_at, started_at, completed_at,
       status_url, cache_url, generate_url, error_json, result_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(year, slug, target_lang, content_hash)
     DO UPDATE SET
       key = excluded.key,
       status = excluded.status,
       source_lang = excluded.source_lang,
       force_refresh = excluded.force_refresh,
       updated_at = excluded.updated_at,
       started_at = excluded.started_at,
       completed_at = excluded.completed_at,
       status_url = excluded.status_url,
       cache_url = excluded.cache_url,
       generate_url = excluded.generate_url,
       error_json = excluded.error_json,
       result_json = excluded.result_json`,
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

export async function updateTranslationJobRowById(
  db: D1Database,
  input: TranslationJobInput
): Promise<TranslationJobSnapshot> {
  await execute(
    db,
    `UPDATE translation_jobs
        SET key = ?,
            status = ?,
            source_lang = ?,
            force_refresh = ?,
            updated_at = ?,
            started_at = ?,
            completed_at = ?,
            status_url = ?,
            cache_url = ?,
            generate_url = ?,
            error_json = ?,
            result_json = ?
      WHERE id = ?`,
    input.key,
    input.status,
    input.sourceLang ?? null,
    input.forceRefresh ? 1 : 0,
    input.updatedAt,
    input.startedAt,
    input.completedAt ?? null,
    input.statusUrl,
    input.cacheUrl,
    input.generateUrl,
    serializeJson(input.error),
    serializeJson(input.result),
    input.id
  );

  const row = await fetchTranslationJobRowById(db, input.id);
  if (!row) {
    throw new Error(`Failed to fetch translation job row after update: ${input.id}`);
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
