import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseURL = process.env.DESIGN_BASE_URL || 'http://127.0.0.1:4319';
const output = new URL('../../verification-screenshots/fieldnotes-20260908/final-public/', import.meta.url);
const routes = {home:'/', archive:'/blog', reader:'/blog/2026/organizing-intelligence-era', about:'/about', projects:'/projects', debate:'/debate', insight:'/insight', login:'/admin/login', error:'/404'};
await mkdir(output, {recursive:true});
const browser = await chromium.launch({executablePath:'/usr/bin/chromium',headless:true});
const selected = process.env.DESIGN_ROUTES?.split(',') || Object.keys(routes);
const results = process.env.DESIGN_ROUTES
  ? JSON.parse(await readFile(new URL('results.json', output), 'utf8')).results.filter(result=>!selected.includes(result.name))
  : [];
try {
  for (const theme of ['light','dark']) for (const width of [390,1440]) {
    const context = await browser.newContext({viewport:{width,height:1050},serviceWorkers:'block'});
    await context.addInitScript(theme => {localStorage.setItem('theme',theme);localStorage.setItem('site.language','ko');},theme);
    await context.route('**/*',route => {
      const url = new URL(route.request().url());
      return url.origin !== new URL(baseURL).origin || url.pathname.startsWith('/api/') ? route.abort('blockedbyclient') : route.continue();
    });
    for (const [name,path] of Object.entries(routes)) {
      if (!selected.includes(name)) continue;
      const page = await context.newPage();
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto(baseURL+path);
      await page.locator('main h1').waitFor();
      if (name==='reader') {
        await page.locator('.article-flow p').first().waitFor();
        const cover=page.locator('.article-flow img').first();
        await cover.scrollIntoViewIfNeeded();
        await cover.evaluate(img=>img.complete && img.naturalWidth ? Promise.resolve() : new Promise((resolve,reject)=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',reject,{once:true});}));
        await page.evaluate(()=>window.scrollTo(0,0));
      }
      await page.evaluate(()=>document.fonts.ready);
      const file=`${name}-${theme}-${width}.png`;
      await page.screenshot({path:new URL(file,output).pathname,animations:'disabled'});
      const metrics=await page.evaluate(()=>({width:document.documentElement.scrollWidth,background:getComputedStyle(document.body).backgroundColor,heading:document.querySelector('main h1').textContent}));
      results.push({name,path,theme,viewport:width,...metrics,errors,screenshot:file});
      console.log(`${name} ${theme} ${width}: width=${metrics.width} errors=${errors.length}`);
      await page.close();
    }
    await context.close();
  }
  await writeFile(new URL('results.json',output),JSON.stringify({scope:'Production build; real local content; API/external requests aborted without substituted responses; viewport screenshots.',results},null,2));
  if (results.some(result=>result.width>result.viewport || result.errors.length)) process.exitCode=1;
} finally {await browser.close();}
