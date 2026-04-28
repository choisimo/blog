import { config } from '../../config.js';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger('d1-repository');

let _db;
let _migrationsReady = false;

function getDbPath() {
  const fromEnv = process.env.SQLITE_PATH || process.env.DB_PATH;
  if (fromEnv && String(fromEnv).trim()) return String(fromEnv).trim();
  return path.join(config.paths?.repoRoot || config.content.repoRoot, '.data', 'blog.db');
}

function ensureDirForFile(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function splitSqlStatements(sqlText) {
  const trimmed = String(sqlText || '').trim();
  if (!trimmed) return [];
  return [trimmed];
}

function ensureMigrations(db) {
  if (_migrationsReady) return;

  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime(\'now\')));'
  );

  const migrationsDir =
    process.env.SQLITE_MIGRATIONS_DIR || path.join(config.paths?.workersDir || path.join(config.content.repoRoot, 'workers'), 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    _migrationsReady = true;
    return;
  }

  const applied = new Set(
    db.prepare('SELECT filename FROM schema_migrations ORDER BY filename ASC').all().map((r) => r.filename)
  );
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  const insertApplied = db.prepare('INSERT OR IGNORE INTO schema_migrations(filename) VALUES (?)');

  for (const filename of files) {
    if (applied.has(filename)) continue;
    const abs = path.join(migrationsDir, filename);
    const sql = fs.readFileSync(abs, 'utf8');
    const statements = splitSqlStatements(sql);
    const tx = db.transaction(() => {
      for (const stmt of statements) {
        db.exec(stmt);
      }
      insertApplied.run(filename);
    });
    tx();
  }

  _migrationsReady = true;
}

function getDb() {
  if (_db) return _db;
  const dbPath = getDbPath();
  ensureDirForFile(dbPath);
  _db = new Database(dbPath);
  ensureMigrations(_db);
  return _db;
}

function isSelectQuery(sql) {
  const s = String(sql || '').trim().toLowerCase();
  return s.startsWith('select') || s.startsWith('with') || s.startsWith('pragma');
}

export async function query(sql, ...params) {
  const db = getDb();
  const statement = db.prepare(String(sql));

  if (isSelectQuery(sql)) {
    const results = statement.all(...params);
    return { results, meta: {} };
  }

  const info = statement.run(...params);
  return {
    results: [],
    meta: {
      changes: info.changes,
      last_row_id: typeof info.lastInsertRowid === 'bigint' ? Number(info.lastInsertRowid) : info.lastInsertRowid,
    },
  };
}

export async function queryAll(sql, ...params) {
  const { results } = await query(sql, ...params);
  return results;
}

export async function queryOne(sql, ...params) {
  const { results } = await query(sql, ...params);
  return results[0] || null;
}

export async function execute(sql, ...params) {
  const { meta } = await query(sql, ...params);
  return {
    changes: meta.changes || 0,
    lastRowId: meta.last_row_id || 0,
  };
}

let _transactionDepth = 0;
let _transactionSequence = 0;

export async function transaction(fn) {
  if (typeof fn !== 'function') {
    throw new TypeError('transaction callback is required');
  }

  const db = getDb();
  const isNested = _transactionDepth > 0;
  const savepoint = `app_tx_${++_transactionSequence}`;

  if (isNested) {
    db.exec(`SAVEPOINT ${savepoint}`);
  } else {
    db.exec('BEGIN IMMEDIATE');
  }

  _transactionDepth += 1;
  try {
    const result = await fn({
      query,
      queryAll,
      queryOne,
      execute,
    });

    _transactionDepth -= 1;
    if (isNested) {
      db.exec(`RELEASE SAVEPOINT ${savepoint}`);
    } else {
      db.exec('COMMIT');
    }
    return result;
  } catch (err) {
    _transactionDepth -= 1;
    try {
      if (isNested) {
        db.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        db.exec(`RELEASE SAVEPOINT ${savepoint}`);
      } else {
        db.exec('ROLLBACK');
      }
    } catch (rollbackErr) {
      logger.error({}, 'DB transaction rollback failed', {
        error: rollbackErr?.message,
      });
    }
    throw err;
  }
}

export function isConfigured() {
  try {
    getDb();
    return true;
  } catch {
    return false;
  }
}

export const isD1Configured = isConfigured;

export async function testConnection() {
  try {
    await queryOne('SELECT 1 as test');
    return true;
  } catch (err) {
    logger.error({}, 'DB connection test failed', { error: err.message });
    return false;
  }
}
