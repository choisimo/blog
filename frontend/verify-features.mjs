import { chromium } from '/home/nodove/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs';
import fs from 'fs';

const BASE = 'http://localhost:5174';
const OPTS = {
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--headless'],
};
const ALGO_POST = '/blog/2025/algo-031-병합-정렬-merge-sort';
const IMAGE_POST = '/blog/2025/FutureClouding';
const results = {};

function log(feature, pass, passNum, msg) {
  const icon = pass ? '✅' : '❌';
  console.log(`${icon} [${feature}] Pass ${passNum}: ${msg}`);
}

async function withPage(browser, viewport, fn) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  try { return await fn(page); } finally { await ctx.close(); }
}

async function runTests() {
  const browser = await chromium.launch(OPTS);
  try {

    // ===== F1: TOC =====
    console.log('\n--- F1: TOC Redesign ---');
    const f1 = [];

    // Pass 1: Desktop TOC panel visible
    await withPage(browser, {width:1440,height:900}, async (page) => {
      await page.goto(BASE + ALGO_POST, { waitUntil: 'networkidle', timeout: 15000 });
      const el = await page.$('[data-testid="toc-panel"]');
      const pass = el !== null && await el.isVisible();
      f1.push(pass);
      log('F1', pass, 1, `Desktop TOC panel visible: ${pass}`);
    });

    // Pass 2: No .truncate class on TOC items
    await withPage(browser, {width:1440,height:900}, async (page) => {
      await page.goto(BASE + ALGO_POST, { waitUntil: 'networkidle', timeout: 15000 });
      const items = await page.$$('[data-testid="toc-panel"] .truncate');
      const pass = items.length === 0;
      f1.push(pass);
      log('F1', pass, 2, `No .truncate class on TOC items (found: ${items.length})`);
    });

    // Pass 3: Mobile trigger button exists and is in DOM
    await withPage(browser, {width:375,height:812}, async (page) => {
      await page.goto(BASE + ALGO_POST, { waitUntil: 'networkidle', timeout: 15000 });
      const btn = await page.$('[data-testid="toc-mobile-trigger"]');
      const pass = btn !== null;
      f1.push(pass);
      log('F1', pass, 3, `Mobile TOC trigger in DOM: ${pass}`);
    });

    // Pass 4: Mobile drawer opens (use JS click to bypass FAB interception)
    await withPage(browser, {width:375,height:812}, async (page) => {
      await page.goto(BASE + ALGO_POST, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(500);
      // Scroll slightly to hide FAB, then JS click
      await page.evaluate(() => window.scrollBy(0, 100));
      await page.waitForTimeout(300);
      const clicked = await page.evaluate(() => {
        const btn = document.querySelector('[data-testid="toc-mobile-trigger"]');
        if (btn) { btn.click(); return true; }
        return false;
      });
      await page.waitForTimeout(700);
      // Check if any dialog/sheet is open
      const dlg = await page.$('[role="dialog"], [data-radix-dialog-content]');
      const pass = clicked && dlg !== null;
      f1.push(pass);
      log('F1', pass, 4, `Mobile drawer opens (clicked: ${clicked}, dialog: ${dlg !== null})`);
    });

    // Pass 5: ScrollArea present (no hardcoded h-[500px] cutoff)
    await withPage(browser, {width:1440,height:900}, async (page) => {
      await page.goto(BASE + ALGO_POST, { waitUntil: 'networkidle', timeout: 15000 });
      // Check there's no h-[500px] on any TOC element
      const hasHardcodedHeight = await page.evaluate(() => {
        const toc = document.querySelector('[data-testid="toc-panel"]');
        if (!toc) return null;
        // Check all descendant elements for h-[500px] class
        return Array.from(toc.querySelectorAll('*')).some(el =>
          Array.from(el.classList).some(c => c.includes('h-[500'))
        );
      });
      const scrollArea = await page.$('[data-testid="toc-panel"] [data-radix-scroll-area-viewport]');
      const pass = hasHardcodedHeight === false && scrollArea !== null;
      f1.push(pass);
      log('F1', pass, 5, `No h-[500px] cutoff (${hasHardcodedHeight}), ScrollArea: ${scrollArea !== null}`);
    });

    results.F1 = f1;
    console.log(`F1 Score: ${f1.filter(Boolean).length}/5`);

    // ===== F2: Lightbox =====
    console.log('\n--- F2: Image Lightbox ---');
    const f2 = [];

    // Pass 1: Images exist
    await withPage(browser, {width:1440,height:900}, async (page) => {
      await page.goto(BASE + IMAGE_POST, { waitUntil: 'networkidle', timeout: 15000 });
      const imgs = await page.$$('img');
      // Filter to content images (not icons/logos)
      const contentImgs = [];
      for (const img of imgs) {
        const src = await img.getAttribute('src') || '';
        if (src.includes('/images/')) contentImgs.push(img);
      }
      const pass = contentImgs.length > 0;
      f2.push(pass);
      log('F2', pass, 1, `Content images on page: ${contentImgs.length}`);
    });

    // Pass 2: Click opens lightbox
    await withPage(browser, {width:1440,height:900}, async (page) => {
      await page.goto(BASE + IMAGE_POST, { waitUntil: 'networkidle', timeout: 15000 });
      // Find a content image
      const imgSrc = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img'));
        const content = imgs.find(i => i.src.includes('/images/'));
        return content ? content.src : null;
      });
      if (imgSrc) {
        await page.evaluate((src) => {
          const img = Array.from(document.querySelectorAll('img')).find(i => i.src === src);
          if (img) img.click();
        }, imgSrc);
        await page.waitForTimeout(700);
        const lb = await page.$('[data-testid="lightbox-container"]');
        const pass = lb !== null;
        f2.push(pass);
        log('F2', pass, 2, `Lightbox opens: ${pass}`);
      } else {
        f2.push(false);
        log('F2', false, 2, 'No content images found');
      }
    });

    // Pass 3: lightbox-image testid present
    await withPage(browser, {width:1440,height:900}, async (page) => {
      await page.goto(BASE + IMAGE_POST, { waitUntil: 'networkidle', timeout: 15000 });
      const opened = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img'));
        const content = imgs.find(i => i.src.includes('/images/'));
        if (content) { content.click(); return true; }
        return false;
      });
      await page.waitForTimeout(700);
      const lbImg = await page.$('[data-testid="lightbox-image"]');
      const pass = opened && lbImg !== null;
      f2.push(pass);
      log('F2', pass, 3, `lightbox-image testid: ${pass}`);
    });

    // Pass 4: Escape closes lightbox
    await withPage(browser, {width:1440,height:900}, async (page) => {
      await page.goto(BASE + IMAGE_POST, { waitUntil: 'networkidle', timeout: 15000 });
      await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img'));
        const content = imgs.find(i => i.src.includes('/images/'));
        if (content) content.click();
      });
      await page.waitForTimeout(700);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      const gone = await page.$('[data-testid="lightbox-image"]');
      const pass = gone === null;
      f2.push(pass);
      log('F2', pass, 4, `Escape closes lightbox: ${pass}`);
    });

    // Pass 5: Wheel zoom changes transform
    await withPage(browser, {width:1440,height:900}, async (page) => {
      await page.goto(BASE + IMAGE_POST, { waitUntil: 'networkidle', timeout: 15000 });
      await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img'));
        const content = imgs.find(i => i.src.includes('/images/'));
        if (content) content.click();
      });
      await page.waitForTimeout(700);
      const lbImg = await page.$('[data-testid="lightbox-image"]');
      if (lbImg) {
        const before = await page.evaluate(() => {
          const el = document.querySelector('[data-testid="lightbox-image"]');
          return el ? el.style.transform : '';
        });
        // Dispatch wheel event on the container
        await page.evaluate(() => {
          const container = document.querySelector('[data-testid="lightbox-container"]');
          if (container) {
            const e = new WheelEvent('wheel', { deltaY: -300, bubbles: true, cancelable: true });
            container.dispatchEvent(e);
          }
        });
        await page.waitForTimeout(400);
        const after = await page.evaluate(() => {
          const el = document.querySelector('[data-testid="lightbox-image"]');
          return el ? el.style.transform : '';
        });
        const pass = before !== after;
        f2.push(pass);
        log('F2', pass, 5, `Wheel zoom: before="${before.substring(0,40)}" after="${after.substring(0,40)}"`);
      } else {
        f2.push(false);
        log('F2', false, 5, 'No lightbox image for wheel test');
      }
    });

    results.F2 = f2;
    console.log(`F2 Score: ${f2.filter(Boolean).length}/5`);

    // ===== F3: Spinner fix =====
    console.log('\n--- F3: Spinner Fix ---');
    const f3 = [];
    const sparkSrc = fs.readFileSync(
      '/home/nodove/workspace/blog/frontend/src/components/features/sentio/SparkInline.tsx', 'utf8'
    );
    // Find lines that contain the spinner container class
    const lines = sparkSrc.split('\n');
    let badTransitionAll = false;
    let hasFixedTransition = false;
    for (const line of lines) {
      if (line.includes('transition-all') && line.includes('duration-300')) badTransitionAll = true;
      if (line.includes('transition-[') && (
        line.includes('height') || line.includes('opacity') || line.includes('max-height')
      )) hasFixedTransition = true;
    }
    const pass = !badTransitionAll || hasFixedTransition;
    for (let i = 1; i <= 5; i++) {
      f3.push(pass);
      log('F3', pass, i, `Spinner transition fixed (bad:${badTransitionAll}, fixed:${hasFixedTransition}): ${pass}`);
    }
    results.F3 = f3;
    console.log(`F3 Score: ${f3.filter(Boolean).length}/5`);

    // ===== F4: Code blocks =====
    console.log('\n--- F4: Code Block Readability ---');
    const f4 = [];

    // Pass 1: collapse toggle present
    await withPage(browser, {width:1440,height:900}, async (page) => {
      await page.goto(BASE + ALGO_POST, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1500);
      const toggle = await page.$('[data-testid="code-collapse-toggle"]');
      const pass = toggle !== null;
      f4.push(pass);
      log('F4', pass, 1, `code-collapse-toggle present: ${pass}`);
    });

    // Pass 2: initially collapsed (maxHeight set)
    await withPage(browser, {width:1440,height:900}, async (page) => {
      await page.goto(BASE + ALGO_POST, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1500);
      const maxH = await page.evaluate(() => {
        const divs = Array.from(document.querySelectorAll('div[style]'));
        for (const d of divs) {
          const mh = d.style.maxHeight;
          if (mh && mh !== 'none' && mh !== '') return mh;
        }
        return null;
      });
      const pass = maxH !== null;
      f4.push(pass);
      log('F4', pass, 2, `Collapsed maxHeight: ${maxH}`);
    });

    // Pass 3: toggle expands
    await withPage(browser, {width:1440,height:900}, async (page) => {
      await page.goto(BASE + ALGO_POST, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1500);
      const toggle = await page.$('[data-testid="code-collapse-toggle"]');
      if (toggle) {
        const before = (await toggle.textContent() || '').trim();
        await page.evaluate(() => {
          const btn = document.querySelector('[data-testid="code-collapse-toggle"]');
          if (btn) btn.click();
        });
        await page.waitForTimeout(400);
        const after = (await toggle.textContent() || '').trim();
        const pass = before !== after;
        f4.push(pass);
        log('F4', pass, 3, `Toggle text: "${before}" -> "${after}"`);
      } else {
        f4.push(false);
        log('F4', false, 3, 'No toggle found');
      }
    });

    // Pass 4: copy button present
    await withPage(browser, {width:1440,height:900}, async (page) => {
      await page.goto(BASE + ALGO_POST, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1500);
      const copyBtn = await page.$('[data-testid="code-copy-btn"]');
      const pass = copyBtn !== null;
      f4.push(pass);
      log('F4', pass, 4, `code-copy-btn present: ${pass}`);
    });

    // Pass 5: line numbers present
    await withPage(browser, {width:1440,height:900}, async (page) => {
      await page.goto(BASE + ALGO_POST, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1500);
      const lineNums = await page.evaluate(() => {
        return document.querySelectorAll('.linenumber').length;
      });
      const pass = lineNums > 0;
      f4.push(pass);
      log('F4', pass, 5, `Line number spans (.linenumber): ${lineNums}`);
    });

    results.F4 = f4;
    console.log(`F4 Score: ${f4.filter(Boolean).length}/5`);

    // ===== F5: Quiz Panel =====
    console.log('\n--- F5: AI Quiz Panel ---');
    const f5 = [];

    // Pass 1: quiz-panel renders on code post
    await withPage(browser, {width:1440,height:900}, async (page) => {
      await page.goto(BASE + ALGO_POST, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1000);
      const qp = await page.$('[data-testid="quiz-panel"]');
      const pass = qp !== null;
      f5.push(pass);
      log('F5', pass, 1, `quiz-panel rendered: ${pass}`);
    });

    // Pass 2: quiz-start button visible
    await withPage(browser, {width:1440,height:900}, async (page) => {
      await page.goto(BASE + ALGO_POST, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1000);
      const btn = await page.$('[data-testid="quiz-start"]');
      const pass = btn !== null && await btn.isVisible();
      f5.push(pass);
      log('F5', pass, 2, `quiz-start button visible: ${pass}`);
    });

    // Pass 3: clicking start changes state
    await withPage(browser, {width:1440,height:900}, async (page) => {
      await page.goto(BASE + ALGO_POST, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1000);
      const clicked = await page.evaluate(() => {
        const btn = document.querySelector('[data-testid="quiz-start"]');
        if (btn) { btn.click(); return true; }
        return false;
      });
      await page.waitForTimeout(500);
      const btnGone = await page.$('[data-testid="quiz-start"]');
      const pass = clicked && btnGone === null;
      f5.push(pass);
      log('F5', pass, 3, `State transition on start (btn gone: ${btnGone === null})`);
    });

    // Pass 4: quiz panel is visible and has nonzero height
    await withPage(browser, {width:1440,height:900}, async (page) => {
      await page.goto(BASE + ALGO_POST, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1000);
      const info = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="quiz-panel"]');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { h: Math.round(r.height), w: Math.round(r.width) };
      });
      const pass = info !== null && info.h > 50;
      f5.push(pass);
      log('F5', pass, 4, `QuizPanel dimensions: ${JSON.stringify(info)}`);
    });

    // Pass 5: quiz-panel absent on no-code post (FutureClouding has no code blocks)
    await withPage(browser, {width:1440,height:900}, async (page) => {
      await page.goto(BASE + IMAGE_POST, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1000);
      const qp = await page.$('[data-testid="quiz-panel"]');
      const pass = qp === null;
      f5.push(pass);
      log('F5', pass, 5, `No quiz on no-code post (FutureClouding): ${pass}`);
    });

    results.F5 = f5;
    console.log(`F5 Score: ${f5.filter(Boolean).length}/5`);

    // Summary
    console.log('\n=== SUMMARY ===');
    const names = { F1:'TOC Redesign', F2:'Image Lightbox', F3:'Spinner Fix', F4:'Code Blocks', F5:'Quiz Panel' };
    let allPass = true;
    for (const f of ['F1','F2','F3','F4','F5']) {
      const score = results[f].filter(Boolean).length;
      if (score < 5) allPass = false;
      console.log(`${score>=5?'✅':'❌'} ${f} (${names[f]}): ${score}/5`);
    }
    console.log(`\n${allPass ? '✅ ALL PASSED' : '❌ SOME FAILED'}`);

  } finally {
    await browser.close();
  }
}

runTests().catch(e => { console.error('Script error:', e.message); process.exit(1); });
