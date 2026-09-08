import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const origin = process.env.DESIGN_BASE_URL || 'http://127.0.0.1:4319';
const directory = 'verification-screenshots/fieldnotes-reader-review-20260908/reading-tools';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true });
const results = [];
try {
  for (const theme of ['light', 'dark']) for (const width of [320, 390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
    const errors = [];
    let commentRequests = 0;
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(value => {
      localStorage.setItem('theme', value);
      localStorage.setItem('site.language', 'ko');
    }, theme);
    // Exercise actual bundled articles and actual unavailable API states. No substituted responses.
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/api/v1/comments') && route.request().method() === 'POST') commentRequests += 1;
      return url.origin === origin && !url.pathname.startsWith('/api/') ? route.continue() : route.abort('blockedbyclient');
    });
    const shot = async name => page.screenshot({ path: `${directory}/${theme}-${width}-${name}.png`, animations: 'disabled' });
    await page.goto(`${origin}/blog/2026/c-lang-2`);
    await expect(page.locator('.article-code-card').first()).toBeVisible();
    await expect(page.getByRole('button', { name: '핵심 요약', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: '글 북마크', exact: true }).click();
    await expect(page.getByRole('button', { name: '북마크 해제', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(page.getByRole('button', { name: '북마크 해제', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: '북마크 해제', exact: true }).click();
    await expect(page.getByRole('button', { name: '글 북마크', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await page.locator('.rd-toolbar').scrollIntoViewIfNeeded();
    await shot('toolbar');
    for (const bounds of await page.locator('.rd-tools-right > button').evaluateAll(elements => elements.map(element => {
      const { width, height } = element.getBoundingClientRect(); return { width, height };
    }))) { expect(bounds.width).toBeGreaterThanOrEqual(44); expect(bounds.height).toBeGreaterThanOrEqual(44); }

    const findTrigger = page.getByRole('button', { name: '본문 검색', exact: true });
    await findTrigger.click();
    const query = page.getByRole('searchbox', { name: '본문 검색어' });
    await query.fill('포인터');
    await expect(page.getByRole('status', { name: '검색 결과' })).toHaveText(/^1\/\d+$/);
    await query.press('Enter');
    await expect(page.getByRole('status', { name: '검색 결과' })).toHaveText(/^2\/\d+$/);
    await query.press('Shift+Enter');
    await expect(page.getByRole('status', { name: '검색 결과' })).toHaveText(/^1\/\d+$/);
    await page.getByRole('button', { name: '다음 검색 결과' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status', { name: '검색 결과' })).toHaveText(/^2\/\d+$/);
    await shot('find');
    const scroll = await page.evaluate(() => window.scrollY);
    await page.getByRole('button', { name: '본문 검색 닫기' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.rd-findbar')).toBeHidden();
    await expect(findTrigger).toBeFocused();
    expect(Math.abs(await page.evaluate(() => window.scrollY) - scroll)).toBeLessThan(2);
    expect(await page.evaluate(() => CSS.highlights.has('fieldnotes-search'))).toBe(false);

    await page.locator('#article-discussion button').first().click();
    const openedAt = Date.now();
    const dialog = page.locator('.ui-comment-dialog');
    const author = dialog.getByRole('textbox', { name: /^이름/ });
    const editor = dialog.getByRole('textbox', { name: /^댓글/ });
    await author.fill('읽기 검토');
    await editor.fill('지능을 조직하고 검증하기');
    await editor.selectText();
    await dialog.getByRole('button', { name: '굵게', exact: true }).click();
    await expect(editor).toHaveValue('**지능을 조직하고 검증하기**');
    await dialog.getByRole('button', { name: '댓글 미리보기', exact: true }).click();
    await expect(dialog.locator('textarea')).toBeHidden();
    await expect(dialog.locator('.fn-comment-preview strong')).toHaveText('지능을 조직하고 검증하기');
    await shot('comment-preview');
    await page.keyboard.press('Escape');
    await expect(dialog.getByRole('group', { name: '작성 내용 폐기 확인' })).toBeVisible();
    await dialog.getByRole('button', { name: '계속 작성', exact: true }).click();
    await expect(editor).toBeVisible();
    await expect(editor).toBeFocused();
    await expect(editor).toHaveValue('**지능을 조직하고 검증하기**');
    await editor.fill('시작 인용 끝');
    await editor.evaluate(element => element.setSelectionRange(3, 5));
    await dialog.getByRole('button', { name: '인용', exact: true }).click();
    await dialog.getByRole('button', { name: '댓글 미리보기', exact: true }).click();
    await expect(dialog.locator('.fn-comment-preview blockquote')).toHaveText('인용');
    await expect(dialog.locator('.fn-comment-preview > div > p').last()).toHaveText('끝');
    await dialog.getByRole('button', { name: '댓글 편집', exact: true }).click();
    await editor.fill('**지능을 조직하고 검증하기**');
    // Requests are aborted, so a real failed submission must retain the draft.
    // Preserve the real three-second anti-abuse gate instead of changing its clock.
    await page.waitForTimeout(Math.max(0, 3100 - (Date.now() - openedAt)));
    await dialog.getByRole('button', { name: '댓글 게시', exact: true }).click();
    await expect(dialog.getByRole('alert')).toBeVisible({ timeout: 15000 });
    expect(commentRequests).toBe(1);
    await expect(editor).toHaveValue('**지능을 조직하고 검증하기**');
    await expect(author).toHaveValue('읽기 검토');
    await shot('comment-error');
    if (width < 600) {
      await page.setViewportSize({ width, height: 500 });
      await expect(dialog.getByRole('button', { name: '댓글 게시', exact: true })).toBeInViewport();
      await shot('comment-short-viewport');
      await page.setViewportSize({ width, height: 900 });
    }
    // Open UI must not obscure the printed article, even when the draft is dirty.
    await page.emulateMedia({ media: 'print' });
    await expect(dialog).toBeHidden();
    await expect(page.locator('.fn-post-page')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(page.locator('.article-flow p').first()).toHaveCSS('color', 'rgb(18, 18, 18)');
    const fixedOverlays = await page.locator('body > div').evaluateAll(elements => elements.filter(element => {
      const style = getComputedStyle(element);
      return style.position === 'fixed' && style.display !== 'none' && element.getBoundingClientRect().height > 0;
    }).map(element => element.className));
    expect(fixedOverlays).toEqual([]);
    await expect(page.locator('.rd-related')).toBeHidden();
    for (const code of await page.locator('.article-code-highlighter').evaluateAll(elements => elements.map(element => ({
      maxHeight: getComputedStyle(element).maxHeight, overflow: getComputedStyle(element).overflow,
    })))) { expect(code.maxHeight).toBe('none'); expect(code.overflow).toBe('visible'); }
    if (width === 1440) await page.pdf({ path: `${directory}/${theme}-article.pdf`, format: 'A4', printBackground: true, margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' } });
    await page.emulateMedia({ media: 'screen' });
    await page.keyboard.press('Escape');
    await dialog.getByRole('button', { name: '버리고 닫기', exact: true }).click();
    await expect(dialog).toBeHidden();
    await page.goto(`${origin}/blog/2026/teleport`);
    await expect(page.locator('.article-code-card button[aria-expanded="false"]').first()).toBeAttached();
    for (const image of await page.locator('.article-image').all()) await expect(image).toHaveAttribute('src', /\S+/);
    await page.getByRole('button', { name: '본문 검색', exact: true }).click();
    await page.getByRole('searchbox', { name: '본문 검색어' }).fill('fork()');
    const count = page.getByRole('status', { name: '검색 결과' });
    await expect(count).toHaveText(/^1\/\d+$/);
    const total = Number((await count.innerText()).split('/')[1]);
    expect(total).toBeGreaterThan(1);
    for (let index = 2; index <= total; index += 1) {
      await page.getByRole('button', { name: '다음 검색 결과' }).click();
      await expect(count).toHaveText(`${index}/${total}`);
      // Allow the actual code-expansion DOM update to settle before asserting selection stability.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await expect(count).toHaveText(`${index}/${total}`);
      if (await page.evaluate(() => [...CSS.highlights.get('fieldnotes-search-current')][0]?.startContainer.parentElement.closest('.article-code-card') !== null)) await shot('find-long-code');
    }
    await expect(page.locator('.article-code-card button[aria-expanded="true"]').first()).toBeAttached();
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(page.locator('.article-code-card button[aria-expanded="false"]').first()).toBeAttached();
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.article-image-loading:visible')).toHaveCount(0);
    const clipped = await page.locator('.article-code-card > .relative').evaluateAll(elements => elements.filter(element => getComputedStyle(element).maxHeight !== 'none').length);
    expect(clipped).toBe(0);
    if (width === 1440) await page.pdf({ path: `${directory}/${theme}-long-code.pdf`, format: 'A4', printBackground: true, margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' } });
    await page.emulateMedia({ media: 'screen' });
    for (const [name, key, size] of [['largest', 'End', '24px'], ['smallest', 'Home', '16px']]) {
      await page.keyboard.press('Alt+a');
      const settings = page.locator('.fn-reading-settings');
      await expect(settings).toBeVisible();
      for (const label of ['글자 크기', '줄 간격', '본문 너비']) {
        await settings.getByRole('slider', { name: new RegExp(label) }).focus();
        await page.keyboard.press(key);
      }
      await settings.getByRole('button', { name: '명조', exact: true }).click();
      if (theme === 'light') await settings.getByRole('button', { name: '따뜻한 종이', exact: true }).click();
      await page.keyboard.press('Escape');
      await page.reload();
      await expect(page.locator('.article-flow')).toHaveCSS('font-size', size);
      await page.locator('.article-flow p').first().scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await shot(`settings-${name}`);
    }
    if (theme === 'light' && width === 1440) {
      await page.goto(`${origin}/blog/2026/organizing-intelligence-era`);
      await page.locator('.article-image').first().scrollIntoViewIfNeeded();
      await expect(page.locator('.article-image-trigger').first()).toHaveAttribute('data-state', 'ready');
      await page.emulateMedia({ media: 'print' });
      await expect(page.locator('.article-image').first()).toBeVisible();
      await page.pdf({ path: `${directory}/generated-cover-print.pdf`, format: 'A4', printBackground: true, pageRanges: '1-2', margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' } });
      await page.emulateMedia({ media: 'screen' });
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect(errors).toEqual([]);
    results.push({ theme, width, bookmarkPersistence: true, searchKeyboardAndScroll: true, commentDraftRetained: true, printOverlaysHidden: true, errors });
    console.log(`${theme} ${width}: passed`);
    await page.close();
  }
  await writeFile(`${directory}/results.json`, JSON.stringify(results, null, 2));
} finally { await browser.close(); }
