import { execute, queryOne, queryAll } from './d1';

export const AI_ARTIFACT_FEED_TYPES = ['feed.lens', 'feed.thought'] as const;
export type AiArtifactFeedType = (typeof AI_ARTIFACT_FEED_TYPES)[number];

type ArtifactVersionRow = {
  id: string;
  artifact_type: AiArtifactFeedType;
  scope_key: string;
  scope_type: string;
  source_ref: string;
  source_hash: string;
  prompt_version: string;
  schema_version: string;
  model_route: string | null;
  generation_version_hash: string;
  status: 'warming' | 'ready' | 'stale' | 'superseded' | 'failed';
  active: number;
  latest_page: number;
  meta_json: string | null;
  created_at: string;
  updated_at: string;
  ready_at: string | null;
};

type ArtifactPageRow = {
  id: string;
  version_id: string;
  page_no: number;
  logical_keys_json: string;
  item_hashes_json: string;
  payload_json: string;
  exhausted: number;
  created_at: string;
};

type ReadStateRow = {
  logical_key: string;
  item_hash: string;
};

export type ArtifactPagePayload<T> = {
  items: T[];
  nextCursor: unknown | null;
  exhausted: boolean;
};

export type StoredArtifactPage<T> = {
  versionId: string;
  artifactType: AiArtifactFeedType;
  scopeKey: string;
  sourceHash: string;
  generationVersionHash: string;
  pageNo: number;
  payload: ArtifactPagePayload<T>;
  logicalKeys: string[];
  itemHashes: string[];
  exhausted: boolean;
  status: 'warming' | 'ready' | 'stale' | 'superseded' | 'failed';
  active: boolean;
  updatedAt: string;
};

export type ItemReadState = {
  logicalKey: string;
  itemHash: string;
  unread: boolean;
  changed: boolean;
};

const schemaInit = new WeakMap<D1Database, Promise<void>>();

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

export async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(digest);
}

export async function buildFeedScopeKey(paragraph: string, postTitle?: string) {
  const hash = await sha256Hex(`${postTitle || ''}\n${paragraph.trim()}`);
  return `seg:${hash.slice(0, 24)}`;
}

export async function buildFeedSourceHash(paragraph: string, postTitle?: string) {
  const hash = await sha256Hex(`${postTitle || ''}\n${paragraph.trim()}`);
  return `sha256:${hash}`;
}

export async function buildGenerationVersionHash(input: {
  sourceHash: string;
  artifactType: string;
  promptVersion: string;
  schemaVersion: string;
  modelRoute: string;
}) {
  const hash = await sha256Hex(
    [
      input.sourceHash,
      input.artifactType,
      input.promptVersion,
      input.schemaVersion,
      input.modelRoute,
    ].join('|')
  );
  return `sha256:${hash}`;
}

export async function computeItemHash(
  generationVersionHash: string,
  logicalKey: string,
  payload: unknown
) {
  const hash = await sha256Hex(
    [logicalKey, JSON.stringify(payload), generationVersionHash].join('|')
  );
  return `sha256:${hash}`;
}

export async function ensureAiArtifactSchema(db: D1Database) {
  const existing = schemaInit.get(db);
  if (existing) {
    await existing;
    return;
  }

  const initPromise = (async () => {
    await execute(
      db,
      `CREATE TABLE IF NOT EXISTS ai_artifact_versions (
         id TEXT PRIMARY KEY,
         artifact_type TEXT NOT NULL,
         scope_key TEXT NOT NULL,
         scope_type TEXT NOT NULL,
         source_ref TEXT NOT NULL,
         source_hash TEXT NOT NULL,
         prompt_version TEXT NOT NULL,
         schema_version TEXT NOT NULL DEFAULT '1',
         model_route TEXT,
         generation_version_hash TEXT NOT NULL,
         status TEXT NOT NULL,
         active INTEGER NOT NULL DEFAULT 0,
         latest_page INTEGER NOT NULL DEFAULT -1,
         meta_json TEXT,
         created_at TEXT NOT NULL DEFAULT (datetime('now')),
         updated_at TEXT NOT NULL DEFAULT (datetime('now')),
         ready_at TEXT,
         UNIQUE (artifact_type, scope_key, generation_version_hash)
       )`
    );
    await execute(
      db,
      `CREATE INDEX IF NOT EXISTS idx_ai_artifact_versions_lookup
         ON ai_artifact_versions (artifact_type, scope_key, active, status, updated_at DESC)`
    );
    await execute(
      db,
      `CREATE INDEX IF NOT EXISTS idx_ai_artifact_versions_status
         ON ai_artifact_versions (status, updated_at DESC)`
    );
    await execute(
      db,
      `CREATE TABLE IF NOT EXISTS ai_artifact_pages (
         id TEXT PRIMARY KEY,
         version_id TEXT NOT NULL,
         page_no INTEGER NOT NULL,
         logical_keys_json TEXT NOT NULL,
         item_hashes_json TEXT NOT NULL,
         payload_json TEXT NOT NULL,
         exhausted INTEGER NOT NULL DEFAULT 0,
         created_at TEXT NOT NULL DEFAULT (datetime('now')),
         UNIQUE (version_id, page_no)
       )`
    );
    await execute(
      db,
      `CREATE INDEX IF NOT EXISTS idx_ai_artifact_pages_version
         ON ai_artifact_pages (version_id, page_no)`
    );
    await execute(
      db,
      `CREATE TABLE IF NOT EXISTS user_ai_artifact_read_state (
         id TEXT PRIMARY KEY,
         user_key TEXT NOT NULL,
         artifact_type TEXT NOT NULL,
         scope_key TEXT NOT NULL,
         logical_key TEXT NOT NULL,
         item_hash TEXT NOT NULL,
         first_read_at TEXT NOT NULL DEFAULT (datetime('now')),
         last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
         UNIQUE (user_key, artifact_type, scope_key, logical_key)
       )`
    );
    await execute(
      db,
      `CREATE INDEX IF NOT EXISTS idx_user_ai_artifact_read_state_lookup
         ON user_ai_artifact_read_state (user_key, artifact_type, scope_key)`
    );
    await execute(
      db,
      `CREATE TABLE IF NOT EXISTS ai_warm_candidates (
         id TEXT PRIMARY KEY,
         artifact_type TEXT NOT NULL,
         scope_key TEXT NOT NULL,
         source_ref TEXT NOT NULL,
         target_lang TEXT NOT NULL DEFAULT '',
         priority TEXT NOT NULL,
         candidate_score REAL NOT NULL DEFAULT 0,
         target_pages INTEGER NOT NULL DEFAULT 1,
         next_run_at TEXT NOT NULL,
         last_enqueued_at TEXT,
         last_success_at TEXT,
         last_error TEXT,
         fail_count INTEGER NOT NULL DEFAULT 0,
         status TEXT NOT NULL DEFAULT 'pending',
         meta_json TEXT,
         created_at TEXT NOT NULL DEFAULT (datetime('now')),
         updated_at TEXT NOT NULL DEFAULT (datetime('now')),
         UNIQUE (artifact_type, scope_key, target_lang)
       )`
    );
    await execute(
      db,
      `CREATE INDEX IF NOT EXISTS idx_ai_warm_candidates_schedule
         ON ai_warm_candidates (status, priority, next_run_at, candidate_score DESC)`
    );
    await execute(
      db,
      `CREATE INDEX IF NOT EXISTS idx_ai_warm_candidates_lookup
         ON ai_warm_candidates (artifact_type, scope_key, target_lang)`
    );
    await execute(
      db,
      `CREATE TABLE IF NOT EXISTS ai_scheduler_decisions (
         id TEXT PRIMARY KEY,
         scheduler_id TEXT NOT NULL,
         redis_up INTEGER NOT NULL,
         queue_enabled INTEGER NOT NULL,
         queue_length INTEGER NOT NULL,
         dlq_length INTEGER NOT NULL,
         allow_warm INTEGER NOT NULL,
         decision_reason TEXT,
         snapshot_json TEXT,
         created_at TEXT NOT NULL DEFAULT (datetime('now'))
       )`
    );
    await execute(
      db,
      `CREATE INDEX IF NOT EXISTS idx_ai_scheduler_decisions_created
         ON ai_scheduler_decisions (created_at DESC)`
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

async function getArtifactVersionByGenerationHash(
  db: D1Database,
  artifactType: AiArtifactFeedType,
  scopeKey: string,
  generationVersionHash: string
): Promise<ArtifactVersionRow | null> {
  return queryOne<ArtifactVersionRow>(
    db,
    `SELECT * FROM ai_artifact_versions
      WHERE artifact_type = ?
        AND scope_key = ?
        AND generation_version_hash = ?
        AND status = 'ready'
      ORDER BY ready_at DESC, updated_at DESC
      LIMIT 1`,
    artifactType,
    scopeKey,
    generationVersionHash
  );
}

async function getLatestReadyVersion(
  db: D1Database,
  artifactType: AiArtifactFeedType,
  scopeKey: string
): Promise<ArtifactVersionRow | null> {
  return queryOne<ArtifactVersionRow>(
    db,
    `SELECT * FROM ai_artifact_versions
      WHERE artifact_type = ?
        AND scope_key = ?
        AND status = 'ready'
      ORDER BY active DESC, ready_at DESC, updated_at DESC
      LIMIT 1`,
    artifactType,
    scopeKey
  );
}

async function getArtifactPage(
  db: D1Database,
  versionId: string,
  pageNo: number
): Promise<ArtifactPageRow | null> {
  return queryOne<ArtifactPageRow>(
    db,
    `SELECT * FROM ai_artifact_pages WHERE version_id = ? AND page_no = ?`,
    versionId,
    pageNo
  );
}

function mapStoredPage<T>(
  version: ArtifactVersionRow,
  page: ArtifactPageRow
): StoredArtifactPage<T> {
  return {
    versionId: version.id,
    artifactType: version.artifact_type,
    scopeKey: version.scope_key,
    sourceHash: version.source_hash,
    generationVersionHash: version.generation_version_hash,
    pageNo: page.page_no,
    payload: parseJson(page.payload_json, {
      items: [],
      nextCursor: null,
      exhausted: true,
    }) as ArtifactPagePayload<T>,
    logicalKeys: parseJson(page.logical_keys_json, []),
    itemHashes: parseJson(page.item_hashes_json, []),
    exhausted: page.exhausted === 1,
    status: version.status,
    active: version.active === 1,
    updatedAt: version.updated_at,
  };
}

export async function getArtifactPageForVersion<T>(
  db: D1Database,
  artifactType: AiArtifactFeedType,
  scopeKey: string,
  generationVersionHash: string,
  pageNo: number
): Promise<StoredArtifactPage<T> | null> {
  await ensureAiArtifactSchema(db);
  const version = await getArtifactVersionByGenerationHash(
    db,
    artifactType,
    scopeKey,
    generationVersionHash
  );
  if (!version) return null;
  const page = await getArtifactPage(db, version.id, pageNo);
  return page ? mapStoredPage<T>(version, page) : null;
}

export async function getLatestReadyArtifactPage<T>(
  db: D1Database,
  artifactType: AiArtifactFeedType,
  scopeKey: string,
  pageNo: number
): Promise<StoredArtifactPage<T> | null> {
  await ensureAiArtifactSchema(db);
  const version = await getLatestReadyVersion(db, artifactType, scopeKey);
  if (!version) return null;
  const page = await getArtifactPage(db, version.id, pageNo);
  return page ? mapStoredPage<T>(version, page) : null;
}

export async function storeReadyArtifactPages<T>(
  db: D1Database,
  input: {
    artifactType: AiArtifactFeedType;
    scopeKey: string;
    scopeType: string;
    sourceRef: string;
    sourceHash: string;
    promptVersion: string;
    schemaVersion: string;
    modelRoute: string;
    generationVersionHash: string;
    pages: Array<{
      pageNo: number;
      payload: ArtifactPagePayload<T>;
      logicalKeys: string[];
      itemHashes: string[];
      exhausted: boolean;
    }>;
    meta?: Record<string, unknown>;
  }
) {
  await ensureAiArtifactSchema(db);
  const versionId = `afv_${crypto.randomUUID()}`;
  const now = nowIso();
  const latestPage = input.pages.reduce((max, page) => Math.max(max, page.pageNo), -1);

  await execute(
    db,
    `UPDATE ai_artifact_versions
        SET active = 0,
            status = CASE WHEN status = 'ready' THEN 'superseded' ELSE status END,
            updated_at = ?
      WHERE artifact_type = ?
        AND scope_key = ?
        AND active = 1`,
    now,
    input.artifactType,
    input.scopeKey
  );

  await execute(
    db,
    `INSERT INTO ai_artifact_versions (
       id, artifact_type, scope_key, scope_type, source_ref, source_hash,
       prompt_version, schema_version, model_route, generation_version_hash,
       status, active, latest_page, meta_json, created_at, updated_at, ready_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready', 1, ?, ?, ?, ?, ?)`,
    versionId,
    input.artifactType,
    input.scopeKey,
    input.scopeType,
    input.sourceRef,
    input.sourceHash,
    input.promptVersion,
    input.schemaVersion,
    input.modelRoute,
    input.generationVersionHash,
    latestPage,
    JSON.stringify(input.meta ?? {}),
    now,
    now,
    now
  );

  for (const page of input.pages) {
    await execute(
      db,
      `INSERT INTO ai_artifact_pages (
         id, version_id, page_no, logical_keys_json, item_hashes_json, payload_json, exhausted, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      `afp_${crypto.randomUUID()}`,
      versionId,
      page.pageNo,
      JSON.stringify(page.logicalKeys),
      JSON.stringify(page.itemHashes),
      JSON.stringify(page.payload),
      page.exhausted ? 1 : 0,
      now
    );
  }

  return versionId;
}

export async function upsertWarmCandidate(
  db: D1Database,
  input: {
    artifactType: string;
    scopeKey: string;
    sourceRef: string;
    targetLang?: string | null;
    priority: 'interactive' | 'publish' | 'revisit' | 'hot' | 'idle';
    candidateScore?: number;
    targetPages?: number;
    meta?: Record<string, unknown>;
  }
) {
  await ensureAiArtifactSchema(db);
  const now = nowIso();
  await execute(
    db,
    `INSERT INTO ai_warm_candidates (
       id, artifact_type, scope_key, source_ref, target_lang, priority,
       candidate_score, target_pages, next_run_at, last_enqueued_at,
       status, meta_json, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
     ON CONFLICT(artifact_type, scope_key, target_lang)
     DO UPDATE SET
       priority = excluded.priority,
       candidate_score = excluded.candidate_score,
       target_pages = excluded.target_pages,
       next_run_at = excluded.next_run_at,
       last_enqueued_at = excluded.last_enqueued_at,
       meta_json = excluded.meta_json,
       updated_at = excluded.updated_at`,
    `awc_${crypto.randomUUID()}`,
    input.artifactType,
    input.scopeKey,
    input.sourceRef,
    input.targetLang ?? '',
    input.priority,
    input.candidateScore ?? 0,
    Math.max(1, input.targetPages ?? 1),
    now,
    now,
    JSON.stringify(input.meta ?? {}),
    now,
    now
  );
}

export async function recordSchedulerDecision(
  db: D1Database,
  input: {
    schedulerId: string;
    redisUp: boolean;
    queueEnabled: boolean;
    queueLength: number;
    dlqLength: number;
    allowWarm: boolean;
    decisionReason: string;
    snapshot: Record<string, unknown>;
  }
) {
  await ensureAiArtifactSchema(db);
  await execute(
    db,
    `INSERT INTO ai_scheduler_decisions (
       id, scheduler_id, redis_up, queue_enabled, queue_length,
       dlq_length, allow_warm, decision_reason, snapshot_json, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    `asd_${crypto.randomUUID()}`,
    input.schedulerId,
    input.redisUp ? 1 : 0,
    input.queueEnabled ? 1 : 0,
    input.queueLength,
    input.dlqLength,
    input.allowWarm ? 1 : 0,
    input.decisionReason,
    JSON.stringify(input.snapshot),
    nowIso()
  );
}

export async function buildItemReadStates(
  db: D1Database,
  input: {
    userKey: string;
    artifactType: AiArtifactFeedType;
    scopeKey: string;
    logicalKeys: string[];
    itemHashes: string[];
  }
): Promise<{ itemStates: ItemReadState[]; unreadCount: number }> {
  await ensureAiArtifactSchema(db);
  if (!input.logicalKeys.length || input.logicalKeys.length !== input.itemHashes.length) {
    return { itemStates: [], unreadCount: 0 };
  }

  const rows = await queryAll<ReadStateRow>(
    db,
    `SELECT logical_key, item_hash
       FROM user_ai_artifact_read_state
      WHERE user_key = ?
        AND artifact_type = ?
        AND scope_key = ?`,
    input.userKey,
    input.artifactType,
    input.scopeKey
  );
  const byKey = new Map(rows.map((row) => [row.logical_key, row.item_hash]));

  const itemStates = input.logicalKeys.map((logicalKey, index) => {
    const itemHash = input.itemHashes[index] || '';
    const previousHash = byKey.get(logicalKey);
    return {
      logicalKey,
      itemHash,
      unread: previousHash == null || previousHash !== itemHash,
      changed: previousHash != null && previousHash !== itemHash,
    };
  });

  return {
    itemStates,
    unreadCount: itemStates.filter((item) => item.unread).length,
  };
}

export async function markArtifactItemsRead(
  db: D1Database,
  input: {
    userKey: string;
    artifactType: string;
    scopeKey: string;
    items: Array<{ logicalKey: string; itemHash: string }>;
  }
) {
  await ensureAiArtifactSchema(db);
  const now = nowIso();

  for (const item of input.items) {
    if (!item.logicalKey || !item.itemHash) continue;
    await execute(
      db,
      `INSERT INTO user_ai_artifact_read_state (
         id, user_key, artifact_type, scope_key, logical_key, item_hash, first_read_at, last_seen_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_key, artifact_type, scope_key, logical_key)
       DO UPDATE SET item_hash = excluded.item_hash, last_seen_at = excluded.last_seen_at`,
      `ars_${crypto.randomUUID()}`,
      input.userKey,
      input.artifactType,
      input.scopeKey,
      item.logicalKey,
      item.itemHash,
      now,
      now
    );
  }
}
