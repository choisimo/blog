import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseURL = process.env.DESIGN_BASE_URL || 'http://127.0.0.1:4173';
const output = new URL('../../docs/design-review-20260908/playground-models/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.DESIGN_CHROMIUM_PATH || undefined });
const model = {
  id: 'design-writing-model',
  displayName: 'Writing model with a deliberately long display name',
  isEnabled: true,
  provider: { displayName: 'Local fixture provider with a long name' },
};
const results = [];
try {
  for (const theme of ['light', 'terminal']) {
    for (const state of ['loading', 'error', 'empty', 'populated']) {
      const context = await browser.newContext({ viewport: { width: 320, height: 900 } });
      await context.addInitScript(theme => localStorage.setItem('theme', theme), theme);
      let releaseModels;
      const modelGate = new Promise(resolve => { releaseModels = resolve; });
      let modelRequests = 0;
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        if (url.origin === new URL(baseURL).origin && !url.pathname.startsWith('/api/')) return route.continue();
        let fixture;
        if (url.pathname === '/api/v1/admin/ai/models') {
          modelRequests += 1;
          if (state === 'loading') await modelGate;
          if (state !== 'error') fixture = { models: state === 'populated' ? [model] : [] };
        } else if (url.pathname === '/api/v1/admin/ai/playground/history') fixture = { history: [], total: 0 };
        else if (url.pathname === '/api/v1/admin/ai/prompt-templates') fixture = { templates: [], total: 0 };
        await route.fulfill({
          status: fixture ? 200 : 503,
          headers,
          contentType: 'application/json',
          body: JSON.stringify(fixture ? { ok: true, data: fixture } : { ok: false, error: 'Design fixture: models unavailable.' }),
        });
      });
      const page = await context.newPage();
      const runtimeErrors = [];
      page.on('pageerror', error => runtimeErrors.push(error.message));
      await page.goto(`${baseURL}/scripts/design-verification/workspace.html?route=ai%2Fplayground`, { waitUntil: 'domcontentloaded' });
      const panel = page.locator('.ui-admin-playground .ui-panel').filter({ has: page.locator('.ui-panel-title').filter({ hasText: /^Models$/ }) });
      await panel.waitFor();
      if (state === 'loading') {
        await panel.getByRole('status').filter({ hasText: 'Loading models' }).waitFor();
        assert.equal(await panel.getByText(/No enabled models/).count(), 0);
        assert.equal(await panel.locator('[aria-busy="true"]').count(), 1);
      } else if (state === 'error') {
        await panel.getByRole('alert').waitFor();
        assert.equal(await panel.getByText(/No enabled models/).count(), 0);
        await panel.getByRole('button', { name: 'Retry models' }).click();
        await panel.getByRole('alert').waitFor();
        assert.equal(modelRequests, 2);
      } else if (state === 'empty') {
        await panel.getByRole('status').filter({ hasText: 'No enabled models available.' }).waitFor();
        assert.equal(await panel.getByRole('checkbox').count(), 0);
      } else {
        const checkbox = panel.getByRole('checkbox', { name: `${model.displayName} ${model.provider.displayName}`, exact: true });
        await checkbox.waitFor();
        await checkbox.focus();
        await page.keyboard.press('Space');
        assert.equal(await checkbox.getAttribute('aria-checked'), 'true');
        await panel.getByText('1/5 selected').waitFor();
      }
      const metrics = await panel.evaluate(element => {
        const panelBox = element.getBoundingClientRect();
        const contents = [...element.querySelectorAll('p,label,button')].map(child => {
          const box = child.getBoundingClientRect();
          return { text: child.textContent?.trim(), x: box.x, right: box.right, width: box.width, height: box.height };
        });
        return { text: element.innerText, x: panelBox.x, right: panelBox.right, documentWidth: document.documentElement.scrollWidth, contents };
      });
      assert.ok(metrics.documentWidth <= 320);
      assert.ok(metrics.x >= 0 && metrics.right <= 320);
      assert.ok(metrics.contents.every(child => child.x >= metrics.x && child.right <= metrics.right));
      assert.deepEqual(runtimeErrors, []);
      await panel.screenshot({ path: new URL(`${state}-${theme}-320.png`, output).pathname });
      results.push({ state, theme, width: 320, modelRequests, ...metrics, runtimeErrors });
      releaseModels();
      if (state === 'loading') await panel.getByText(/No enabled models available/).waitFor();
      await context.close();
    }
  }
  await writeFile(new URL('results.json', output), JSON.stringify({ scope: 'Actual Playground Models panel with isolated local API fixtures; loading, error/retry, empty and populated keyboard selection at 320px in light/terminal. No model execution or writes.', results }, null, 2));
  console.log(`Playground model states: ${results.length} cases passed.`);
} finally {
  await browser.close();
}
