import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const origin = process.env.DESIGN_BASE_URL || 'http://127.0.0.1:4319';
const directory = 'verification-screenshots/fieldnotes-reader-review-20260908/final';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.DESIGN_CHROMIUM_PATH || '/usr/bin/chromium', headless: true });
const results = [];
try {
  for (const theme of ['light', 'dark']) for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, serviceWorkers: 'block' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(value => {
      localStorage.setItem('theme', value);
      localStorage.setItem('site.language', 'ko');
    }, theme);
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      // The real block capture tool loads this public library. No response substitutes.
      const converter = url.hostname === 'unpkg.com' && url.pathname.startsWith('/turndown');
      return converter || (url.origin === origin && !url.pathname.startsWith('/api/'))
        ? route.continue() : route.abort('blockedbyclient');
    });
    const screenshot = async name => {
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.screenshot({ path: `${directory}/${theme}-${width}-${name}.png`, animations: 'disabled' });
    };
    await page.goto(`${origin}/blog/2026/organizing-intelligence-era`);
    const image = page.locator('.article-image-trigger').first();
    await expect(image).toHaveAttribute('data-state', 'ready');
    await screenshot('article');
    await image.click();
    const viewer = page.locator('.ui-image-viewer');
    await expect(viewer).toBeVisible();
    await expect(viewer.locator('[data-testid="lightbox-image"]')).toHaveAttribute('data-state', 'ready');
    const canvas = await viewer.locator('.ui-image-viewer__canvas').boundingBox();
    const tools = await viewer.locator('.ui-image-viewer__tools').boundingBox();
    expect(tools.y).toBeGreaterThan(canvas.y + canvas.height - 1);
    await screenshot('image-viewer');
    await page.keyboard.press('Escape');
    await expect(image).toBeFocused();
    await page.goto(`${origin}/blog/2026/c-lang-2`);
    await expect(page.locator('.article-code-card').first()).toBeVisible();
    for (const [name, selector] of [['code', '.article-code-card'], ['table', '.article-table-shell'], ['quote', '.article-flow blockquote'], ['discussion', '#article-discussion']]) {
      const element = page.locator(selector).first();
      await element.evaluate(el => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 125, behavior: 'instant' }));
      await screenshot(name);
    }
    const opener = width > 850
      ? page.locator('.rd-right').getByRole('button', { name: '메모 열기' })
      : page.locator('.fn-reader-mobilebar').getByRole('button', { name: '메모', exact: true });
    await opener.click();
    const memo = page.locator('ai-memo-pad .panel');
    await expect(memo).toBeVisible();
    await memo.locator('textarea.memo-input').fill('읽는 중에 남긴 메모\n\n지능의 결과를 어떤 기준으로 검증할까?');
    await screenshot('memo');
    if (width > 850) {
      await expect.poll(() => page.locator('ai-memo-pad').evaluate(element => Boolean(element._turndown))).toBe(true);
      const paragraph = page.locator('.article-flow p').first();
      await paragraph.evaluate(el => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 160, behavior: 'instant' }));
      await memo.locator('.memo-format-tools > summary').click();
      await memo.getByRole('button', { name: '블록 추가', exact: true }).click();
      await paragraph.hover();
      await paragraph.click();
      const menu = page.locator('ai-memo-pad .block-action-menu');
      await expect(menu).toBeVisible();
      await screenshot('block-menu');
      const previousDraft = await memo.locator('textarea.memo-input').inputValue();
      await menu.getByRole('button', { name: '메모에 붙여넣기', exact: true }).click();
      const appendedDraft = await memo.locator('textarea.memo-input').inputValue();
      expect(appendedDraft).toContain(previousDraft);
      expect(appendedDraft.length).toBeGreaterThan(previousDraft.length);
    }
    await memo.getByLabel('창 제어').getByRole('button', { name: '닫기', exact: true }).click();
    await expect(memo).toBeHidden();
    if (width > 850) {
      await page.keyboard.press('Alt+z');
      await expect(page.locator('.ui-header__navigation')).toBeHidden();
      await screenshot('focus');
      await page.keyboard.press('Escape');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect(errors).toEqual([]);
    results.push({ theme, width, errors, viewerToolsBelowImage: true, memoDraftEntered: true });
    console.log(`${theme} ${width}: captured and checked`);
    await page.close();
  }
  await writeFile(`${directory}/results.json`, JSON.stringify(results, null, 2));
} finally { await browser.close(); }
