const fs = require('fs');

const path = 'frontend/e2e/live-chat.spec.ts';
let code = fs.readFileSync(path, 'utf8');

// 1. Screenshot on successful /live message
code = code.replace(
  /const chatArea = page\.locator\('\[data-testid="chat-messages"\], \.chat-messages, \[role="log"\]'\)\.first\(\);\n\s+if \(await chatArea\.isVisible\(\)\) \{\n\s+const text = await chatArea\.innerText\(\);\n\s+expect\(text\)\.toMatch\(\/\\\[Live\\\]\|Live\|test message\/i\);\n\s+\}/g,
  `const chatArea = page.locator('[data-testid="chat-messages"], .chat-messages, [role="log"]').first();
    await expect(chatArea).toBeVisible({ timeout: 5000 });
    
    // Check if the chat area has the live message
    await expect(chatArea).toContainText(/(\\[Live\\]|Live|test message)/i);
    
    // Take a screenshot verification
    await page.screenshot({ 
      path: 'verification-screenshots/live-chat-message-success.png',
      fullPage: false 
    });`
);

// 2. Add an advanced simulated chat test
code += `
test.describe('/live — advanced simulated conversation', () => {
  test('handles incoming live_message and updates UI correctly', async ({ page }) => {
    let sseCallback: any = null;
    
    page.route(\`\${API_BASE}/api/v1/chat/live/stream*\`, async (route: Route) => {
      // Create a mock stream that we can control
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue('data: {"type":"connected","sessionId":"advanced-sess"}\\n\\n');
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
      sseCallback('data: {"type":"live_message","text":"Welcome to Live Chat!","senderType":"admin","room":"room:lobby"}\\n\\n');
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
`;

fs.writeFileSync(path, code);
