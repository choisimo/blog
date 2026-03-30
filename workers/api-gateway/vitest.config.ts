import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig(async () => {
  // Read all migrations from workers/migrations/ (relative to this file)
  const migrations = await readD1Migrations('../migrations');

  return {
    test: {
      setupFiles: ['./test/setup.ts'],
      poolOptions: {
        workers: {
          wrangler: { configPath: './wrangler.toml' },
          miniflare: {
            // Inject migrations as a serialised binding so test/setup.ts can apply them
            bindings: {
              TEST_MIGRATIONS: migrations,
              JWT_SECRET: 'translation-route-test-secret',
              PUBLIC_SITE_URL: 'https://public.example',
              BACKEND_ORIGIN: 'https://backend.example',
            },
          },
        },
      },
    },
  };
});
