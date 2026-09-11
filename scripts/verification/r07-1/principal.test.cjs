// Actual React service modules, with API base and Zustand store replaced by test fixtures.
const {test,beforeEach,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const Module=require('node:module');
const {root,transpile}=require('./support.cjs');
const lifecycle=require(path.join(root,'shared/src/runtime/anonymous-session.js'));
function load(relative,deps){const filename=path.join(root,relative);const module=new Module(filename);
 module.filename=filename;module.paths=Module._nodeModulePaths(path.dirname(filename));
 module.require=id=>Object.hasOwn(deps,id)?deps[id]:require(id);module._compile(transpile(filename),filename);return module.exports;}
let account,cleared,requests,storage;
const api={getApiBaseUrl:()=> 'https://fixture.invalid'};
const auth=load('frontend/src/services/session/auth.ts',{'@blog/shared/runtime/anonymous-session':lifecycle,
 '@/utils/network/apiBase':api,'@/lib/auth':{bearerAuth:t=>({Authorization:`Bearer ${t}`})}});
const principal=load('frontend/src/services/session/userContentAuth.ts',{'@/services/session/auth':auth,
 '@/lib/auth':{bearerAuth:t=>({Authorization:`Bearer ${t}`})},'@/stores/session/useAuthStore':{useAuthStore:{getState:()=>account}}});
const sub='anon-11111111-1111-4111-8111-111111111111';
const token=(id=sub,secs=3600)=>'eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:id,role:id.startsWith('anon-')?'anonymous':'admin',tokenClass:'anonymous',type:'access',exp:Math.floor(Date.now()/1000)+secs})).toString('base64url')+'.fixture';
const originalFetch=globalThis.fetch;
beforeEach(()=>{
 delete globalThis[Symbol.for('nodove:anonymous-session:v1')];cleared=0;requests=0;storage=new Map();
 globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
 account={accessToken:null,refreshToken:null,getValidAccessToken:async()=>null,clearAuth:()=>{cleared++}};
 globalThis.fetch=async()=>{requests++;return new Response('{}',{status:503})};
});
afterEach(()=>{delete globalThis.localStorage;globalThis.fetch=originalFetch});
test('valid member is used without anonymous requests',async()=>{
 const member=token('member-one');account.accessToken=member;
 assert.equal(await principal.getPrincipalToken(),member);assert.equal(requests,0);
});
test('expired member session cannot become an anonymous operation',async()=>{
 account.accessToken=token('member-one',-1);account.refreshToken='expired';
 await assert.rejects(principal.getPrincipalToken(),/자동 전환하지/);assert.equal(requests,0);
});
test('failed member operation does not clear auth or retry as a guest',async()=>{
 account.accessToken=token('member-one');await assert.rejects(principal.refreshPrincipalTokenAfterAuthFailure(),/로그인 자격/);
 assert.equal(cleared,0);assert.equal(requests,0);
});
test('near-expiry guest is renewed instead of being cleared by principal selection',async()=>{
 const old=token(sub,45),next=token(sub,200000);storage.set('anon.token',old);
 globalThis.fetch=async(url,init)=>{requests++;assert.ok(url.endsWith('/refresh'));assert.equal(init.headers.Authorization,`Bearer ${old}`);
 return new Response(JSON.stringify({ok:true,data:{userId:sub,token:next}}));};
 assert.equal(await principal.getPrincipalToken(),next);assert.equal(requests,1);assert.equal(cleared,0);
});
test('guest auth retry preserves owner on a temporary server failure',async()=>{
 const old=token();storage.set('anon.token',old);await assert.rejects(principal.refreshPrincipalTokenAfterAuthFailure(),e=>e.code==='ANONYMOUS_AUTH_UNAVAILABLE');
 assert.equal(storage.get('anon.token'),old);assert.equal(requests,1);assert.equal(cleared,0);
});
test('login during pending anonymous acquisition stops the prior operation',async()=>{
 globalThis.fetch=async()=>{account.accessToken=token('member-now');return new Response(JSON.stringify({ok:true,data:{userId:sub,token:token()}}))};
 await assert.rejects(principal.getPrincipalToken(),/계정이 변경/);
});
test('invalid stored header is not exposed and is not erased implicitly',()=>{
 storage.set('anon.token','stored\r\nheader');assert.equal(auth.getStoredAnonymousToken(),null);assert.equal(storage.get('anon.token'),'stored\r\nheader');
});
