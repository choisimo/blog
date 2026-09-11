// Exercises the canonical runtime with fixture transport and Storage; no React mock UI.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getAnonymousSession, startNewAnonymousSession } from '../../../shared/src/runtime/anonymous-session.js';
const STATE = Symbol.for('nodove:anonymous-session:v1');
beforeEach(()=>{ delete globalThis[STATE]; });
const subA='anon-11111111-1111-4111-8111-111111111111';
const subB='anon-22222222-2222-4222-8222-222222222222';
function token(sub=subA, seconds=3600, id=crypto.randomUUID()) {
  return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.'+Buffer.from(JSON.stringify({sub,role:'anonymous',tokenClass:'anonymous',type:'access',exp:Math.floor(Date.now()/1000)+seconds,jti:id})).toString('base64url')+'.fixture';
}
function storage(initial=null) {
  const map=new Map(initial===null?[]:[['anon.token',initial]]);map.set('aiMemo.content','existing local draft');
  return { map, getItem:key=>map.get(key)??null, setItem:(key,value)=>map.set(key,value) };
}
function ok(next) {return new Response(JSON.stringify({ok:true,data:{token:next,userId:JSON.parse(Buffer.from(next.split('.')[1],'base64url')).sub}}),{status:200});}
const options=(store,fetcher,other={})=>({apiBase:'https://fixture.invalid',storage:store,fetcher,...other});
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r});return {resolve,promise};}
const code=(promise,expected)=>assert.rejects(promise,error=>error.code===expected);

test('first visit stores only the server subject and retains local memo',async()=>{
 const s=storage(), next=token();const result=await getAnonymousSession(options(s,async(url,init)=>{assert.ok(url.endsWith('/anonymous'));assert.equal(init.headers.Authorization,undefined);return ok(next)}));
 assert.equal(result,next);assert.equal(s.getItem('anon.token'),next);assert.equal(s.getItem('aiMemo.content'),'existing local draft');
});
test('100 simultaneous first requests are one logical request',async()=>{
 const s=storage(), next=token();let count=0;const opt=options(s,async()=>{count++;await new Promise(r=>setTimeout(r,10));return ok(next)});
 const results=await Promise.all(Array.from({length:100},()=>getAnonymousSession(opt)));
 assert.equal(count,1);assert.equal(new Set(results).size,1);
});
test('far-from-expiry proof is used without an extra request',async()=>{
 const old=token(subA,2*86400), s=storage(old);
 assert.equal(await getAnonymousSession(options(s,async()=>assert.fail('no fetch'))),old);
});
test('renewal sends old proof and retains the same exact subject',async()=>{
 const old=token(),next=token(subA,2592000),s=storage(old);
 assert.equal(await getAnonymousSession(options(s,async(url,init)=>{assert.ok(url.endsWith('/refresh'));assert.equal(init.headers.Authorization,`Bearer ${old}`);return ok(next)})),next);
});
for(const status of [500,502,503,504,429]) {
 test(`transient ${status} keeps valid proof; no fresh issuance`,async()=>{
  const old=token(),s=storage(old);let count=0;
  assert.equal(await getAnonymousSession(options(s,async url=>{count++;assert.ok(url.endsWith('/refresh'));return new Response('{}',{status})})),old);
  assert.equal(count,1);assert.equal(s.getItem('anon.token'),old);
 });
}
test('network failure preserves valid proof',async()=>{
 const old=token(),s=storage(old);assert.equal(await getAnonymousSession(options(s,async()=>{throw new TypeError('offline')})),old);assert.equal(s.getItem('anon.token'),old);
});
test('forced refresh after a rejected operation never replays the rejected proof on 503',async()=>{
 const old=token(),s=storage(old);await code(getAnonymousSession(options(s,async()=>new Response('{}',{status:503}),{forceRefresh:true})),'ANONYMOUS_AUTH_UNAVAILABLE');assert.equal(s.getItem('anon.token'),old);
});
for(const status of [401,403]) {
 test(`definitive ${status} keeps proof and requires explicit recovery`,async()=>{
  const old=token(),s=storage(old);let count=0;
  await code(getAnonymousSession(options(s,async()=>{count++;return new Response('{}',{status})})),'ANONYMOUS_RECOVERY_REQUIRED');
  assert.equal(s.getItem('anon.token'),old);assert.equal(count,1);
 });
}
for(const old of [token(subA,-1),'broken-token','a\r\nHeader: bad']) {
 test(`expired/malformed stored proof is not silently cleared (${old.length} chars)`,async()=>{
  const s=storage(old);await code(getAnonymousSession(options(s,async()=>assert.fail('no replacement call'))),'ANONYMOUS_RECOVERY_REQUIRED');assert.equal(s.getItem('anon.token'),old);
 });
}
test('renewal to a different owner is refused even after HTTP 200',async()=>{
 const old=token(),s=storage(old);await code(getAnonymousSession(options(s,async()=>ok(token(subB)))),'ANONYMOUS_IDENTITY_MISMATCH');assert.equal(s.getItem('anon.token'),old);
});
test('malformed success cannot be saved',async()=>{
 const s=storage();await code(getAnonymousSession(options(s,async()=>new Response(JSON.stringify({ok:true,data:{token:'unsafe\r\n',userId:subA}})))),'ANONYMOUS_IDENTITY_MISMATCH');assert.equal(s.getItem('anon.token'),null);
});
test('late refresh does not overwrite a changed storage credential',async()=>{
 const old=token(),other=token(subB),s=storage(old),gate=deferred(),started=deferred();
 const pending=getAnonymousSession(options(s,async()=>{started.resolve();await gate.promise;return ok(token())}));
 await started.promise;s.setItem('anon.token',other);gate.resolve();await code(pending,'ANONYMOUS_SESSION_CHANGED');assert.equal(s.getItem('anon.token'),other);
});
test('late initial issue cannot overwrite another tab',async()=>{
 const s=storage(),other=token(subB),gate=deferred(),started=deferred();
 const pending=getAnonymousSession(options(s,async()=>{started.resolve();await gate.promise;return ok(token())}));
 await started.promise;s.setItem('anon.token',other);gate.resolve();await code(pending,'ANONYMOUS_SESSION_CHANGED');assert.equal(s.getItem('anon.token'),other);
});
test('Web Lock is acquired before reading credential and issuing',async()=>{
 const s=storage();let entered=false;await getAnonymousSession(options(s,async()=>{assert.equal(entered,true);return ok(token())},{locks:{request:async(name,mode,fn)=>{assert.equal(mode.mode,'exclusive');entered=true;return fn()}}}));
});
test('unavailable storage prevents creation instead of making ephemeral owners',async()=>{
 const s={getItem(){throw new Error('storage blocked')},setItem(){assert.fail()}};
 await code(getAnonymousSession(options(s,async()=>assert.fail('no fetch'))),'ANONYMOUS_STORAGE_UNAVAILABLE');
});
test('failed storage write does not report a new session as established',async()=>{
 const s=storage();s.setItem=()=>{throw new Error('quota')};await code(getAnonymousSession(options(s,async()=>ok(token()))),'ANONYMOUS_STORAGE_UNAVAILABLE');
});
test('explicit new identity requires confirmation and expected stored credential',async()=>{
 const old=token(subA,-1),s=storage(old),next=token(subB);let count=0;const opt=options(s,async()=>{count++;return ok(next)});
 await code(startNewAnonymousSession({...opt,expectedToken:old,confirmed:false}),'ANONYMOUS_CONFIRMATION_REQUIRED');
 await code(startNewAnonymousSession({...opt,confirmed:true}),'ANONYMOUS_CONFIRMATION_REQUIRED');assert.equal(count,0);
 assert.equal(await startNewAnonymousSession({...opt,confirmed:true,expectedToken:old}),next);assert.equal(count,1);assert.equal(s.getItem('aiMemo.content'),'existing local draft');
});
test('failed explicit reset preserves old credential and draft',async()=>{
 const old=token(subA,-1),s=storage(old);await code(startNewAnonymousSession({...options(s,async()=>new Response('{}',{status:503})),confirmed:true,expectedToken:old}),'ANONYMOUS_AUTH_UNAVAILABLE');assert.equal(s.getItem('anon.token'),old);
});
test('explicit reset rejects stale dialog state without a request',async()=>{
 const s=storage(token(subB));await code(startNewAnonymousSession({...options(s,async()=>assert.fail('must not fetch')),confirmed:true,expectedToken:token(subA)}),'ANONYMOUS_SESSION_CHANGED');
});
test('closing/reset cancellation before result prevents local identity change',async()=>{
 const old=token(subA,-1),s=storage(old),abort=new AbortController();
 await code(startNewAnonymousSession({...options(s,async()=>{abort.abort();return ok(token(subB))}),confirmed:true,expectedToken:old,signal:abort.signal}),'ANONYMOUS_ACTION_CANCELLED');assert.equal(s.getItem('anon.token'),old);
});
test('account login during explicit reset prevents a new guest credential commit',async()=>{
 const old=token(subA,-1),s=storage(old);await code(startNewAnonymousSession({...options(s,async()=>ok(token(subB))),confirmed:true,expectedToken:old,isCurrent:()=>false}),'ANONYMOUS_ACTION_CANCELLED');assert.equal(s.getItem('anon.token'),old);
});
test('checked-in memo module is byte-for-byte the canonical runtime',()=>{
 const source=fs.readFileSync(new URL('../../../shared/src/runtime/anonymous-session.js',import.meta.url));
 const asset=fs.readFileSync(new URL('../../../frontend/public/ai-memo/anonymous-session.js',import.meta.url));assert.equal(source.equals(asset),true);
});

test('a request queued behind an explicit owner change does not resume under the new owner',async()=>{
 const old=token(subA,-1),s=storage(old),gate=deferred(),started=deferred();
 const opt=options(s,async()=>{started.resolve();await gate.promise;return ok(token(subB))});
 const reset=startNewAnonymousSession({...opt,confirmed:true,expectedToken:old});
 await started.promise;
 const queued=getAnonymousSession(options(s,async()=>assert.fail('old operation must stop')));
 gate.resolve();await reset;await code(queued,'ANONYMOUS_SESSION_CHANGED');
});
