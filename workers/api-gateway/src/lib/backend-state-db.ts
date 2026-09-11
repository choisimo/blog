import type { Env } from '../types';
import { attachOriginSignatureHeaders } from './origin-signature';

type Value = string | number | null | { blob: number[] };
type Query = { sql: string; params: Value[] };
type Result = D1Result<Record<string, unknown>>;

function encodeValue(value: unknown): Value {
  if (value === null || typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof ArrayBuffer) return { blob: Array.from(new Uint8Array(value)) };
  if (ArrayBuffer.isView(value)) return { blob: Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)) };
  throw new TypeError('Unsupported SQL binding type');
}

/** The origin is the only writer. Never fall back to D1 or replay a timed-out write. */
export function createBackendStateDatabase(env: Env): D1Database {
  if (!env.BACKEND_ORIGIN || !env.BACKEND_KEY || !(env.GATEWAY_SIGNING_SECRET || env.BACKEND_GATEWAY_SIGNING_SECRET)) {
    throw new Error('Backend state database configuration is incomplete');
  }
  const origin = new URL(env.BACKEND_ORIGIN);
  if (env.ENV === 'production' && origin.protocol !== 'https:') throw new Error('Backend state database requires HTTPS');

  async function execute(statements: Query[]): Promise<Result[]> {
    if (!statements.length || statements.length > 50) throw new Error('Invalid state query batch size');
    const path = '/internal/state-db/query';
    const headers = new Headers({ 'Content-Type': 'application/json', 'X-Backend-Key': env.BACKEND_KEY! });
    await attachOriginSignatureHeaders({ env, headers, method: 'POST', pathAndQuery: path });
    let response: Response;
    try {
      response = await fetch(new URL(path, origin), {
        method: 'POST', headers, redirect: 'manual', signal: AbortSignal.timeout(20_000),
        body: JSON.stringify({ statements, atomic: true }),
      });
    } catch (error) {
      // Classify locally; exception text can contain credentials or URLs.
      const message = String(error instanceof Error ? error.message : '');
      const code = /redirect/i.test(message) ? 'REDIRECT' : /different request|request context/i.test(message) ? 'REQUEST_CONTEXT' : /timeout|abort/i.test(message) ? 'TIMEOUT' : 'TRANSPORT';
      console.error(`[backend-state] phase=transport status=0 code=${code}`);
      throw error;
    }
    // This Workers compatibility runtime accepts only follow/manual. Never
    // forward signed credentials or SQL to a redirect destination.
    if (response.status >= 300 && response.status < 400) {
      console.error(`[backend-state] phase=response status=${response.status} code=REDIRECT`);
      throw new Error('Backend state redirect refused');
    }
    let data: { ok?: boolean; results?: Result[]; error?: { code?: string; message?: string } };
    try { data = await response.json(); }
    catch {
      console.error(`[backend-state] phase=decode status=${response.status} code=NON_JSON`);
      throw new Error(`Backend state query returned an invalid response (${response.status})`);
    }
    if (!response.ok || !data.ok || !Array.isArray(data.results) || data.results.length !== statements.length) {
      const code = /^[A-Z0-9_]{1,80}$/.test(data.error?.code || '') ? data.error!.code : 'INVALID_RESPONSE';
      console.error(`[backend-state] phase=response status=${response.status} code=${code}`);
      throw new Error(data.error?.message || `Backend state query failed (${response.status})`);
    }
    return data.results;
  }

  class Statement {
    constructor(readonly sql: string, readonly params: Value[] = []) {}
    bind(...values: unknown[]) { return new Statement(this.sql, values.map(encodeValue)); }
    async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
      return (await execute([{ sql: this.sql, params: this.params }]))[0] as D1Result<T>;
    }
    async run<T = Record<string, unknown>>(): Promise<D1Result<T>> { return this.all<T>(); }
    async first<T = Record<string, unknown>>(column?: string): Promise<T | null> {
      const row = (await this.all<Record<string, unknown>>()).results[0];
      if (!row) return null;
      if (column !== undefined) {
        if (!Object.hasOwn(row, column)) throw new Error(`Column not found: ${column}`);
        return row[column] as T;
      }
      return row as T;
    }
    async raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<T[]> {
      const rows = (await this.all<Record<string, unknown>>()).results;
      const values = rows.map(row => Object.values(row));
      return (options?.columnNames && rows.length ? [Object.keys(rows[0]), ...values] : values) as T[];
    }
  }

  return {
    prepare(sql: string) {
      if (typeof sql !== 'string' || !sql.trim() || sql.length > 100_000) throw new Error('Invalid SQL statement');
      return new Statement(sql);
    },
    async batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      if (!statements.every(statement => statement instanceof Statement)) throw new Error('Statements must belong to the same database');
      return await execute(statements.map(statement => ({ sql: (statement as unknown as Statement).sql, params: (statement as unknown as Statement).params }))) as D1Result<T>[];
    },
    async exec() { throw new Error('Apply schema migrations on the backend; remote SQL scripts are disabled'); },
    async dump() { throw new Error('Use the backend SQLite backup operation'); },
  } as unknown as D1Database;
}

let cachedBackend: { configuration: unknown[]; db: D1Database } | undefined;
export function withBackendState(env: Env): Env {
  if (!env.STATE_STORE_BACKEND || env.STATE_STORE_BACKEND === 'd1') return env;
  if (env.STATE_STORE_BACKEND !== 'origin') throw new Error('Unknown state store backend');
  const configuration = [env.BACKEND_ORIGIN, env.BACKEND_KEY, env.GATEWAY_SIGNING_SECRET, env.BACKEND_GATEWAY_SIGNING_SECRET, env.ENV];
  // Schema readiness is memoized by database identity elsewhere. Reuse the
  // transport across requests, while credential/config changes create a new one.
  if (!cachedBackend || configuration.some((value, index) => value !== cachedBackend!.configuration[index])) {
    cachedBackend = { configuration, db: createBackendStateDatabase({ ...env }) };
  }
  return { ...env, DB: cachedBackend.db };
}
