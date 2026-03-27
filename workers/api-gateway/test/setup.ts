// Global test setup — runs once per test FILE before any tests execute.
// Applies all D1 migrations to the local D1 instance so tests can use the full schema.
import type { D1Database } from '@cloudflare/workers-types';
import { applyD1Migrations, env } from 'cloudflare:test';
import { beforeAll } from 'vitest';

// Augment ProvidedEnv so TypeScript knows TEST_MIGRATIONS is available in env.
declare module 'cloudflare:test' {
  interface ProvidedEnv {
    DB: D1Database;
    TEST_MIGRATIONS: Array<{ name: string; queries: string[] }>;
  }
}

beforeAll(async () => {
  // Apply every migration in workers/migrations/ before the test suite runs.
  const migrations = env.TEST_MIGRATIONS.map((migration) => ({
    ...migration,
    queries: migration.queries.filter((query: string) => query.replace(/^\s*--.*$/gm, '').trim().length > 0),
  }));

  await applyD1Migrations(env.DB, migrations);
});
