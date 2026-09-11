import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import express from 'express';
import Database from 'better-sqlite3';
import { createWorkerStateStore } from '../src/services/worker-state-store.service.js';

process.env.APP_ENV = 'test';
process.env.BACKEND_KEY = 'worker-state-test-key';
process.env.JWT_EXPIRES_IN ||= '15m';
process.env.AI_DEFAULT_MODEL ||= 'gpt-4.1-mini';
const { config } = await import('../src/config.js');
const { createWorkerStateRouter } = await import('../src/routes/workerState.js');
config.backendKey = 'worker-state-test-key';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-state-test-'));
let sequence = 0;
const stores = [];
function fixture({ ledger = true } = {}) {
  const dbPath = path.join(root, `state-${++sequence}.db`);
  const db = new Database(dbPath);
  db.exec('CREATE TABLE quota (id INTEGER PRIMARY KEY, owner TEXT NOT NULL, data BLOB)');
  if (ledger) db.exec("CREATE TABLE d1_migrations(name TEXT); INSERT INTO d1_migrations VALUES('0041_translation_execution.sql')");
  db.close();
  const store = createWorkerStateStore({ dbPath });
  stores.push(store);
  return { store, dbPath };
}
function query(store, sql, params = []) {
  return store.execute({ statements: [{ sql, params }], atomic: true }).results[0];
}
function count(store) { return query(store, 'SELECT COUNT(*) AS count FROM quota').results[0].count; }
after(() => {
  for (const store of stores) store.close();
  fs.rmSync(root, { recursive: true, force: true });
});

test('never creates a missing or empty database; requires imported schema and ledger', () => {
  const missing = path.join(root, 'missing.db');
  const store = createWorkerStateStore({ dbPath: missing });
  assert.throws(() => store.health(), { code: 'STATE_DB_NOT_READY', status: 503 });
  assert.equal(fs.existsSync(missing), false);
  fs.writeFileSync(missing, '');
  assert.throws(() => store.health(), { code: 'STATE_DB_NOT_READY' });
  assert.equal(fs.statSync(missing).size, 0);
  assert.throws(() => fixture({ ledger: false }).store.health(), { code: 'STATE_DB_NOT_READY' });
  const ledgerOnly = path.join(root, 'ledger-only.db');
  const db = new Database(ledgerOnly);
  db.exec("CREATE TABLE d1_migrations(name TEXT); INSERT INTO d1_migrations VALUES('one.sql')");
  db.close();
  assert.throws(() => createWorkerStateStore({ dbPath: ledgerOnly }).health(), { code: 'STATE_DB_NOT_READY' });
});

test('health exposes only store type and aggregate schema counts', () => {
  const { store } = fixture();
  assert.deepEqual(store.health(), { store: 'kubernetes-sqlite', ledgerCount: 1, tableCount: 2 });
});

test('executes statements in order and rolls back the whole atomic batch on failure', () => {
  const { store } = fixture();
  assert.throws(() => store.execute({ atomic: true, statements: [
    { sql: 'INSERT INTO quota(id,owner) VALUES(1,?)', params: ['private-value'] },
    { sql: 'INSERT INTO quota(id,owner) VALUES(1,?)', params: ['duplicate'] },
  ] }), /UNIQUE constraint failed: quota.id/);
  assert.equal(count(store), 0);
  const result = store.execute({ atomic: true, statements: [
    { sql: "INSERT INTO quota(owner) VALUES('first')", params: [] },
    { sql: 'SELECT COUNT(*) AS count FROM quota', params: [] },
  ] });
  assert.equal(result.results[0].meta.changes, 1);
  assert.equal(result.results[1].results[0].count, 1);
  assert.equal(result.results[1].meta.changes, 0);
});

test('INSERT and DELETE RETURNING return rows and correct mutation metadata', () => {
  const { store } = fixture();
  const inserted = query(store, 'INSERT INTO quota(owner) VALUES(?) RETURNING id,owner', ['reader']);
  assert.equal(inserted.results[0].owner, 'reader');
  assert.equal(inserted.meta.changes, 1);
  assert.equal(inserted.meta.last_row_id, inserted.results[0].id);
  assert.equal(inserted.meta.rows_written, 1);
  assert.equal(inserted.meta.served_by, 'kubernetes-sqlite');
  const deleted = query(store, 'DELETE FROM quota WHERE id=? RETURNING id', [inserted.results[0].id]);
  assert.equal(deleted.meta.changes, 1);
  assert.deepEqual(deleted.results, [{ id: inserted.results[0].id }]);
  assert.equal(query(store, 'DELETE FROM quota WHERE id=? RETURNING id', [inserted.results[0].id]).meta.changes, 0);
});

test('batch SQL changes() observes the preceding mutation on the same connection', () => {
  const { store } = fixture();
  query(store, 'INSERT INTO quota(id,owner) VALUES(?,?)', [1, 'before']);
  const apply = id => store.execute({ atomic: true, statements: [
    { sql: 'UPDATE quota SET owner=? WHERE id=? RETURNING id', params: ['after', id] },
    { sql: 'SELECT changes() AS previous_changes', params: [] },
    { sql: 'INSERT INTO quota(owner) SELECT ? WHERE changes() = 1', params: ['audit'] },
    { sql: 'SELECT changes() AS previous_changes', params: [] },
  ] }).results;
  const changed = apply(1);
  assert.equal(changed[0].meta.changes, 1);
  assert.equal(changed[1].results[0].previous_changes, 1);
  assert.equal(changed[2].meta.changes, 1);
  assert.equal(changed[3].results[0].previous_changes, 1);
  const unchanged = apply(999);
  assert.equal(unchanged[0].meta.changes, 0);
  assert.equal(unchanged[1].results[0].previous_changes, 0);
  assert.equal(unchanged[2].meta.changes, 0);
  assert.equal(unchanged[3].results[0].previous_changes, 0);
  assert.equal(count(store), 2);
});

test('serializes explicit blob parameters as byte arrays without changing null/scalar values', () => {
  const { store } = fixture();
  query(store, 'INSERT INTO quota(owner,data) VALUES(?,?)', ['reader', { blob: [0, 127, 255] }]);
  assert.deepEqual(query(store, 'SELECT data, ? AS absent, ? AS enabled FROM quota', [null, true]).results,
    [{ data: [0, 127, 255], absent: null, enabled: 1 }]);
});

test('supports only audited runtime schema creation and idempotency column upgrades', () => {
  const { store } = fixture();
  query(store, 'CREATE TABLE IF NOT EXISTS idempotency_records(scope TEXT)');
  query(store, 'ALTER TABLE idempotency_records ADD COLUMN state TEXT');
  query(store, 'ALTER TABLE idempotency_records ADD COLUMN locked_until TEXT');
  assert.deepEqual(query(store, "SELECT name FROM pragma_table_info('idempotency_records')").results,
    [{ name: 'scope' }, { name: 'state' }, { name: 'locked_until' }]);
  assert.throws(() => query(store, 'ALTER TABLE idempotency_records ADD COLUMN state TEXT'), /duplicate column name: state/);
  assert.throws(() => query(store, 'SELECT missing FROM quota'), /no such column: missing/);
  assert.throws(() => query(store, 'SELECT * FROM missing'), /no such table: missing/);
});

test('rejects extensions, file access, metadata writes, unaudited DDL, and multiple statements', () => {
  const { store } = fixture();
  for (const sql of [
    "ATTACH DATABASE ':memory:' AS other", 'DETACH DATABASE other', 'PRAGMA journal_mode=OFF', 'VACUUM',
    "SELECT load_extension('secret')", "SELECT \"load_extension\"('secret')", "SELECT readfile('/etc/passwd')",
    "SELECT writefile('/tmp/file','x')", 'SELECT * FROM pragma_database_list()',
    'CREATE VIRTUAL TABLE anything USING fts5(text)', 'CREATE TABLE anything(id)',
    'CREATE TRIGGER evil AFTER INSERT ON quota BEGIN DELETE FROM quota; END',
    'ALTER TABLE quota ADD COLUMN x TEXT', 'DROP TABLE quota',
    "UPDATE sqlite_master SET sql='x'", 'DELETE FROM "d1_migrations"',
    "DELETE FROM 'd1_migrations'", "DELETE FROM main.'d1_migrations'",
    'WITH x AS (SELECT 1) DELETE FROM main.schema_migrations',
    "SELECT 1; INSERT INTO quota(owner) VALUES('injected')",
  ]) assert.throws(() => query(store, sql), undefined, sql);
  assert.equal(count(store), 0);
  assert.equal(query(store, "-- safe leading comment\nSELECT 'load_extension; ATTACH' AS content").results[0].content,
    'load_extension; ATTACH');
});

test('enforces request and response limits, rolling back oversized RETURNING results', () => {
  const { store } = fixture();
  for (const input of [
    { atomic: true, statements: [] },
    { atomic: true, statements: Array.from({ length: 51 }, () => ({ sql: 'SELECT 1', params: [] })) },
    { atomic: true, statements: [{ sql: ' '.repeat(100001), params: [] }] },
    { atomic: true, statements: [{ sql: 'SELECT 1', params: Array(257).fill(null) }] },
    { atomic: true, statements: [{ sql: 'SELECT ?', params: [{ blob: [256] }] }] },
  ]) assert.throws(() => store.execute(input), { code: 'STATE_REQUEST_INVALID' });
  assert.throws(() => query(store, "INSERT INTO quota(owner) VALUES('oversize') RETURNING hex(zeroblob(6000000))"),
    { code: 'STATE_RESPONSE_TOO_LARGE', status: 413 });
  assert.equal(count(store), 0);
});

async function serve(store, verified) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use((req, _res, next) => { req.gatewaySignatureVerified = verified; next(); });
  app.use('/internal/state-db', createWorkerStateRouter({ store }));
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { base: `http://127.0.0.1:${server.address().port}/internal/state-db`,
    close: async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); },
  };
}

test('health and queries require both backend key and server-verified gateway signature', async () => {
  const { store } = fixture();
  const unsigned = await serve(store, false);
  const signed = await serve(store, true);
  try {
    for (const endpoint of ['/health', '/query']) {
      const request = endpoint === '/query'
        ? { method: 'POST', body: JSON.stringify({ atomic: true, statements: [{ sql: 'SELECT 1', params: [] }] }) } : {};
      assert.equal((await fetch(`${signed.base}${endpoint}`, request)).status, 401);
      const options = { ...request, headers: { 'Content-Type': 'application/json', 'X-Backend-Key': config.backendKey,
        'X-Gateway-Signature-Verified': 'true' } };
      assert.equal((await fetch(`${unsigned.base}${endpoint}`, options)).status, 403);
      const response = await fetch(`${signed.base}${endpoint}`, options);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
    const error = await fetch(`${signed.base}/query`, { method: 'POST', headers: {
      'Content-Type': 'application/json', 'X-Backend-Key': config.backendKey,
    }, body: JSON.stringify({ atomic: true, statements: [{ sql: 'SELECT * FROM missing', params: [] }] }) });
    assert.equal((await error.json()).error.message, 'no such table: missing');
  } finally { await unsigned.close(); await signed.close(); }
});

test('concurrent HTTP quota reservations admit exactly twenty and retain durable rows', async () => {
  const { store } = fixture();
  const origin = await serve(store, true);
  try {
    const responses = await Promise.all(Array.from({ length: 60 }, async () => {
      const response = await fetch(`${origin.base}/query`, { method: 'POST', headers: {
        'Content-Type': 'application/json', 'X-Backend-Key': config.backendKey,
      }, body: JSON.stringify({ atomic: true, statements: [{
        sql: 'INSERT INTO quota(owner) SELECT ? WHERE (SELECT COUNT(*) FROM quota WHERE owner=?) < ?',
        params: ['reader', 'reader', 20],
      }] }) });
      assert.equal(response.status, 200);
      return response.json();
    }));
    assert.equal(responses.reduce((sum, response) => sum + response.results[0].meta.changes, 0), 20);
    store.close();
    assert.equal(count(store), 20);
  } finally { await origin.close(); }
});
