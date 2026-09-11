const {test}=require('node:test'),assert=require('node:assert/strict');
require('../r07-1/support.cjs').register();
const {observeTranslation}=require('../../../frontend/src/services/content/translationObservation.ts');
const job=(status='running',extra={})=>({id:'job-1',status,statusUrl:'/status',cacheUrl:'/cache',generateUrl:'/generate',...extra});
const translation={title:'title',description:'desc',content:'body',cached:true};
const micro=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function fixture(t,values={}){
 t.mock.timers.enable({apis:['setTimeout']});
 const controller=new AbortController(),events=[],lookups=[],statuses=[];
 const api={signal:controller.signal,onChange:e=>events.push(e),
  lookup:async o=>{lookups.push(o);return {translation:null,pending:true,job:job()};},
  status:async(id,o)=>{statuses.push({id,...o});return job();},...values};
 const promise=observeTranslation(api);return {controller,events,lookups,statuses,promise};
}
test('immediate valid cache renders ready without a status poll',async t=>{
 const f=fixture(t,{lookup:async()=>({translation,pending:false,job:null})});await f.promise;
 assert.equal(f.events.at(-1).status,'ready');assert.deepEqual(f.events.at(-1).translation,translation);assert.equal(f.statuses.length,0);
});
test('observation budget expiry becomes paused, not AI_TIMEOUT or a server failure',async t=>{
 const f=fixture(t);await micro();t.mock.timers.tick(90_001);await f.promise;
 assert.equal(f.events.at(-1).status,'paused');assert.equal(f.events.at(-1).job.id,'job-1');assert.ok(!f.events.some(e=>e.status==='error'));
});
test('a request that ignores AbortSignal cannot prevent observation from ending',async t=>{
 const f=fixture(t,{lookup:()=>new Promise(()=>{})});await micro();t.mock.timers.tick(90_001);await f.promise;
 assert.equal(f.events.at(-1).status,'paused');
});
test('polling uses the saved ID and a read-only cache read after success',async t=>{
 let count=0;const options=[];
 const f=fixture(t,{lookup:async o=>{options.push(o);return ++count===1?{translation:null,pending:true,job:job()}:{translation,pending:false,job:null};},status:async()=>job('succeeded')});
 await micro();t.mock.timers.tick(3000);await f.promise;
 assert.equal(count,2);assert.equal(options[1].readOnly,true);assert.equal(options[1].jobId,'job-1');assert.equal(f.events.at(-1).status,'ready');
});
test('resume starts with status lookup, never a new admission',async t=>{
 let lookupCount=0,statusCount=0;
 const f=fixture(t,{resumeJobId:'job-1',status:async id=>{assert.equal(id,'job-1');statusCount++;return job('succeeded');},
  lookup:async o=>{lookupCount++;assert.equal(o.readOnly,true);return {translation,pending:false,job:null};}});
 await f.promise;assert.equal(statusCount,1);assert.equal(lookupCount,1);assert.equal(f.events.at(-1).status,'ready');
});
test('terminal failed job preserves stale text and never submits a retry',async t=>{
 const f=fixture(t,{lookup:async()=>({translation,pending:false,job:job('failed',{error:{code:'RESULT_UNKNOWN',message:'Review required',retryable:false}})})});
 await f.promise;assert.equal(f.events.at(-1).status,'error');assert.deepEqual(f.events.at(-1).translation,translation);assert.equal(f.statuses.length,0);
});
test('deferred budget state is visible without clearing the text while waiting',async t=>{
 const f=fixture(t,{lookup:async()=>({translation,pending:true,job:job('deferred',{retryAt:new Date(Date.now()+86400000).toISOString()})})});
 await micro();assert.equal(f.events.at(-1).status,'deferred');assert.deepEqual(f.events.at(-1).translation,translation);
 t.mock.timers.tick(90_001);await f.promise;assert.equal(f.events.at(-1).status,'paused');assert.deepEqual(f.events.at(-1).translation,translation);
});
test('network disconnection during status polling preserves text and permits reconnection',async t=>{
 const f=fixture(t,{lookup:async()=>({translation,pending:true,job:job()}),status:async()=>{throw new TypeError('offline');}});
 await micro();t.mock.timers.tick(3000);await f.promise;assert.equal(f.events.at(-1).status,'paused');assert.deepEqual(f.events.at(-1).translation,translation);
});
test('changing language aborts observation and discards a late response',async t=>{
 let resolve;const f=fixture(t,{lookup:()=>new Promise(r=>{resolve=r})});await micro();f.controller.abort();await f.promise;
 const n=f.events.length;resolve({translation,pending:false,job:null});await micro();assert.equal(f.events.length,n);
});
test('closing the page does not call a generation cancellation endpoint',async t=>{
 const f=fixture(t);await micro();f.controller.abort();await f.promise;
 assert.equal(f.lookups.length,1);assert.equal(f.statuses.length,0);assert.equal(f.events.at(-1).status,'warming');
});
test('legacy 202 without a job is polled with observation-only flags',async t=>{
 let n=0;const options=[];
 const f=fixture(t,{lookup:async o=>{options.push(o);return ++n===1?{translation:null,pending:true,job:null,retryAfterSeconds:1}:{translation,pending:false,job:null};}});
 await micro();t.mock.timers.tick(1000);await f.promise;assert.equal(options[1].readOnly,true);assert.equal(f.events.at(-1).status,'ready');
});
test('succeeded status without validated cache does not show a false ready result',async t=>{
 const f=fixture(t,{resumeJobId:'job-1',status:async()=>job('succeeded'),lookup:async()=>({translation,pending:true,stale:true,job:job('succeeded')})});
 await f.promise;assert.equal(f.events.at(-1).status,'paused');assert.ok(!f.events.some(e=>e.status==='ready'));
});
test('a failed resumed job does not fall through to a new generating GET',async t=>{
 const f=fixture(t,{resumeJobId:'job-1',status:async()=>job('failed',{error:{code:'MAX_ATTEMPTS',message:'Limit reached'}})});
 await f.promise;assert.equal(f.lookups.length,0);assert.equal(f.events.at(-1).status,'error');
});
