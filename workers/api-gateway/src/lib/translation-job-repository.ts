import { execute, queryAll, queryOne } from './d1';
import type { TranslationJobStatus } from '../../../../shared/src/contracts/translation.js';

export type TranslationJobRow = {
  id: string; key: string; status: TranslationJobStatus['status'];
  year: string; slug: string; target_lang: 'ko' | 'en'; source_lang: 'ko' | 'en';
  force_refresh: number; content_hash: string; source_version: string;
  created_at: string; updated_at: string; started_at: string; completed_at: string | null;
  status_url: string; cache_url: string; generate_url: string;
  error_json: string | null; result_json: string | null;
  lock_token: string | null; lock_expires_at: string | null; lease_version: number;
  priority: number; attempts: number; available_at: string; outbox_id: string | null;
  active_stage: string | null; checkpoint_json: string; token_budget: number;
  requested_by: string | null; refresh_key: string | null; last_wake_at: string | null;
};
export type TranslationExecutionPolicy = {
  enabled: boolean; allowWarm: boolean; maxConcurrent: number; maxAttempts: number;
  dailyAttempts: number; dailyTokenBudget: number; postDailyAttempts: number; maxPending: number;
};
export const TRANSLATION_STREAM = 'ai.artifact.generate';
export const TRANSLATION_LEASE_MS = 330_000;
const changes = (result: D1Result) => Number(result.meta?.changes || 0);
export const getTranslationJobById = (db: D1Database, id: string) =>
  queryOne<TranslationJobRow>(db, 'SELECT * FROM translation_jobs WHERE id = ?', id);
export const getLatestTranslationJob = (db: D1Database, year: string, slug: string, lang: string, version: string) =>
  queryOne<TranslationJobRow>(db,
    'SELECT * FROM translation_jobs WHERE year=? AND slug=? AND target_lang=? AND source_version=? ORDER BY rowid DESC LIMIT 1',
    year, slug, lang, version);

export async function enqueueTranslationJob(db: D1Database, input: {
  year: string; slug: string; targetLang: 'ko' | 'en'; sourceLang: 'ko' | 'en'; sourceVersion: string;
  priority: number; tokenBudget: number; requestedBy?: string; refreshKey?: string;
  urls: { statusUrl: string; cacheUrl: string; generateUrl: string }; now?: string; maxPending: number;
}) {
  const now = input.now || new Date().toISOString();
  const hash = input.refreshKey ? `${input.sourceVersion}:refresh:${input.refreshKey}` : input.sourceVersion;
  // A plain GET always joins the newest logical revision, including terminal failures.
  const existing = input.refreshKey
    ? await queryOne<TranslationJobRow>(db, 'SELECT * FROM translation_jobs WHERE year=? AND slug=? AND target_lang=? AND content_hash=?', input.year, input.slug, input.targetLang, hash)
    : await getLatestTranslationJob(db, input.year, input.slug, input.targetLang, input.sourceVersion);
  if (existing) {
    if (input.priority > existing.priority && ['queued','deferred'].includes(existing.status)) {
      await execute(db, 'UPDATE translation_jobs SET priority=MAX(priority,?) WHERE id=?', input.priority, existing.id);
    }
    return { created: false, job: (await getTranslationJobById(db, existing.id))! };
  }
  // An old deployment may still have submitted a paid request. Do not replace it silently.
  const unknownLegacy = await queryOne<TranslationJobRow>(db,
    `SELECT * FROM translation_jobs WHERE year=? AND slug=? AND target_lang=? AND source_version LIKE 'legacy:%'
      AND json_extract(error_json,'$.code')='RESULT_UNKNOWN' ORDER BY rowid DESC LIMIT 1`, input.year, input.slug, input.targetLang);
  if (unknownLegacy && !input.refreshKey) return { created: false, job: unknownLegacy };
  const id = `translation-job-${crypto.randomUUID()}`;
  const outboxId = `translation-event-${crypto.randomUUID()}`;
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO translation_jobs (
      id,key,status,year,slug,target_lang,source_lang,force_refresh,content_hash,source_version,
      created_at,updated_at,started_at,status_url,cache_url,generate_url,priority,available_at,outbox_id,token_budget,requested_by,refresh_key
    ) SELECT ?,?,'queued',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
      WHERE (SELECT COUNT(*) FROM translation_jobs WHERE status IN ('queued','deferred','running')) < ?`)
      .bind(id, `${input.year}:${input.slug}:${input.targetLang}`, input.year,input.slug,input.targetLang,input.sourceLang,
        input.refreshKey ? 1 : 0, hash,input.sourceVersion,now,now,now,input.urls.statusUrl,input.urls.cacheUrl,input.urls.generateUrl,
        input.priority,now,outboxId,input.tokenBudget,input.requestedBy||null,input.refreshKey||null,input.maxPending),
    db.prepare(`INSERT OR IGNORE INTO domain_outbox
      (id,stream,aggregate_id,event_type,payload_json,status,retry_count,next_attempt_at,created_at,updated_at,idempotency_key)
      SELECT outbox_id,?,key,'translation.generate',json_object('jobId',id),'pending',0,?,?,?,id FROM translation_jobs WHERE id=?`)
      .bind(TRANSLATION_STREAM,now,now,now,id),
  ]);
  const job = await queryOne<TranslationJobRow>(db,
    'SELECT * FROM translation_jobs WHERE year=? AND slug=? AND target_lang=? AND content_hash=?', input.year,input.slug,input.targetLang,hash);
  if (!job) throw Object.assign(new Error('Translation backlog is full'), { code: 'TRANSLATION_CAPACITY', status: 429 });
  // A warm insert may win while an interactive admission is between its read and insert.
  // Promote after the unique-key race as well; never require a second user request.
  if (input.priority > job.priority && ['queued', 'deferred'].includes(job.status)) {
    await execute(db, `UPDATE translation_jobs SET priority=MAX(priority,?)
      WHERE id=? AND status IN ('queued','deferred')`, input.priority, job.id);
    return { created: job.id === id, job: (await getTranslationJobById(db, job.id))! };
  }
  return { created: job.id === id, job };
}

export function translationQuotaDay(now: string) {
  const value = new Date(now).getTime();
  return new Date(value + 9*3600_000).toISOString().slice(0,10);
}
function nextQuotaDay(now: string) {
  const day = translationQuotaDay(now);
  return new Date(Date.parse(`${day}T00:00:00+09:00`) + 86400_000).toISOString();
}

export async function recoverExpiredTranslationJobs(db: D1Database, now = new Date().toISOString()) {
  // A submitted stage with no persisted result is ambiguous. Never auto-charge it again.
  return db.batch([
    db.prepare(`UPDATE translation_jobs SET
      status=CASE WHEN active_stage IS NULL AND attempts<3 THEN 'deferred' ELSE 'failed' END,
      error_json=CASE WHEN active_stage IS NULL AND attempts>=3 THEN '{"code":"MAX_ATTEMPTS","retryable":false}'
        WHEN active_stage IS NULL THEN '{"code":"EXECUTOR_INTERRUPTED","message":"Execution will resume","retryable":true}'
        ELSE '{"code":"RESULT_UNKNOWN","message":"The previous generation outcome needs review","retryable":false}' END,
      available_at=?,updated_at=?,lock_token=NULL,lock_expires_at=NULL,lease_version=lease_version+1
      WHERE status='running' AND (lock_expires_at IS NULL OR lock_expires_at<=?)`).bind(now,now,now),
    db.prepare(`UPDATE domain_outbox SET status=CASE
        WHEN (SELECT status FROM translation_jobs WHERE outbox_id=domain_outbox.id)='failed' THEN 'dead_letter' ELSE 'pending' END,
      locked_at=NULL,consumer_id=NULL,updated_at=?,next_attempt_at=?
      WHERE status='processing' AND id IN (SELECT outbox_id FROM translation_jobs WHERE status IN ('failed','deferred'))`).bind(now,now),
  ]);
}

export async function claimNextTranslationJob(db: D1Database, policy: TranslationExecutionPolicy, now = new Date().toISOString()) {
  await recoverExpiredTranslationJobs(db, now);
  if (!policy.enabled) {
    await execute(db, `UPDATE translation_jobs SET status='deferred', error_json='{"code":"EXECUTION_DISABLED","message":"Translation execution is paused","retryable":true}',updated_at=?
      WHERE status IN ('queued','deferred')`, now);
    return null;
  }
  const candidates = await queryAll<TranslationJobRow>(db,
    `SELECT j.* FROM translation_jobs j JOIN domain_outbox o ON o.id=j.outbox_id
      WHERE j.status IN ('queued','deferred') AND j.available_at<=? AND j.attempts<?
        AND o.status='pending' AND (?=1 OR j.priority>=100)
      ORDER BY CASE WHEN j.created_at<=? THEN 1 ELSE 0 END DESC,j.priority DESC,j.created_at ASC,j.rowid ASC LIMIT 12`,
    now,policy.maxAttempts,policy.allowWarm ? 1 : 0,new Date(Date.parse(now)-600_000).toISOString());
  const day = translationQuotaDay(now);
  for (const candidate of candidates) {
    const token = crypto.randomUUID();
    const results = await db.batch([
      db.prepare(`UPDATE translation_jobs SET status='running',lock_token=?,lock_expires_at=?,lease_version=lease_version+1,
        attempts=attempts+1,started_at=?,updated_at=?,error_json=NULL
        WHERE id=? AND status IN ('queued','deferred') AND available_at<=? AND attempts<?
        AND (SELECT COUNT(*) FROM translation_jobs WHERE status='running')<?
        AND NOT EXISTS(SELECT 1 FROM translation_jobs other WHERE other.key=translation_jobs.key AND other.status='running')
        AND (SELECT COUNT(*) FROM translation_attempts WHERE day=?)<?
        AND (SELECT COALESCE(SUM(token_budget),0) FROM translation_attempts WHERE day=?)+token_budget<=?
        AND (SELECT COUNT(*) FROM translation_attempts a JOIN translation_jobs j ON j.id=a.job_id WHERE a.day=? AND j.key=translation_jobs.key)<?`)
        .bind(token,new Date(Date.parse(now)+TRANSLATION_LEASE_MS).toISOString(),now,now,candidate.id,now,policy.maxAttempts,
          policy.maxConcurrent,day,policy.dailyAttempts,day,policy.dailyTokenBudget,day,policy.postDailyAttempts),
      db.prepare(`INSERT INTO translation_attempts(id,job_id,day,token_budget,created_at)
        SELECT ?,id,?,token_budget,? FROM translation_jobs WHERE id=? AND lock_token=?`).bind(token,day,now,candidate.id,token),
      db.prepare(`UPDATE domain_outbox SET status='processing',locked_at=?,consumer_id=?,last_attempt_at=?,updated_at=?
        WHERE id IN (SELECT outbox_id FROM translation_jobs WHERE id=? AND lock_token=?)`).bind(now,token,now,now,candidate.id,token),
    ]);
    if (changes(results[0])) return (await getTranslationJobById(db, candidate.id))!;
    const totals = await queryOne<{n:number;tokens:number}>(db,
      'SELECT COUNT(*) AS n,COALESCE(SUM(token_budget),0) AS tokens FROM translation_attempts WHERE day=?', day);
    const postTotal = await queryOne<{n:number}>(db,
      'SELECT COUNT(*) AS n FROM translation_attempts a JOIN translation_jobs j ON j.id=a.job_id WHERE day=? AND j.key=?', day,candidate.key);
    const quota = Number(totals?.n)>=policy.dailyAttempts || Number(totals?.tokens)+candidate.token_budget>policy.dailyTokenBudget || Number(postTotal?.n)>=policy.postDailyAttempts;
    await execute(db, `UPDATE translation_jobs SET status='deferred',available_at=?,error_json=?,updated_at=? WHERE id=? AND status IN ('queued','deferred')`,
      quota ? nextQuotaDay(now) : new Date(Date.parse(now)+10_000).toISOString(),
      JSON.stringify({ code: quota ? 'TRANSLATION_BUDGET' : 'EXECUTOR_BUSY', message: quota ? 'Daily translation budget reached' : 'Waiting for an execution slot', retryable:true }), now,candidate.id);
  }
  return null;
}

export async function markTranslationStage(db: D1Database, job: TranslationJobRow, stage: string, now = new Date().toISOString()) {
  const result = await execute(db, `UPDATE translation_jobs SET active_stage=?,updated_at=? WHERE id=? AND status='running' AND lock_token=? AND lease_version=? AND lock_expires_at>?`,
    stage,now,job.id,job.lock_token,job.lease_version,now);
  if (!changes(result)) throw Object.assign(new Error('Translation lease lost'), { code:'LEASE_LOST' });
}
export async function checkpointTranslation(db: D1Database, job: TranslationJobRow, checkpoint: Record<string,string>, now = new Date().toISOString()) {
  const result = await execute(db, `UPDATE translation_jobs SET checkpoint_json=?,active_stage=NULL,updated_at=? WHERE id=? AND status='running' AND lock_token=? AND lease_version=? AND lock_expires_at>?`,
    JSON.stringify(checkpoint),now,job.id,job.lock_token,job.lease_version,now);
  if (!changes(result)) throw Object.assign(new Error('Translation lease lost'), { code:'LEASE_LOST' });
}
export async function settleTranslationJob(db: D1Database, job: TranslationJobRow, input: {
  status:'succeeded'|'failed'|'deferred'; error?: {code:string;message:string;retryable:boolean}; nextAt?: string; now?: string;
}) {
  const now = input.now || new Date().toISOString();
  const results = await db.batch([
    db.prepare(`UPDATE translation_jobs SET status=?,error_json=?,updated_at=?,completed_at=?,available_at=?,lock_token=NULL,lock_expires_at=NULL,active_stage=NULL
      WHERE id=? AND status='running' AND lock_token=? AND lease_version=? AND lock_expires_at>?`)
      .bind(input.status,input.error ? JSON.stringify(input.error) : null,now,input.status==='deferred'?null:now,input.nextAt||now,job.id,job.lock_token,job.lease_version,now),
    db.prepare(`UPDATE domain_outbox SET status=?,next_attempt_at=?,updated_at=?,locked_at=NULL,consumer_id=NULL,last_error=?,retry_count=?
      WHERE id=? AND consumer_id=? AND EXISTS(SELECT 1 FROM translation_jobs WHERE id=? AND status=? AND lease_version=?)`)
      .bind(input.status==='succeeded'?'processed':input.status==='failed'?'dead_letter':'pending',input.nextAt||now,now,input.error?.code||null,job.attempts,
        job.outbox_id,job.lock_token,job.id,input.status,job.lease_version),
  ]);
  return changes(results[0])>0;
}

export async function commitTranslationCache(db: D1Database, job: TranslationJobRow, value: {title:string;description:string;content:string;isAiGenerated?:boolean}) {
  const now = new Date().toISOString();
  // The lease and superseding logical revisions are checked in the same SQL statement as the write.
  const result = await execute(db, `INSERT INTO post_translations_cache
    (post_slug,year,source_lang,target_lang,title,description,content,content_hash,source_version,is_ai_generated)
    SELECT slug,year,source_lang,target_lang,?,?,?,content_hash,source_version,? FROM translation_jobs j
    WHERE id=? AND status='running' AND lock_token=? AND lease_version=? AND lock_expires_at>?
      AND NOT EXISTS(SELECT 1 FROM translation_jobs newer WHERE newer.key=j.key AND newer.rowid>j.rowid)
    ON CONFLICT(post_slug,year,target_lang) DO UPDATE SET title=excluded.title,description=excluded.description,content=excluded.content,
      source_lang=excluded.source_lang,content_hash=excluded.content_hash,source_version=excluded.source_version,is_ai_generated=excluded.is_ai_generated,updated_at=datetime('now')`,
    value.title,value.description,value.content,value.isAiGenerated===false?0:1,job.id,job.lock_token,job.lease_version,now);
  if (!changes(result)) throw Object.assign(new Error('Translation was superseded or its lease was lost'), {code:'SUPERSEDED'});
}

export async function invalidateTranslationCache(db: D1Database, year:string,slug:string,lang:string) {
  const now=new Date().toISOString();
  await db.batch([
    db.prepare(`UPDATE translation_jobs SET status='failed',error_json='{"code":"CACHE_INVALIDATED","message":"Cache was invalidated by an administrator","retryable":false}',lock_token=NULL,lock_expires_at=NULL,lease_version=lease_version+1,updated_at=?
      WHERE year=? AND slug=? AND target_lang=?`).bind(now,year,slug,lang),
    db.prepare(`UPDATE domain_outbox SET status='dead_letter',consumer_id=NULL,locked_at=NULL WHERE id IN (SELECT outbox_id FROM translation_jobs WHERE year=? AND slug=? AND target_lang=?)`).bind(year,slug,lang),
    db.prepare('DELETE FROM post_translations_cache WHERE year=? AND post_slug=? AND target_lang=?').bind(year,slug,lang),
  ]);
}

export async function reserveTranslationWake(db:D1Database,id:string,now=new Date().toISOString()) {
  const result=await execute(db, `UPDATE translation_jobs SET last_wake_at=? WHERE id=? AND status IN ('queued','deferred') AND available_at<=?
    AND (last_wake_at IS NULL OR last_wake_at<=?)`,now,id,now,new Date(Date.parse(now)-10_000).toISOString());
  return changes(result)>0;
}

export async function isLatestTranslationJob(db:D1Database, job:TranslationJobRow) {
  const latest=await queryOne<{id:string}>(db,'SELECT id FROM translation_jobs WHERE key=? ORDER BY rowid DESC LIMIT 1',job.key);
  return latest?.id===job.id;
}
