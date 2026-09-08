import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect as baseExpect } from '@playwright/test';

const expect = baseExpect.configure({ timeout: 30_000 });

const baseURL = process.env.DESIGN_BASE_URL || 'http://127.0.0.1:4173';
const origin = new URL(baseURL).origin;
const sections = new Set((process.env.DESIGN_PUBLIC_SECTIONS || 'routes,recovery,screenshots').split(','));
const output = new URL('../../docs/design-review-20260908/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.DESIGN_CHROMIUM_PATH || '/usr/bin/chromium',
});
const evidence = {
  baseURL,
  networkPolicy: 'Local static GETs and explicit local manifest fixtures only; external HTTP, API calls and WebSockets blocked.',
  results: [],
  failures: [],
};
let currentCase = 'setup';
let currentPage;

function contrast(foreground, background) {
  const luminance = color => {
    const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

async function inspectPrimaryLink(page) {
  const contact = page.getByRole('link', { name: '연락하기', exact: true });
  await expect(contact).toBeVisible();
  const colors = () => contact.evaluate(element => ({ background: getComputedStyle(element).backgroundColor, color: getComputedStyle(element).color }));
  const before = await colors();
  await contact.hover();
  const hover = await colors();
  const ratios = { normal: contrast(before.color, before.background), hover: contrast(hover.color, hover.background) };
  assert.ok(ratios.normal >= 4.5, `Primary link normal contrast: ${JSON.stringify(before)}`);
  assert.ok(ratios.hover >= 4.5, `Primary link hover contrast: ${JSON.stringify(hover)}`);
  return { before, hover, ratios };
}

async function localPage(theme, width = 320, height = 800) {
  const context = await browser.newContext({
    viewport: { width, height }, serviceWorkers: 'block', reducedMotion: 'reduce',
  });
  await context.addInitScript(value => {
    if (location.origin === 'null') return;
    localStorage.setItem('theme', value);
    localStorage.setItem('site.language', 'ko');
  }, theme);
  await context.route('**/*', route => {
    const request = route.request();
    const url = new URL(request.url());
    return request.method() !== 'GET' || url.origin !== origin || url.pathname.startsWith('/api/')
      ? route.abort('blockedbyclient') : route.continue();
  });
  await context.routeWebSocket('**/*', socket => socket.close());
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  currentPage = page;
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  return { context, page, errors };
}

async function visibleMainGeometry(page, width) {
  const metrics = await page.evaluate(() => {
    const rect = element => {
      const box = element.getBoundingClientRect();
      return { x: box.x, right: box.right, width: box.width, height: box.height };
    };
    return {
      title: document.querySelector('main h1')?.textContent,
      scrollWidth: document.documentElement.scrollWidth,
      main: rect(document.querySelector('main')),
      controls: [...document.querySelectorAll('main a, main button')]
        .filter(element => element.getClientRects().length)
        .map(element => ({ name: element.textContent.trim(), ...rect(element) })),
    };
  });
  assert.ok(metrics.scrollWidth <= width + 1, `document overflow: ${JSON.stringify(metrics)}`);
  assert.ok(metrics.main.x >= -0.5 && metrics.main.right <= width + 1);
  for (const control of metrics.controls) {
    assert.ok(control.x >= -0.5 && control.right <= width + 1 && control.width >= 43.5 && control.height >= 43.5, JSON.stringify(control));
  }
  return metrics;
}

const manifest = {
  items: Array.from({ length: 15 }, (_, index) => ({
    path: `/posts/2026/runtime-${index + 1}.md`,
    year: '2026', slug: `runtime-${index + 1}`,
    title: `Runtime ${String(index + 1).padStart(2, '0')}`,
    description: 'Local failure recovery fixture', date: '2026-09-08',
    category: 'Tech', tags: ['runtime'], published: true,
  })),
};

try {
  if (sections.has('routes')) for (const theme of ['light', 'dark', 'terminal']) {
    const { context, page, errors } = await localPage(theme);
    const routes = ['/400', '/401', '/403', '/404', '/429', '/500', '/503', '/admin/unknown', '/insight/unknown', '/admin/auth/callback', '/admin/auth/callback#error=Provider%20denied'];
    for (const route of routes) {
      currentCase = `${theme}-320-${route}`;
      console.log(`Checking ${currentCase}`);
      // OAuth returns through a new document; adjacent hash-only goto calls
      // would otherwise reuse the preceding callback component and its effect.
      if (route.includes('/auth/callback')) await page.goto('about:blank');
      await page.goto(`${baseURL}${route}`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('main h1')).toBeVisible();
      if (route.includes('/auth/callback')) {
        await expect(page.getByRole('heading', { name: '인증을 완료하지 못했습니다' })).toBeVisible();
        await expect(page).toHaveURL(`${baseURL}/admin/auth/callback`);
        await expect(page.getByRole('alert')).toHaveText('인증 응답을 확인하지 못했습니다. 로그인을 다시 시작해 주세요.');
        await expect(page.getByRole('link', { name: '관리자 로그인으로 돌아가기' })).toHaveAttribute('href', '/admin/login');
      } else {
        const status = route.endsWith('/unknown') ? '404' : route.slice(1);
        await expect(page.locator('.ui-error-meta code')).toHaveText(status);
      }
      const geometry = await visibleMainGeometry(page, 320);
      evidence.results.push({ case: currentCase, finalPath: new URL(page.url()).pathname, ...geometry });
      if (theme === 'terminal' && route === '/503') await page.screenshot({ path: new URL('status-503-terminal-320.png', output).pathname });
      if (theme === 'light' && route === '/admin/auth/callback') await page.screenshot({ path: new URL('auth-callback-light-320.png', output).pathname });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    currentCase = `${theme}-header-search-390`;
    await page.goto(`${baseURL}/blog`, { waitUntil: 'domcontentloaded' });
    await page.locator('.ui-filter-trigger').click();
    const applyButton = page.getByRole('button', { name: '결과 보기', exact: true });
    const colors = () => applyButton.evaluate(element => ({ background: getComputedStyle(element).backgroundColor, color: getComputedStyle(element).color }));
    const before = await colors();
    await applyButton.hover();
    const hover = await colors();
    assert.deepEqual(hover, before, 'Native filter primary colors must survive global hover rules');
    assert.ok(contrast(before.color, before.background) >= 4.5);
    await page.keyboard.press('Escape');
    const opener = page.getByRole('button', { name: '검색', exact: true });
    await opener.click();
    const search = page.locator('.ui-search-sheet input').first();
    await expect(search).toBeFocused();
    const input = await search.evaluate(element => ({ fontSize: parseFloat(getComputedStyle(element).fontSize), height: element.getBoundingClientRect().height }));
    assert.ok(input.fontSize >= 16 && input.height >= 44, JSON.stringify(input));
    if (theme === 'terminal') await page.screenshot({ path: new URL('header-search-terminal-390.png', output).pathname });
    await page.keyboard.press('Escape');
    await expect(opener).toBeFocused();
    await page.goto(`${baseURL}/about`, { waitUntil: 'domcontentloaded' });
    const primaryLink = await inspectPrimaryLink(page);
    assert.deepEqual(errors, []);
    evidence.results.push({ case: currentCase, input, primary: { before, hover }, primaryLink, openerRestored: true, pageErrors: errors });
    await context.close();
  }

  if (sections.has('contrast')) for (const theme of ['light', 'dark', 'terminal']) {
    currentCase = `primary-link-${theme}-320`;
    const { context, page, errors } = await localPage(theme, 320, 900);
    await page.goto(`${baseURL}/about`, { waitUntil: 'domcontentloaded' });
    const primaryLink = await inspectPrimaryLink(page);
    if (theme === 'terminal') {
      await page.mouse.move(0, 0);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.screenshot({ path: new URL('latest-about-terminal-320.png', output).pathname });
    }
    assert.deepEqual(errors, []);
    evidence.results.push({ case: currentCase, primaryLink, pageErrors: errors });
    await context.close();
  }

  if (sections.has('routes')) {
    const { context, page } = await localPage('light');
    const aliases = { '/bad-request': '/400', '/unauthorized': '/401', '/forbidden': '/403', '/too-many-requests': '/429', '/error': '/500', '/server-error': '/500', '/maintenance': '/503', '/contact': '/about' };
    for (const [route, target] of Object.entries(aliases)) {
      currentCase = `alias-${route}`;
      await page.goto(`${baseURL}${route}`, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(`${baseURL}${target}`);
      await expect(page.locator('main h1')).toBeVisible();
      evidence.results.push({ case: currentCase, target });
    }
    await context.close();
  }

  if (sections.has('recovery')) for (const theme of ['light', 'terminal']) {
    for (const route of ['blog', 'home']) {
      currentCase = `${route}-manifest-recovery-${theme}`;
      console.log(`Checking ${currentCase}`);
      const { context, page, errors } = await localPage(theme, 390, 844);
      let unavailable = true;
      let manifestRequests = 0;
      await context.route('**/posts-manifest.json*', request => {
        manifestRequests += 1;
        return request.fulfill({ status: unavailable ? 503 : 200, contentType: 'application/json', body: JSON.stringify(unavailable ? { error: 'Temporary outage' } : manifest) });
      });
      const path = route === 'blog' ? '/blog?category=Tech&tag=runtime&q=Runtime&sort=title&page=2' : '/';
      await page.goto(`${baseURL}${path}`, { waitUntil: 'domcontentloaded' });
      if (route === 'blog') {
        const results = page.getByRole('region', { name: '게시글 검색 결과' });
        await expect(results.getByRole('alert')).toContainText('글을 불러오지 못했습니다.');
        await expect(page.getByText('찾는 글이 없습니다', { exact: true })).toHaveCount(0);
        await page.screenshot({ path: new URL(`blog-manifest-failure-${theme}-390.png`, output).pathname });
        unavailable = false;
        await results.getByRole('button', { name: '다시 시도', exact: true }).click();
        await expect(page.getByTestId('post-link')).toHaveCount(3);
        await expect(results.getByRole('status')).toHaveText('총 15개 글 · 2 / 2 페이지');
        await expect(page).toHaveURL(`${baseURL}${path}`);
        await page.locator('.ui-filter-trigger').click();
        await expect(page.getByLabel('전체 주제')).toHaveValue('Tech');
        await expect(page.getByLabel('정렬')).toHaveValue('title');
        await page.keyboard.press('Escape');
      } else {
        await expect(page.getByRole('button', { name: '최신 글 다시 시도', exact: true })).toBeVisible();
        const search = page.getByRole('textbox', { name: '검색어', exact: true });
        await search.fill('Runtime');
        const retry = page.getByRole('button', { name: '검색 다시 시도', exact: true });
        await expect(retry).toBeVisible();
        await expect(page.getByText('검색 결과가 없습니다.', { exact: false })).toHaveCount(0);
        unavailable = false;
        await retry.click();
        await expect(page.getByRole('link', { name: '전체 검색 결과 보기 (15개)', exact: true })).toBeVisible();
        await expect(search).toHaveValue('Runtime');
        await page.getByRole('button', { name: '최신 글 다시 시도', exact: true }).click();
        await expect(page.getByRole('button', { name: '최신 글 다시 시도', exact: true })).toHaveCount(0);
      }
      assert.deepEqual(errors, []);
      evidence.results.push({ case: currentCase, manifestRequests, realService: true, recovered: true, queryPreserved: true, pageErrors: errors });
      await context.close();
    }
  }

  if (sections.has('screenshots')) for (const snapshot of [
    { name: 'latest-home-light-1440', route: '/', theme: 'light', width: 1440 },
    { name: 'latest-blog-terminal-320', route: '/blog', theme: 'terminal', width: 320 },
    { name: 'latest-projects-light-1440', route: '/projects', theme: 'light', width: 1440 },
    { name: 'latest-about-terminal-320', route: '/about', theme: 'terminal', width: 320 },
  ]) {
    currentCase = snapshot.name;
    const { context, page, errors } = await localPage(snapshot.theme, snapshot.width, 900);
    await page.goto(`${baseURL}${snapshot.route}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main h1')).toBeVisible();
    if (snapshot.route === '/') await expect(page.locator('.ui-latest-list a').first()).toBeVisible();
    if (snapshot.route === '/blog') await expect(page.getByTestId('post-link').first()).toBeVisible();
    let projectSummary;
    if (snapshot.route === '/projects') {
      await expect(page.locator('#project-results-summary')).toHaveText(/^\d+개/);
      await expect(page.getByRole('link', { name: /저장소 열기/ }).first()).toBeVisible();
      projectSummary = await page.locator('#project-results-summary').textContent();
    }
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: new URL(`${snapshot.name}.png`, output).pathname });
    assert.deepEqual(errors, []);
    evidence.results.push({ case: currentCase, screenshot: `${snapshot.name}.png`, projectSummary, pageErrors: errors });
    await context.close();
  }
  console.log(`Verified ${evidence.results.length} public review cases.`);
} catch (error) {
  evidence.failures.push({ case: currentCase, message: error instanceof Error ? error.stack : String(error) });
  if (currentPage && !currentPage.isClosed()) await currentPage.screenshot({ path: new URL('public-review-failure.png', output).pathname }).catch(() => {});
  throw error;
} finally {
  await writeFile(new URL(process.env.DESIGN_PUBLIC_RESULTS || 'public-review-browser-results.json', output), JSON.stringify(evidence, null, 2));
  await browser.close();
}
