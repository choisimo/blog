import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '../e2e',
  testMatch: 'article-diagrams.spec.ts',
  outputDir: '../test-results/article-diagrams',
  fullyParallel: true,
  workers: 2,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4186',
    ...devices['Desktop Chrome'],
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath: process.env.CONTENT_CHROMIUM_PATH,
    },
  },
});
