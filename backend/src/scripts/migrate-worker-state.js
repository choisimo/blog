import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const localMigrations = fileURLToPath(new URL('../../../workers/migrations/', import.meta.url));

function failure(code) {
  return Object.assign(new Error(code), { code });
}

// Migrations are reviewed repository SQL. Reject commands that could escape the
// enclosing transaction or write another file; permit ordinary trigger bodies.
function validateMigration(sql) {
  const tokens = sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|`(?:``|[^`])*`|\[[^\]]*\]|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\//g, ' ')
    .toLowerCase().match(/[a-z_][a-z_0-9]*|;/g) || [];
  const forbidden = new Set(['commit', 'rollback', 'savepoint', 'release', 'attach', 'detach', 'vacuum', 'pragma', 'load_extension', 'readfile', 'writefile']);
  let statement = [];
  let trigger = false;
  const blocks = [];
  for (const token of tokens) {
    if (forbidden.has(token)) throw failure('MIGRATION_SQL_NOT_TRANSACTIONAL');
    if (token === ';') {
      if (!trigger) statement = [];
      continue;
    }
    statement.push(token);
    if (statement[0] === 'create' && token === 'trigger' && statement.length <= 3) trigger = true;
    if (token === 'case') blocks.push('case');
    if (token === 'begin' && trigger) blocks.push('trigger');
    if (token === 'end') {
      if (!blocks.length) throw failure('MIGRATION_SQL_NOT_TRANSACTIONAL');
      if (blocks.pop() === 'trigger') trigger = false;
    }
    if (token === 'begin' && !trigger) throw failure('MIGRATION_SQL_NOT_TRANSACTIONAL');
  }
  if (trigger) throw failure('MIGRATION_SQL_NOT_TRANSACTIONAL');
  if (!tokens.length) throw failure('MIGRATION_SQL_EMPTY');
}

function ledger(db) {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='d1_migrations'").get()) {
    throw failure('D1_MIGRATION_LEDGER_REQUIRED');
  }
  const rows = db.prepare('SELECT name FROM d1_migrations').all();
  const names = new Set(rows.map(row => row.name));
  if (!rows.length || names.size !== rows.length || rows.some(row => typeof row.name !== 'string')) {
    throw failure('D1_MIGRATION_LEDGER_INVALID');
  }
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('d1_migrations','schema_migrations') LIMIT 1").get()) {
    throw failure('IMPORTED_STATE_SCHEMA_REQUIRED');
  }
  return names;
}

function verifyIntegrity(db) {
  const results = db.pragma('integrity_check');
  if (results.length !== 1 || results[0].integrity_check !== 'ok') throw failure('STATE_INTEGRITY_FAILED');
}

async function createBackup(dbPath, backupRoot) {
  fs.mkdirSync(backupRoot, { recursive: true, mode: 0o700 });
  const directory = fs.mkdtempSync(path.join(backupRoot, 'before-migration-'));
  const backupPath = path.join(directory, 'worker-state.db');
  fs.closeSync(fs.openSync(backupPath, 'wx', 0o600));
  // The writer holds BEGIN IMMEDIATE. A separate reader backs up the committed
  // pre-migration state, including pages in WAL, without copying live sidecars.
  const source = new Database(dbPath, { readonly: true, fileMustExist: true, timeout: 5000 });
  try {
    await source.backup(backupPath);
    const snapshot = new Database(backupPath, { readonly: true, fileMustExist: true });
    try { verifyIntegrity(snapshot); } finally { snapshot.close(); }
    const fd = fs.openSync(backupPath, 'r');
    try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    for (const dir of [directory, backupRoot]) {
      const dirFd = fs.openSync(dir, 'r');
      try { fs.fsyncSync(dirFd); } finally { fs.closeSync(dirFd); }
    }
    return backupPath;
  } catch (error) {
    error.backupPath = backupPath;
    throw error;
  } finally {
    source.close();
  }
}

export async function migrateWorkerState({
  dbPath = process.env.WORKER_STATE_SQLITE_PATH,
  migrationsDir = localMigrations,
  backupDir,
  check = false,
} = {}) {
  if (!dbPath || dbPath === ':memory:') throw failure('WORKER_STATE_SQLITE_PATH_REQUIRED');
  let stat;
  try { stat = fs.statSync(dbPath); } catch { throw failure('EXISTING_STATE_DATABASE_REQUIRED'); }
  if (!stat.isFile() || stat.size === 0) throw failure('EXISTING_STATE_DATABASE_REQUIRED');
  dbPath = fs.realpathSync(dbPath);
  const files = fs.readdirSync(migrationsDir).filter(name => /^\d{4}_.+\.sql$/.test(name)).sort();
  if (!files.length) throw failure('MIGRATION_FILES_REQUIRED');
  const db = new Database(dbPath, { readonly: check, fileMustExist: true, timeout: 5000 });
  let backupPath;
  let currentMigration;
  try {
    let applied = ledger(db);
    const result = () => ({
      ok: true, dbPath, applied: [], pending: files.filter(name => !applied.has(name)),
      ledgerCount: applied.size, additionalLedgerEntries: [...applied].filter(name => !files.includes(name)).sort(),
      backupPath: null,
    });
    if (check || files.every(name => applied.has(name))) return result();
    db.pragma('foreign_keys = ON');
    db.exec('BEGIN IMMEDIATE');
    // Another migration process might have completed while this one waited.
    applied = ledger(db);
    const pending = files.filter(name => !applied.has(name));
    if (!pending.length) { db.exec('COMMIT'); return result(); }
    const migrations = pending.map(name => {
      currentMigration = name;
      const sql = fs.readFileSync(path.join(migrationsDir, name), 'utf8');
      validateMigration(sql);
      return { name, sql };
    });
    currentMigration = undefined;
    backupPath = await createBackup(dbPath, backupDir || path.join(path.dirname(dbPath), 'worker-state-backups'));
    db.pragma('defer_foreign_keys = ON');
    const record = db.prepare('INSERT INTO d1_migrations(name) VALUES (?)');
    for (const { name, sql } of migrations) {
      currentMigration = name;
      db.exec(sql);
      record.run(name);
    }
    currentMigration = undefined;
    const finalLedger = ledger(db);
    if (finalLedger.size !== applied.size + pending.length || [...applied, ...pending].some(name => !finalLedger.has(name))) {
      throw failure('MIGRATION_LEDGER_CHANGED_UNEXPECTEDLY');
    }
    verifyIntegrity(db);
    if (db.pragma('foreign_key_check').length) throw failure('STATE_FOREIGN_KEY_CHECK_FAILED');
    db.exec('COMMIT');
    return { ...result(), applied: pending, pending: [], ledgerCount: applied.size + pending.length, backupPath };
  } catch (error) {
    if (db.inTransaction) db.exec('ROLLBACK');
    const safe = failure('WORKER_STATE_MIGRATION_FAILED');
    safe.details = {
      causeCode: /^[A-Z][A-Z0-9_]+$/.test(error.code || '') ? error.code : 'MIGRATION_FAILED',
      migration: currentMigration || null, backupPath: backupPath || error.backupPath || null,
    };
    throw safe;
  } finally {
    db.close();
  }
}

async function main() {
  const options = {};
  const args = process.argv.slice(2);
  const names = { '--db': 'dbPath', '--migrations-dir': 'migrationsDir', '--backup-dir': 'backupDir' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--check') { options.check = true; continue; }
    const name = names[args[i]];
    if (!name || !args[i + 1] || args[i + 1].startsWith('--')) throw failure('INVALID_ARGUMENTS');
    options[name] = args[++i];
  }
  process.stdout.write(JSON.stringify(await migrateWorkerState(options)) + '\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    // Error text can include SQL or private values. Emit codes and paths only.
    process.stderr.write(JSON.stringify({ ok: false,
      code: /^[A-Z][A-Z0-9_]+$/.test(error.code || '') ? error.code : 'MIGRATION_FAILED',
      ...error.details,
    }) + '\n');
    process.exitCode = 1;
  });
}
