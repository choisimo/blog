import { test, expect, type Page } from '@playwright/test';

async function setup(page: Page, baseURL: string, theme: string) {
  const origin = new URL(baseURL).origin;
  await page.addInitScript(
    ({ origin, theme }) => {
      localStorage.setItem('theme', theme);
      localStorage.setItem('site.language', 'ko');
      localStorage.setItem('aiMemo.backendUrl', JSON.stringify(origin));
      localStorage.setItem('aiMemo.fab.enabled', 'true');
      localStorage.setItem(
        'anon.token',
        `fixture.${btoa(
          JSON.stringify({
            sub: 'anon-00000000-0000-0000-0000-000000000001',
            role: 'anonymous',
            tokenClass: 'anonymous',
            type: 'access',
            exp: Math.floor(Date.now() / 1000) + 172800,
          })
        )
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '')}.fixture`
      );
    },
    { origin, theme }
  );
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/v1/public/config')
      return route.fulfill({
        json: {
          ok: true,
          data: {
            apiBaseUrl: origin,
            chatBaseUrl: origin,
            siteBaseUrl: origin,
            features: {
              aiEnabled: true,
              aiInline: true,
              ragEnabled: false,
              commentsEnabled: false,
              codeExecutionEnabled: false,
            },
          },
        },
      });
    if (url.pathname === '/api/v1/chat/session')
      return route.fulfill({ json: { id: 'memo-fixture-session' } });
    if (url.origin !== origin || url.pathname.startsWith('/api/'))
      return route.fulfill({ json: { ok: true, data: {} } });
    return route.continue();
  });
  await page.route('**/posts-manifest.json*', route =>
    route.fulfill({
      json: {
        version: 1,
        total: 1,
        years: ['2026'],
        posts: ['/posts/2026/memo-ai.md'],
        items: [
          {
            path: '/posts/2026/memo-ai.md',
            year: '2026',
            slug: 'memo-ai',
            title: '메모와 함께 읽는 캐시',
            date: '2026-09-12',
            tags: [],
            published: true,
            language: 'ko',
            url: '/blog/2026/memo-ai',
          },
        ],
      },
    })
  );
  await page.route('**/posts/2026/memo-ai.md*', route =>
    route.fulfill({
      contentType: 'text/markdown',
      body: '---\ntitle: 메모와 함께 읽는 캐시\ndate: 2026-09-12\n---\n\n# 캐시의 갱신\n\n캐시는 반복된 읽기를 빠르게 처리합니다. 데이터가 바뀌면 캐시를 갱신해야 합니다.\n',
    })
  );
  await page.routeWebSocket('**/*', socket => socket.close());
  await page.goto('/blog/2026/memo-ai');
  const panel = page.locator('ai-memo-pad #panel');
  await expect(panel).toBeAttached();
  await page.keyboard.press('Alt+m');
  await expect(panel).toBeVisible();
  return panel;
}

for (const scenario of [
  { width: 390, theme: 'light' },
  { width: 1280, theme: 'dark' },
  { width: 390, theme: 'terminal' },
]) {
  test(`memo AI and proposals ${scenario.theme} ${scenario.width}`, async ({
    page,
    baseURL,
  }) => {
    await page.setViewportSize({ width: scenario.width, height: 900 });
    const panel = await setup(page, baseURL!, scenario.theme);
    const requests: Array<{ input: string; instructions: string }> = [];
    let fail = false;
    await page.route('**/api/v1/ai/summarize', async route => {
      requests.push(route.request().postDataJSON());
      await route.fulfill({
        status: fail ? 503 : 200,
        json: fail
          ? { ok: false, error: { code: 'AI_GENERATION_FAILED' } }
          : {
              ok: true,
              data: {
                summary:
                  '## 생성된 분석\n\n- **캐시 갱신**을 확인합니다.\n- 메모와 본문을 함께 분석했습니다.',
              },
            },
      });
    });
    const memo = panel.locator('#memo');
    await memo.fill('내가 작성 중인 **메모**');
    await panel.locator('.memo-format-tools > summary').click();
    await panel.getByRole('button', { name: 'AI 요약', exact: true }).click();
    await expect(memo).toHaveValue(
      /내가 작성 중인 \*\*메모\*\*[\s\S]*생성된 분석/
    );
    await expect(
      panel.locator('#memoPreview strong').filter({ hasText: '캐시 갱신' })
    ).toBeVisible();
    expect(requests[0].input).toContain('내가 작성 중인 **메모**');
    await panel.locator('.memo-format-tools > summary').click();
    await panel.getByRole('button', { name: 'Catalyst', exact: true }).click();
    await panel.locator('#catalystInput').fill('반대 관점과 구체적인 예시');
    fail = true;
    const before = await memo.inputValue();
    await panel.locator('#catalystRun').click();
    await expect(panel.locator('#memoAiFeedback')).toHaveAttribute(
      'data-state',
      'error'
    );
    await expect(memo).toHaveValue(before);
    await expect(panel.locator('#catalystInput')).toHaveValue(
      '반대 관점과 구체적인 예시'
    );
    fail = false;
    await panel.getByRole('button', { name: '다시 생성' }).click();
    await expect(memo).toHaveValue(/## 반대 관점과 구체적인 예시/);
    expect(requests.at(-1)!.instructions).toContain(
      '반대 관점과 구체적인 예시'
    );
    await panel.getByRole('tab', { name: '제안', exact: true }).click();
    await expect(panel.locator('#proposalMd')).toHaveValue(/캐시의 갱신/);
    await panel
      .locator('#proposalMd')
      .fill(
        '# 제안하는 설명\n\n캐시의 **만료 시점**을 예시와 함께 설명합니다.\n\n- 데이터 변경\n- 갱신 전략'
      );
    await panel
      .locator('.proposal-pane-tabs')
      .getByRole('tab', { name: '미리보기', exact: true })
      .click();
    await expect(panel.locator('#proposalPreview h1')).toHaveText(
      '제안하는 설명'
    );
    await expect(panel.locator('#proposalPreview strong')).toHaveText(
      '만료 시점'
    );
    await expect(panel.locator('#proposeNewVersion')).toBeVisible();
    const bounds = await panel.locator('.proposal-workspace').boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(scenario.width + 1);
    expect(
      await panel
        .locator('#devBody')
        .evaluate(e => e.scrollWidth <= e.clientWidth)
    ).toBe(true);
    await page.screenshot({
      path: `verification-screenshots/memo-proposal-${scenario.theme}-${scenario.width}.png`,
    });
  });
}

test('chat shows the live memo under the prompt and sends the displayed snapshot', async ({
  page,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  const panel = await setup(page, baseURL!, 'light');
  await panel.locator('#memo').fill('처음 작성한 메모');
  await panel.locator('#close').click();
  await page
    .locator('.rd-right')
    .getByRole('button', { name: '이 글에 질문하기', exact: true })
    .click();
  const chat = page.locator('.fn-chat-desk');
  const context = chat.getByRole('region', { name: '현재 메모 문맥' });
  await expect(context).toContainText('처음 작성한 메모');
  await page.keyboard.press('Alt+m');
  await panel.locator('#memo').fill('지금 수정한 **캐시 메모**');
  await expect(
    context.locator('strong').filter({ hasText: '캐시 메모' })
  ).toHaveCount(1);
  await panel.locator('#close').click();
  const sent: unknown[] = [];
  await page.route('**/api/v1/chat/**/message', async route => {
    sent.push(route.request().postDataJSON());
    await route.fulfill({
      contentType: 'text/event-stream',
      body: 'data: {"type":"text","text":"메모를 확인했습니다."}\n\ndata: {"type":"done"}\n\n',
    });
  });
  await chat
    .getByRole('textbox', { name: '채팅 메시지 입력' })
    .fill('이 메모를 설명해 주세요');
  await chat.getByRole('button', { name: '메시지 보내기' }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(JSON.stringify(sent[0])).toContain('지금 수정한 **캐시 메모**');
  await expect(
    chat.getByRole('button', { name: '메시지 보내기' })
  ).toBeVisible();
  await context.getByRole('button', { name: '메모 연결 해제' }).click();
  await chat
    .getByRole('textbox', { name: '채팅 메시지 입력' })
    .fill('이제 일반 질문');
  await chat.getByRole('button', { name: '메시지 보내기' }).click();
  await expect.poll(() => sent.length).toBe(2);
  expect(JSON.stringify(sent[1])).not.toContain('지금 수정한 **캐시 메모**');
  await page.screenshot({
    path: 'verification-screenshots/chat-live-memo-1280.png',
  });
});

test('original loading preserves edits made while the response is pending', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  const panel = await setup(page, baseURL!, 'light');
  await panel.getByRole('tab', { name: '제안', exact: true }).click();
  const editor = panel.locator('#proposalMd');
  await expect(editor).toHaveValue(/캐시의 갱신/);
  await editor.fill('원문을 요청하기 전 초안');

  let release!: () => void;
  let started!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const requestStarted = new Promise<void>(resolve => { started = resolve; });
  await page.route('**/posts/2026/memo-ai.md*', async route => {
    started();
    await pending;
    await route.fulfill({ contentType: 'text/markdown', body: '# 늦게 도착한 원문' });
  });
  try {
    await panel.getByRole('button', { name: '원문 불러오기', exact: true }).click();
    await requestStarted;
    const draft = '# 로딩 중 작성한 초안\n\n이 **수정 내용**을 보존해야 합니다.';
    await editor.fill(draft);
    release();
    await expect(panel.locator('#proposalFeedback')).toContainText('덮어쓰지 않았습니다');
    await expect(editor).toHaveValue(draft);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('aiMemo.proposalMd') || 'null'))).toBe(draft);
    await panel.locator('.proposal-pane-tabs').getByRole('tab', { name: '미리보기', exact: true }).click();
    await expect(panel.locator('#proposalPreview h1')).toHaveText('로딩 중 작성한 초안');
  } finally {
    release();
  }
});

test('proposal storage failures remain visible and the preserved draft can be saved after recovery', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  const panel = await setup(page, baseURL!, 'light');
  await panel.getByRole('tab', { name: '제안', exact: true }).click();
  const editor = panel.locator('#proposalMd');
  await expect(editor).toHaveValue(/캐시의 갱신/);
  const persisted = await page.evaluate(() => localStorage.getItem('aiMemo.proposalMd'));
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key: string, value: string) {
      if (key === 'aiMemo.proposalMd') throw new DOMException('Storage full', 'QuotaExceededError');
      return original.call(this, key, value);
    };
    Object.defineProperty(window, 'restoreProposalStorage', {
      configurable: true, value: () => { Storage.prototype.setItem = original; },
    });
  });

  // A successful download must not replace a failed storage message with success.
  await panel.getByRole('button', { name: '원문 불러오기', exact: true }).click();
  const feedback = panel.locator('#proposalFeedback');
  await expect(feedback).toHaveAttribute('data-state', 'error');
  await expect(feedback).toContainText('복사하세요');
  const draft = '# 저장 실패 중에도 유지할 초안\n\n**작성 내용**은 화면에 남아 있어야 합니다.';
  await editor.fill(draft);
  await expect(editor).toHaveValue(draft);
  await expect(feedback).toHaveAttribute('data-state', 'error');
  expect(await page.evaluate(() => localStorage.getItem('aiMemo.proposalMd'))).toBe(persisted);
  await panel.locator('.proposal-pane-tabs').getByRole('tab', { name: '미리보기', exact: true }).click();
  await expect(panel.locator('#proposalPreview h1')).toHaveText('저장 실패 중에도 유지할 초안');

  await page.evaluate(() => (window as Window & { restoreProposalStorage: () => void }).restoreProposalStorage());
  await panel.locator('.proposal-pane-tabs').getByRole('tab', { name: '작성', exact: true }).click();
  const recoveredDraft = `${draft}\n\n저장 연결 복구 후 수정`;
  await editor.fill(recoveredDraft);
  await expect(feedback).toHaveAttribute('data-state', 'saved');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('aiMemo.proposalMd') || 'null'))).toBe(recoveredDraft);
  await page.reload();
  await expect(page.locator('ai-memo-pad #proposalMd')).toHaveValue(recoveredDraft);
});
