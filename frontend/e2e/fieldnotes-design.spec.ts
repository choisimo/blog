import { test, expect, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block' });
const article = '/blog/2026/knowledge';

async function localSite(page: Page, theme = 'light') {
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
}

for (const [theme, color] of [['light', 'rgb(246, 245, 239)'], ['dark', 'rgb(16, 31, 28)']] as const) {
  test(`${theme}: shared paper palette and complete error-route family`, async ({ page }) => {
    await localSite(page, theme);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ['/400', '/401', '/403', '/404', '/429', '/500', '/503']) {
      await page.goto(path);
      await expect(page.locator('main h1')).toBeVisible();
      await expect(page.locator('body')).toHaveCSS('background-color', color);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      await expect(page.locator('.fn-error-page')).toBeVisible();
    }
  });
}

test('reader follows reference columns and keeps actual content available at all widths', async ({ page }) => {
  await localSite(page);
  for (const width of [1440, 1024, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(article);
    await expect(page.locator('.article-flow p').first()).toBeVisible({ timeout: 30_000 });
    const body = await page.locator('.rd-maincol').boundingBox();
    expect(body!.width).toBeLessThanOrEqual(901);
    expect(body!.x).toBeGreaterThanOrEqual(0);
    expect(body!.x + body!.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (width >= 1200) {
      const rail = await page.locator('.rd-left').boundingBox();
      expect(rail!.x + rail!.width).toBeLessThan(body!.x);
      await expect(page.locator('.rd-right')).toBeVisible();
    } else if (width < 850) {
      await expect(page.locator('.rd-left')).toBeHidden();
      await expect(page.locator('.rd-right')).toBeHidden();
    }
  }
});

test('reading controls persist, reflow the real article and return keyboard focus', async ({ page }) => {
  await localSite(page);
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto(article);
  await expect(page.locator('.article-flow p').first()).toBeVisible({ timeout: 30_000 });
  const trigger = page.locator('header.fn-site-header').getByRole('button', { name: '읽기 환경', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '읽는 방식도, 나답게.' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '명조', exact: true }).click();
  const size = dialog.getByRole('slider', { name: '글자 크기' });
  await size.focus();
  await page.keyboard.press('End');
  const width = dialog.getByRole('slider', { name: '본문 너비' });
  await width.focus();
  await page.keyboard.press('End');
  await dialog.getByRole('button', { name: '따뜻한 종이' }).click();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(241, 233, 217)');
  await page.keyboard.press('Alt+a');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.locator('.article-flow p').first()).toHaveCSS('font-size', '24px');
  await page.reload();
  await expect(page.locator('.article-flow p').first()).toHaveCSS('font-size', '24px', { timeout: 30_000 });
  await page.keyboard.press('Alt+z');
  await expect(page.locator('.rd-left')).toBeHidden();
  await expect(page.locator('.ui-header__navigation')).toBeHidden();
  await expect(page.locator('.fn-edition')).toBeHidden();
  await expect(page.locator('header.fn-site-header').getByRole('button', { name: '읽기 환경', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.rd-left')).toBeVisible();
  await expect(page.locator('.ui-header__navigation')).toBeVisible();
  await page.goto('/blog');
  await page.keyboard.press('Alt+z');
  await expect(page.getByRole('button', { name: '집중 모드 종료', exact: true })).toHaveCount(0);
});

test('320px settings remain reachable through compact preferences', async ({ page }) => {
  await localSite(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/blog');
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await page.getByRole('menuitem', { name: '읽기 환경' }).click();
  const dialog = page.getByRole('dialog', { name: '읽는 방식도, 나답게.' });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '설정', exact: true })).toBeFocused();
});

test('mobile reader keeps extra tools and the real notebook reachable', async ({ page }) => {
  await localSite(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(article);
  await expect(page.locator('.article-flow p').first()).toBeVisible({ timeout: 30_000 });
  const more = page.locator('.fn-reader-mobilebar button[aria-label="더 많은 도구"]');
  await expect(page.getByRole('toolbar', { name: /빠른 작업|Floating actions/ })).toHaveCount(0);
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('menuitem', { name: '방문 기록' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: '인사이트' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(more).toBeFocused();
  await expect(page.getByRole('menu')).toBeHidden();
  const memo = page.locator('ai-memo-pad .panel');
  await expect(memo).toHaveCount(1);
  await page.locator('.fn-reader-mobilebar').getByRole('button', { name: '메모', exact: true }).click();
  await expect(memo).toBeVisible();
  await memo.getByLabel('창 제어').getByRole('button', { name: '닫기', exact: true }).click();
  await expect(memo).toBeHidden();
});

test('header and reading rails stay in view through a long real article', async ({ page }) => {
  await localSite(page);
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/blog/2026/c-lang-2');
    await expect(page.locator('.article-code-card').first()).toBeVisible({timeout:30_000});
    for (const y of [1800, 7000]) {
      await page.evaluate(top => window.scrollTo({top,behavior:'instant'}), y);
      await expect.poll(async () => (await page.locator('header.fn-site-header').boundingBox())!.y).toBe(0);
      for (const selector of width >= 1200 ? ['.rd-left','.rd-right'] : width >= 851 ? ['.rd-left'] : []) {
        const box = await page.locator(selector).boundingBox();
        expect(box!.y).toBeGreaterThanOrEqual(76);
        expect(box!.y).toBeLessThan(150);
        expect(box!.y + box!.height).toBeLessThanOrEqual(1000);
      }
    }
  }
});

for (const theme of ['light', 'dark']) {
  test(`${theme}: reader notebook fits its side desk or bottom sheet and retains the draft`, async ({ page }) => {
    await localSite(page, theme);
    for (const width of [390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(article);
      await expect(page.locator('.article-flow p').first()).toBeVisible({ timeout: 30_000 });
      const opener = width >= 1200
        ? page.locator('.rd-right').getByRole('button', { name: '메모 열기' })
        : page.locator('.fn-reader-mobilebar').getByRole('button', { name: '메모', exact: true });
      await expect(page.getByRole('toolbar', { name: /빠른 작업|Floating actions/ })).toHaveCount(0);
      await opener.click();
      const memo = page.locator('ai-memo-pad .panel');
      await expect(memo).toBeVisible();
      await expect(memo).toHaveCSS('background-color', theme === 'dark' ? 'rgb(20, 39, 34)' : 'rgb(252, 251, 247)');
      await memo.evaluate(async element => {
        await Promise.all(element.getAnimations().map(animation => animation.finished));
      });
      await expect.poll(async () => Math.round((await memo.boundingBox())!.height)).toBe(width > 850 ? 976 : 940);
      await expect.poll(async () => Math.abs((await memo.boundingBox())!.y - (width > 850 ? 12 : 60))).toBeLessThan(1);
      const box = (await memo.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      if (width > 850) {
        await expect(memo).toHaveAttribute('data-window-mode', 'docked');
        expect(box.width).toBe(420);
        expect(box.y).toBe(12);
      } else {
        expect(Math.abs(box.y - 60)).toBeLessThan(1);
      }
      const editor = memo.locator('textarea.memo-input');
      const draft = `검토 메모 ${theme} ${width}\n본문을 읽으며 남긴 생각`;
      await editor.fill(draft);
      await expect(editor).toHaveCSS('background-color', theme === 'dark' ? 'rgb(20, 39, 34)' : 'rgb(252, 251, 247)');
      const close = memo.getByLabel('창 제어').getByRole('button', { name: '닫기', exact: true });
      await close.click();
      await expect(memo).toBeHidden();
      await expect(page.getByRole('toolbar', { name: /빠른 작업|Floating actions/ })).toHaveCount(0);
      await opener.click();
      await expect(editor).toHaveValue(draft);
      if (width > 850) {
        const fullscreen = memo.getByRole('button', { name: '전체 화면', exact: true });
        await fullscreen.click();
        await expect(memo).toHaveAttribute('data-window-mode', 'fullscreen');
        await expect(editor).toHaveValue(draft);
      }
      await close.click();
      await expect(memo).toBeHidden();
    }
  });
}

test('real code, table and mobile TOC use the refined reader surfaces', async ({ page }) => {
  await localSite(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/blog/2026/c-lang-2');
  const code=page.locator('.article-code-card').first();
  await expect(code).toBeVisible({timeout:30_000});
  await expect(code).toHaveCSS('background-color','rgb(21, 39, 31)');
  await expect(code.locator('.article-code-toolbar')).toHaveCSS('background-color','rgb(29, 49, 39)');
  await expect(code.locator('.article-code-highlighter')).toHaveCSS('background-color','rgb(21, 39, 31)');
  const table=page.locator('.article-table-scroll').first();
  await table.scrollIntoViewIfNeeded();
  expect(await table.evaluate(e=>e.scrollWidth>e.clientWidth)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const trigger=page.locator('.fn-reader-toc-trigger');
  await expect(trigger).toHaveText('목차');
  await trigger.click();
  const drawer=page.locator('.ui-toc-drawer');
  await expect(drawer).toBeVisible();
  await expect.poll(async () => {
    const bounds = await drawer.boundingBox();
    return Math.abs(bounds!.y + bounds!.height - 844);
  }).toBeLessThan(2);
  const box=await drawer.boundingBox();
  expect(box!.y).toBeGreaterThan(80);
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});

test('TOC follows large section jumps and opens at the current mobile section', async ({ page }) => {
  await localSite(page);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/blog/2026/c-lang-2');
    await expect(page.locator('.article-code-card').first()).toBeVisible();
    const last = page.locator('.article-flow h2').last();
    const title = (await last.innerText()).replace(/\s+/g, ' ').trim();
    await last.evaluate(element => window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - 110, behavior: 'instant' }));
    if (width < 850) await page.locator('.fn-reader-toc-trigger').click();
    const toc = page.locator(width < 850 ? '.ui-toc-drawer' : '.rd-left');
    const active = toc.locator('.ui-toc-item[aria-current="location"]');
    await expect(active).toHaveAttribute('title', title);
    await expect.poll(async () => {
      const item = (await active.boundingBox())!;
      const viewport = (await toc.locator('[data-radix-scroll-area-viewport]').boundingBox())!;
      return item.y >= viewport.y - 1 && item.y + item.height <= viewport.y + viewport.height + 1;
    }).toBe(true);
    if (width < 850) await page.keyboard.press('Escape');
    else {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await expect(toc.locator('.ui-toc-item').first()).toHaveAttribute('aria-current', 'location');
    }
  }
});
