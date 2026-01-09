#!/usr/bin/env node
/**
 * E2E Test Script using Playwright
 * Tests all major features of the blog frontend
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:8080';
const SCREENSHOTS_ENABLED =
  process.env.E2E_SCREENSHOTS === '1' || process.argv.includes('--screenshots');
const THEME = process.env.E2E_THEME || '';
const LANGUAGE = process.env.E2E_LANGUAGE || '';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-');
const SCREENSHOTS_DIR =
  process.env.E2E_SCREENSHOTS_DIR ||
  path.resolve(__dirname, '..', 'screenshots', 'e2e-mobile', RUN_ID);

// Test results collector
const results = [];
function log(status, test, message = '') {
  const icon = status === 'PASS' ? '\x1b[32m✓\x1b[0m' : status === 'FAIL' ? '\x1b[31m✗\x1b[0m' : '\x1b[33m⚠\x1b[0m';
  console.log(`${icon} ${test}${message ? `: ${message}` : ''}`);
  results.push({ status, test, message });
}

function safeFilename(name) {
  const base = (name || '')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 120);
  return base || 'screenshot';
}

async function screenshot(page, name) {
  if (!SCREENSHOTS_ENABLED) return;
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  const filePath = path.join(SCREENSHOTS_DIR, `${safeFilename(name)}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`Screenshot: ${filePath}`);
}

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('\n\x1b[36m=== E2E Tests Starting ===\x1b[0m\n');
  console.log(`Base URL: ${BASE_URL}\n`);

  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const contextOptions = {
    viewport: SCREENSHOTS_ENABLED
      ? { width: 390, height: 844 }
      : { width: 1280, height: 800 },
    userAgent: SCREENSHOTS_ENABLED
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) E2E-Test',
    reducedMotion: 'reduce',
  };
  if (SCREENSHOTS_ENABLED) {
    contextOptions.deviceScaleFactor = 2;
    contextOptions.isMobile = true;
    contextOptions.hasTouch = true;
  }
  const context = await browser.newContext(contextOptions);

  if (SCREENSHOTS_ENABLED) {
    await context.addInitScript(
      ({ theme, language }) => {
        try {
          localStorage.setItem('aiMemo.fab.enabled', 'true');
        } catch {}
        try {
          if (theme) localStorage.setItem('theme', theme);
        } catch {}
        try {
          if (language) localStorage.setItem('site.language', language);
        } catch {}
      },
      { theme: THEME, language: LANGUAGE }
    );
  }
  
  const page = await context.newPage();

  try {
    // ========================================
    // 1. Home Page (Index)
    // ========================================
    console.log('\x1b[34m--- Home Page Tests ---\x1b[0m');
    
    try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
      log('PASS', 'Home page loads');
      await screenshot(page, 'home');
    } catch (e) {
      log('FAIL', 'Home page loads', e.message);
    }

    if (SCREENSHOTS_ENABLED) {
      try {
        const menuButton = page.locator('button[aria-label="Toggle main menu"]').first();
        if (await menuButton.isVisible()) {
          await menuButton.click();
          await wait(400);
          await screenshot(page, 'home-menu-open');
          await menuButton.click();
          await wait(200);
        }
      } catch {}

      try {
        const settingsButton = page.locator('button[aria-label="설정"]').first();
        if (await settingsButton.isVisible()) {
          await settingsButton.click();
          await wait(300);
          await screenshot(page, 'home-settings-open');
          await page.keyboard.press('Escape');
          await wait(200);
        }
      } catch {}
    }

    // Check header exists
    try {
      const header = await page.locator('header').first();
      await header.waitFor({ state: 'visible', timeout: 5000 });
      log('PASS', 'Header is visible');
    } catch (e) {
      log('FAIL', 'Header is visible', e.message);
    }

    // Check footer exists
    try {
      const footer = await page.locator('footer').first();
      await footer.waitFor({ state: 'attached', timeout: 5000 });
      log('PASS', 'Footer is present');
    } catch (e) {
      log('FAIL', 'Footer is present', e.message);
    }

    // ========================================
    // 2. Blog Page
    // ========================================
    console.log('\n\x1b[34m--- Blog Page Tests ---\x1b[0m');
    
    try {
      await page.goto(`${BASE_URL}/#/blog`, { waitUntil: 'networkidle', timeout: 30000 });
      await wait(1000);
      log('PASS', 'Blog page loads');
      await screenshot(page, 'blog');
    } catch (e) {
      log('FAIL', 'Blog page loads', e.message);
    }

    if (SCREENSHOTS_ENABLED) {
      try {
        const moreTagsBtn = page.getByRole('button', { name: /More tags/i }).first();
        if (await moreTagsBtn.isVisible()) {
          await moreTagsBtn.click();
          await wait(500);
          await screenshot(page, 'blog-tags-open');
          await page.keyboard.press('Escape');
          await wait(200);
        }
      } catch {}
    }

    // Check for blog posts list
    try {
      // Wait for some content to appear
      await page.waitForSelector('main', { timeout: 5000 });
      const mainContent = await page.locator('main').textContent();
      if (mainContent && mainContent.length > 50) {
        log('PASS', 'Blog page has content');
      } else {
        log('WARN', 'Blog page has content', 'Content seems minimal');
      }
    } catch (e) {
      log('FAIL', 'Blog page has content', e.message);
    }

    // ========================================
    // 3. Blog Post Page
    // ========================================
    console.log('\n\x1b[34m--- Blog Post Tests ---\x1b[0m');
    
    try {
      // Navigate to a specific post (using common test post)
      await page.goto(`${BASE_URL}/#/blog/2025/latest`, { waitUntil: 'networkidle', timeout: 30000 });
      await wait(1500);
      
      // Check if post content loaded
      const article = await page.locator('article, main').first();
      await article.waitFor({ state: 'visible', timeout: 5000 });
      log('PASS', 'Blog post page loads');
      await screenshot(page, 'blog-post');
    } catch (e) {
      log('FAIL', 'Blog post page loads', e.message);
    }

    if (SCREENSHOTS_ENABLED) {
      try {
        await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
        await wait(800);
        await screenshot(page, 'home-after-visit');

        const chatButton = page
          .locator('button[aria-label="채팅"], button[aria-label="Chat"]')
          .first();
        if (await chatButton.isVisible()) {
          await chatButton.click();
          await wait(800);
          await screenshot(page, 'home-chat-open');
          const closeButton = page
            .locator(
              'button[aria-label*="close" i], button[aria-label*="Close" i], button[aria-label*="닫기" i]'
            )
            .first();
          if (await closeButton.isVisible()) {
            await closeButton.click();
            await wait(300);
          } else {
            await page.keyboard.press('Escape');
            await wait(300);
          }
        }

        await page.evaluate(() => {
          try {
            window.dispatchEvent(new CustomEvent('visitedposts:open'));
          } catch {}
        });
        await wait(600);
        await screenshot(page, 'home-visited-open');
        await page.keyboard.press('Escape');
        await wait(300);
      } catch {}
    }

    // ========================================
    // 4. About Page
    // ========================================
    console.log('\n\x1b[34m--- About Page Tests ---\x1b[0m');
    
    try {
      await page.goto(`${BASE_URL}/#/about`, { waitUntil: 'networkidle', timeout: 30000 });
      await wait(1000);
      log('PASS', 'About page loads');
      await screenshot(page, 'about');
    } catch (e) {
      log('FAIL', 'About page loads', e.message);
    }

    // ========================================
    // 5. Contact Page
    // ========================================
    console.log('\n\x1b[34m--- Contact Page Tests ---\x1b[0m');
    
    try {
      await page.goto(`${BASE_URL}/#/contact`, { waitUntil: 'networkidle', timeout: 30000 });
      await wait(1000);
      log('PASS', 'Contact page loads');
      await screenshot(page, 'contact');
    } catch (e) {
      log('FAIL', 'Contact page loads', e.message);
    }

    // ========================================
    // 6. Insight Page
    // ========================================
    console.log('\n\x1b[34m--- Insight Page Tests ---\x1b[0m');
    
    try {
      await page.goto(`${BASE_URL}/#/insight`, { waitUntil: 'networkidle', timeout: 30000 });
      await wait(1500);
      log('PASS', 'Insight page loads');
      await screenshot(page, 'insight');
    } catch (e) {
      log('FAIL', 'Insight page loads', e.message);
    }

    if (SCREENSHOTS_ENABLED) {
      try {
        await page.goto(`${BASE_URL}/#/admin/new-post`, { waitUntil: 'networkidle', timeout: 30000 });
        await wait(1200);
        await screenshot(page, 'admin-new-post');
      } catch {}
      try {
        await page.goto(`${BASE_URL}/#/admin/config`, { waitUntil: 'networkidle', timeout: 30000 });
        await wait(1200);
        await screenshot(page, 'admin-config');
      } catch {}
      try {
        await page.goto(`${BASE_URL}/#/non-existent-page-12345`, { waitUntil: 'networkidle', timeout: 30000 });
        await wait(800);
        await screenshot(page, 'not-found');
      } catch {}
    }

    // ========================================
    // 7. Floating Action Bar (FAB)
    // ========================================
    console.log('\n\x1b[34m--- Floating Action Bar Tests ---\x1b[0m');
    
    // Go back to home for FAB tests
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await wait(1000);
    
    // Check FAB toolbar exists
    try {
      const fabToolbar = await page.locator('[role="toolbar"][aria-label="Floating actions"]').first();
      await fabToolbar.waitFor({ state: 'visible', timeout: 5000 });
      log('PASS', 'FAB toolbar is visible');
    } catch (e) {
      log('WARN', 'FAB toolbar is visible', 'FAB may be disabled or hidden');
    }

    // Test Chat button
    try {
      const chatButton = await page.locator('button[aria-label="Chat"]').first();
      if (await chatButton.isVisible()) {
        await chatButton.click();
        await wait(500);
        
        // Check if chat widget opened (look for chat-related elements)
        const chatWidget = await page.locator('[class*="chat"], [class*="Chat"]').first();
        await chatWidget.waitFor({ state: 'visible', timeout: 3000 });
        log('PASS', 'Chat widget opens');
        
        // Close chat if possible
        const closeButton = await page.locator('button[aria-label*="close" i], button[aria-label*="Close" i]').first();
        if (await closeButton.isVisible()) {
          await closeButton.click();
          await wait(500);
        }
      } else {
        log('WARN', 'Chat widget opens', 'Chat button not visible');
      }
    } catch (e) {
      log('WARN', 'Chat widget opens', e.message);
    }

    // ========================================
    // 8. Theme Toggle
    // ========================================
    console.log('\n\x1b[34m--- Theme Tests ---\x1b[0m');
    
    try {
      // Look for theme toggle button in header
      const themeButton = await page.locator('button[aria-label*="theme" i], button[aria-label*="Theme" i], button[aria-label*="mode" i]').first();
      if (await themeButton.isVisible()) {
        const initialClasses = await page.locator('html').getAttribute('class');
        await themeButton.click();
        await wait(500);
        const newClasses = await page.locator('html').getAttribute('class');
        
        if (initialClasses !== newClasses) {
          log('PASS', 'Theme toggle works');
        } else {
          log('WARN', 'Theme toggle works', 'Classes did not change');
        }
      } else {
        log('WARN', 'Theme toggle works', 'Theme button not found');
      }
    } catch (e) {
      log('WARN', 'Theme toggle works', e.message);
    }

    // ========================================
    // 9. Navigation
    // ========================================
    console.log('\n\x1b[34m--- Navigation Tests ---\x1b[0m');
    
    try {
      // Test navigation links in header
      const navLinks = await page.locator('header nav a, header a').all();
      if (navLinks.length > 0) {
        log('PASS', 'Navigation links exist', `Found ${navLinks.length} links`);
      } else {
        log('WARN', 'Navigation links exist', 'No nav links found');
      }
    } catch (e) {
      log('FAIL', 'Navigation links exist', e.message);
    }

    // ========================================
    // 10. 404 Page
    // ========================================
    console.log('\n\x1b[34m--- 404 Page Tests ---\x1b[0m');
    
    try {
      await page.goto(`${BASE_URL}/#/non-existent-page-12345`, { waitUntil: 'networkidle', timeout: 30000 });
      await wait(1000);
      
      const pageContent = await page.locator('main').first().textContent();
      if (pageContent && (pageContent.includes('404') || pageContent.toLowerCase().includes('not found'))) {
        log('PASS', '404 page shows correctly');
      } else {
        log('WARN', '404 page shows correctly', 'Page loaded but 404 message not found');
      }
    } catch (e) {
      log('FAIL', '404 page shows correctly', e.message);
    }

    // ========================================
    // 11. Responsive Check (Mobile)
    // ========================================
    console.log('\n\x1b[34m--- Mobile Responsive Tests ---\x1b[0m');
    
    try {
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE size
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
      await wait(1000);
      
      // Check if content is still visible
      const mainContent = await page.locator('main').first();
      await mainContent.waitFor({ state: 'visible', timeout: 5000 });
      log('PASS', 'Mobile viewport renders');
    } catch (e) {
      log('FAIL', 'Mobile viewport renders', e.message);
    }

    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 800 });

    // ========================================
    // 12. Performance Check
    // ========================================
    console.log('\n\x1b[34m--- Performance Tests ---\x1b[0m');
    
    try {
      const startTime = Date.now();
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const loadTime = Date.now() - startTime;
      
      if (loadTime < 3000) {
        log('PASS', 'Page load time', `${loadTime}ms`);
      } else if (loadTime < 5000) {
        log('WARN', 'Page load time', `${loadTime}ms (slow)`);
      } else {
        log('FAIL', 'Page load time', `${loadTime}ms (too slow)`);
      }
    } catch (e) {
      log('FAIL', 'Page load time', e.message);
    }

    // ========================================
    // 13. Console Errors Check
    // ========================================
    console.log('\n\x1b[34m--- Console Errors Check ---\x1b[0m');
    
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await wait(2000);
    
    if (consoleErrors.length === 0) {
      log('PASS', 'No console errors');
    } else {
      log('WARN', 'Console errors found', `${consoleErrors.length} errors`);
      consoleErrors.slice(0, 3).forEach(err => console.log(`   - ${err.slice(0, 100)}`));
    }

  } catch (error) {
    console.error('\n\x1b[31mTest execution error:\x1b[0m', error.message);
  } finally {
    await browser.close();
  }

  // ========================================
  // Summary
  // ========================================
  console.log('\n\x1b[36m=== Test Summary ===\x1b[0m\n');
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warned = results.filter(r => r.status === 'WARN').length;
  
  console.log(`\x1b[32m  Passed: ${passed}\x1b[0m`);
  console.log(`\x1b[31m  Failed: ${failed}\x1b[0m`);
  console.log(`\x1b[33m  Warnings: ${warned}\x1b[0m`);
  console.log(`  Total: ${results.length}\n`);

  if (failed > 0) {
    console.log('\x1b[31mFailed tests:\x1b[0m');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  - ${r.test}: ${r.message}`);
    });
    console.log('');
  }

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
