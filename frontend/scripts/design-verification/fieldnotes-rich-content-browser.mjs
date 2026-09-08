import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const origin = process.env.DESIGN_BASE_URL || 'http://127.0.0.1:4319';
const directory = 'verification-screenshots/fieldnotes-reader-review-20260908/rich-content';
await mkdir(directory, { recursive: true });
const source = await readFile('public/posts/2026/teleport-config.md', 'utf8');
const diagrams = [...source.matchAll(/```diagram\s*\n([\s\S]*?)```/g)].map(match => JSON.parse(match[1]));
const normalize = value => value.normalize('NFC').replace(/\s/g, '');
const browser = await chromium.launch({ executablePath: process.env.DESIGN_CHROMIUM_PATH || '/usr/bin/chromium' });
const results = [];
try {
  for (const theme of ['light', 'dark']) for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(value => {
      localStorage.setItem('theme', value);
      localStorage.setItem('site.language', 'ko');
    }, theme);
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      // These are the actual authored simulators' styling dependencies, not substitutes.
      const dependency = ['cdn.tailwindcss.com', 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname);
      return dependency || (url.origin === origin && !url.pathname.startsWith('/api/')) ? route.continue() : route.abort('blockedbyclient');
    });
    const shot = async (name, element) => {
      await element.evaluate(element => window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - 100, behavior: 'instant' }));
      await page.screenshot({ path: `${directory}/${theme}-${width}-${name}.png`, animations: 'disabled' });
    };
    await page.goto(`${origin}/blog/2026/teleport-config`);
    const figures = page.locator('.article-diagram');
    await expect(figures).toHaveCount(diagrams.length);
    const figure = figures.first();
    await expect(figure).toHaveCSS('border-radius', '6px');
    await figure.getByRole('button', { name: '다음 항목' }).click();
    await expect(figure.locator('.article-diagram__position')).toHaveText(`2 / ${diagrams[0].nodes.length}`);
    await shot('diagram', figure);
    let printedLabels = 0;
    if (width === 1440) {
      const path = `${directory}/${theme}-diagrams.pdf`;
      await page.pdf({ path, format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } });
      const text = normalize(execFileSync('pdftotext', ['-layout', path, '-'], { encoding: 'utf8' }));
      for (const label of diagrams.flatMap(diagram => [diagram.title, ...diagram.nodes.map(node => node.label)])) {
        expect(text).toContain(normalize(label));
        printedLabels += 1;
      }
    }
    await page.goto(`${origin}/blog/2026/teleport`);
    const embeds = page.locator('.article-embed');
    await expect(embeds).toHaveCount(3);
    const sources = [];
    for (const embed of await embeds.all()) {
      const iframe = embed.locator('iframe');
      const src = await iframe.getAttribute('src');
      const title = await iframe.getAttribute('title');
      sources.push({ src, title });
      const link = embed.getByRole('link', { name: '새 탭에서 열기' });
      await expect(link).toHaveAttribute('href', src);
      await expect(link).toHaveAttribute('target', '_blank');
      await link.focus();
      await expect(link).toBeFocused();
      expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(44);
      await expect(iframe).toHaveCSS('border-radius', '0px 0px 6px 6px');
    }
    const first = embeds.first();
    await first.scrollIntoViewIfNeeded();
    const frame = first.frameLocator('iframe');
    // A loaded Tailwind utility proves the CDN has resolved; a blocked stylesheet is not visual evidence.
    await expect(frame.locator('#dp-cpu svg')).toHaveCSS('width', '48px', { timeout: 20000 });
    await frame.locator('#dp-virtual-pages').selectOption('4');
    await expect(frame.locator('#dp-page-btns button')).toHaveCount(4);
    await frame.getByRole('button', { name: 'Reset', exact: true }).click();
    await shot('iframe', first);
    const chart = embeds.nth(1).frameLocator('iframe');
    await chart.locator('#ref-input').fill('1, 2, 1');
    const history = embeds.nth(2).frameLocator('iframe');
    await expect(history.locator('#btn-start')).toBeEnabled({ timeout: 15000 });
    await history.locator('#ref-input').fill('1, 2, 1');
    await history.locator('#btn-start').click();
    await expect(history.locator('#fifo-status')).toHaveText('completed');
    await expect(history.locator('#fifo-faults')).toHaveText('2');
    await expect(history.locator('#fifo-hits')).toHaveText('1');
    // Toggle the real theme control without navigating/reloading the embedded documents.
    await first.getByRole('link', { name: '새 탭에서 열기' }).focus();
    await page.keyboard.press('Alt+a');
    const settings = page.getByRole('dialog');
    await settings.getByRole('button', { name: theme === 'dark' ? '밝은 종이' : '밤의 종이', exact: true }).click();
    await page.keyboard.press('Escape');
    for (const embed of await embeds.all()) {
      await expect(embed.frameLocator('iframe').locator('html')).toHaveAttribute('data-theme', theme === 'dark' ? 'light' : 'dark');
    }
    await expect(frame.locator('#dp-virtual-pages')).toHaveValue('4');
    await expect(chart.locator('#ref-input')).toHaveValue('1, 2, 1');
    await expect(history.locator('#fifo-faults')).toHaveText('2');
    await expect(history.locator('#fifo-history .col')).toHaveCount(3);
    await first.getByRole('link', { name: '새 탭에서 열기' }).focus();
    await page.keyboard.press('Alt+a');
    await page.getByRole('dialog').getByRole('button', { name: theme === 'dark' ? '밤의 종이' : '밝은 종이', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByText(`Switched to ${theme} mode`, { exact: true })).toBeHidden({ timeout: 10000 });
    for (const [index, name] of ['paging', 'chart', 'history'].entries()) {
      const embed = embeds.nth(index);
      await expect(embed.frameLocator('iframe').locator('body')).toHaveCSS('background-color', theme === 'dark' ? 'rgb(20, 39, 34)' : 'rgb(252, 251, 247)');
      const bodyHeight = await embed.frameLocator('iframe').locator('body').evaluate(body => Math.ceil(body.getBoundingClientRect().height));
      await expect.poll(async () => (await embed.locator('iframe').boundingBox()).height).toBeGreaterThanOrEqual(Math.min(bodyHeight, 6000));
      await shot(name, embed);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.emulateMedia({ media: 'print' });
    for (const embed of await embeds.all()) {
      await expect(embed.locator('iframe')).toBeHidden();
      await expect(embed.getByText('온라인에서 보기', { exact: true })).toBeVisible();
      expect((await embed.boundingBox()).height).toBeLessThan(180);
    }
    if (width === 1440) {
      const path = `${directory}/${theme}-embeds.pdf`;
      await page.pdf({ path, format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } });
      const text = execFileSync('pdftotext', ['-layout', path, '-'], { encoding: 'utf8' });
      for (const { src, title } of sources) {
        expect(normalize(text)).toContain(normalize(src));
        expect(normalize(text)).toContain(normalize(title));
      }
      const pageNumber = text.split('\f').findIndex(page => page.includes('Demand Paging Animation')) + 1;
      expect(pageNumber).toBeGreaterThan(0);
      execFileSync('pdftoppm', ['-f', String(pageNumber), '-singlefile', '-scale-to', '1200', '-png', path, `${directory}/${theme}-embed-print`]);
    }
    expect(errors).toEqual([]);
    results.push({ theme, width, diagrams: diagrams.length, printedLabels, embeds: sources, printFramesHidden: true, simulatorControlsWorking: true, themePreservesInputsAndResults: true, errors });
    await page.close();
    console.log(`${theme} ${width}: diagrams and embeds passed`);
  }
  await writeFile(`${directory}/results.json`, JSON.stringify(results, null, 2));
} finally { await browser.close(); }
