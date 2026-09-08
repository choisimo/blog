import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

// Vite serves the existing real-component harness; production auth is not replaced.
const origin = process.env.DESIGN_BASE_URL || 'http://127.0.0.1:4321';
const directory = 'verification-screenshots/fieldnotes-public-review-20260908';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
const results = [];
try {
  for (const theme of ['light', 'dark']) for (const width of [320, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(value => localStorage.setItem('theme', value), theme);
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      return url.origin === origin && !url.pathname.startsWith('/api/') ? route.continue() : route.abort();
    });
    await page.goto(`${origin}/scripts/design-verification/workspace.html?route=secrets/overview`);
    const panel = page.locator('.ui-admin-secretsmanager');
    const refresh = panel.getByRole('button', { name: 'Refresh secrets overview' });
    await expect(panel).toBeVisible();
    await expect(refresh).toBeEnabled({ timeout: 20000 });
    await expect(panel.getByText('All configured', { exact: true })).toHaveCount(0);
    await expect(panel.getByText('None expiring', { exact: true })).toHaveCount(0);
    await expect(panel.getByText('Unknown', { exact: true })).toHaveCount(4);
    await refresh.click();
    await expect(refresh).toBeEnabled();
    await expect(panel.getByText('Unknown', { exact: true })).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect(errors).toEqual([]);
    await page.screenshot({ path: `${directory}/secrets-${theme}-${width}.png`, fullPage: true });
    results.push({ theme, width, unknownCounts: true, retry: true, errors });
    await page.close();
    console.log(`${theme} ${width}: secrets unavailable state passed`);
  }
  await writeFile(`${directory}/secrets-results.json`, JSON.stringify(results, null, 2));
} finally { await browser.close(); }
