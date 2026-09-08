import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseURL = process.env.DESIGN_BASE_URL || 'http://127.0.0.1:4173';
const output = new URL('../../docs/design-review-20260908/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.DESIGN_CHROMIUM_PATH || undefined });
const results = [];
const draft = '## 디자인 검증\n\n공백과 줄바꿈을 유지하는 실제 편집기 내용입니다.';

try {
  for (const surface of ['admin', 'standalone']) {
    for (const theme of ['light', 'dark', 'terminal']) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await context.addInitScript(({ theme }) => localStorage.setItem('theme', theme), { theme });
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== new URL(baseURL).origin || url.pathname.startsWith('/api/')) {
          await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: { message: 'Design verification: API unavailable' } }) });
        } else {
          await route.continue();
        }
      });
      const page = await context.newPage();
      await page.goto(`${baseURL}/scripts/design-verification/workspace.html?surface=${surface}`, { waitUntil: 'networkidle' });
      const editor = page.getByRole('textbox', { name: 'Markdown content editor' });
      await editor.fill(draft);

      for (const width of [375, 768, 1024, 1280, 1440, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        const compact = await page.locator('.ui-editor').evaluate(element => element.clientWidth <= 1120);
        const toolbar = page.getByRole('toolbar', { name: '글 편집 작업 영역' });
        assert.equal(await toolbar.isVisible(), compact, `pane control visibility: ${surface}/${theme}/${width}`);
        if (compact) {
          await toolbar.getByRole('button', { name: '미리보기' }).click();
          assert.equal(await editor.isVisible(), false);
          assert.equal(await page.locator('.ui-editor-preview-pane').isVisible(), true);
          await toolbar.getByRole('button', { name: '도구' }).click();
          assert.equal(await page.locator('.ui-editor-tools').isVisible(), true);
          await toolbar.getByRole('button', { name: '작성', exact: true }).click();
        }
        assert.equal(await editor.inputValue(), draft, `draft preservation: ${surface}/${theme}/${width}`);
        const measured = await page.evaluate(() => {
          const rect = selector => {
            const element = document.querySelector(selector);
            const bounds = element?.getBoundingClientRect();
            return element && getComputedStyle(element).display !== 'none' && bounds
              ? { width: Math.round(bounds.width), height: Math.round(bounds.height) }
              : null;
          };
          return {
            viewport: innerWidth,
            documentWidth: document.documentElement.scrollWidth,
            editor: rect('.ui-editor'),
            write: rect('.ui-editor-write-pane'),
            preview: rect('.ui-editor-preview-pane'),
            tools: rect('.ui-editor-tools'),
          };
        });
        assert.ok(measured.documentWidth <= width + 1, `document overflow: ${JSON.stringify(measured)}`);
        if (!compact) {
          assert.ok(measured.write.width >= 320 && measured.preview.width >= 320, `wide pane width: ${JSON.stringify(measured)}`);
        }
        results.push({ surface, theme, width, compact, ...measured, draftPreserved: true, paneSwitches: compact ? 'write/preview/tools verified' : 'wide split visible' });
        if ([375, 1024, 1440].includes(width)) {
          await page.screenshot({ path: new URL(`workspace-${surface}-${theme}-${width}.png`, output).pathname, fullPage: true });
        }
      }

      // A desktop mode choice must not suppress the other compact pane after resize.
      await page.getByRole('tab', { name: 'Write', exact: true }).click();
      await page.setViewportSize({ width: 1024, height: 900 });
      await page.getByRole('toolbar', { name: '글 편집 작업 영역' }).getByRole('button', { name: '미리보기' }).click();
      assert.equal(await page.locator('.ui-editor-preview-pane').isVisible(), true);
      if (surface === 'admin') {
        await page.setViewportSize({ width: 1280, height: 420 });
        const sidebar = page.locator('.ui-admin-navigation');
        const navMetrics = await sidebar.evaluate(element => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, overflow: getComputedStyle(element).overflowY }));
        assert.equal(navMetrics.overflow, 'auto');
        assert.ok(navMetrics.scrollHeight > navMetrics.clientHeight);
        await page.getByRole('tab', { name: 'Workers', exact: true }).focus();
        assert.ok(await sidebar.evaluate(element => element.scrollTop > 0));
        results.push({ surface, theme, shortViewport: '1280x420', ...navMetrics, lastNavigationItemReachable: true });
      }
      await context.close();
    }
  }
  await writeFile(new URL('workspace-browser-results.json', output), JSON.stringify({ scope: 'Real React components in a test-only harness; production authentication and live API are not exercised.', results }, null, 2));
  console.log(`Verified ${results.length} workspace layout cases.`);
} finally {
  await browser.close();
}
