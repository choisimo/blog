// D1 query helpers
export async function queryOne<T>(
  db: D1Database,
  sql: string,
  ...params: unknown[]
): Promise<T | null> {
  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.first<T>();
  return result ?? null;
}

export async function queryAll<T>(
  db: D1Database,
  sql: string,
  ...params: unknown[]
): Promise<T[]> {
  const stmt = db.prepare(sql).bind(...params);
  const { results } = await stmt.all<T>();
  return results ?? [];
}

export async function execute(
  db: D1Database,
  sql: string,
  ...params: unknown[]
): Promise<D1Result> {
  const stmt = db.prepare(sql).bind(...params);
  return await stmt.run();
}

// Batch operations
export async function executeBatch(db: D1Database, statements: D1PreparedStatement[]) {
  return await db.batch(statements);
}

// Transaction helper (D1 supports batch as atomic operations)
export async function transaction<T>(
  db: D1Database,
  fn: (db: D1Database) => Promise<T>
): Promise<T> {
  // D1 doesn't have explicit transactions, but batch operations are atomic
  // For now, just execute the function
  return await fn(db);
}
