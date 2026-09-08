import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const origin = process.env.DESIGN_BASE_URL || 'http://127.0.0.1:4319';
const directory = 'verification-screenshots/fieldnotes-final-polish-20260908';
const source = await readFile('public/posts/2026/organizing-intelligence-era.md', 'utf8');
const sourceUrls = [...source.matchAll(/^\[\d+\].*? (https?:\/\/\S+)$/gm)].map(match => match[1]);
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.DESIGN_CHROMIUM_PATH || '/usr/bin/chromium' });
const results = [];
try {
  for (const theme of ['light', 'dark']) for (const width of [320, 390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    page.setDefaultTimeout(15_000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(value => {
      localStorage.setItem('theme', value);
      localStorage.setItem('site.language', 'ko');
    }, theme);
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      return url.origin === origin && !url.pathname.startsWith('/api/') ? route.continue() : route.abort('blockedbyclient');
    });
    await page.goto(`${origin}/blog/2026/organizing-intelligence-era`);
    const references = page.locator('.article-flow details.article-references');
    await expect(references).toHaveCount(1);
    await expect(references).not.toHaveAttribute('open', '');
    await expect(page.getByText('읽고, 생각하고, 다시 연결하기.', { exact: true })).toHaveCount(0);
    let toc = page.locator('.rd-left .ui-toc-scroll-silent');
    if (width < 850) {
      await page.locator('.fn-reader-mobilebar').getByRole('button', { name: '목차 열기', exact: true }).click();
      toc = page.locator('.ui-toc-drawer .ui-toc-scroll-silent');
    }
    const viewport = toc.locator('[data-radix-scroll-area-viewport]');
    await expect(viewport).toBeVisible();
    await viewport.hover();
    const before = await viewport.evaluate(el => el.scrollTop);
    await page.mouse.wheel(0, 420);
    await expect.poll(() => viewport.evaluate(el => el.scrollTop)).toBeGreaterThan(before);
    await expect.poll(() => toc.locator('.ui-scrollbar:visible').count()).toBe(0);
    expect(await viewport.evaluate(el => getComputedStyle(el).scrollbarWidth)).toBe('none');
    await viewport.focus();
    const beforeKeyboard = await viewport.evaluate(el => el.scrollTop);
    await page.keyboard.press('PageDown');
    await expect.poll(() => viewport.evaluate(el => el.scrollTop)).toBeGreaterThan(beforeKeyboard);
    await page.screenshot({ path: `${directory}/${theme}-${width}-toc.png` });
    if (width < 850) await page.keyboard.press('Escape');

    await references.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${directory}/${theme}-${width}-references-closed.png` });
    const summary = references.locator('summary');
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(references).toHaveAttribute('open', '');
    const actualUrls = await references.locator('a').evaluateAll(links => links.map(link => link.getAttribute('href')));
    expect(actualUrls).toEqual(sourceUrls);
    expect(actualUrls).toHaveLength(43);
    await page.screenshot({ path: `${directory}/${theme}-${width}-references-open.png` });
    await page.keyboard.press('Space');
    await expect(references).not.toHaveAttribute('open', '');
    if (width === 1440) {
      await page.pdf({ path: `${directory}/${theme}-article.pdf`, format: 'A4', printBackground: true });
      await expect(references).not.toHaveAttribute('open', '');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.goto(`${origin}/projects`);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.getByText(/GitHub choisimo의 공개 저장소를/)).toHaveCount(0);
    await page.screenshot({ path: `${directory}/${theme}-${width}-projects.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect(errors).toEqual([]);
    results.push({ theme, width, tocWheelAndKeyboard: true, tocScrollbarHidden: true, referencesInitiallyClosed: true, sourceUrlsPreserved: actualUrls.length, keyboardToggle: true, printRestoresDisclosure: width === 1440, removedCopy: true, errors });
    await page.close();
    console.log(`${theme} ${width}: passed`);
  }
  await writeFile(`${directory}/results.json`, JSON.stringify(results, null, 2));
} finally { await browser.close(); }
