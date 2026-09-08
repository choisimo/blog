import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const baseURL = process.env.DESIGN_BASE_URL || 'http://127.0.0.1:4173';
const output = new URL('../../docs/design-review-20260908/', import.meta.url);
const browser = await chromium.launch({ headless: true, executablePath: process.env.DESIGN_CHROMIUM_PATH || undefined });
const results = [];

try {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  await context.addInitScript(() => localStorage.setItem('theme', 'light'));
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (route.request().method() === 'OPTIONS') await route.fulfill({ status: 204, headers });
    else if (url.pathname === '/api/v1/agent/prompts') {
      await route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify({ data: { prompts: [{ mode: 'default', label: '기본 프롬프트', text: '디자인 검증용 내용', isOverridden: false }] } }) });
    } else if (url.origin !== new URL(baseURL).origin || url.pathname.startsWith('/api/')) {
      await route.fulfill({ status: 503, headers, contentType: 'application/json', body: JSON.stringify({ error: 'Design verification fixture' }) });
    } else await route.continue();
  });
  const page = await context.newPage();
  await page.goto(`${baseURL}/scripts/design-verification/workspace.html?section=prompts`, { waitUntil: 'networkidle' });
  const tabs = page.getByRole('tablist', { name: 'Admin section tabs', exact: true });
  const record = async name => {
    const metrics = await tabs.evaluate(element => {
      const active = element.querySelector('[aria-selected="true"]');
      const list = element.getBoundingClientRect();
      const bounds = active.getBoundingClientRect();
      return { label: active.getAttribute('aria-label'), scrollLeft: element.scrollLeft, scrollY, visible: bounds.left >= list.left + element.clientLeft - 1 && bounds.right <= list.left + element.clientLeft + element.clientWidth + 1 };
    });
    assert.equal(metrics.visible, true, `${name}: active tab must be visible`);
    results.push({ name, ...metrics });
    return metrics;
  };

  await expect(tabs.getByRole('tab', { name: 'Prompts', exact: true })).toHaveAttribute('aria-selected', 'true');
  const direct = await record('375px direct Prompts route');
  assert.ok(direct.scrollLeft > 0);
  assert.equal(direct.scrollY, 0);
  await page.screenshot({ path: new URL('admin-subtabs-direct-375.png', output).pathname, fullPage: true });

  // Keep document height stable while the real route switches between panels, so
  // scroll position measures the tab behavior rather than shorter-page clamping.
  await page.addStyleTag({ content: 'body { min-height:2200px; }' });
  await page.evaluate(() => window.scrollTo({ top: 100, behavior: 'instant' }));
  await tabs.getByRole('tab', { name: 'Prompts', exact: true }).evaluate(element => element.focus({ preventScroll: true }));
  await page.keyboard.press('ArrowLeft');
  await expect(tabs.getByRole('tab', { name: 'Traces', exact: true })).toBeFocused();
  await expect(tabs.getByRole('tab', { name: 'Traces', exact: true })).toHaveAttribute('aria-selected', 'true');
  const keyboard = await record('ArrowLeft keeps selected Traces visible without vertical jump');
  assert.equal(keyboard.scrollY, 100);

  await page.keyboard.press('End');
  await expect(tabs.getByRole('tab', { name: 'Prompts', exact: true })).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 812 });
  await page.setViewportSize({ width: 320, height: 812 });
  await expect.poll(async () => tabs.evaluate(element => {
    const active = element.querySelector('[aria-selected="true"]');
    const bounds = active.getBoundingClientRect();
    const list = element.getBoundingClientRect();
    return bounds.left >= list.left - 1 && bounds.right <= list.left + element.clientWidth + 1;
  })).toBe(true);
  const resize = await record('1440px to 320px reveals active Prompts after resize');
  assert.equal(resize.label, 'Prompts');
  assert.equal(resize.scrollY, 100);
  await writeFile(new URL('admin-subtabs-browser-results.json', output), JSON.stringify({ scope: 'Actual AdminDashboard and AdminSubtabs with MemoryRouter/API fixtures; vertical document height stabilized only for keyboard and resize checks.', results }, null, 2));
  console.log('Verified 3 AdminSubtabs browser cases.');
  await context.close();
} finally {
  await browser.close();
}
