import { defineConfig, devices } from '@playwright/test';

// Start a local Vite preview before running this isolated design regression suite.
export default defineConfig({
  testDir: '../e2e',
  testMatch: ['site-design.spec.ts', 'reading-design.spec.ts'],
  outputDir: process.env.DESIGN_RESULTS_DIR ?? '../test-results/design',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 1 : 3,
  reporter: 'list',
  use: {
    baseURL: process.env.DESIGN_BASE_URL ?? 'http://127.0.0.1:4174',
    screenshot: 'only-on-failure',
    launchOptions: process.env.DESIGN_CHROMIUM_PATH
      ? { executablePath: process.env.DESIGN_CHROMIUM_PATH }
      : undefined,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
