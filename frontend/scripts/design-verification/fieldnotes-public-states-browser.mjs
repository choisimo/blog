import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const origin = process.env.DESIGN_BASE_URL || 'http://127.0.0.1:4319';
const directory = 'verification-screenshots/fieldnotes-public-review-20260908';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
const results = [];
try {
  for (const theme of ['light', 'dark']) for (const width of [320, 390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const errors = [];
    let chatRequests = 0;
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(value => { localStorage.setItem('theme', value); localStorage.setItem('site.language', 'ko'); }, theme);
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/api/') && route.request().method() === 'POST') chatRequests += 1;
      return url.origin === origin && !url.pathname.startsWith('/api/') ? route.continue() : route.abort('blockedbyclient');
    });
    const shot = name => page.screenshot({ path: `${directory}/${theme}-${width}-${name}.png`, animations: 'disabled' });
    const fit = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.goto(`${origin}/blog`);
    await expect(page.locator('.fn-archive-row').first()).toBeVisible();
    const initialCount = await page.locator('.fn-archive-row').count();
    if (width < 768) await page.locator('.ui-filter-trigger').click();
    await page.getByRole('button', { name: /태그 선택/ }).click();
    await page.getByRole('textbox', { name: '태그 검색' }).fill('AI');
    await expect.poll(async () => {
      const labels = await page.locator('#blog-tag-options button[aria-pressed]').allTextContents();
      return labels.length > 0 && labels.every(label => label.toLowerCase().includes('ai'));
    }).toBe(true);
    const tag = page.getByRole('button', { name: '#AI', exact: true });
    await tag.click();
    await expect(tag).toHaveAttribute('aria-pressed', 'true');
    await expect(tag).toHaveCSS('border-radius', '4px');
    expect(new URL(page.url()).searchParams.getAll('tag')).toContain('AI');
    await shot('archive-tags');
    if (width < 768) {
      await page.getByRole('button', { name: '결과 보기', exact: true }).click();
      await expect(page.locator('.ui-filter-trigger')).toBeFocused();
    }
    await expect(page.locator('.fn-archive-row').first()).toBeVisible();
    await page.reload();
    await expect(page.locator('.fn-archive-row').first()).toBeVisible();
    expect(new URL(page.url()).searchParams.getAll('tag')).toEqual(['AI']);
    await page.getByRole('searchbox', { name: '게시글 검색' }).fill('없는검색결과-필드노트-검증');
    await expect(page.getByText('찾는 글이 없습니다', { exact: true })).toBeVisible();
    await shot('archive-empty');
    await page.getByRole('status').filter({ hasText: '찾는 글이 없습니다' }).getByRole('button', { name: '필터 초기화', exact: true }).click();
    await expect(page.locator('.fn-archive-row')).toHaveCount(initialCount);
    await expect(page.getByRole('searchbox', { name: '게시글 검색' })).toHaveValue('');
    await fit();
    await page.goto(`${origin}/debate`);
    const topic = '지능의 결과를 어떤 기준으로 검증할까';
    await page.getByLabel('주제', { exact: true }).fill(topic);
    await page.getByLabel('맥락', { exact: true }).fill('읽은 내용을 검토합니다.\n\n근거와 판단을 구분합니다.');
    await page.getByRole('button', { name: '상담실 열기', exact: true }).click();
    const room = page.locator('.fn-debate-workbench');
    await expect(room).toHaveCSS('border-radius', '6px');
    await room.evaluate(element => window.scrollTo({ top: element.getBoundingClientRect().top + scrollY - 90, behavior: 'instant' }));
    await expect(room.locator('.fn-debate-intent')).toHaveCount(4);
    for (const option of await room.locator('.fn-debate-intent').all()) {
      await expect(option.locator('.bg-gradient-to-br')).toHaveCSS('background-image', 'none');
    }
    await shot('debate-intent');
    await room.getByRole('button', { name: /더 잘 이해하고 싶어요/ }).click();
    await expect(room.getByText(/응답을 생성하지 못했어요/)).toBeVisible({ timeout: 15000 });
    expect(chatRequests).toBeGreaterThan(0);
    const input = room.getByRole('textbox', { name: '상담 메시지' });
    await input.fill('한글을 조합하는 중');
    const before = chatRequests;
    await input.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true });
    await expect(input).toHaveValue('한글을 조합하는 중');
    expect(chatRequests).toBe(before);
    await input.fill('첫 문장');
    await input.press('Shift+Enter');
    await input.pressSequentially('둘째 문장');
    await expect(input).toHaveValue('첫 문장\n둘째 문장');
    await expect(input).toHaveCSS('font-size', '16px');
    await shot('debate-error-draft');
    await page.setViewportSize({ width, height: 500 });
    await input.focus();
    await room.locator('.fn-debate-composer').scrollIntoViewIfNeeded();
    await expect(room.getByRole('button', { name: '보내기', exact: true })).toBeEnabled();
    await shot('debate-short-viewport');
    await fit();
    await page.setViewportSize({ width, height: 1000 });
    await room.getByRole('button', { name: '닫기', exact: true }).click();
    await expect(page.getByLabel('주제', { exact: true })).toHaveValue(topic);
    await expect(page.getByLabel('맥락', { exact: true })).toHaveValue('읽은 내용을 검토합니다.\n\n근거와 판단을 구분합니다.');
    const statuses = [];
    for (const code of [400, 401, 403, 404, 429, 500, 503]) {
      await page.goto(`${origin}/${code}`);
      await expect(page.locator('main h1')).toBeVisible();
      await fit();
      statuses.push({ code, title: await page.locator('main h1').innerText() });
    }
    await shot('status-503');
    expect(errors).toEqual([]);
    results.push({ theme, width, archiveTagRestored: true, archiveEmptyReset: true, debateFailure: true, imePreservesDraft: true, topicPreservedOnClose: true, chatRequests, statuses, errors });
    console.log(`${theme} ${width}: archive, debate, seven status pages passed`);
    await page.close();
  }
  await writeFile(`${directory}/results.json`, JSON.stringify(results, null, 2));
} finally { await browser.close(); }
