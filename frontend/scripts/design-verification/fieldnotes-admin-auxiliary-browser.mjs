import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const baseURL = process.env.DESIGN_BASE_URL || 'http://127.0.0.1:4317';
const output = new URL('../../verification-screenshots/fieldnotes-20260908/admin-auxiliary/', import.meta.url);
await mkdir(output, { recursive: true });
const routes = ['login','callback','standalone'];
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium' });
const selectedRoutes = process.env.DESIGN_ROUTES ? process.env.DESIGN_ROUTES.split(',') : routes;
const results = process.env.DESIGN_ROUTES ? JSON.parse(await readFile(new URL('results.json', output), 'utf8')).results.filter(result => !selectedRoutes.includes(result.route)) : [];
try {
  await Promise.all(['light','dark'].flatMap(theme => [320,1440].map(width => ({theme,width}))).map(async ({theme,width}) => {
      const context = await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});
      await context.addInitScript(theme => localStorage.setItem('theme', theme), theme);
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== new URL(baseURL).origin || url.pathname.startsWith('/api/')) {
          await route.abort('blockedbyclient');
        } else await route.continue();
      });
      for(const name of selectedRoutes) {
        const page = await context.newPage();
        const runtimeErrors=[];
        page.on('pageerror',e=>runtimeErrors.push(e.message));
        await page.goto(name === 'login' ? `${baseURL}/admin/login` : name === 'callback' ? `${baseURL}/admin/auth/callback` : `${baseURL}/scripts/design-verification/workspace.html?surface=standalone`,{waitUntil:'networkidle'});
        await page.locator('.ui-auth-card,.ui-editor').first().waitFor();
        await page.waitForFunction(()=>!document.querySelector('.ui-section-loading'));
        const metrics = await page.evaluate(()=>{
          const visible = e=>e.getClientRects().length && getComputedStyle(e).visibility!=='hidden';
          const scrollable = e=>e.closest('.overflow-x-auto,.overflow-auto,[data-radix-scroll-area-viewport],[role="tablist"],.ui-admin-subtabs,.ui-subtabs');
          const controls=[...document.querySelectorAll('button,input,select,textarea')].filter(visible);
          return {
            documentWidth:document.documentElement.scrollWidth,
            heading:document.querySelector('h1')?.textContent,
            background:getComputedStyle(document.body).backgroundColor,
            headingFont:getComputedStyle(document.querySelector('h1')).fontFamily,
            sectionNavigation:document.querySelector('.ui-admin-sidebar') ? getComputedStyle(document.querySelector('.ui-admin-sidebar')).display : null,
            controlOverflow:controls.filter(e=>!scrollable(e)).map(e=>{const r=e.getBoundingClientRect();return{name:e.getAttribute('aria-label')||e.textContent?.trim().slice(0,70),x:r.x,right:r.right,width:r.width,height:r.height}}).filter(r=>r.x< -1||r.right>innerWidth+1),
            overflow:[...document.querySelectorAll('.ui-auth-card *,.ui-editor *')].filter(visible).filter(e=>!scrollable(e)).filter(e=>{const r=e.getBoundingClientRect();return r.left< -1||r.right>innerWidth+1}).slice(0,12).map(e=>({tag:e.tagName,className:e.className,text:e.textContent?.trim().slice(0,100)}))
          };
        });
        const filename=`${name.replaceAll('/','-')}-${theme}-${width}.png`;
        await page.screenshot({path:new URL(filename,output).pathname,fullPage:true});
        results.push({route:name,theme,width,...metrics,runtimeErrors,screenshot:filename});
        console.log(`${name} ${theme} ${width}: width=${metrics.documentWidth} overflow=${metrics.overflow.length} controls=${metrics.controlOverflow.length} errors=${runtimeErrors.length}`);
        await page.close();
      }
      await context.close();

  }));
      await writeFile(new URL('results.json',output),JSON.stringify({scope:'Production login/callback routes and real standalone editor; API network requests blocked; no credentials or mutations; light/dark at 320/1440.',results},null,2));
} finally {await browser.close();}
