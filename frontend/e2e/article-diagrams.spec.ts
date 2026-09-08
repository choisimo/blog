import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

const migrations: { file: string; title: string }[] = JSON.parse(
  readFileSync(
    new URL(
      '../docs/content-refinement/diagram-migrations.json',
      import.meta.url
    ),
    'utf8'
  )
);
const files = [...new Set(migrations.map(item => item.file))];
const target = '2024/multimodal-recommendation-system-research.md';

test.use({ serviceWorkers: 'block' });
async function openPost(page: Page, file: string, theme = 'light') {
  const baseURL = test.info().project.use.baseURL;
  if (!baseURL) throw new Error('A Playwright baseURL is required');
  const origin = new URL(baseURL).origin;
  await page.addInitScript(value => {
    localStorage.setItem('theme', value);
    localStorage.setItem('site.language', 'ko');
  }, theme);
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin !== origin ||
      url.pathname.startsWith('/api/')
      ? route.abort('blockedbyclient')
      : route.fallback();
  });
  await page.goto(`/blog/${file.replace(/\.md$/, '')}`);
  await expect(page.locator('.article-diagram')).toHaveCount(
    migrations.filter(item => item.file === file).length,
    { timeout: 30000 }
  );
}

for (const file of files) {
  test(`320px content and geometry: ${file}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await openPost(page, file);
    for (const figure of await page.locator('.article-diagram').all()) {
      const box = await figure.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(321);
      expect(
        await figure.evaluate(el => el.scrollWidth <= el.clientWidth)
      ).toBe(true);
      for (const button of await figure.getByRole('button').all()) {
        const bounds = await button.boundingBox();
        expect(bounds!.height).toBeGreaterThanOrEqual(44);
        expect(bounds!.width).toBeGreaterThanOrEqual(44);
      }
      // Borders that clip the container must not conceal overflowing text or children.
      expect(
        await figure.evaluate(el =>
          [...el.querySelectorAll('*')].every(
            child =>
              child.scrollWidth <= child.clientWidth + 1 ||
              child instanceof SVGElement
          )
        )
      ).toBe(true);
    }
  });
}

for (const theme of ['light', 'dark', 'terminal']) {
  for (const width of [320, 768, 1440]) {
    test(`${theme} ${width}px: recommendation flow, keyboard and screenshot`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openPost(page, target, theme);
      await expect(page.locator('.article-flow > h2').first()).toHaveCSS('text-align', 'start');
      const figure = page.getByRole('figure', { name: '추천 엔진 처리 흐름' });
      await expect(figure.locator('h3')).toHaveCSS('text-align', 'left');
      await expect(figure.locator('p').first()).toHaveCSS('text-align', 'left');
      expect(await figure.locator('figcaption').evaluate(el => getComputedStyle(el, '::before').content)).toBe('none');
      expect(await figure.locator('.article-diagram__body li').first().evaluate(el => getComputedStyle(el, '::marker').content)).toBe('none');
      const first = figure.getByRole('button', {
        name: '데이터 수집',
        exact: true,
      });
      await first.focus();
      await page.keyboard.press('Enter');
      await expect(first).toHaveAttribute('aria-pressed', 'true');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await expect(
        figure.getByRole('button', { name: '특징 공학', exact: true })
      ).toHaveAttribute('aria-pressed', 'true');
      await figure
        .getByRole('button', { name: '피드백 루프', exact: true })
        .click();
      await expect(
        figure.getByRole('button', { name: '다음 항목' })
      ).toBeDisabled();
      await expect(figure.locator('[aria-live]')).toContainText('5 / 5');
      await expect(figure).toContainText('반응 재수집 · 데이터 수집');
      await figure
        .getByRole('button', { name: '데이터 수집', exact: true })
        .click();
      await expect(first).toHaveCSS('transition-duration', '0s');
      await figure.screenshot({
        path: `docs/content-refinement/screenshots/recommendation-${theme}-${width}.png`,
      });
    });
  }
}
