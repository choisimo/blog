import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { migrateWorkerState } from '../src/scripts/migrate-worker-state.js';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-migration-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dbPath = path.join(root, 'worker-state.db');
  const migrationsDir = path.join(root, 'migrations');
  fs.mkdirSync(migrationsDir);
  fs.writeFileSync(path.join(migrationsDir, '0001_imported.sql'), 'THIS MUST NEVER RUN');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY, name TEXT UNIQUE, applied_at TEXT DEFAULT CURRENT_TIMESTAMP);
    INSERT INTO d1_migrations(name) VALUES('0001_imported.sql'),('0038_edge_rate_limits.sql'),('0039_auth_ephemeral_records.sql');
    CREATE TABLE items(id INTEGER PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO items VALUES(1, 'existing-private-value');`);
  t.after(() => { if (db.open) db.close(); });
  return { root, dbPath, migrationsDir, db,
    add(name, sql) { fs.writeFileSync(path.join(migrationsDir, name), sql); },
    run(options = {}) { return migrateWorkerState({ dbPath, migrationsDir, ...options }); },
  };
}

test('requires an existing nonempty imported D1 database and never creates one', async t => {
  const f = fixture(t);
  const missing = path.join(f.root, 'missing.db');
  await assert.rejects(f.run({ dbPath: missing }), { code: 'EXISTING_STATE_DATABASE_REQUIRED' });
  assert.equal(fs.existsSync(missing), false);
  fs.writeFileSync(missing, '');
  await assert.rejects(f.run({ dbPath: missing }), { code: 'EXISTING_STATE_DATABASE_REQUIRED' });
  assert.equal(fs.statSync(missing).size, 0);
  const legacy = path.join(f.root, 'blog.db');
  const db = new Database(legacy);
  db.exec("CREATE TABLE schema_migrations(filename TEXT); INSERT INTO schema_migrations VALUES('legacy.sql')");
  db.close();
  await assert.rejects(f.run({ dbPath: legacy }), e => e.details.causeCode === 'D1_MIGRATION_LEDGER_REQUIRED');
});

test('backs up committed WAL data before applying schema and ledger, then reruns without writes', async t => {
  const f = fixture(t);
  f.add('0042_new_column.sql', 'ALTER TABLE items ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;');
  const result = await f.run();
  assert.deepEqual(result.applied, ['0042_new_column.sql']);
  assert.equal(result.ledgerCount, 4);
  assert.equal(f.db.prepare('SELECT revision FROM items').get().revision, 1);
  const backup = new Database(result.backupPath, { readonly: true });
  try {
    assert.deepEqual(backup.prepare('SELECT * FROM items').all(), [{ id: 1, value: 'existing-private-value' }]);
    assert.equal(backup.prepare('SELECT count(*) AS n FROM d1_migrations').get().n, 3);
  } finally { backup.close(); }
  assert.equal(fs.statSync(result.backupPath).mode & 0o777, 0o600);
  const again = await f.run();
  assert.deepEqual(again.applied, []);
  assert.equal(again.backupPath, null);
  assert.equal(again.additionalLedgerEntries.length, 2);
  assert.equal(fs.readdirSync(path.join(f.root, 'worker-state-backups')).length, 1);
});

test('a later failing migration rolls back all pending schema, data, and ledger entries', async t => {
  const f = fixture(t);
  f.add('0042_first.sql', "ALTER TABLE items ADD COLUMN revision INTEGER; UPDATE items SET value='changed';");
  f.add('0043_failure.sql', "INSERT INTO items VALUES(1,'duplicate-private-value',2);");
  let error;
  await assert.rejects(f.run(), e => { error = e; return e.details.causeCode === 'SQLITE_CONSTRAINT_PRIMARYKEY'; });
  assert.equal(error.details.migration, '0043_failure.sql');
  assert.equal(fs.existsSync(error.details.backupPath), true);
  assert.deepEqual(f.db.prepare('SELECT * FROM items').all(), [{ id: 1, value: 'existing-private-value' }]);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM d1_migrations').get().n, 3);
});

test('backup failure prevents all schema and ledger writes', async t => {
  const f = fixture(t);
  f.add('0042_new.sql', 'CREATE TABLE never_created(id INTEGER);');
  const blocker = path.join(f.root, 'not-a-directory');
  fs.writeFileSync(blocker, 'keep');
  await assert.rejects(f.run({ backupDir: blocker }));
  assert.equal(f.db.prepare("SELECT 1 FROM sqlite_master WHERE name='never_created'").get(), undefined);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM d1_migrations').get().n, 3);
  assert.equal(fs.readFileSync(blocker, 'utf8'), 'keep');
});

test('foreign key validation rejects and rolls back an orphan-producing migration', async t => {
  const f = fixture(t);
  f.add('0042_orphan.sql', 'CREATE TABLE child(parent_id INTEGER REFERENCES items(id)); INSERT INTO child VALUES(999);');
  await assert.rejects(f.run(), e => e.details.causeCode === 'STATE_FOREIGN_KEY_CHECK_FAILED');
  assert.equal(f.db.prepare("SELECT 1 FROM sqlite_master WHERE name='child'").get(), undefined);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM d1_migrations').get().n, 3);
});

test('rejects transaction escape commands but supports triggers and CASE expressions', async t => {
  const f = fixture(t);
  f.add('0042_trigger.sql', `CREATE TRIGGER revision_trigger AFTER UPDATE ON items BEGIN
    SELECT CASE WHEN NEW.value = 'COMMIT; END;' THEN 1 ELSE 0 END;
    SELECT 1;
    END;
    UPDATE items SET value = CASE WHEN id = 1 THEN value ELSE 'other' END;`);
  await f.run();
  f.add('0043_escape.sql', "UPDATE items SET value='changed'; END; UPDATE items SET value='outside';");
  await assert.rejects(f.run(), e => e.details.causeCode === 'MIGRATION_SQL_NOT_TRANSACTIONAL');
  assert.equal(f.db.prepare('SELECT value FROM items').get().value, 'existing-private-value');
});

test('migration cannot remove historical ledger entries', async t => {
  const f = fixture(t);
  f.add('0042_bad_ledger.sql', "DELETE FROM d1_migrations WHERE name='0038_edge_rate_limits.sql';");
  await assert.rejects(f.run(), e => e.details.causeCode === 'MIGRATION_LEDGER_CHANGED_UNEXPECTEDLY');
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM d1_migrations').get().n, 3);
  assert.equal(f.db.prepare("SELECT count(*) AS n FROM d1_migrations WHERE name='0038_edge_rate_limits.sql'").get().n, 1);
});

test('standalone UPDATE CASE works while a subsequent top-level END remains rejected', async t => {
  const f = fixture(t);
  f.add('0042_case.sql', "UPDATE items SET value = CASE WHEN id = 1 THEN 'updated' ELSE value END;");
  await f.run();
  assert.equal(f.db.prepare('SELECT value FROM items').get().value, 'updated');
  f.add('0043_escape.sql', "UPDATE items SET value = CASE WHEN id = 1 THEN 'escaped' ELSE value END; END TRANSACTION;");
  await assert.rejects(f.run(), e => e.details.causeCode === 'MIGRATION_SQL_NOT_TRANSACTIONAL');
  assert.equal(f.db.prepare('SELECT value FROM items').get().value, 'updated');
  assert.equal(f.db.prepare("SELECT count(*) AS n FROM d1_migrations WHERE name='0043_escape.sql'").get().n, 0);
});

test('CLI check lists pending migrations without backup; CLI errors omit private SQL values', t => {
  const f = fixture(t);
  f.add('0042_bad.sql', "INSERT INTO missing_table VALUES('do-not-print-this-private-value');");
  const script = new URL('../src/scripts/migrate-worker-state.js', import.meta.url);
  const args = [script.pathname, '--migrations-dir', f.migrationsDir];
  const env = { ...process.env, WORKER_STATE_SQLITE_PATH: f.dbPath };
  const check = spawnSync(process.execPath, [...args, '--check'], { env, encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  assert.deepEqual(JSON.parse(check.stdout).pending, ['0042_bad.sql']);
  assert.equal(fs.existsSync(path.join(f.root, 'worker-state-backups')), false);
  const run = spawnSync(process.execPath, args, { env, encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.equal(JSON.parse(run.stderr).code, 'WORKER_STATE_MIGRATION_FAILED');
  assert.equal((run.stdout + run.stderr).includes('do-not-print-this-private-value'), false);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM d1_migrations').get().n, 3);
});
