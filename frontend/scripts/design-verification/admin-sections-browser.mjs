import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseURL = process.env.DESIGN_BASE_URL || 'http://127.0.0.1:4173';
const output = new URL('../../docs/design-review-20260908/', import.meta.url);
const browser = await chromium.launch({ headless: true, executablePath: process.env.DESIGN_CHROMIUM_PATH || undefined });
const prompts = ['default', 'research', 'coding', 'blog', 'article', 'terminal', 'performance'].map(mode => ({ mode, label: `${mode} 프롬프트 설정`, text: `${mode}의 원본 프롬프트\n\n여러 문단의 편집 내용`, isOverridden: mode === 'default' }));
const results = [];

try {
  for (const section of ['prompts', 'logs']) {
    for (const theme of ['light', 'dark', 'terminal']) {
      const context = await browser.newContext();
      await context.addInitScript(({ theme }) => localStorage.setItem('theme', theme), { theme });
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
        if (route.request().method() === 'OPTIONS') {
          await route.fulfill({ status: 204, headers });
        } else if (url.pathname === '/api/v1/agent/prompts') {
          await route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { prompts } }) });
        } else if (url.pathname === '/api/v1/admin/logs/stream') {
          const entry = { timestamp: '2026-09-08T00:00:00.000Z', level: 'info', service: 'design-verification', message: '화면 검증용 로그입니다. 실제 서비스의 로그가 아닙니다.' };
          await route.fulfill({ status: 200, headers, contentType: 'text/event-stream', body: `data: ${JSON.stringify(entry)}\n\n` });
        } else if (url.origin !== new URL(baseURL).origin || url.pathname.startsWith('/api/')) {
          await route.fulfill({ status: 503, headers, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Design verification: API unavailable' }) });
        } else await route.continue();
      });
      const page = await context.newPage();
      await page.goto(`${baseURL}/scripts/design-verification/workspace.html?section=${section}`, { waitUntil: 'networkidle' });
      if (section === 'prompts') {
        await page.getByRole('textbox', { name: 'default 프롬프트 설정' }).fill('검증 중인 새 문장\n\nresize 뒤에도 유지됩니다.');
      } else {
        await page.getByRole('region', { name: '서버 로그 목록' }).getByText('화면 검증용 로그입니다. 실제 서비스의 로그가 아닙니다.').first().waitFor();
      }
      for (const width of [320, 375, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        const rootSelector = section === 'prompts' ? '.ui-admin-promptsmanager' : '.ui-admin-logviewer';
        const data = await page.locator(rootSelector).evaluate(element => {
          const bounds = element.getBoundingClientRect();
          const controls = [...element.querySelectorAll('button,input,textarea')].filter(node => node.getClientRects().length).map(node => {
            const rect = node.getBoundingClientRect();
            return { name: node.getAttribute('aria-label') || node.textContent?.trim().slice(0, 40) || node.tagName, x: rect.x, width: rect.width, height: rect.height, right: rect.right };
          });
          return { viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, panelWidth: bounds.width, controls };
        });
        assert.ok(data.documentWidth <= width + 1, `document overflow: ${section}/${theme}/${width}`);
        assert.ok(data.controls.every(control => control.x >= 0 && control.right <= width + 1), `clipped control: ${JSON.stringify(data)}`);
        assert.ok(data.controls.every(control => control.height >= 44 && control.width >= 44), `small control: ${JSON.stringify(data)}`);
        if (section === 'prompts') {
          const editor = page.getByRole('textbox', { name: 'default 프롬프트 설정' });
          assert.equal(await editor.inputValue(), '검증 중인 새 문장\n\nresize 뒤에도 유지됩니다.');
          const rect = await editor.boundingBox();
          assert.ok(rect.width >= Math.min(220, width - 100));
        } else {
          const streamFits = await page.locator('.ui-log-stream').evaluate(element => element.scrollWidth <= element.clientWidth + 1);
          assert.equal(streamFits, true, `log text overflow: ${section}/${theme}/${width}`);
          await page.getByRole('button', { name: 'warn', exact: true }).click();
          assert.equal(await page.getByRole('button', { name: 'warn', exact: true }).getAttribute('aria-pressed'), 'true');
          await page.getByRole('button', { name: 'all', exact: true }).click();
          await page.getByRole('textbox', { name: '서비스 로그 검색' }).fill('design');
          await page.getByRole('button', { name: 'Pause log stream', exact: true }).click();
          assert.equal(await page.getByRole('button', { name: 'Resume log stream', exact: true }).getAttribute('aria-pressed'), 'true');
          await page.getByRole('button', { name: 'Resume log stream', exact: true }).click();
        }
        results.push({ section, theme, width, ...data, statePreserved: true });
        if ([375, 1024].includes(width)) await page.screenshot({ path: new URL(`admin-${section}-${theme}-${width}.png`, output).pathname, fullPage: true });
      }
      await context.close();
    }
  }
  await writeFile(new URL('admin-sections-browser-results.json', output), JSON.stringify({ scope: 'Real AdminDashboard/PromptsManager/LogViewer in test-only React harness; requests use fixtures, no production authentication or API writes.', results }, null, 2));
  console.log(`Verified ${results.length} administrator section cases.`);
} finally {
  await browser.close();
}
