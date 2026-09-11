import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

async function setup(
  page: Page,
  theme: string,
  baseURL: string | undefined,
  longReading = false
) {
  if (!baseURL) throw new Error('A Playwright baseURL is required');
  const appOrigin = new URL(baseURL).origin;
  await page.addInitScript(value => {
    localStorage.setItem('theme', value.theme);
    localStorage.setItem('site.language', 'ko');
    localStorage.setItem('aiMemo.fab.enabled', 'false');
    localStorage.setItem(
      'anon.token',
      // The browser checks continuity claims; fixture requests never leave this page.
      `fixture.${btoa(JSON.stringify({
        sub: 'anon-00000000-0000-0000-0000-000000000001',
        role: 'anonymous', tokenClass: 'anonymous', type: 'access',
        exp: Math.floor(Date.now() / 1000) + 172800,
      })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.fixture`
    );
    const originalFetch = window.fetch.bind(window);
    let turn = 0;
    let session = 0;
    const readingText = value.longReading
      ? '긴 설명에서도 문단을 끝까지 읽고 이어서 질문할 수 있어야 합니다. '.repeat(50)
      : '';
    window.fetch = async (input, init) => {
      const url = new URL(
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
        location.href
      );
      if (!url.pathname.startsWith('/api/v1/'))
        return originalFetch(input, init);
      const json = (data: unknown) =>
        new Response(JSON.stringify(data), {
          headers: { 'Content-Type': 'application/json' },
        });
      if (url.pathname.endsWith('/public/config'))
        return json({
          features: {
            aiEnabled: true,
            aiInline: true,
            ragEnabled: false,
            commentsEnabled: false,
            terminalEnabled: false,
            codeExecutionEnabled: false,
          },
        });
      if (url.pathname.endsWith('/chat/session'))
        return json({ id: `fixture-session-${++session}` });
      if (url.pathname.endsWith('/ai/sketch'))
        return json({ mood: '분석적', bullets: [`핵심 요약 결과 ${readingText}`] });
      if (url.pathname.endsWith('/lens-feed'))
        return json({
          items: [
            {
              id: 'lens-a',
              personaId: 'analyst',
              angleKey: 'first',
              title: '첫 번째 관점',
              summary: `첫 카드의 원래 설명 ${readingText}`,
              detail: '원래 근거',
              bullets: ['첫 번째 요점'],
              tags: [],
            },
            {
              id: 'lens-b',
              personaId: 'mentor',
              angleKey: 'second',
              title: '두 번째 관점',
              summary: '다른 카드의 설명',
              detail: '다른 근거',
              bullets: [],
              tags: [],
            },
          ],
          source: 'feed',
          exhausted: true,
        });
      if (url.pathname.endsWith('/thought-feed'))
        return json({
          items: [
            {
              id: 'thought-a',
              trackKey: 'first',
              title: '첫 번째 질문',
              body: `첫 카드의 원래 설명 ${readingText}`,
              bullets: ['어떻게 적용할 수 있을까?'],
              tags: [],
            },
            {
              id: 'thought-b',
              trackKey: 'second',
              title: '두 번째 질문',
              body: '다른 카드의 설명',
              bullets: ['어떤 한계가 있을까?'],
              tags: [],
            },
          ],
          source: 'feed',
          exhausted: true,
        });
      if (url.pathname.endsWith('/message')) {
        const number = ++turn;
        const encoder = new TextEncoder();
        const signal = init?.signal;
        let ended = false;
        const timers: ReturnType<typeof setTimeout>[] = [];
        const stream = new ReadableStream({
          start(controller) {
            const send = (value: unknown) => {
              if (!ended)
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(value)}\n\n`)
                );
            };
            signal?.addEventListener(
              'abort',
              () => {
                if (ended) return;
                ended = true;
                timers.forEach(clearTimeout);
                controller.error(new DOMException('Aborted', 'AbortError'));
              },
              { once: true }
            );
            timers.push(
              setTimeout(
                () =>
                  send({ type: 'text', text: `실시간 첫 문장 ${number}. ` }),
                100
              )
            );
            timers.push(
              setTimeout(
                () =>
                  send({
                    type: 'text',
                    text: `선택한 방향의 깊어진 설명 ${number}.`,
                  }),
                1300
              )
            );
            timers.push(
              setTimeout(() => {
                send({
                  type: 'text',
                  text: '\n<<<FOLLOWUPS>>>\n["구체적으로 적용하면 어떻게 될까?", "반례를 더 살펴볼까?"]',
                });
                send({ type: 'done' });
                ended = true;
                controller.close();
              }, 2100)
            );
          },
        });
        return new Response(stream, {
          headers: { 'Content-Type': 'text/event-stream' },
        });
      }
      return json({ ok: true, data: {} });
    };
  }, { theme, longReading });
  // Fixture content and credentials must never reach external services.
  await page.route('**/*', route =>
    new URL(route.request().url()).origin !== appOrigin
      ? route.abort()
      : route.fallback()
  );
  await page.route('**/posts-manifest.json*', route =>
    route.fulfill({
      json: {
        version: 1,
        total: 1,
        years: ['2026'],
        posts: ['/posts/2026/sentio-fixture.md'],
        items: [
          {
            path: '/posts/2026/sentio-fixture.md',
            year: '2026',
            slug: 'sentio-fixture',
            title: '카드 탐구 테스트',
            description: '',
            snippet: '',
            date: '2026-09-08',
            tags: [],
            published: true,
            language: 'ko',
            url: '/blog/2026/sentio-fixture',
          },
        ],
      },
    })
  );
  await page.route('**/posts/2026/sentio-fixture.md*', route =>
    route.fulfill({
      contentType: 'text/markdown',
      body: '---\ntitle: 카드 탐구 테스트\ndate: 2026-09-08\n---\n\n캐시는 반복된 요청을 빠르게 처리하지만 일관성과 갱신 시점을 함께 고려해야 합니다. 이 문단을 여러 관점에서 탐구합니다.\n',
    })
  );
  await page.goto('/blog/2026/sentio-fixture');
  await page
    .getByRole('button', {
      name: /AI로 문단 분석하기|Analyze paragraph with AI/,
    })
    .first()
    .click();
}

for (const scenario of [
  { width: 1280, theme: 'light', reduced: false },
  { width: 390, theme: 'dark', reduced: false },
  { width: 320, theme: 'light', reduced: false },
  { width: 1280, theme: 'terminal', reduced: false },
  { width: 390, theme: 'light', reduced: true },
]) {
  test(`mode reveal ${scenario.theme} ${scenario.width}px reduced=${scenario.reduced}`, async ({
    page,
    baseURL,
  }) => {
    await page.setViewportSize({ width: scenario.width, height: 1000 });
    await page.emulateMedia({
      reducedMotion: scenario.reduced ? 'reduce' : 'no-preference',
    });
    await setup(page, scenario.theme, baseURL);
    const panel = page.locator('.sentio-panel:visible');
    const grid = panel.locator('.sentio-mode-grid');
    const initialGrid = await grid.boundingBox();
    const expanded = panel.locator('.sentio-expanded-modes');
    const initialExpanded = (await expanded.boundingBox())!.height;
    for (const label of [
      '핵심 파악',
      '다각도 분석',
      '더 생각해보기',
      '다각도 분석',
    ]) {
      await panel.getByRole('button', { name: new RegExp(label) }).click();
      const reveal = panel.locator('.sentio-reveal:visible');
      if (!scenario.reduced) {
        await expect(reveal).toHaveAttribute('aria-busy', 'true');
        await expect(reveal.getByRole('status')).toBeVisible();
        const loadingHeight = await reveal.evaluate(element => {
          // Measure the existing loader at its natural height, outside the overlay.
          const natural = element
            .querySelector('.sentio-loading')!
            .cloneNode(true) as HTMLElement;
          Object.assign(natural.style, {
            position: 'absolute',
            width: '100%',
            height: 'auto',
            visibility: 'hidden',
          });
          element.append(natural);
          const expected = natural.getBoundingClientRect().height;
          natural.remove();
          return { actual: element.getBoundingClientRect().height, expected };
        });
        expect(loadingHeight.actual).toBeCloseTo(loadingHeight.expected, 0);
        await expect(reveal.locator('.sentio-reveal-content')).toHaveCSS(
          'visibility',
          'hidden'
        );
      }
      await expect(reveal).toHaveAttribute('aria-busy', 'false');
      const content = reveal.locator('.sentio-reveal-content');
      await expect(content).toHaveCSS('opacity', '1');
      await expect(content).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
      if (scenario.reduced)
        await expect(content).toHaveCSS('transition-duration', '0s');
      const currentGrid = await grid.boundingBox();
      await expect(panel).toHaveAttribute('data-compact', 'true');
      await expect
        .poll(async () => (await expanded.boundingBox())!.height)
        .toBeLessThan(1);
      await expect(
        panel.locator('.sentio-compact-mode[aria-pressed="true"]')
      ).toBeFocused();
      expect(initialExpanded).toBeGreaterThan(80);
      expect(currentGrid!.width).toBeCloseTo(initialGrid!.width, 0);
      const bounds = await panel.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(scenario.width + 1);
    }
    await panel.getByRole('button', { name: '분석 방식 펼치기' }).click();
    await expect(panel).toHaveAttribute('data-compact', 'false');
    await expect
      .poll(async () => (await expanded.boundingBox())!.height)
      .toBeCloseTo(initialExpanded, 0);
    await expect(
      panel.getByRole('button', { name: /다각도 분석/ })
    ).toBeFocused();
    await panel.getByRole('button', { name: /다각도 분석/ }).click();
    await expect
      .poll(async () => (await expanded.boundingBox())!.height)
      .toBeLessThan(1);
    await panel.screenshot({
      path: `verification-screenshots/sentio-mode-collapse-${scenario.theme}-${scenario.width}-${scenario.reduced}.png`,
    });
  });
}

for (const width of [390, 1024, 1440]) {
  test(`reading desk ${width}px keeps chat and history without the FAB`, async ({
    page,
    baseURL,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    // setup deliberately disables the old FAB preference; desk actions must still work.
    await setup(page, 'light', baseURL);
    await expect(page.locator('.fn-assistant-dock')).toHaveCount(0);
    const desk = page.locator(
      width >= 1200 ? '.rd-right' : '.fn-reader-mobilebar'
    );
    if (width < 1200)
      await desk.getByRole('button', { name: '더 많은 도구' }).click();
    await page
      .getByRole(width >= 1200 ? 'button' : 'menuitem', {
        name: '방문 기록',
        exact: true,
      })
      .click();
    await expect(page.locator('.fn-visited-desk')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.fn-visited-desk')).toBeHidden();
    await desk
      .getByRole('button', {
        name: width >= 1200 ? '이 글에 질문하기' : '질문',
        exact: true,
      })
      .click();
    await expect(page.locator('.fn-chat-desk')).toBeVisible();
    await expect(page.locator('.fn-assistant-dock')).toHaveCount(0);
    const legacyLauncher = page.locator('ai-memo-pad #launcher');
    await expect(legacyLauncher).toBeHidden();
    await page
      .locator('.fn-chat-desk')
      .getByRole('button', { name: '창 닫기', exact: true })
      .click();
    await page.evaluate(() => {
      window.history.pushState({}, '', '/projects');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await expect(legacyLauncher).toBeVisible();
  });
}

for (const mode of ['prism', 'chain'] as const) {
  for (const width of [1280, 390]) {
    test(`${mode} ${width}px: streams in the same card and follows the next direction`, async ({
      page,
      baseURL,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await setup(page, width === 390 ? 'dark' : 'light', baseURL);
      const panel = page.locator('.sentio-panel:visible');
      await panel
        .getByRole('button', {
          name: mode === 'prism' ? /다각도 분석/ : /더 생각해보기/,
        })
        .click();
      const card = panel.locator(
        `[data-card-id="${mode === 'prism' ? 'lens-a' : 'thought-a'}"]`
      );
      await card.waitFor();
      await card.evaluate(el => {
        el.setAttribute('data-instance', 'original-frame');
      });
      const initialQuestion =
        mode === 'prism'
          ? '이 관점을 실제 사례에 적용하면?'
          : '어떻게 적용할 수 있을까?';
      await card
        .getByRole('button', { name: initialQuestion, exact: true })
        .click();
      await expect(card).toContainText('실시간 첫 문장 1.');
      await expect(card).not.toContainText('선택한 방향의 깊어진 설명 1.');
      await expect(card).toHaveAttribute('data-instance', 'original-frame');
      await expect(
        card.getByRole('button', {
          name: '구체적으로 적용하면 어떻게 될까?',
          exact: true,
        })
      ).toBeVisible();
      await expect(card).toContainText('선택한 방향의 깊어진 설명 1.');
      await expect(card).not.toContainText('<<<FOLLOWUPS>>>');
      await card
        .getByRole('button', {
          name: '구체적으로 적용하면 어떻게 될까?',
          exact: true,
        })
        .click();
      await expect(card).toContainText('실시간 첫 문장 2.');
      await expect(card).not.toContainText('실시간 첫 문장 1.');
      await expect(
        card.getByRole('button', {
          name: '구체적으로 적용하면 어떻게 될까?',
          exact: true,
        })
      ).toBeVisible();
      await card
        .getByRole('button', { name: '이전 내용으로 돌아가기' })
        .click();
      await expect(card).toContainText('실시간 첫 문장 1.');
      if (mode === 'chain')
        await expect(panel.locator('[data-card-id="thought-b"]')).toContainText(
          '다른 카드의 설명'
        );
      const bounds = await card.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
      await card.screenshot({
        path: `verification-screenshots/sentio-exploration-${mode}-${width}.png`,
      });
      await card
        .getByRole('textbox', { name: '이 카드에 이어서 질문하기' })
        .fill('직접 입력한 방향');
      await card.getByRole('button', { name: '질문 보내기' }).click();
      await expect(card).toContainText('실시간 첫 문장 3.');
      await card.getByRole('button', { name: '중지', exact: true }).click();
      await expect(card).toContainText('생성을 중지했어요');
      await card
        .getByRole('button', { name: '같은 질문으로 다시 시도' })
        .click();
      await expect(card).toContainText('실시간 첫 문장 4.');
      await panel.getByRole('button', { name: '닫기', exact: true }).click();
      await page
        .getByRole('button', {
          name: /AI로 문단 분석하기|Analyze paragraph with AI/,
        })
        .first()
        .click();
      await expect(card).toContainText('생성을 중지했어요');
    });
  }
}

for (const scenario of [
  { width: 320, height: 568, theme: 'light', mobile: true, reduced: false },
  { width: 390, height: 844, theme: 'dark', mobile: true, reduced: false },
  { width: 640, height: 960, theme: 'light', mobile: true, reduced: true },
  { width: 844, height: 390, theme: 'terminal', mobile: true, reduced: false },
  { width: 1280, height: 900, theme: 'light', mobile: false, reduced: false },
]) {
  test.describe(`paper viewport ${scenario.width}x${scenario.height}`, () => {
    test.use({ hasTouch: scenario.mobile, isMobile: scenario.mobile });
    test('fills mobile screens and keeps long content scrollable beneath the toolbar', async ({
      page,
      baseURL,
    }) => {
      await page.setViewportSize({
        width: scenario.width,
        height: scenario.height,
      });
      await page.emulateMedia({
        reducedMotion: scenario.reduced ? 'reduce' : 'no-preference',
      });
      await setup(page, scenario.theme, baseURL, true);
      const panel = page.locator('.sentio-panel:visible');
      for (const mode of ['핵심 파악', '다각도 분석', '더 생각해보기']) {
        await panel.getByRole('button', { name: new RegExp(mode) }).click();
        const trigger = panel
          .getByRole('button', { name: /크게 보기/ })
          .first();
        await trigger.click();
        const dialog = page.getByRole('dialog');
        const expected = scenario.mobile
          ? { x: 0, y: 0, width: scenario.width, height: scenario.height }
          : { x: 100, y: 24, width: 1080, height: 852 };
        await expect.poll(() => dialog.boundingBox()).toEqual(expected);
        await expect(page.locator('ai-memo-pad #launcher')).toBeHidden();
        await expect(page.locator('ai-memo-pad #historyLauncher')).toBeHidden();
        if (scenario.mobile) {
          await expect(dialog).toHaveCSS('border-radius', '0px');
          await expect(dialog).toHaveCSS('transform', 'none');
        }
        if (scenario.reduced)
          await expect(dialog).toHaveCSS('animation-name', 'none');
        const canvas = dialog.locator('.sentio-paper-canvas');
        const toolbar = dialog.locator('.sentio-paper-toolbar');
        const toolbarBefore = await toolbar.boundingBox();
        const pageScroll = await page.evaluate(() => window.scrollY);
        await canvas.evaluate(element => {
          element.scrollTop = element.scrollHeight;
        });
        await expect
          .poll(() => canvas.evaluate(element => element.scrollTop))
          .toBeGreaterThan(0);
        expect(await toolbar.boundingBox()).toEqual(toolbarBefore);
        expect(await page.evaluate(() => window.scrollY)).toBe(pageScroll);
        expect(
          await canvas.evaluate(
            element => element.scrollWidth <= element.clientWidth
          )
        ).toBe(true);
        const close = dialog.getByRole('button', { name: '큰 화면 닫기' });
        await expect(close).toBeInViewport();
        const closeBounds = (await close.boundingBox())!;
        expect(closeBounds.width).toBeGreaterThanOrEqual(44);
        expect(closeBounds.height).toBeGreaterThanOrEqual(44);
        if (mode === '더 생각해보기') {
          const question = dialog.getByRole('textbox', {
            name: '이 카드에 이어서 질문하기',
          });
          await question.fill('팝업을 닫아도 질문 유지');
          await expect(question).toBeInViewport();
          await page.keyboard.press('Escape');
          await expect(panel.getByRole('textbox').first()).toHaveValue(
            '팝업을 닫아도 질문 유지'
          );
        } else {
          await close.click();
        }
        await expect(dialog).toHaveCount(0);
        await expect(trigger).toBeFocused();
        await expect(panel).toBeVisible();
        if (scenario.theme === 'terminal') {
          await expect(page.locator('ai-memo-pad #launcher')).toBeVisible();
        }
      }
      await panel.getByRole('button', { name: /더 생각해보기/ }).click();
      await panel
        .getByRole('button', { name: /크게 보기/ })
        .first()
        .click();
      await expect(page.getByRole('dialog')).toHaveCSS('opacity', '1');
      if (scenario.mobile) {
        const height = scenario.height - 120;
        await page.setViewportSize({ width: scenario.width, height });
        await expect.poll(() => page.getByRole('dialog').boundingBox()).toEqual({
          x: 0,
          y: 0,
          width: scenario.width,
          height,
        });
        await page.setViewportSize({
          width: scenario.width,
          height: scenario.height,
        });
        await expect.poll(() => page.getByRole('dialog').boundingBox()).toEqual({
          x: 0,
          y: 0,
          width: scenario.width,
          height: scenario.height,
        });
      }
      await page.screenshot({
        path: `verification-screenshots/sentio-paper-${scenario.theme}-${scenario.width}x${scenario.height}.png`,
      });
    });
  });
}

// Component fixtures need source modules even when the main suite uses a built preview.
const markdownTest = test.extend<{}, { markdownOrigin: string }>({
  markdownOrigin: [async ({}, use) => {
    const { createServer } = await import('vite');
    const server = await createServer({
      root: fileURLToPath(new URL('..', import.meta.url)),
      configFile: fileURLToPath(new URL('../config/vite.config.ts', import.meta.url)),
      server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false },
    });
    try {
      await server.listen();
      await use(server.resolvedUrls!.local[0]);
    } finally {
      await server.close();
    }
  }, { scope: 'worker' }],
});

for (const width of [390, 1280]) {
  markdownTest(`markdown list flow ${width}px preserves inline prose and raw bullets`, async ({ page, markdownOrigin }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(new URL('/e2e/fixtures/sentio-markdown.html', markdownOrigin).href);
    const rich = page.getByTestId('rich');
    const items = rich.locator('li');
    await expect(items).toHaveCount(4);
    for (const item of await items.all()) {
      await expect(item).toHaveCSS('display', 'list-item');
    }
    await expect(rich.locator('ul').first()).toHaveCSS('list-style-type', 'disc');
    await expect(rich.locator('ol')).toHaveCSS('list-style-type', 'decimal');
    const code = rich.locator('code');
    await expect(code).toHaveCount(8);
    for (const inline of await code.all()) {
      await expect(inline).toHaveCSS('display', 'inline');
      const geometry = await inline.evaluate(element => ({
        height: element.getBoundingClientRect().height,
        lineHeight: parseFloat(getComputedStyle(element.parentElement!).lineHeight),
      }));
      // Tokens can wrap with prose, but must not stretch to the entire item's height.
      expect(geometry.height).toBeLessThan(geometry.lineHeight * 3);
    }
    const paragraphs = rich.locator('ul > li > p');
    await expect(paragraphs).toHaveCount(2);
    const first = (await paragraphs.nth(0).boundingBox())!;
    const second = (await paragraphs.nth(1).boundingBox())!;
    expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);
    const raw = page.locator('[data-card-id="raw"] > ul > li');
    await expect(raw).toHaveCSS('display', 'flex');
    expect(await raw.evaluate(element => getComputedStyle(element, '::before').width)).toBe('4px');
    expect(await rich.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  });
}
