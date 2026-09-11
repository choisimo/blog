import test from 'node:test';
import assert from 'node:assert/strict';
import {createTranslationDispatcher} from '../../../backend/src/services/translation-dispatch.service.js';
const encoder=new TextEncoder();
function stream(value){return new Response(`data: {"type":"open"}\n\ndata: ${JSON.stringify({type:'done',...value})}\n\n`,{headers:{'Content-Type':'text/event-stream'}})}
test('100 wake signals are coalesced and contain no caller-supplied URL or source text',async()=>{
 const calls=[];let n=0;const d=createTranslationDispatcher({workerApiUrl:'https://worker.test',backendKey:'test-key',fetchImpl:async(url,init)=>{calls.push({url,init});return stream({processed:n++===0?1:0});}});
 for(let i=0;i<100;i++)assert.equal(d.wake(),true);await d.idle();assert.equal(calls.length,2);
 assert.ok(calls.every(c=>c.url==='https://worker.test/api/v1/internal/translations/drain' && c.init.body==='{}'));
 assert.ok(calls.every(c=>c.init.redirect==='error' && c.init.headers['X-Backend-Key']==='test-key'));
});
test('unconfigured transport rejects a wake and never fetches',async()=>{
 let called=false;const d=createTranslationDispatcher({workerApiUrl:'',backendKey:'key',fetchImpl:async()=>{called=true}});
 assert.equal(d.configured,false);assert.equal(d.wake(),false);await d.idle();assert.equal(called,false);
});
test('consumer HTTP errors do not cause unbounded automatic retry',async()=>{
 let n=0;const errors=[];const d=createTranslationDispatcher({workerApiUrl:'https://worker.test',backendKey:'key',fetchImpl:async()=>{n++;return new Response('',{status:503})},onError:e=>errors.push(e)});
 d.wake();await d.idle();assert.equal(n,1);assert.deepEqual(errors,['TRANSLATION_DISPATCH_UNAVAILABLE']);
});
test('a disconnected observation is not a successful generation result',async()=>{
 const errors=[];const d=createTranslationDispatcher({workerApiUrl:'https://worker.test',backendKey:'key',fetchImpl:async()=>new Response('data: {"type":"open"}\n\n',{headers:{'Content-Type':'text/event-stream'}}),onError:e=>errors.push(e)});
 d.wake();await d.idle();assert.equal(errors.length,1);
});
test('one process pump is bounded even with an endless backlog',async()=>{
 let n=0;const d=createTranslationDispatcher({workerApiUrl:'https://worker.test',backendKey:'key',fetchImpl:async()=>{n++;return stream({processed:1})}});
 d.wake();await d.idle();assert.equal(n,4);
});
test('SSE frames split across network chunks are parsed without buffering the whole job',async()=>{
 let n=0;const errors=[];const d=createTranslationDispatcher({workerApiUrl:'https://worker.test',backendKey:'key',fetchImpl:async()=>{
  n++;return new Response(new ReadableStream({start(c){for(const s of ['data: {"type":"hea','rtbeat"}\n\n','data: {"type":"done","processed":0}\n','\n'])c.enqueue(encoder.encode(s));c.close()}}),{headers:{'Content-Type':'text/event-stream'}});
 },onError:e=>errors.push(e)});d.wake();await d.idle();assert.equal(n,1);assert.equal(errors.length,0);
});
test('unexpected large executor bodies are stopped rather than retained in memory',async()=>{
 let cancelled=false;const errors=[];const d=createTranslationDispatcher({workerApiUrl:'https://worker.test',backendKey:'key',fetchImpl:async()=>new Response(new ReadableStream({pull(c){c.enqueue(new Uint8Array(65537))},cancel(){cancelled=true}}),{headers:{'Content-Type':'text/event-stream'}}),onError:e=>errors.push(e)});
 d.wake();await d.idle();assert.equal(cancelled,true);assert.equal(errors.length,1);
});
test('a later explicit wake can recover after a failed callback',async()=>{
 let n=0;const d=createTranslationDispatcher({workerApiUrl:'https://worker.test',backendKey:'key',fetchImpl:async()=>++n===1?new Response('',{status:503}):stream({processed:0})});
 d.wake();await d.idle();d.wake();await d.idle();assert.equal(n,2);
});
