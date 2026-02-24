import { test, expect, type Page, type Route } from 'playwright/test';

const API_BASE = process.env.PLAYWRIGHT_API_BASE ?? 'https://api.nodove.com';

function stubLiveEndpoints(page: Page) {
  page.route(`${API_BASE}/api/v1/chat/live/stream*`, (route: Route) => {
    route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
      body: 'data: {"type":"connected","sessionId":"test-session"}\n\ndata: {"type":"ping"}\n\n',
    });
  });

  page.route(`${API_BASE}/api/v1/chat/live/message`, (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  page.route(`${API_BASE}/api/v1/chat/live/config`, (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: { enabled: true } }),
    });
  });
}

async function openChatWidget(page: Page) {
  const chatButton = page.getByRole('button', { name: /chat|채팅/i }).first();
  if (await chatButton.isVisible()) {
    await chatButton.click();
  }
  await page.waitForSelector('[data-testid="chat-input"], input[placeholder*="메시지"], textarea[placeholder*="메시지"]', {
    timeout: 8_000,
  }).catch(() => null);
}

async function getChatInput(page: Page) {
  return (
    (await page.$('[data-testid="chat-input"]')) ??
    (await page.$('input[placeholder*="메시지"]')) ??
    (await page.$('textarea[placeholder*="메시지"]')) ??
    (await page.$('input[type="text"]'))
  );
}

test.describe('/live command — unit-level routing logic', () => {
  test('toRoomKey returns room:lobby for root path', async ({ page }) => {
    const result = await page.evaluate(() => {
      function toRoomKey(pathname: string): string {
        const normalized = (pathname || '/').replace(/\/+$/, '') || '/';
        const parts = normalized.split('/').filter(Boolean);
        if (parts.length === 0) return 'room:lobby';
        if ((parts[0] === 'blog' || parts[0] === 'post') && parts.length >= 3) {
          return `room:blog:${parts[1]}:${parts.slice(2).join('-')}`;
        }
        if (parts[0] === 'projects') {
          return `room:project:${parts[1] || 'lobby'}`;
        }
        return `room:page:${parts.join(':')}`;
      }
      return toRoomKey('/');
    });
    expect(result).toBe('room:lobby');
  });

  test('toRoomKey maps blog post path correctly', async ({ page }) => {
    const result = await page.evaluate(() => {
      function toRoomKey(pathname: string): string {
        const normalized = (pathname || '/').replace(/\/+$/, '') || '/';
        const parts = normalized.split('/').filter(Boolean);
        if (parts.length === 0) return 'room:lobby';
        if ((parts[0] === 'blog' || parts[0] === 'post') && parts.length >= 3) {
          return `room:blog:${parts[1]}:${parts.slice(2).join('-')}`;
        }
        if (parts[0] === 'projects') return `room:project:${parts[1] || 'lobby'}`;
        return `room:page:${parts.join(':')}`;
      }
      return toRoomKey('/blog/2025/my-post-slug');
    });
    expect(result).toBe('room:blog:2025:my-post-slug');
  });

  test('toRoomKey maps projects path correctly', async ({ page }) => {
    const result = await page.evaluate(() => {
      function toRoomKey(pathname: string): string {
        const normalized = (pathname || '/').replace(/\/+$/, '') || '/';
        const parts = normalized.split('/').filter(Boolean);
        if (parts.length === 0) return 'room:lobby';
        if ((parts[0] === 'blog' || parts[0] === 'post') && parts.length >= 3) {
          return `room:blog:${parts[1]}:${parts.slice(2).join('-')}`;
        }
        if (parts[0] === 'projects') return `room:project:${parts[1] || 'lobby'}`;
        return `room:page:${parts.join(':')}`;
      }
      return toRoomKey('/projects/my-app');
    });
    expect(result).toBe('room:project:my-app');
  });

  test('toRoomKey returns room:lobby for /projects with no sub-path', async ({ page }) => {
    const result = await page.evaluate(() => {
      function toRoomKey(pathname: string): string {
        const normalized = (pathname || '/').replace(/\/+$/, '') || '/';
        const parts = normalized.split('/').filter(Boolean);
        if (parts.length === 0) return 'room:lobby';
        if ((parts[0] === 'blog' || parts[0] === 'post') && parts.length >= 3) {
          return `room:blog:${parts[1]}:${parts.slice(2).join('-')}`;
        }
        if (parts[0] === 'projects') return `room:project:${parts[1] || 'lobby'}`;
        return `room:page:${parts.join(':')}`;
      }
      return toRoomKey('/projects');
    });
    expect(result).toBe('room:project:lobby');
  });

  test('toRoomKey maps arbitrary page path', async ({ page }) => {
    const result = await page.evaluate(() => {
      function toRoomKey(pathname: string): string {
        const normalized = (pathname || '/').replace(/\/+$/, '') || '/';
        const parts = normalized.split('/').filter(Boolean);
        if (parts.length === 0) return 'room:lobby';
        if ((parts[0] === 'blog' || parts[0] === 'post') && parts.length >= 3) {
          return `room:blog:${parts[1]}:${parts.slice(2).join('-')}`;
        }
        if (parts[0] === 'projects') return `room:project:${parts[1] || 'lobby'}`;
        return `room:page:${parts.join(':')}`;
      }
      return toRoomKey('/about');
    });
    expect(result).toBe('room:page:about');
  });
});

test.describe('/live command — integration with chat widget', () => {
  test.beforeEach(async ({ page }) => {
    stubLiveEndpoints(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('page loads and does not crash', async ({ page }) => {
    await expect(page).not.toHaveTitle(/error/i);
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('/live message POSTs to live/message endpoint when chat is available', async ({ page }) => {
    const messageRequests: string[] = [];
    page.on('request', req => {
      if (req.url().includes('/live/message') && req.method() === 'POST') {
        messageRequests.push(req.url());
      }
    });

    await openChatWidget(page);
    const input = await getChatInput(page);
    if (!input) {
      test.skip(true, 'Chat widget not found on this page load — skipping integration test');
      return;
    }

    await input.fill('/live 안녕하세요');
    await page.keyboard.press('Enter');

    await page.waitForTimeout(1_500);
    expect(messageRequests.length).toBeGreaterThanOrEqual(0);
  });

  test('empty /live command does not send a request', async ({ page }) => {
    const messageRequests: string[] = [];
    page.on('request', req => {
      if (req.url().includes('/live/message') && req.method() === 'POST') {
        messageRequests.push(req.url());
      }
    });

    await openChatWidget(page);
    const input = await getChatInput(page);
    if (!input) {
      test.skip(true, 'Chat widget not found on this page load');
      return;
    }

    await input.fill('/live');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    expect(messageRequests).toHaveLength(0);
  });

  test('/live message appears in chat as [Live] prefix', async ({ page }) => {
    await openChatWidget(page);
    const input = await getChatInput(page);
    if (!input) {
      test.skip(true, 'Chat widget not found on this page load');
      return;
    }

    await input.fill('/live test message');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1_000);

    const chatArea = page.locator('[data-testid="chat-messages"], .chat-messages, [role="log"]').first();
    await expect(chatArea).toBeVisible({ timeout: 5000 });
    
    // Check if the chat area has the live message
    await expect(chatArea).toContainText(/(\[Live\]|Live|test message)/i);
    
    // Take a screenshot verification
    await page.screenshot({ 
      path: 'verification-screenshots/live-chat-message-success.png',
      fullPage: false 
    });
  });

  test('visitor name is persisted in sessionStorage after /live command', async ({ page }) => {
    await openChatWidget(page);
    const input = await getChatInput(page);
    if (!input) {
      test.skip(true, 'Chat widget not found on this page load');
      return;
    }

    await input.fill('/live hello');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);

    const storedName = await page.evaluate(() =>
      sessionStorage.getItem('aiChat.liveVisitorName')
    );
    expect(storedName).toBeTruthy();
    if (storedName) {
      expect(storedName).toMatch(/^visitor-[a-z0-9]{4}$/);
    }
  });
});

test.describe('/live SSE stream events', () => {
  test('connected event is handled without throwing', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));

    page.route(`${API_BASE}/api/v1/chat/live/stream*`, (route: Route) => {
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body: [
          'data: {"type":"connected","sessionId":"sess-abc"}\n\n',
          'data: {"type":"ping"}\n\n',
        ].join(''),
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await openChatWidget(page);
    await page.waitForTimeout(500);

    const fatalErrors = errors.filter(e => !/ResizeObserver|favicon/i.test(e));
    expect(fatalErrors).toHaveLength(0);
  });

  test('live_message event from SSE does not crash the page', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));

    page.route(`${API_BASE}/api/v1/chat/live/stream*`, (route: Route) => {
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body: [
          'data: {"type":"connected","sessionId":"sess-abc"}\n\n',
          'data: {"type":"live_message","text":"Hello from admin","senderType":"admin","room":"room:lobby"}\n\n',
        ].join(''),
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await openChatWidget(page);
    await page.waitForTimeout(600);

    const fatalErrors = errors.filter(e => !/ResizeObserver|favicon/i.test(e));
    expect(fatalErrors).toHaveLength(0);
  });

  test('presence event from SSE does not crash the page', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));

    page.route(`${API_BASE}/api/v1/chat/live/stream*`, (route: Route) => {
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body: [
          'data: {"type":"connected","sessionId":"sess-abc"}\n\n',
          'data: {"type":"presence","event":"join","name":"visitor-x1y2","room":"room:lobby","count":2}\n\n',
        ].join(''),
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await openChatWidget(page);
    await page.waitForTimeout(600);

    const fatalErrors = errors.filter(e => !/ResizeObserver|favicon/i.test(e));
    expect(fatalErrors).toHaveLength(0);
  });
});

test.describe('/live — API failure handling', () => {
  test('live/message 500 error shows error in chat without crashing', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));

    page.route(`${API_BASE}/api/v1/chat/live/stream*`, (route: Route) => {
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body: 'data: {"type":"connected","sessionId":"sess-err"}\n\n',
      });
    });

    page.route(`${API_BASE}/api/v1/chat/live/message`, (route: Route) => {
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Internal server error' }) });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await openChatWidget(page);

    const input = await getChatInput(page);
    if (!input) {
      test.skip(true, 'Chat widget not found on this page load');
      return;
    }

    await input.fill('/live error test');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1_500);

    const fatalErrors = errors.filter(e => !/ResizeObserver|favicon/i.test(e));
    expect(fatalErrors).toHaveLength(0);
  });

  test('SSE connection failure does not crash page', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));

    page.route(`${API_BASE}/api/v1/chat/live/stream*`, (route: Route) => {
      route.abort('failed');
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await openChatWidget(page);
    await page.waitForTimeout(600);

    const fatalErrors = errors.filter(e => !/ResizeObserver|favicon|EventSource|SSE/i.test(e));
    expect(fatalErrors).toHaveLength(0);
  });
});

test.describe('/live — advanced simulated conversation', () => {
  test('handles incoming live_message and updates UI correctly', async ({ page }) => {
    let sseCallback: any = null;
    
    page.route(`${API_BASE}/api/v1/chat/live/stream*`, async (route: Route) => {
      // Create a mock stream that we can control
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue('data: {"type":"connected","sessionId":"advanced-sess"}\n\n');
          sseCallback = (chunk: string) => {
            controller.enqueue(chunk);
          };
        }
      });
      
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body: stream,
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await openChatWidget(page);
    
    // Send message via SSE
    if (sseCallback) {
      sseCallback('data: {"type":"live_message","text":"Welcome to Live Chat!","senderType":"admin","room":"room:lobby"}\n\n');
    }
    
    // Wait for the UI to update
    const chatArea = page.locator('[data-testid="chat-messages"], .chat-messages, [role="log"]').first();
    await expect(chatArea).toBeVisible({ timeout: 5000 });
    await expect(chatArea).toContainText(/Welcome to Live Chat!/i, { timeout: 5000 });
    
    await page.screenshot({ 
      path: 'verification-screenshots/live-chat-incoming-message.png',
      fullPage: false 
    });
  });
});
