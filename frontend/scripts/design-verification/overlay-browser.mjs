import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const baseURL = process.env.DESIGN_BASE_URL || 'http://127.0.0.1:4173';
const origin = new URL(baseURL).origin;
const output = new URL('../../docs/design-review-20260908/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.DESIGN_CHROMIUM_PATH || '/usr/bin/chromium' });
const evidence = { baseURL, networkPolicy: 'Only local static files and GET public-config fixture allowed. All other API/external HTTP and all WebSocket connections blocked.', results: [], failures: [] };
let currentPage;
let currentCase = 'setup';

async function localPage(theme, width, realTerminal = false) {
  const blocked = [];
  const errors = [];
  const context = await browser.newContext({ viewport: { width, height: 800 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await context.addInitScript(({ theme, realTerminal }) => {
    localStorage.setItem('theme', theme);
    localStorage.setItem('site.language', 'ko');
    localStorage.setItem('aiMemo.fab.enabled', 'true');
    if (realTerminal) localStorage.setItem('aiMemo.authToken', JSON.stringify('local-design-fixture-no-credentials'));
  }, { theme, realTerminal });
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'GET' && url.pathname === '/api/v1/public/config') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { apiBaseUrl: origin, chatBaseUrl: origin, siteBaseUrl: origin, features: { aiEnabled: true, ragEnabled: false, terminalEnabled: realTerminal, aiInline: false, codeExecutionEnabled: false, commentsEnabled: false } } }) });
    } else if (url.origin !== origin || url.pathname.startsWith('/api/')) {
      blocked.push({ method: request.method(), path: url.pathname });
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: { message: 'Local overlay verification: unavailable' } }) });
    } else await route.continue();
  });
  await context.routeWebSocket('**/*', socket => socket.close());
  const page = await context.newPage();
  currentPage = page;
  page.setDefaultTimeout(60_000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main h1')).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole('toolbar', { name: /빠른 작업|Floating actions/ })).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('ai-memo-pad #panel')).toBeAttached({ timeout: 90_000 });
  return { context, page, blocked, errors };
}

async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function assertBackgroundScrollLocked(page) {
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.move(8, 24);
  await page.mouse.wheel(0, 500);
  await settle(page);
  const after = await page.evaluate(() => window.scrollY);
  assert.equal(after, before, 'modal allowed background page to scroll');
  return { before, after };
}

async function assertFocusInside(page, dialog, presses = 18) {
  for (let index = 0; index < presses; index += 1) {
    await page.keyboard.press(index % 3 === 0 ? 'Shift+Tab' : 'Tab');
    assert.ok(await dialog.evaluate(element => element.contains(document.activeElement)), `focus escaped at step ${index}`);
  }
}

async function geometry(page, dialog, width) {
  const header = dialog.locator(':scope > div').first();
  const metrics = await header.evaluate(element => ({ width: element.getBoundingClientRect().width, scrollWidth: element.scrollWidth, children: [...element.querySelectorAll('button')].map(button => { const rect = button.getBoundingClientRect(); return { label: button.getAttribute('aria-label'), x: rect.x, right: rect.right, width: rect.width, height: rect.height }; }) }));
  assert.ok(metrics.scrollWidth <= width + 1, `header overflow: ${JSON.stringify(metrics)}`);
  for (const box of metrics.children) {
    assert.ok(box.x >= 0 && box.right <= width + 1 && box.width >= 43.5 && box.height >= 43.5, `header target: ${JSON.stringify(box)}`);
  }
  return metrics;
}

try {
  for (const theme of (process.env.DESIGN_OVERLAY_THEMES || 'light,dark').split(',')) {
    currentCase = `chat-${theme}-320`;
    console.log(`Checking ${currentCase}`);
    const { context, page, blocked, errors } = await localPage(theme, 320);
    const toolbar = page.getByRole('toolbar', { name: /빠른 작업|Floating actions/ });
    const opener = toolbar.getByRole('button', { name: /채팅|Chat/i });
    await expect(opener).toBeVisible();
    await opener.click();
    const chat = page.getByRole('dialog', { name: 'AI Chat', exact: true });
    await expect(chat).toBeVisible({ timeout: 90_000 });
    await expect(chat).toHaveAttribute('aria-modal', 'true');
    await expect(chat.locator('textarea:visible').first()).toBeFocused();
    await settle(page);
    const header = await geometry(page, chat, 320);
    const backgroundScroll = await assertBackgroundScrollLocked(page);
    await assertFocusInside(page, chat);
    await page.screenshot({ path: new URL(`${currentCase}.png`, output).pathname, fullPage: false });
    const options = chat.getByRole('button', { name: '대화 옵션', exact: true });
    await options.click();
    const sheet = page.getByRole('dialog', { name: '대화 옵션', exact: true });
    await expect(sheet).toBeVisible();
    await settle(page);
    const childBackgroundScroll = await assertBackgroundScrollLocked(page);
    await page.screenshot({ path: new URL(`${currentCase}-sheet.png`, output).pathname, fullPage: false });
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(chat).toBeVisible();
    await expect(options).toBeFocused();
    await chat.getByRole('button', { name: '창 닫기', exact: true }).click();
    await expect(chat).toBeHidden();
    await expect(opener).toBeFocused();
    await opener.focus();
    await page.keyboard.press('Control+Alt+m');
    await expect(chat).toBeVisible();
    await expect(chat.locator('textarea:visible').first()).toBeFocused();
    await settle(page);
    await expect(page.locator('ai-memo-pad #panel')).toBeHidden();
    await chat.getByRole('button', { name: '창 닫기', exact: true }).click({ trial: true });
    await page.keyboard.press('Escape');
    await expect(chat).toBeHidden();
    await expect(opener).toBeFocused();
    assert.deepEqual(errors, []);
    evidence.results.push({ case: currentCase, header, backgroundScroll, childBackgroundScroll, tabContainment: true, childEscapeOnly: true, childFocusRestored: true, actualOpenerRestored: true, shortcutEscapeRestored: true, shortcutDoesNotOpenMemo: true, pageErrors: errors, blockedRequests: blocked });
    await context.close();
  }

  currentCase = 'shell-terminal-320';
  console.log(`Checking ${currentCase}`);
  {
    const { context, page, blocked, errors } = await localPage('terminal', 320, true);
    const opener = page.getByRole('button', { name: 'Open command input', exact: true });
    await expect(opener).toBeVisible();
    await opener.click();
    const shell = page.getByRole('dialog', { name: '터미널 명령 입력', exact: true });
    const input = shell.getByRole('textbox', { name: '터미널 명령어' });
    await expect(input).toBeFocused();
    await settle(page);
    const backgroundScroll = await assertBackgroundScrollLocked(page);
    await input.fill('c');
    const suggestions = shell.getByRole('listbox', { name: '명령어 제안' });
    await expect(suggestions).toBeVisible();
    const suggestionBounds = await suggestions.boundingBox();
    assert.ok(suggestionBounds.y >= 0 && suggestionBounds.y + suggestionBounds.height <= 800, `suggestions outside viewport: ${JSON.stringify(suggestionBounds)}`);
    await page.screenshot({ path: new URL(`${currentCase}-suggestions.png`, output).pathname, fullPage: false });
    await input.press('Escape');
    await expect(suggestions).toBeHidden();
    await expect(shell).toBeVisible();
    await expect(input).toBeFocused();
    await input.press('Escape');
    await expect(shell).toBeHidden();
    await expect(opener).toBeFocused();
    await opener.click();
    await expect(shell).toBeVisible();
    await expect(input).toBeFocused();
    await settle(page);
    await assertFocusInside(page, shell);
    const close = shell.getByRole('button', { name: '터미널 닫기' });
    await close.focus();
    await page.keyboard.press('Escape');
    await expect(shell).toBeHidden();
    await expect(opener).toBeFocused();
    await opener.click();
    await shell.getByRole('button', { name: '실제 Linux 터미널로 전환' }).click();
    const real = page.getByRole('dialog', { name: 'Real Linux terminal', exact: true });
    await expect(real).toBeVisible();
    await expect(real.locator('.xterm')).toBeVisible({ timeout: 90_000 });
    await expect(real.getByRole('status')).toContainText('Disconnected');
    await settle(page);
    await assertFocusInside(page, real);
    await page.screenshot({ path: new URL('real-terminal-320-disconnected.png', output).pathname, fullPage: false });
    const terminalInput = real.locator('.xterm-helper-textarea');
    await terminalInput.focus();
    await page.keyboard.press('Escape');
    await expect(real).toBeVisible();
    await real.getByRole('button', { name: 'Close real terminal' }).focus();
    await page.keyboard.press('Escape');
    await expect(real).toBeHidden();
    await expect(opener).toBeFocused();
    await opener.focus();
    await page.keyboard.press('Control+Alt+m');
    const chat = page.getByRole('dialog', { name: 'AI Chat', exact: true });
    await expect(chat).toBeVisible();
    await expect(chat.locator('textarea:visible').first()).toBeFocused();
    await settle(page);
    await expect(page.locator('ai-memo-pad #panel')).toBeHidden();
    await chat.getByRole('button', { name: '창 닫기', exact: true }).click({ trial: true });
    const header = await geometry(page, chat, 320);
    await page.screenshot({ path: new URL('chat-terminal-320.png', output).pathname, fullPage: false });
    await page.keyboard.press('Escape');
    await expect(chat).toBeHidden();
    await expect(opener).toBeFocused();
    assert.deepEqual(errors, []);
    evidence.results.push({ case: currentCase, suggestionBounds, backgroundScroll, suggestionEscapePreserved: true, secondEscapeCloses: true, headerEscapeCloses: true, tabContainment: true, openerRestored: true, realTerminal: { initialized: true, disconnected: true, tabContainment: true, inputEscapeKeepsOpen: true, headerEscapeCloses: true, openerRestored: true }, terminalChatHeader: header, shortcutDoesNotOpenMemo: true, pageErrors: errors, blockedRequests: blocked });
    await context.close();
  }
  console.log(`Verified ${evidence.results.length} actual-home overlay cases.`);
} catch (error) {
  evidence.failures.push({ case: currentCase, message: error instanceof Error ? error.stack : String(error) });
  if (currentPage && !currentPage.isClosed()) {
    await currentPage.screenshot({ path: new URL(`${currentCase}-failure.png`, output).pathname, fullPage: false }).catch(() => {});
    evidence.failures.at(-1).visibleDialogs = await currentPage.locator('[role="dialog"]').evaluateAll(elements => elements.map(element => ({ label: element.getAttribute('aria-label'), text: element.textContent?.slice(0, 1400), rect: element.getBoundingClientRect().toJSON() }))).catch(() => []);
  }
  throw error;
} finally {
  await writeFile(new URL('overlay-browser-results.json', output), JSON.stringify(evidence, null, 2));
  await browser.close();
}
