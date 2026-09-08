import { test, expect, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

async function localPreview(page: Page, theme = 'light') {
  await page.addInitScript(value => {
    localStorage.setItem('theme', value);
    localStorage.setItem('site.language', 'ko');
  }, theme);
  // Exercise local UI and static content without writing to connected services.
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    const origin = new URL(
      test.info().project.use.baseURL || 'http://127.0.0.1:8080'
    ).origin;
    return url.origin !== origin || url.pathname.startsWith('/api/')
      ? route.abort('blockedbyclient')
      : route.fallback();
  });
}

for (const theme of ['light', 'dark', 'terminal']) {
  for (const width of [320, 768, 1440]) {
    test(`${theme} / ${width}px: public routes, closed memo and navigation targets`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width, height: 900 });
      await localPreview(page, theme);
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      for (const path of [
        '/',
        '/blog',
        '/projects',
        '/about',
        '/debate',
        '/404',
        '/insight',
      ]) {
        await page.goto(path);
        await expect(page.locator('main h1')).toBeVisible({ timeout: 30_000 });
        // Both root geometry and interactive boxes matter: overflow clipping can hide a broken row.
        const main = await page.locator('main').boundingBox();
        expect(main!.x).toBeGreaterThanOrEqual(0);
        expect(main!.x + main!.width).toBeLessThanOrEqual(width + 1);
        const memo = page.locator('ai-memo-pad .panel');
        if (await memo.count()) await expect(memo).toBeHidden();
        for (const target of await page
          .locator('.ui-header a, .ui-header button, .ui-footer a')
          .all()) {
          if (!(await target.isVisible())) continue;
          const box = await target.boundingBox();
          expect(box!.width, await target.textContent()).toBeGreaterThanOrEqual(
            43.5
          );
          expect(
            box!.height,
            await target.textContent()
          ).toBeGreaterThanOrEqual(43.5);
          expect(box!.x).toBeGreaterThanOrEqual(0);
          expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
        }
      }
      expect(errors).toEqual([]);
    });
  }
}

for (const theme of ['light', 'terminal']) {
  test(`${theme}: project search reset restores focus and preserves list selection`, async ({
    page,
  }) => {
    await localPreview(page, theme);
    await page.route('**/projects-manifest.json*', route =>
      route.fulfill({
        json: {
          total: 1,
          items: [{
            id: 'design-fixture',
            title: 'Design fixture',
            description: 'A local project for search and view-state verification.',
            url: 'https://example.com/design-fixture',
            date: '2026-09-08',
            category: 'Web',
          }],
        },
      })
    );
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto('/projects');
    await expect(page.locator('#project-results-summary')).toHaveText(/^1개/);
    const search = page.getByRole('searchbox', { name: '프로젝트 검색' });
    await search.fill('no-project-matches-this-query');
    await expect(page.locator('#project-results-summary')).toHaveText(/^0개/);
    await page
      .getByRole('button', { name: '검색어 지우기', exact: true })
      .click();
    await expect(search).toBeFocused();
    await expect(search).toHaveValue('');
    const list = page.getByRole('button', { name: '목록', exact: true });
    await list.click();
    await expect(list).toHaveAttribute('aria-pressed', 'true');
    await search.fill('no-project-matches-this-query');
    await page
      .getByRole('button', { name: '검색·필터 초기화', exact: true })
      .click();
    await expect(search).toBeFocused();
    await expect(list).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.ui-project-directory')).toBeVisible();
  });
}

test('320px pagination keeps every visible navigation control inside the page', async ({
  page,
}) => {
  await localPreview(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/blog');
  const pagination = page.getByRole('navigation', { name: 'Pagination' });
  await expect(pagination).toBeVisible({ timeout: 30_000 });
  for (const button of await pagination.getByRole('button').all()) {
    if (!(await button.isVisible())) continue;
    const box = await button.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  }
});

test('mobile stack selection reveals and focuses its inspector', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await localPreview(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('.ui-pick').first().click();
  await expect(page.locator('.ui-article-title')).toBeVisible({
    timeout: 30_000,
  });
  await page.goto('/insight');
  await page.locator('.ui-insight-stack-disclosure > summary').click();
  const item = page.locator('.ui-insight-stack-select').first();
  await expect(item).toBeVisible({ timeout: 30_000 });
  await item.click();
  await expect(page.locator('#insight-inspector-pane')).toBeVisible();
  await expect(page.locator('#insight-inspector-pane')).toBeFocused();
});

test('mobile memo opens on request, closes fully, and stays closed across routes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await localPreview(page);
  await page.goto('/');
  const memo = page.locator('ai-memo-pad .panel');
  await expect(memo).toBeHidden();
  const opener = page.getByRole('button', { name: '메모', exact: true });
  await opener.click();
  await expect(memo).toBeVisible();
  await memo.locator('button.close').click();
  await expect(memo).toBeHidden();
  await expect(opener).toBeFocused();
  await page.goto('/about');
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.locator('ai-memo-pad .panel')).toBeHidden();
});

test('mobile menu and preferences preserve keyboard focus and report selection', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await localPreview(page);
  await page.goto('/about');
  const menu = page.getByRole('button', { name: 'Toggle main menu' });
  await menu.click();
  await expect(page.getByRole('dialog', { name: '메뉴' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await page.getByRole('button', { name: '설정', exact: true }).click();
  const dark = page.getByRole('menuitemradio', { name: 'Dark', exact: true });
  await page.getByRole('menu').evaluate(async element => {
    await Promise.all(
      element.getAnimations().map(animation => animation.finished)
    );
  });
  expect((await dark.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await dark.click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await expect(
    page.getByRole('menuitemradio', { name: /Dark/ })
  ).toHaveAttribute('aria-checked', 'true');
});

test('composing a topic preserves spaces, paragraph breaks and a readable mobile field', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await localPreview(page);
  await page.goto('/debate');
  const title = page.getByLabel('주제', { exact: true });
  const context = page.getByLabel('맥락', { exact: true });
  await title.pressSequentially('two ideas ');
  await expect(title).toHaveValue('two ideas ');
  await context.fill('첫 문단');
  await context.press('End');
  await context.press('Enter');
  await context.press('Enter');
  await expect(context).toHaveValue('첫 문단\n\n');
  expect((await context.boundingBox())!.height).toBeGreaterThanOrEqual(200);
  await expect(page.locator('.ui-field-count')).toHaveCSS(
    'white-space',
    'nowrap'
  );
});

test('failed subscription keeps the address and offers a readable retry state', async ({
  page,
}) => {
  await localPreview(page);
  await page.goto('/about');
  const email = page.locator('#footer-subscribe-email');
  await email.fill('reader@example.com');
  await page.getByRole('button', { name: '구독하기', exact: true }).click();
  await expect(page.locator('#footer-subscribe-status')).toHaveText(
    /연결을 확인하고 다시 시도/
  );
  await expect(email).toHaveValue('reader@example.com');
  await email.fill('new-reader@example.com');
  await expect(page.locator('#footer-subscribe-status')).toBeEmpty();
  await expect(
    page.getByRole('button', { name: '구독하기', exact: true })
  ).toBeEnabled();
});

test('reduced motion disables memo entry animation and leaves it dismissible', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await localPreview(page);
  await page.goto('/');
  await page.getByRole('button', { name: '메모', exact: true }).click();
  const memo = page.locator('ai-memo-pad .panel');
  await expect(memo).toBeVisible();
  await expect(memo).toHaveCSS('animation-name', 'none');
  await memo.locator('button.close').click();
  await expect(memo).toBeHidden();
});

test('terminal shortcuts open one tool at a time', async ({ page }) => {
  await localPreview(page, 'terminal');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(
    page.getByRole('toolbar', { name: /빠른 작업|Floating actions/ })
  ).toBeVisible({ timeout: 30_000 });
  const opener = page.locator('.ui-wordmark');
  await opener.focus();
  const memo = page.locator('ai-memo-pad .panel');
  await page.keyboard.press('Alt+m');
  await expect(memo).toBeVisible();
  await page.keyboard.press('Alt+m');
  await expect(memo).toBeHidden();
  await page.keyboard.press('Control+Alt+m');
  const chat = page.getByRole('dialog', { name: 'AI Chat', exact: true });
  await expect(chat).toBeVisible();
  await expect(memo).toBeHidden();
  const close = chat.getByRole('button', { name: '창 닫기', exact: true });
  await expect(close).toBeVisible();
  await close.click();
  await expect(chat).toBeHidden();
  await expect(memo).toBeHidden();
});

for (const theme of ['light', 'dark', 'terminal']) {
  test(`${theme}: primary action text retains contrast on hover`, async ({
    page,
  }) => {
    await localPreview(page, theme);
    await page.goto('/about');
    const actions = page.locator('.ui-control[data-ui-variant="default"]');
    await expect(actions.first()).toBeVisible({ timeout: 30_000 });
    // The same primary variant can render as a button or a navigation link.
    for (const action of await actions.all()) {
      const contrast = () =>
        action.evaluate(element => {
          const luminance = (color: string) => {
            const values = color
              .match(/[\d.]+/g)!
              .slice(0, 3)
              .map(Number)
              .map(value => {
                const channel = value / 255;
                return channel <= 0.04045
                  ? channel / 12.92
                  : ((channel + 0.055) / 1.055) ** 2.4;
              });
            return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
          };
          const style = getComputedStyle(element);
          const a = luminance(style.color),
            b = luminance(style.backgroundColor);
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        });
      expect(await contrast()).toBeGreaterThanOrEqual(4.5);
      await action.hover();
      expect(await contrast()).toBeGreaterThanOrEqual(4.5);
    }
  });
}
