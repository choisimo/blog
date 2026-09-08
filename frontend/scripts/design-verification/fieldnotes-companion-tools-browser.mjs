import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const origin = process.env.DESIGN_BASE_URL || 'http://127.0.0.1:4319';
const directory = 'verification-screenshots/fieldnotes-reader-review-20260908/companion-tools';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true });
const results = [];
try {
  for (const theme of ['light', 'dark']) for (const width of [320, 390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const errors = [];
    let failedApiRequests = 0;
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(value => { localStorage.setItem('theme', value); localStorage.setItem('site.language', 'ko'); }, theme);
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/api/')) failedApiRequests += 1;
      return url.origin === origin && !url.pathname.startsWith('/api/') ? route.continue() : route.abort('blockedbyclient');
    });
    const shot = async (name, element) => {
      await element.evaluate(element => window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - 100, behavior: 'instant' }));
      await page.screenshot({ path: `${directory}/${theme}-${width}-${name}.png`, animations: 'disabled' });
    };
    await page.goto(`${origin}/blog/2026/c-lang-2`);
    const trigger = page.locator('.sentio-trigger').first();
    await trigger.click();
    const panel = page.locator('.sentio-panel:visible');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveCSS('border-radius', '6px');
    await shot('panel', panel);
    await panel.locator('.sentio-mode-card[data-mode="sketch"]').click();
    await expect(panel.getByRole('alert')).toBeVisible();
    await shot('sketch-error', panel.getByRole('alert'));
    await panel.getByRole('button', { name: '다시 시도', exact: true }).click();
    await expect(panel.getByRole('alert')).toBeVisible();
    await panel.locator('.sentio-mode-card[data-mode="prism"]').click();
    await expect(panel.locator('.sentio-deck-stage')).toBeVisible();
    // These are the application's existing fallback cards after real request failure.
    // No AI success or generated content is substituted by this runner.
    await expect(panel.locator('[data-artifact-status="fallback-hard"]')).toHaveText('기본 분석');
    const activeCard = panel.locator('.sentio-lens:not([aria-hidden="true"])');
    await expect(activeCard.locator('.fn-lens-faces')).toHaveCSS('transform', 'none');
    await expect(activeCard.locator('.fn-lens-face[aria-hidden="false"]')).toHaveCount(1);
    const firstId = await activeCard.getAttribute('data-card-id');
    await shot('prism-summary', activeCard);
    await activeCard.getByRole('button', { name: '클릭해 근거 보기', exact: true }).click();
    const back = activeCard.getByRole('button', { name: '클릭해 요점 보기', exact: true });
    await expect(back).toBeFocused();
    await expect(activeCard.locator('.fn-lens-face[aria-hidden="true"]')).toBeHidden();
    await shot('prism-evidence', activeCard);
    await back.press('Enter');
    await expect(activeCard.getByRole('button', { name: '클릭해 근거 보기', exact: true })).toBeFocused();
    await panel.getByRole('button', { name: '다음 관점', exact: true }).click();
    await expect(activeCard).not.toHaveAttribute('data-card-id', firstId);
    await panel.getByRole('button', { name: '이전 관점', exact: true }).click();
    await expect(activeCard).toHaveAttribute('data-card-id', firstId);
    await expect(activeCard.getByRole('textbox', { name: '이 카드에 이어서 질문하기' })).toBeDisabled();
    await panel.locator('.sentio-mode-card[data-mode="chain"]').click();
    await expect(panel.locator('.sentio-thought').first()).toBeVisible();
    await shot('thought-feed', panel.locator('.sentio-thought').first());
    await panel.locator('.sentio-mode-card[data-mode="chain"]').focus();
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    await expect(page.locator('.sentio-panel:visible')).toHaveCount(0);
    await trigger.click();
    await expect(panel.locator('.sentio-mode-card[data-mode="chain"]')).toHaveAttribute('aria-pressed', 'true');
    await panel.getByRole('button', { name: '닫기', exact: true }).click();

    const quiz = page.getByTestId('quiz-panel');
    await shot('quiz-idle', quiz);
    const study = quiz.getByRole('button', { name: /학습 모드 OFF/ });
    await study.click();
    await expect(quiz.getByRole('button', { name: /학습 모드 ON/ })).toHaveAttribute('aria-pressed', 'true');
    await quiz.getByRole('button', { name: /학습 모드 ON/ }).click();
    await quiz.getByTestId('quiz-start').click();
    let answered = 0;
    while (true) {
      await expect.poll(async () => await quiz.getByTestId('quiz-question').count() + await quiz.getByRole('button', { name: '다시 도전하기', exact: true }).count()).toBeGreaterThan(0).catch(async error => { console.error({ theme, width, answered, quizText: await quiz.innerText() }); await shot('quiz-interruption', quiz); throw error; });
      if (await quiz.getByRole('button', { name: '다시 도전하기', exact: true }).count()) break;
      expect(answered).toBeLessThan(20);
      const question = quiz.getByTestId('quiz-question');
      await expect(question).toBeVisible().catch(async error => { console.error({ theme, width, answered, quizText: await quiz.innerText() }); throw error; });
      const choices = question.locator('.fn-quiz-option');
      if (await choices.count()) {
        const choice = choices.nth(answered === 0 ? 1 : 0);
        await choice.click();
        await expect(choice).toHaveAttribute('aria-pressed', 'true');
      } else {
        // Answer text from the actual createQuizFallback implementation, not a server fixture.
        await question.getByRole('textbox').fill('문서의 코드 예제 핵심 조건');
      }
      if (answered === 0) await shot('quiz-selected', question);
      await question.getByRole('button', { name: '확인', exact: true }).click();
      const feedback = question.getByTestId('quiz-feedback');
      await expect(feedback).toBeVisible();
      if (answered === 0) await shot('quiz-feedback', feedback);
      const next = feedback.getByRole('button', { name: /다음 문제|결과 보기/ });
      await expect(next).toBeEnabled();
      await next.click();
      answered += 1;
    }
    await shot('quiz-complete', quiz);
    await quiz.getByRole('button', { name: '다시 도전하기', exact: true }).click();
    await expect(quiz.getByTestId('quiz-start')).toBeVisible();
    expect(failedApiRequests).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect(errors).toEqual([]);
    results.push({ theme, width, source: 'existing application fallback after aborted network', answered, failedApiRequests, errors });
    console.log(`${theme} ${width}: passed (${answered} quiz answers)`);
    await page.close();
  }
  await writeFile(`${directory}/results.json`, JSON.stringify(results, null, 2));
} finally { await browser.close(); }
