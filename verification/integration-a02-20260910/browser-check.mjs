import { chromium } from '/home/nodove/workspace/blog/frontend/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const dir='/home/nodove/workspace/blog/frontend/verification-screenshots/integration-a02-20260910';
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium'});
const results=[];
try {
 for (const width of [390,1440]) {
  const page=await browser.newPage({viewport:{width,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
  await page.goto('http://127.0.0.1:5179/projects',{waitUntil:'networkidle'});
  await page.getByRole('heading',{name:'From ideas to systems.'}).waitFor();
  await page.screenshot({path:`${dir}/projects-${width}.png`});
  const projectsText=await page.locator('body').innerText();
  if(!projectsText.includes('68개 저장소'))throw new Error('Projects missing');
  await page.keyboard.press('Control+Alt+m');
  const expand=page.getByRole('button',{name:'채팅 창 확대',exact:true});
  if(width>600 && await expand.isVisible())await expand.click();
  await page.getByRole('button',{name:'AI 설정 열기',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'AI 설정',exact:true});
  await dialog.waitFor();
  await dialog.getByRole('combobox',{name:/말투/}).selectOption('formal');
  await dialog.getByRole('button',{name:'저장',exact:true}).click();
  await dialog.getByRole('status').filter({hasText:'이 기기에 저장됨'}).waitFor();
  for(let n=0;n<15;n++) {await page.keyboard.press('Tab');if(!await dialog.evaluate(el=>el.contains(document.activeElement)))throw new Error('Focus escaped settings');}
  const bounds=await dialog.boundingBox();if(bounds.x< -1||bounds.x+bounds.width>width+1)throw new Error('Settings overflow');
  await page.screenshot({path:`${dir}/settings-${width}.png`});
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label') === 'AI 설정 열기',{}, {timeout:2000});
  const focusRestored=await page.getByRole('button',{name:'AI 설정 열기',exact:true}).evaluate(el=>el===document.activeElement);
  if(!focusRestored)throw new Error('Settings focus not restored');
  await page.getByRole('button',{name:'AI 설정 열기',exact:true}).click();
  if(await dialog.getByRole('combobox',{name:/말투/}).inputValue()!=='formal')throw new Error('Setting not persisted');
  await dialog.getByRole('button',{name:'AI 설정 닫기',exact:true}).click();await dialog.waitFor({state:'hidden'});
  // Drive the documented application recovery event; no credentials are generated or submitted.
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('reader:anonymous-auth-required',{detail:{code:'ANONYMOUS_PROOF_REQUIRED'}})));
  const recovery=page.getByRole('dialog',{name:'익명 인증 확인',exact:true});await recovery.waitFor();
  if(!await recovery.getByRole('button',{name:'새 익명 세션 시작',exact:true}).isDisabled())throw new Error('Missing recovery confirmation');
  await recovery.getByRole('checkbox').check();
  if(await recovery.getByRole('button',{name:'새 익명 세션 시작',exact:true}).isDisabled())throw new Error('Confirmation not actionable');
  for(let n=0;n<8;n++){await page.keyboard.press('Tab');if(!await recovery.evaluate(el=>el.contains(document.activeElement)))throw new Error('Focus escaped recovery');}
  await page.screenshot({path:`${dir}/recovery-${width}.png`});
  await page.keyboard.press('Escape');await recovery.waitFor({state:'hidden'});
  results.push({width,projects:68,settingsSaveAndReopen:true,nestedModalFocus:true,recoveryConfirmation:true,errors});
  await page.close();
 }
 fs.writeFileSync(`${dir}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
} finally {await browser.close();}
