import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect as baseExpect } from '@playwright/test';

const expect = baseExpect.configure({ timeout: 30_000 });
const baseURL = process.env.DESIGN_BASE_URL || 'http://127.0.0.1:4175';
const origin = new URL(baseURL).origin;
const output = new URL('../../verification-screenshots/memo-discussion-ux/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.DESIGN_CHROMIUM_PATH || '/usr/bin/chromium' });
const results = [];
const comments = [
  { id: 'ux-human', postId: '2025/memory-management-study', author: '독자', content: '설명 감사합니다. 메모리 관리에서 중요한 부분을 정리해 보았습니다.\n\n추가적인 예시도 궁금합니다.', createdAt: '2026-09-08T00:00:00Z' },
  { id: 'ai-ux', postId: '2025/memory-management-study', author: 'AI Assistant', content: '객체의 생명주기와 참조 관계를 함께 살펴보면 이해하기 쉽습니다.', createdAt: '2026-09-08T00:01:00Z' },
];

try {
  for (const theme of ['light', 'dark', 'terminal']) {
    for (const width of [320, 390, 1440]) {
      console.log(`Checking ${theme} / ${width}`);
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
      await context.addInitScript(theme => {
        localStorage.setItem('theme', theme);
        localStorage.setItem('site.language', 'ko');
        localStorage.setItem('aiMemo.fab.enabled', 'true');
      }, theme);
      // Exercise the UI with local fixtures; never submit comments or invoke external AI services.
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.pathname === '/api/v1/public/config') return route.fulfill({ json: { ok: true, data: { apiBaseUrl: origin, chatBaseUrl: origin, siteBaseUrl: origin, features: { aiEnabled: true, commentsEnabled: true, ragEnabled: false, aiInline: false, codeExecutionEnabled: false } } } });
        if (url.pathname === '/api/v1/comments' && route.request().method() === 'GET') return route.fulfill({ json: { comments } });
        if (url.pathname === '/api/v1/comments/reactions/batch') return route.fulfill({ json: {} });
        if (url.origin !== origin || url.pathname.startsWith('/api/')) return route.abort('blockedbyclient');
        return route.continue();
      });
      await context.routeWebSocket('**/*', socket => socket.close());
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
      const panel = page.locator('ai-memo-pad #panel');
      await expect(panel).toBeAttached();
      await page.keyboard.press('Alt+m');
      await expect(panel).toBeVisible();
      const memo = panel.locator('#memo');
      await memo.fill('**메모**\n\n```javascript\n' + Array.from({ length: 80 }, (_,i) => `console.log(${i});`).join('\n') + '\n```');
      await expect(panel.locator('#codeMode')).toBeVisible();
      assert.equal(await memo.evaluate(e => getComputedStyle(e).scrollbarWidth), 'none');
      await memo.evaluate(e => { e.scrollTop = 0; });
      await memo.hover();
      await page.mouse.wheel(0, 350);
      await expect.poll(() => memo.evaluate(e => e.scrollTop)).toBeGreaterThan(0);
      await page.screenshot({ path: new URL(`memo-${theme}-${width}.png`, output).pathname });
      const format = panel.locator('.memo-format-tools');
      await format.locator('summary').click();
      for (const id of ['memoH1','memoH2','memoH3','memoUl','memoOl','memoQuote','memoLink','memoCodeBlock','addSelection','addBlock']) {
        await expect(format.locator(`#${id}`)).toBeVisible();
      }
      await format.locator('#memoH1').click();
      await expect(format).not.toHaveAttribute('open');
      const manage = panel.locator('.memo-more-actions');
      await manage.locator('summary').click();
      for (const button of await manage.locator('button').all()) {
        await expect(button).toBeVisible();
        const box = await button.boundingBox();
        assert.ok(box.width >= 44 && box.height >= 44 && box.x >= 0 && box.x + box.width <= width, JSON.stringify(box));
      }
      await page.screenshot({ path: new URL(`memo-menu-${theme}-${width}.png`, output).pathname });
      await page.keyboard.press('Escape');
      await expect(manage).not.toHaveAttribute('open');
      await expect(manage.locator('summary')).toBeFocused();
      await expect(panel).toBeVisible();
      await panel.locator('#close').click();
      await expect(panel).toBeHidden();

      await page.goto(`${baseURL}/blog/2025/memory-management-study`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('[data-reading-progress]')).toBeVisible();
      const positions = [];
      for (const y of [0, 650, 1500]) {
        await page.evaluate(y => window.scrollTo(0, y), y);
        await expect.poll(() => page.evaluate(() => Math.abs(document.querySelector('[data-reading-progress]').getBoundingClientRect().top - Math.max(0, document.querySelector('.ui-header').getBoundingClientRect().bottom)))).toBeLessThan(1);
        positions.push(await page.locator('[data-reading-progress]').boundingBox());
      }
      await page.screenshot({ path: new URL(`reading-${theme}-${width}.png`, output).pathname });
      const section = page.locator('.ui-comment-section');
      await expect(section.getByText('설명 감사합니다.', { exact: false })).toBeVisible();
      await section.scrollIntoViewIfNeeded();
      if (width < 600) {
        const layout = section.locator('.ui-discussion-card-layout').first();
        assert.equal(await layout.evaluate(e => getComputedStyle(e).flexDirection), 'column');
        const body = layout.locator('.ui-discussion-message > div').first();
        const bodyBox = await body.boundingBox();
        const layoutBox = await layout.boundingBox();
        assert.ok(bodyBox.width >= layoutBox.width - 1, JSON.stringify({bodyBox,layoutBox}));
      }
      await page.screenshot({ path: new URL(`discussion-${theme}-${width}.png`, output).pathname });
      const reaction = section.locator('.ui-reactions').first();
      await reaction.getByRole('button', { name: 'Add reaction', exact: true }).click();
      const picker = reaction.getByRole('group', { name: 'Choose reaction' });
      await expect(picker).toBeVisible();
      const pickerBox = await picker.boundingBox();
      assert.ok(pickerBox.x >= 0 && pickerBox.x + pickerBox.width <= width, JSON.stringify(pickerBox));
      for (const button of await picker.locator('button').all()) {
        const box = await button.boundingBox();
        assert.ok(box.width >= 44 && box.height >= 44, JSON.stringify(box));
      }
      await page.screenshot({ path: new URL(`reactions-${theme}-${width}.png`, output).pathname });
      await page.keyboard.press('Escape');
      await expect(reaction.locator('button[aria-expanded]')).toBeFocused();
      await section.getByRole('button', { name: '새 댓글 작성', exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('button', { name: '댓글 작성 창 닫기', exact: true }).click();
      await section.getByRole('button', { name: /^Reply:/ }).first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
      assert.equal(await page.locator('.ui-comment-scroll').evaluate(e => getComputedStyle(e).scrollbarWidth), 'none');
      assert.deepEqual(errors, []);
      results.push({ theme, width, positions, pickerBox, pageErrors: errors });
      await context.close();
    }
  }
} finally {
  await writeFile(new URL('results.json', output), JSON.stringify(results, null, 2));
  await browser.close();
}
console.log(`Passed ${results.length} memo, discussion and reading layout cases.`);
