import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

const markdown = readFileSync(new URL('./fixtures/reading-design.md', import.meta.url), 'utf8');
const title = '읽기 디자인 회귀 검증';
const slug = 'reading-design-fixture';
const path = `/posts/2026/${slug}.md`;
const svg = (width: number, height: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#dbeafe"/><rect x="10%" y="10%" width="80%" height="80%" rx="20" fill="#2456bc"/><text x="50%" y="50%" text-anchor="middle" fill="white" font-size="48">${width} × ${height}</text></svg>`;

test.use({ serviceWorkers: 'block' });

async function openFixture(page: Page, theme = 'light') {
  await page.addInitScript(value => {
    localStorage.setItem('theme', value);
    localStorage.setItem('site.language', 'ko');
  }, theme);
  // Never send fixture content to a deployed API; optional services must degrade gracefully.
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    const origin = new URL(test.info().project.use.baseURL || 'http://127.0.0.1:8080').origin;
    return url.origin !== origin || url.pathname.startsWith('/api/') ? route.abort('blockedbyclient') : route.fallback();
  });
  await page.route('**/posts-manifest.json', route => route.fulfill({ json: {
    version: 1, total: 1, years: ['2026'], posts: [path],
    items: [{ path, year: '2026', slug, title, description: 'Reading fixture', snippet: '', date: '2026-09-08', author: 'Fixture', category: 'Engineering', tags: [], published: true, url: `/blog/2026/${slug}`, language: 'ko' }],
  } }));
  await page.route('**/posts/2026/manifest.json', route => route.fulfill({ json: { files: [], simulatorFiles: [] } }));
  await page.route(`**${path}`, route => route.fulfill({ contentType: 'text/markdown; charset=utf-8', body: markdown }));
  await page.route('**/media/reading-wide.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: svg(1200, 600) }));
  await page.route('**/media/reading-tall.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: svg(600, 1200) }));
  let brokenRequests = 0;
  await page.route('**/media/reading-broken.svg', route => {
    brokenRequests += 1;
    return brokenRequests === 1 ? route.fulfill({ status: 503, body: '' }) : route.fulfill({ contentType: 'image/svg+xml', body: svg(800, 400) });
  });
  await page.goto(`/blog/2026/${slug}`);
  await expect(page.locator('.ui-article-title')).toHaveText(theme === 'terminal' ? `> ${title}` : title);
  await expect(page.locator('[data-reading-content] .article-flow')).toBeVisible();
}

for (const width of [390, 1440]) {
  test(`${width}px: reading progress follows the visible header edge while scrolling`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openFixture(page);
    for (const scrollY of [0, 32, 500, 1800, 0]) {
      await page.evaluate(value => window.scrollTo(0, value), scrollY);
      await expect.poll(async () => page.evaluate(() => {
        const headerBottom = document.querySelector('.ui-header')!.getBoundingClientRect().bottom;
        const bar = document.querySelector('[data-reading-progress]')!.getBoundingClientRect();
        return Math.abs(bar.top - Math.max(0, headerBottom));
      })).toBeLessThan(1);
      const bar = await page.locator('[data-reading-progress]').boundingBox();
      expect(bar!.x).toBe(0);
      expect(bar!.height).toBe(3);
      const header = await page.locator('.ui-header').boundingBox();
      expect(bar!.width).toBe(header!.width);
    }
  });
}

for (const theme of ['light', 'dark', 'terminal']) {
  for (const width of [320, 390, 768, 1440]) {
    test(`${theme} / ${width}px: reading width, local scrolling and real image ratios`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openFixture(page, theme);
      const article = page.locator('.ui-article');
      const bounds = await article.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
      expect(bounds!.width).toBeLessThanOrEqual(780);
      const image = page.locator('img[alt="세로 이미지"]');
      await image.scrollIntoViewIfNeeded();
      await expect(image).toHaveJSProperty('naturalWidth', 600);
      await expect(image.locator('..')).toHaveAttribute('data-state', 'ready');
      const imageBox = await image.boundingBox();
      expect(imageBox!.height / imageBox!.width).toBeCloseTo(2, 1);
      const table = page.locator('.article-table-shell table');
      await expect(table).toHaveCSS('display', 'table');
      await expect(table).toHaveCSS('overflow-x', 'visible');
      const scroll = page.locator('.article-table-scroll');
      await expect(scroll).toHaveCSS('overflow-x', 'auto');
      // A table that fits the refined 12px typography need not overflow on desktop.
      // Narrow screens must still scroll locally without widening the document.
      if (width < 500) {
        expect(await scroll.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
        await scroll.evaluate(element => { element.scrollLeft = element.scrollWidth; });
        expect(await scroll.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await expect(page.locator('.article-flow h2').first()).toHaveCSS('text-align', 'start');
      const headingBox = await page.locator('.article-flow h2').first().boundingBox();
      const paragraphBox = await page.locator('.article-flow > .article-readable').first().boundingBox();
      expect(Math.abs(headingBox!.x - paragraphBox!.x)).toBeLessThan(1);
      await expect(page.locator('.article-code-toolbar__actions button').first()).toHaveCSS('min-width', '44px');
      await expect(page.locator('.article-code-toolbar__actions button').first()).toHaveCSS('opacity', '1');
    });
  }
}

test('code wrapping changes the actual scroll behavior rather than only the button label', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFixture(page);
  const card = page.locator('.article-code-card');
  await card.scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: '코드 줄 바꿈 끄기' }).click();
  await expect(card).toHaveAttribute('data-wrapped', 'false');
  await expect(card.locator('.article-code-highlighter')).toHaveCSS('white-space', 'pre');
  expect(await card.locator('.article-code-region').evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
  await page.getByRole('button', { name: '코드 줄 바꿈 켜기' }).click();
  await expect(card.locator('.article-code-highlighter')).toHaveCSS('white-space', 'pre-wrap');
});

test('image viewer preserves keyboard focus, safe fit and reset on a small screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await openFixture(page);
  const opener = page.getByRole('button', { name: 'View 가로 이미지 in full size' });
  await opener.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS('background-color', 'rgb(252, 251, 247)');
  await expect(page.getByTestId('lightbox-image')).toHaveAttribute('data-state', 'ready');
  await expect(page.getByRole('button', { name: 'Close image preview' })).toBeFocused();
  // Measure the final dialog geometry after Radix's entry scale animation.
  await dialog.evaluate(async element => {
    await Promise.all(element.getAnimations().map(animation => animation.finished));
  });
  for (const button of await dialog.locator('.ui-image-viewer__tools button').all()) {
    const box = await button.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  }
  await page.getByRole('button', { name: 'Zoom in image preview' }).click();
  await expect(dialog.locator('output')).toHaveText('125%');
  await page.keyboard.press('r');
  await page.keyboard.press('0');
  await expect(dialog.locator('output')).toHaveText('100%');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(opener).toBeFocused();
});

test('an unavailable image stops loading and recovers after explicit retry', async ({ page }) => {
  await openFixture(page);
  const figure = page.locator('figure').filter({ has: page.getByText('다시 시도할 이미지', { exact: true }) });
  await figure.scrollIntoViewIfNeeded();
  await expect(figure.getByRole('button', { name: '다시 시도' })).toBeVisible();
  await expect(figure.getByRole('status', { name: 'Loading image thumbnail' })).toHaveCount(0);
  await figure.getByRole('button', { name: '다시 시도' }).click();
  await expect(figure.locator('.article-image-trigger')).toHaveAttribute('data-state', 'ready');
});

test('mobile TOC has a single close control and a labelled keyboard scroll viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFixture(page);
  await page.evaluate(() => window.scrollTo(0, 700));
  await expect(page.locator('.fn-reader-mobilebar')).toHaveAttribute('data-scroll-hidden', 'true');
  await page.evaluate(() => window.scrollBy({ top: -80, behavior: 'instant' }));
  const trigger = page.getByTestId('toc-mobile-trigger');
  await expect(trigger).toBeVisible();
  await trigger.click();
  const drawer = page.locator('.ui-toc-drawer');
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('button', { name: '닫기', exact: true })).toHaveCount(1);
  await expect(drawer.locator('[data-radix-scroll-area-viewport]')).toHaveAttribute('tabindex', '0');
  await drawer.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(drawer).not.toBeVisible();
});
