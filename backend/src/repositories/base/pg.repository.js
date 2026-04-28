import pg from 'pg';

const { Pool } = pg;

let _pool = null;

export function getPool() {
  if (!_pool) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      return null;
    }
    _pool = new Pool({
      connectionString: url,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    _pool.on('error', (err) => {
      process.stderr.write(JSON.stringify({ level: 'error', service: 'pg', message: 'Pool error', error: err.message }) + '\n');
    });
  }
  return _pool;
}

export function isPgConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export async function pgQuery(sql, ...params) {
  const pool = getPool();
  if (!pool) throw new Error('PostgreSQL not configured (DATABASE_URL missing)');
  const { rows } = await pool.query(sql, params);
  return rows;
}

export async function pgQueryOne(sql, ...params) {
  const pool = getPool();
  if (!pool) throw new Error('PostgreSQL not configured (DATABASE_URL missing)');
  const { rows } = await pool.query(sql, params);
  return rows[0] ?? null;
}

export async function pgExecute(sql, ...params) {
  const pool = getPool();
  if (!pool) throw new Error('PostgreSQL not configured (DATABASE_URL missing)');
  await pool.query(sql, params);
}

export async function testPgConnection() {
  const pool = getPool();
  if (!pool) return false;
  await pool.query('SELECT 1');
  return true;
}

export async function pgTransaction(fn) {
  const pool = getPool();
  if (!pool) throw new Error('PostgreSQL not configured (DATABASE_URL missing)');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
