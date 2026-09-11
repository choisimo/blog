import { test, expect, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

async function openReader(page: Page, theme: string) {
  await page.addInitScript(value => {
    localStorage.setItem('theme', value);
    localStorage.setItem('site.language', 'ko');
  }, theme);
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    const origin = new URL(test.info().project.use.baseURL!).origin;
    return url.origin !== origin || url.pathname.startsWith('/api/')
      ? route.abort('blockedbyclient') : route.continue();
  });
  await page.goto('/blog/2026/knowledge');
  await expect(page.locator('.article-flow p').first()).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => window.scrollTo({ top: 1600, behavior: 'instant' }));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(1600);
}

async function expectReadingPosition(page: Page) {
  await expect.poll(async () => (await page.locator('header.fn-site-header').boundingBox())!.y).toBe(0);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(1600);
}

for (const [width, theme] of [[320, 'light'], [390, 'dark'], [390, 'terminal'], [1024, 'light']] as const) {
  test(`${width}px ${theme}: settings stay anchored while reading and return to the same position`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await openReader(page, theme);
    const trigger = page.getByRole('button', { name: '설정', exact: true });
    await trigger.click();
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expectReadingPosition(page);
    await expect(menu).toBeInViewport({ ratio: 1 });
    await menu.evaluate(async element => {
      await Promise.all(element.getAnimations().map(animation => animation.finished));
    });
    await page.screenshot({ path: `verification-screenshots/header-settings-menu-${theme}-${width}.png` });
    await page.mouse.move(5, 700);
    await page.mouse.wheel(0, 600);
    await expectReadingPosition(page);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
    await expectReadingPosition(page);

    await trigger.press('Enter');
    await page.getByRole('menuitemradio', { name: /^Dark/ }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(trigger).toBeFocused();
    await expectReadingPosition(page);
    // The existing mobile theme toast covers the header until dismissed.
    await page.getByRole('button', { name: 'Close notification' }).click();
    await expect(page.getByRole('button', { name: 'Close notification' })).toBeHidden();

    await trigger.click();
    await page.getByRole('menuitem', { name: '읽기 환경', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '읽는 방식도, 나답게.' });
    await expect(dialog).toBeVisible();
    await expectReadingPosition(page);
    await expect(dialog).toBeInViewport({ ratio: 1 });
    await dialog.getByRole('button', { name: '따뜻한 종이' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-reading-paper', 'warm');
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
    await page.screenshot({ path: `verification-screenshots/header-settings-${theme}-${width}.png` });
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(page.locator('body')).not.toHaveAttribute('data-scroll-locked');
    await expectReadingPosition(page);
    await page.mouse.move(width / 2, 500);
    await page.mouse.wheel(0, 400);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1600);
  });
}

for (const theme of ['light', 'dark', 'terminal']) {
  test(`1440px ${theme}: reading dialog preserves header, scroll and focus`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openReader(page, theme);
    const trigger = page.locator('header').getByRole('button', { name: '읽기 환경', exact: true });
    // Pointer activation must record the trigger even on browsers that do not focus buttons on click.
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: '읽는 방식도, 나답게.' });
    await expect(dialog).toBeVisible();
    await expectReadingPosition(page);
    await page.mouse.move(5, 800);
    await page.mouse.wheel(0, 500);
    await expectReadingPosition(page);
    await dialog.getByRole('button', { name: '닫기', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await expectReadingPosition(page);
    await page.keyboard.press('Alt+a');
    await expect(dialog).toBeVisible();
    await expectReadingPosition(page);
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    await expectReadingPosition(page);
  });
}
