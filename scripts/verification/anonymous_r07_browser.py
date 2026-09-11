"""Production memo methods + canonical ES module in Chromium with real localStorage/Web Locks.
HTTP auth responses are fixtures, NOT a live Worker/provider. No external calls are made.
Requires Python playwright and Chromium. Outputs no credentials or private identifiers.
"""
import asyncio, base64, json, os, time, uuid
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'verification/anonymous-r07-1/browser.json'
ORIGIN = 'http://localhost:8199'
A = 'anon-11111111-1111-4111-8111-111111111111'
B = 'anon-22222222-2222-4222-8222-222222222222'
def token(sub=A, seconds=2592000):
    payload = {'sub': sub, 'role': 'anonymous', 'type': 'access', 'tokenClass': 'anonymous',
               'exp': int(time.time()) + seconds, 'jti': str(uuid.uuid4())}
    part = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip('=')
    return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + part + '.fixture'

async def main():
    checks = []
    state = {'mode': 'ok', 'requests': 0, 'delay': False}
    started = asyncio.Event()
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),
                                                  headless=True, args=['--no-sandbox'])
        context = await browser.new_context(service_workers='block')
        async def route_request(route):
            url = route.request.url
            if not url.startswith(ORIGIN + '/'):
                return await route.abort()
            path = urlparse(url).path
            if path.startswith('/api/v1/auth/anonymous'):
                state['requests'] += 1
                if state['delay']:
                    started.set()
                    await asyncio.sleep(.2)
                status = int(state['mode']) if str(state['mode']).isdigit() else 200
                subject = B if state['mode'] == 'wrong-owner' else A
                data = {'ok': True, 'data': {'token': token(subject), 'userId': subject}} if status == 200 else {'ok':False,'error':{'code':'FIXTURE_FAILURE'}}
                return await route.fulfill(status=status, content_type='application/json', body=json.dumps(data))
            if path == '/runtime/anonymous-session.js':
                return await route.fulfill(content_type='application/javascript', body=(ROOT/'shared/src/runtime/anonymous-session.js').read_text())
            if path.startswith('/ai-memo/'):
                file = ROOT / 'frontend/public' / path.lstrip('/')
                if file.is_file():
                    return await route.fulfill(content_type='text/css' if file.suffix == '.css' else 'application/javascript', body=file.read_bytes())
            if path == '/blog':
                return await route.fulfill(content_type='text/html', body='<!doctype html><html lang="ko"><meta charset="utf-8"><body><main>Fixture</main></body></html>')
            await route.fulfill(status=404, body='Fixture not found')
        await context.route('**/*',route_request)
        async def setup(page, memo=False):
            await page.goto(ORIGIN+'/blog')
            await page.evaluate("async()=>{window.runtime=await import('/runtime/anonymous-session.js');window.recoveryEvents=[];window.addEventListener('reader:anonymous-auth-required',e=>window.recoveryEvents.push(Object.keys(e.detail).sort()));}")
            if memo:
                await page.evaluate("()=>{localStorage.setItem('aiMemo.content',JSON.stringify('local draft retained'));localStorage.setItem('aiMemo.isOpen','true');}")
                await page.add_script_tag(url=ORIGIN+'/ai-memo/ai-memo.js')
                await page.evaluate("()=>{window.memo=document.createElement('ai-memo-pad');document.body.appendChild(window.memo)}")
        p1=await context.new_page();p2=await context.new_page()
        await setup(p1,True);await setup(p2)
        assert await p1.evaluate('!!navigator.locks')
        checks.append({'name':'real Chromium Web Locks available','pass':True})
        # Two separately loaded copies share same-tab single flight, plus a real cross-tab lock.
        results=await asyncio.gather(
            p1.evaluate("async()=>Promise.all([runtime.getAnonymousSession({apiBase:location.origin}),memo.getValidAnonymousToken(location.origin)])"),
            p2.evaluate("()=>runtime.getAnonymousSession({apiBase:location.origin})"))
        assert state['requests']==1,state
        assert results[0][0]==results[0][1]==results[1]
        checks.append({'name':'memo + application module + second tab create once','pass':True,'authRequests':1})
        first=results[1]
        await p2.reload()
        assert await p2.evaluate("localStorage.getItem('anon.token')")==first
        assert await p2.evaluate("JSON.parse(localStorage.getItem('aiMemo.content'))")=='local draft retained'
        checks.append({'name':'real Storage survives page reload; memo retained','pass':True})
        # Near-expiry proof; no automatic new owner after transport/server problems.
        old=token(seconds=3600)
        await p1.evaluate("t=>localStorage.setItem('anon.token',t)",old)
        state['mode']='503';before=state['requests']
        result=await p1.evaluate("()=>memo.getValidAnonymousToken(location.origin)")
        assert result==old and state['requests']==before+1
        assert await p1.evaluate("localStorage.getItem('anon.token')")==old
        checks.append({'name':'actual memo renewal 503 keeps same credential','pass':True})
        state['mode']='401';before=state['requests']
        code=await p1.evaluate("async()=>{try{await memo.getValidAnonymousToken(location.origin)}catch(e){return e.code}}")
        assert code=='ANONYMOUS_RECOVERY_REQUIRED' and state['requests']==before+1
        assert await p1.evaluate("localStorage.getItem('anon.token')")==old
        assert await p1.evaluate('window.recoveryEvents.at(-1)')==['code']
        checks.append({'name':'401 stops without new issue; UI event contains code only','pass':True})
        state['mode']='wrong-owner'
        code=await p1.evaluate("async()=>{try{await memo.getValidAnonymousToken(location.origin)}catch(e){return e.code}}")
        assert code=='ANONYMOUS_IDENTITY_MISMATCH'
        assert await p1.evaluate("localStorage.getItem('anon.token')")==old
        checks.append({'name':'HTTP 200 with wrong subject cannot replace memo owner','pass':True})
        state['mode']='ok';state['delay']=True
        pending=asyncio.create_task(p1.evaluate("async()=>{try{await memo.getValidAnonymousToken(location.origin)}catch(e){return e.code}}"))
        await started.wait()
        replacement=token(B)
        await p1.evaluate("t=>localStorage.setItem('anon.token',t)",replacement)
        assert await pending=='ANONYMOUS_SESSION_CHANGED'
        assert await p1.evaluate("localStorage.getItem('anon.token')")==replacement
        state['delay']=False
        checks.append({'name':'late response cannot overwrite a concurrent storage change','pass':True})
        expired=token(seconds=-1)
        await p1.evaluate("t=>localStorage.setItem('anon.token',t)",expired)
        before=state['requests']
        code=await p1.evaluate("async()=>{try{await memo.getValidAnonymousToken(location.origin)}catch(e){return e.code}}")
        assert code=='ANONYMOUS_RECOVERY_REQUIRED' and state['requests']==before
        checks.append({'name':'expired proof requires explicit action, no automatic reset request','pass':True})
        await p1.evaluate("async()=>runtime.startNewAnonymousSession({apiBase:location.origin,expectedToken:localStorage.getItem('anon.token'),confirmed:true})")
        assert await p1.evaluate("JSON.parse(localStorage.getItem('aiMemo.content'))")=='local draft retained'
        assert await p1.locator('ai-memo-pad #memo').input_value()=='local draft retained'
        checks.append({'name':'explicit new identity retains actual memo editor and Storage','pass':True})
        await context.close();await browser.close()
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps({'scope':'Chromium production memo methods + shared runtime; fixture HTTP; actual localStorage and Web Locks; not React dialog or live Worker E2E',
                               'passed':len(checks),'checks':checks},ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'passed':len(checks),'report':str(OUT)},ensure_ascii=False))

if __name__=='__main__':
    try:
        asyncio.run(main())
    except Exception as error:
        message = str(error).splitlines()[0][:220]
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(json.dumps({'scope':__doc__, 'status':'blocked' if 'ERR_BLOCKED_BY_ADMINISTRATOR' in message else 'failed',
                                   'error':message, 'passed':0, 'actualCrossTabVerified':False,
                                   'actualPersistenceVerified':False},ensure_ascii=False,indent=2)+'\n')
        raise
