"""Opaque-origin DOM fixture for the production memo and shared auth runtime.
Uses memory Storage, fixture fetch and an asset-loader substitution. It does NOT
verify real Storage persistence, Web Locks, cross-tab behavior or the React dialog.
"""
import asyncio, json, os
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'verification/anonymous-r07-1/browser-fixture.json'
async def main():
    checks=[]
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
        ctx=await browser.new_context(service_workers='block')
        await ctx.route('**/*',lambda route:route.abort())
        page=await ctx.new_page();errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        await page.set_content('<!doctype html><html lang="ko"><meta charset="utf-8"><body><main>Memo fixture</main></body></html>')
        await page.evaluate('''()=>{
          class MemoryStorage{constructor(){this.map=new Map()}getItem(k){return this.map.get(k)??null}setItem(k,v){this.map.set(k,String(v))}removeItem(k){this.map.delete(k)}clear(){this.map.clear()}}
          for(const key of ['localStorage','sessionStorage'])Object.defineProperty(window,key,{value:new MemoryStorage()});
          localStorage.setItem('aiMemo.content',JSON.stringify('local memo retained'));
          localStorage.setItem('aiMemo.isOpen','true');
          window.fixture={status:200,requests:0,sub:'anon-11111111-1111-4111-8111-111111111111'};
          window.makeToken=(sub=fixture.sub,seconds=2592000)=>'eyJhbGciOiJIUzI1NiJ9.'+btoa(JSON.stringify({sub,role:'anonymous',tokenClass:'anonymous',type:'access',exp:Math.floor(Date.now()/1000)+seconds})).replace(/=/g,'').replace(/\\+/g,'-').replace(/\\//g,'_')+'.fixture';
          window.fetch=async(url,init)=>{
            if(String(url).includes('/api/v1/auth/anonymous')){fixture.requests++;return new Response(JSON.stringify(fixture.status===200?{ok:true,data:{token:makeToken(),userId:fixture.sub}}:{ok:false,error:{code:'FIXTURE'}}),{status:fixture.status})}
            return new Response('{}',{status:404});
          };
          window.recovery=[];window.addEventListener('reader:anonymous-auth-required',e=>recovery.push(Object.keys(e.detail)));
        }''')
        # Evaluate unchanged runtime logic; only module export plumbing is adapted for this opaque-origin fixture.
        runtime=(ROOT/'shared/src/runtime/anonymous-session.js').read_text()
        runtime=runtime.replace('export class ', 'class ').replace('export async function ', 'async function ')
        await page.add_script_tag(content='(()=>{'+runtime+'\nwindow.__anonymousRuntimeFixture={getAnonymousSession,startNewAnonymousSession};})();')
        source=(ROOT/'frontend/public/ai-memo/ai-memo.js').read_text()
        for name in ['ai-memo.css','memo-workspace.css']:
            css=(ROOT/'frontend/public/ai-memo'/name).read_text()
            source=source.replace('<link rel="stylesheet" href="/ai-memo/'+name+'?v=${AI_MEMO_ASSET_VERSION}" />','<style>${'+json.dumps(css)+'}</style>')
        original='return import(`/ai-memo/anonymous-session.js?v=${AI_MEMO_ASSET_VERSION}`);'
        assert original in source
        source=source.replace(original,'return window.__anonymousRuntimeFixture;')
        await page.add_script_tag(content=source)
        assert await page.locator('ai-memo-pad #memo').input_value()=='local memo retained'
        checks.append({'name':'production memo mounts with existing draft','pass':True})
        result=await page.evaluate('''async()=>{const memo=document.querySelector('ai-memo-pad');const values=await Promise.all([
          memo.getValidAnonymousToken('https://fixture.invalid'),__anonymousRuntimeFixture.getAnonymousSession({apiBase:'https://fixture.invalid'})]);
          return {same:values[0]===values[1],count:fixture.requests}}''')
        assert result=={'same':True,'count':1},result
        checks.append({'name':'memo and canonical application runtime join one same-tab issuance','pass':True})
        result=await page.evaluate('''async()=>{const old=makeToken(fixture.sub,3600);localStorage.setItem('anon.token',old);fixture.status=503;
          const before=fixture.requests;const next=await document.querySelector('ai-memo-pad').getValidAnonymousToken('https://fixture.invalid');
          return {kept:old===next&&localStorage.getItem('anon.token')===old,requests:fixture.requests-before}}''')
        assert result=={'kept':True,'requests':1},result
        checks.append({'name':'actual memo transient refresh failure keeps owner','pass':True})
        result=await page.evaluate('''async()=>{fixture.status=401;const old=localStorage.getItem('anon.token');const before=fixture.requests;
          try{await document.querySelector('ai-memo-pad').getValidAnonymousToken('https://fixture.invalid')}catch(e){return {code:e.code,kept:old===localStorage.getItem('anon.token'),requests:fixture.requests-before,eventKeys:recovery.at(-1)}}}''')
        assert result=={'code':'ANONYMOUS_RECOVERY_REQUIRED','kept':True,'requests':1,'eventKeys':['code']},result
        checks.append({'name':'401 reports recovery without replacing credentials or leaking event tokens','pass':True})
        result=await page.evaluate('''async()=>{fixture.status=200;fixture.sub='anon-22222222-2222-4222-8222-222222222222';const old=localStorage.getItem('anon.token');
          try{await document.querySelector('ai-memo-pad').getValidAnonymousToken('https://fixture.invalid')}catch(e){return {code:e.code,kept:old===localStorage.getItem('anon.token')}}}''')
        assert result=={'code':'ANONYMOUS_IDENTITY_MISMATCH','kept':True},result
        checks.append({'name':'actual memo rejects wrong-owner successful response','pass':True})
        await page.evaluate("async()=>__anonymousRuntimeFixture.startNewAnonymousSession({apiBase:'https://fixture.invalid',expectedToken:localStorage.getItem('anon.token'),confirmed:true})")
        assert await page.locator('ai-memo-pad #memo').input_value()=='local memo retained'
        assert await page.evaluate("JSON.parse(localStorage.getItem('aiMemo.content'))")=='local memo retained'
        checks.append({'name':'explicit session change does not delete current editor or fixture Storage','pass':True})
        assert not errors,errors
        await ctx.close();await browser.close()
    OUT.write_text(json.dumps({'scope':__doc__,'passed':len(checks),'checks':checks,'pageErrors':errors},ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'passed':len(checks),'report':str(OUT)},ensure_ascii=False))
if __name__=='__main__':asyncio.run(main())
