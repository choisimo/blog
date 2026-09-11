import fs from 'node:fs';
import Database from 'better-sqlite3';
import { z } from 'zod';

const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const parameter = z.union([
  z.string(), z.number().finite(), z.boolean(), z.null(),
  z.object({ blob: z.array(z.number().int().min(0).max(255)).max(1024 * 1024) }).strict(),
]);
const requestSchema = z.object({
  statements: z.array(z.object({
    sql: z.string().min(1).max(100000),
    params: z.array(parameter).max(256).default([]),
  }).strict()).min(1).max(50),
  atomic: z.boolean(),
}).strict();

const runtimeTables = new Set([
  'ai_artifact_versions', 'ai_artifact_pages', 'user_ai_artifact_read_state',
  'ai_warm_candidates', 'ai_scheduler_decisions', 'domain_outbox', 'idempotency_records',
]);
const runtimeIndexes = new Map([
  ['idx_ai_artifact_versions_lookup', 'ai_artifact_versions'],
  ['idx_ai_artifact_versions_status', 'ai_artifact_versions'],
  ['idx_ai_artifact_pages_version', 'ai_artifact_pages'],
  ['idx_user_ai_artifact_read_state_lookup', 'user_ai_artifact_read_state'],
  ['idx_ai_warm_candidates_schedule', 'ai_warm_candidates'],
  ['idx_ai_warm_candidates_lookup', 'ai_warm_candidates'],
  ['idx_ai_scheduler_decisions_created', 'ai_scheduler_decisions'],
  ['idx_domain_outbox_idempotency', 'domain_outbox'],
  ['idx_domain_outbox_pending', 'domain_outbox'],
  ['idx_domain_outbox_aggregate', 'domain_outbox'],
]);

export class WorkerStateError extends Error {
  constructor(code, status = 400, message = code) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function safeSqliteMessage(error) {
  const message = String(error?.message || '');
  // Callers use these schema/CAS errors for compatibility; retain identifiers only.
  if (/^(?:no such (?:table|column): |duplicate column name: )[\w.]+$/.test(message)
    || /^(?:UNIQUE|NOT NULL) constraint failed: [\w., ]+$/.test(message)
    || message === 'FOREIGN KEY constraint failed'
    || message === 'database is locked'
    || message === 'The supplied SQL string contains more than one statement') return message;
  return 'State database query failed';
}

// Remove comments and literal values, but retain quoted identifiers for policy checks.
function policySql(sql) {
  return sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|`(?:``|[^`])*`|\[[^\]]*\]|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\//g, token => {
    if (token.startsWith("'")) return ' ? ';
    if (token.startsWith('--') || token.startsWith('/*')) return ' ';
    return ` ${token.slice(1, -1).replace(/""|``/g, '')} `;
  }).trim().toLowerCase();
}

function validateSql(sql) {
  const normalized = policySql(sql);
  if (/\b(?:attach|detach|pragma|vacuum|load_extension|readfile|writefile|eval)\b/.test(normalized)
    || /\bpragma_(?!table_info\b)\w+/.test(normalized)) {
    throw new WorkerStateError('STATE_SQL_REJECTED');
  }
  if (/^(?:select|with|insert|update|delete)\b/.test(normalized)) {
    if (/\b(?:insert|update|delete|replace)\b/.test(normalized)
      && (/\b(?:sqlite_\w+|d1_migrations|schema_migrations)\b/.test(normalized)
        // SQLite also accepts string-literal identifiers. They are not used by Worker SQL.
        || /\b(?:update(?:\s+or\s+\w+)?|into|from)\s+(?:\w+\s*\.\s*)?\?/.test(normalized))) {
      throw new WorkerStateError('STATE_SQL_REJECTED');
    }
    return;
  }
  const table = normalized.match(/^create\s+table\s+if\s+not\s+exists\s+(\w+)\s*\(/);
  if (table && runtimeTables.has(table[1])) return;
  const index = normalized.match(/^create\s+(?:unique\s+)?index\s+if\s+not\s+exists\s+(\w+)\s+on\s+(\w+)\s*\(/);
  if (index && runtimeIndexes.get(index[1]) === index[2]) return;
  if (/^alter\s+table\s+idempotency_records\s+add\s+column\s+(?:state|locked_until)\s+text\s*;?$/.test(normalized)) return;
  throw new WorkerStateError('STATE_SQL_REJECTED');
}

function bindValue(value) {
  if (typeof value === 'boolean') return Number(value);
  if (value && typeof value === 'object') return Buffer.from(value.blob);
  return value;
}

function jsonRow(row) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key,
    Buffer.isBuffer(value) ? Array.from(value) : typeof value === 'bigint' ? Number(value) : value,
  ]));
}

export function createWorkerStateStore({ dbPath } = {}) {
  let db;

  function database() {
    if (db) return db;
    const filename = dbPath || process.env.WORKER_STATE_SQLITE_PATH || '/app/.data/worker-state.db';
    let candidate;
    try {
      const stat = fs.statSync(filename);
      if (!stat.isFile() || stat.size === 0) throw new Error('Missing imported database');
      candidate = new Database(filename, { fileMustExist: true, timeout: 5000 });
      const ledger = candidate.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('d1_migrations', 'schema_migrations') ORDER BY name LIMIT 1").get();
      if (!ledger || !candidate.prepare(`SELECT COUNT(*) AS count FROM ${ledger.name}`).get().count) {
        throw new Error('Missing migration ledger');
      }
      if (candidate.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('d1_migrations', 'schema_migrations')").get().count === 0) {
        throw new Error('Missing imported schema');
      }
      candidate.pragma('journal_mode = WAL');
      candidate.pragma('foreign_keys = ON');
      candidate.pragma('busy_timeout = 5000');
      db = candidate;
      return db;
    } catch {
      candidate?.close();
      throw new WorkerStateError('STATE_DB_NOT_READY', 503);
    }
  }

  function execute(input) {
    const parsed = requestSchema.safeParse(input);
    if (!parsed.success) throw new WorkerStateError('STATE_REQUEST_INVALID');
    parsed.data.statements.forEach(({ sql }) => validateSql(sql));
    const connection = database();
    const results = [];
    let bytes = Buffer.byteLength('{"ok":true,"results":[]}');

    function runOne({ sql, params }) {
      const start = performance.now();
      // prepare rejects multiple statements; reader supports DML ... RETURNING as well as SELECT.
      const statement = connection.prepare(sql);
      let rows = [];
      let changes = 0;
      let lastRowId = 0;
      if (statement.reader) {
        let rowBytes = 0;
        for (const row of statement.iterate(...params.map(bindValue))) {
          const value = jsonRow(row);
          rowBytes += Buffer.byteLength(JSON.stringify(value)) + 1;
          if (bytes + rowBytes > MAX_RESPONSE_BYTES) throw new WorkerStateError('STATE_RESPONSE_TOO_LARGE', 413);
          rows.push(value);
        }
        if (!statement.readonly) {
          const info = connection.prepare('SELECT changes() AS changes, last_insert_rowid() AS lastRowId').get();
          changes = info.changes;
          lastRowId = info.lastRowId;
        }
      } else {
        const info = statement.run(...params.map(bindValue));
        changes = info.changes;
        lastRowId = Number(info.lastInsertRowid);
      }
      const result = { success: true, results: rows, meta: {
        changes, last_row_id: lastRowId, duration: performance.now() - start,
        rows_read: rows.length, rows_written: changes, served_by: 'kubernetes-sqlite',
      } };
      bytes += Buffer.byteLength(JSON.stringify(result)) + (results.length ? 1 : 0);
      if (bytes > MAX_RESPONSE_BYTES) throw new WorkerStateError('STATE_RESPONSE_TOO_LARGE', 413);
      results.push(result);
    }

    try {
      if (parsed.data.atomic) {
        connection.transaction(() => parsed.data.statements.forEach(runOne)).immediate();
      } else {
        for (const statement of parsed.data.statements) {
          // A size/serialization failure must also roll back the current individual mutation.
          connection.transaction(() => runOne(statement)).immediate();
        }
      }
      return { ok: true, results };
    } catch (error) {
      if (error instanceof WorkerStateError) throw error;
      // Never expose SQL fragments or row values, including custom trigger errors.
      throw new WorkerStateError(error?.code === 'SQLITE_BUSY' ? 'STATE_DB_BUSY' : 'STATE_QUERY_FAILED',
        error?.code === 'SQLITE_BUSY' ? 503 : 400, safeSqliteMessage(error));
    }
  }

  return {
    execute,
    health() {
      const connection = database();
      const ledger = connection.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('d1_migrations', 'schema_migrations') ORDER BY name LIMIT 1").get();
      return { store: 'kubernetes-sqlite',
        ledgerCount: connection.prepare(`SELECT COUNT(*) AS count FROM ${ledger.name}`).get().count,
        tableCount: connection.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get().count,
      };
    },
    close() {
      db?.close();
      db = undefined;
    },
  };
}

export const workerStateStore = createWorkerStateStore();
