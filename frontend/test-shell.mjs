import playwright from 'playwright';
const { chromium } = playwright;

(async () => {
  const browser = await chromium.launch({ headless: true });
  
  // Mobile - Terminal Theme with Shell Open
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await page.goto('http://localhost:8081');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  
  // Click on shell bar to open it
  const shellBar = await page.$('[role="button"]');
  if (shellBar) {
    await shellBar.click();
    await page.waitForTimeout(1000);
    console.log('Shell bar clicked');
  } else {
    console.log('Shell bar not found');
  }
  
  await page.screenshot({ path: '../screenshots/mobile-terminal-shell-open.png', fullPage: false });
  console.log('Screenshot saved');
  
  await browser.close();
})();
