import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseURL = process.env.DESIGN_BASE_URL || 'http://127.0.0.1:4173';
const output = new URL('../../docs/design-review-20260908/admin-coverage/', import.meta.url);
await mkdir(output, { recursive: true });
const routes = ['health', 'rag', 'analytics', 'config', 'secrets/overview', 'secrets/secrets', 'secrets/audit', 'workers/workers', 'workers/secrets', 'workers/resources', 'content/home-cta', 'ai/playground', 'ai/models', 'ai/providers', 'ai/routes', 'ai/monitoring', 'ai/traces'];
const emptyFixtures = {
  '/api/v1/admin/ai/providers': { providers: [] },
  '/api/v1/admin/ai/models': { models: [] },
  '/api/v1/admin/ai/routes': { routes: [] },
  '/api/v1/admin/ai/traces': { traces: [], total: 0 },
  '/api/v1/admin/ai/playground/history': { history: [], total: 0 },
  '/api/v1/admin/ai/prompt-templates': { templates: [], total: 0 },
  '/api/v1/admin/config/categories': { categories: [] },
  '/api/v1/admin/config/current': { config: {}, mutationsEnabled: false, mutationGuidance: '읽기 전용 디자인 검증 데이터입니다.' },
  '/api/v1/admin/workers/list': { workers: [] },
  '/api/v1/admin/workers/secrets': { secrets: [] },
  '/api/v1/admin/workers/d1/databases': { databases: [] },
  '/api/v1/admin/workers/kv/namespaces': { namespaces: [] },
  '/api/v1/admin/workers/r2/buckets': { buckets: [] },
  '/api/v1/admin/secrets/overview': { categories: [], stats: { total: 0, configured: 0, missing_required: 0, expiring_soon: 0 }, recentActivity: [] },
  '/api/v1/admin/secrets/health': { status: 'healthy', encryption: 'ok', stats: { totalSecrets: 0, withValue: 0, expired: 0 } },
  '/api/v1/admin/secrets/categories': { categories: [] },
  '/api/v1/admin/secrets/': { secrets: [] },
  '/api/v1/admin/secrets/audit': { logs: [], pagination: { total: 0, limit: 20, offset: 0 } },
};
const selectedRoutes = process.env.DESIGN_ROUTES ? process.env.DESIGN_ROUTES.split(',') : routes;
const browser = await chromium.launch({ headless: true, executablePath: process.env.DESIGN_CHROMIUM_PATH || undefined });
const previousResults = process.env.DESIGN_ROUTES
  ? JSON.parse(await readFile(new URL('results.json', output), 'utf8')).results
  : [];
const results = previousResults.filter(result => !selectedRoutes.includes(result.route));
try {
  for (const routeName of selectedRoutes) {
    for (const mode of ['unavailable', 'empty-known']) {
      for (const theme of ['light', 'terminal']) {
        const context = await browser.newContext();
        await context.addInitScript(({ theme }) => localStorage.setItem('theme', theme), { theme });
        const requests = [];
        await context.route('**/*', async route => {
          const url = new URL(route.request().url());
          const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
          if (route.request().method() === 'OPTIONS') await route.fulfill({ status: 204, headers });
          else if (url.origin !== new URL(baseURL).origin || url.pathname.startsWith('/api/')) {
            const fixture = mode === 'empty-known' ? emptyFixtures[url.pathname] : undefined;
            const status = fixture ? 200 : 503;
            requests.push({ path: url.pathname, status });
            await route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(fixture ? { ok: true, data: fixture } : { ok: false, error: '디자인 검증: 서비스 응답을 사용할 수 없습니다.' }) });
          } else await route.continue();
        });
        const page = await context.newPage();
        const runtimeErrors = [];
        page.on('pageerror', error => runtimeErrors.push(error.message));
        await page.goto(`${baseURL}/scripts/design-verification/workspace.html?route=${encodeURIComponent(routeName)}`, { waitUntil: 'networkidle' });
        await page.locator('.ui-admin-panel').waitFor();
        await page.waitForFunction(() => !document.querySelector('.ui-section-loading'));
        for (const width of [320, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const metrics = await page.locator('.ui-admin-panel').evaluate(panel => {
            const visible = element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden';
            const allControls = [...panel.querySelectorAll('button,input,select,textarea,[role="combobox"]')].filter(visible);
            const named = element => element.getAttribute('aria-label') || (element.getAttribute('aria-labelledby') || '').split(' ').map(id => document.getElementById(id)?.textContent || '').join(' ').trim() || [...(element.labels || [])].map(label => label.textContent).join(' ').trim() || element.textContent?.trim() || element.getAttribute('title') || '';
            const excluded = element => element.closest('[role="tablist"],.ui-admin-subtabs,.ui-subtabs,.overflow-x-auto,.overflow-auto,[data-radix-scroll-area-viewport]');
            const controls = allControls.filter(element => !excluded(element)).map(element => {
              const rect = element.getBoundingClientRect();
              return { tag: element.tagName, type: element.getAttribute('type'), name: named(element).slice(0, 100), placeholder: element.getAttribute('placeholder'), x: rect.x, right: rect.right, width: rect.width, height: rect.height, disabled: element.disabled || false };
            });
            const overflowNodes = [...panel.querySelectorAll('*')].filter(visible).filter(element => !excluded(element)).filter(element => { const rect = element.getBoundingClientRect(); return rect.right > innerWidth + 1 || rect.left < -1; }).slice(0, 12).map(element => ({ tag: element.tagName, className: element.className, text: element.textContent?.trim().slice(0, 100) }));
            return { heading: document.querySelector('.ui-admin-page-heading h1')?.textContent, documentWidth: document.documentElement.scrollWidth, controls, unnamedFields: controls.filter(control => ['INPUT', 'TEXTAREA', 'SELECT'].includes(control.tag) && !control.name), clippedControls: controls.filter(control => control.x < -1 || control.right > innerWidth + 1), overflowNodes, visibleCopy: panel.innerText.slice(0, 1800) };
          });
          const result = { route: routeName, mode, theme, width, ...metrics, requests: [...new Map(requests.map(request => [request.path, request])).values()], runtimeErrors };
          results.push(result);
          if ((width === 320 && theme === 'light') || result.clippedControls.length || result.overflowNodes.length || runtimeErrors.length) {
            await page.screenshot({ path: new URL(`${routeName.replaceAll('/', '-')}-${mode}-${theme}-${width}.png`, output).pathname, fullPage: true });
          }
        }
        await context.close();
      }
    }
    console.log(`${routeName}: ${results.filter(result => result.route === routeName).map(result => ({ mode: result.mode, theme: result.theme, width: result.width, overflow: result.overflowNodes.length, clipped: result.clippedControls.length, unnamed: result.unnamedFields.length, errors: result.runtimeErrors.length })).filter(result => result.overflow || result.clipped || result.unnamed || result.errors).length} cases need review`);
    await writeFile(new URL('results.json', output), JSON.stringify({ scope: 'Real AdminDashboard sections, API unavailable and explicit empty-known fixtures, no authentication or live API writes; table/tablist horizontal scrolling excluded from clipping checks.', results }, null, 2));
  }
  console.log(`Inspected ${results.length} administrator coverage cases.`);
  const concerns = results.filter(result => result.documentWidth > result.width + 1 || result.clippedControls.length || result.unnamedFields.length || result.overflowNodes.length || result.runtimeErrors.length);
  if (process.env.DESIGN_ASSERT_CLEAN === '1' && concerns.length) {
    throw new Error(`${concerns.length} administrator coverage cases still need review.`);
  }
} finally {
  await browser.close();
}
