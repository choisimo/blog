import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium, expect as baseExpect } from '@playwright/test';

const expect = baseExpect.configure({ timeout: 30_000 });
const baseURL = process.env.DESIGN_BASE_URL || 'http://127.0.0.1:4173';
const origin = new URL(baseURL).origin;
const output = new URL('../../docs/design-review-20260908/', import.meta.url);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.DESIGN_CHROMIUM_PATH || '/usr/bin/chromium',
});
const evidence = { baseURL, networkPolicy: 'Local static GETs only; API, external HTTP and WebSocket requests blocked.', results: [], failures: [] };
let currentCase;

async function leftEdge(locator) {
  return locator.evaluate(element => {
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + 5, box.top + box.height / 2);
    return {
      box: box.toJSON(),
      point: { x: box.left + 5, y: box.top + box.height / 2 },
      belongsToTarget: Boolean(hit && (hit === element || element.contains(hit))),
      hitTag: hit?.tagName,
      hitButton: hit?.closest('button')?.getAttribute('aria-label'),
    };
  });
}

try {
  for (const theme of ['light', 'terminal']) {
    for (const width of [320, 768, 1024, 1440]) {
      currentCase = `projects-dock-${theme}-${width}`;
      console.log(`Checking ${currentCase}`);
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
      await context.addInitScript(theme => {
        localStorage.setItem('theme', theme);
        localStorage.setItem('site.language', 'ko');
        localStorage.setItem('aiMemo.fab.enabled', 'true');
      }, theme);
      await context.route('**/*', route => {
        const request = route.request();
        const url = new URL(request.url());
        return request.method() !== 'GET' || url.origin !== origin || url.pathname.startsWith('/api/')
          ? route.abort('blockedbyclient') : route.continue();
      });
      await context.routeWebSocket('**/*', socket => socket.close());
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${baseURL}/projects`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#project-results-summary')).toHaveText(/^\d+개 저장소$/);
      await expect(page.getByRole('toolbar', { name: /빠른 작업|Floating actions/ })).toBeVisible();
      const filter = page.getByRole('button', { name: '전체', exact: true });
      const search = page.getByRole('searchbox', { name: '프로젝트 검색', exact: true });
      const searchWrapper = page.locator('.ui-projects-search');
      const filterHit = await leftEdge(filter);
      const searchHit = await leftEdge(search);
      const searchWrapperHit = await leftEdge(searchWrapper);
      assert.ok(filterHit.belongsToTarget, `Filter left edge intercepted: ${JSON.stringify(filterHit)}`);
      assert.ok(searchHit.belongsToTarget, `Input left edge intercepted: ${JSON.stringify(searchHit)}`);
      assert.ok(searchWrapperHit.belongsToTarget, `Search left edge intercepted: ${JSON.stringify(searchWrapperHit)}`);
      const geometry = await page.evaluate(() => {
        const container = document.querySelector('.ui-projects-page.ui-page-container');
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          paddingLeft: parseFloat(getComputedStyle(container).paddingLeft),
          paddingRight: parseFloat(getComputedStyle(container).paddingRight),
          controls: [...document.querySelectorAll('.ui-projects-catalog button, .ui-projects-catalog input, .ui-projects-catalog select')]
            .filter(element => element.getClientRects().length)
            .map(element => ({ name: element.getAttribute('aria-label') || element.textContent.trim(), ...element.getBoundingClientRect().toJSON() })),
        };
      });
      assert.equal(geometry.paddingLeft, width >= 768 ? 72 : 16);
      assert.equal(geometry.paddingRight, width >= 768 ? 72 : 16);
      assert.ok(geometry.scrollWidth <= geometry.clientWidth + 1);
      for (const control of geometry.controls) {
        assert.ok(control.x >= -0.5 && control.right <= width + 1 && control.width >= 43.5 && control.height >= 43.5, JSON.stringify(control));
      }
      // The formerly intercepted edge now reaches the intended search field.
      await page.mouse.click(searchHit.point.x, searchHit.point.y);
      await expect(search).toBeFocused();
      await page.mouse.click(filterHit.point.x, filterHit.point.y);
      await expect(filter).toBeFocused();
      if (theme === 'light' && width === 1440) {
        await filter.evaluate(element => element.blur());
        await page.mouse.move(0, 0);
        await page.screenshot({ path: new URL('latest-projects-light-1440.png', output).pathname });
      }
      assert.deepEqual(errors, []);
      evidence.results.push({ case: currentCase, filterHit, searchHit, searchWrapperHit, geometry, pageErrors: errors });
      await context.close();
    }
  }
  console.log(`Verified ${evidence.results.length} Projects dock cases.`);
} catch (error) {
  evidence.failures.push({ case: currentCase, message: error instanceof Error ? error.stack : String(error) });
  throw error;
} finally {
  await writeFile(new URL('projects-dock-browser-results.json', output), JSON.stringify(evidence, null, 2));
  await browser.close();
}
