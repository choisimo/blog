const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture,source,network,context,root}=require('./support.cjs');
const path=require('node:path'),fs=require('node:fs'),os=require('node:os');
const repo=require(path.join(root,'workers/api-gateway/src/lib/translation-job-repository.ts'));
const work=require(path.join(root,'workers/api-gateway/src/routes/lib/translation-jobs.ts'));
const service=require(path.join(root,'workers/api-gateway/src/lib/translation-service.ts'));
const route=require(path.join(root,'workers/api-gateway/src/routes/translate.ts'));
const urls=require(path.join(root,'shared/src/contracts/translation-path.js'));
const outbox=require(path.join(root,'workers/api-gateway/src/lib/domain-outbox.ts'));
const policy=()=>({enabled:true,allowWarm:true,maxConcurrent:2,maxAttempts:3,dailyAttempts:50,dailyTokenBudget:2000000,postDailyAttempts:6,maxPending:80});
async function enqueue(env,p=source(),options={}){return work.startTranslationJob(env,p,'en',options)}
async function admit(t,env,p=source(),options={}){const n=network(t,env,{posts:[p],...options});const job=(await enqueue(env,p)).job;return {n,job}}
const rows=(raw,table)=>raw.prepare(`SELECT * FROM ${table}`).all();

for(const slug of ['감동을_잃어버린_그대들에게','Container Network Interface','_index','release.v1','C++','한글'.normalize('NFD')]){
 test(`translation selector accepts and canonicalizes ${slug}`,()=>{
  const value=urls.normalizeTranslationSelectors({year:'2026',slug:encodeURIComponent(slug),targetLang:'en'});
  assert.equal(value.slug,slug.normalize('NFC'));
  assert.ok(urls.translationUrls('https://api.test',value).cacheUrl.includes(encodeURIComponent(slug.normalize('NFC'))));
 });
}
for(const slug of ['.','..','a/b','a\\b','%252f','%2F','a\n','a%00','bad%','a?b','a#b','%252e%252e']){
 test(`translation selector rejects unsafe segment ${JSON.stringify(slug)}`,()=>assert.throws(()=>urls.normalizeTranslationSlug(slug)));
}
test('every supplied public post is accepted by the shared selector',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'frontend/public/posts-manifest.json'),'utf8'));
 const publicPosts=manifest.items.filter(p=>p.published!==false);
 assert.ok(publicPosts.length > 0, 'the selector must be checked against a nonempty public catalog');
 for(const p of publicPosts)assert.equal(urls.normalizeTranslationSelectors({...p,targetLang:'en'}).slug,p.slug.normalize('NFC'));
});
test('100 concurrent admissions share one job and one durable outbox record',async t=>{
 const {env,raw}=fixture(t);const jobs=await Promise.all(Array.from({length:100},()=>enqueue(env)));
 assert.equal(new Set(jobs.map(j=>j.job.id)).size,1);assert.equal(jobs.filter(j=>j.created).length,1);
 assert.equal(rows(raw,'translation_jobs').length,1);assert.equal(rows(raw,'domain_outbox').length,1);
});
test('100 public requests return the same job; the wake contains no source and is coalesced',async t=>{
 const {env,raw}=fixture(t);const n=network(t,env);const contexts=Array.from({length:100},()=>context(env));
 const responses=await Promise.all(contexts.map(c=>route.cached(c)));await Promise.all(contexts.flatMap(c=>c.waits));
 const values=await Promise.all(responses.map(r=>r.json()));
 assert.equal(new Set(values.map(p=>p.job.id)).size,1);assert.ok(responses.every(r=>r.status===202));
 assert.equal(n.generations.length,0);const wakes=n.calls.filter(c=>c.url.endsWith('/wake'));assert.equal(wakes.length,1);
 assert.equal(wakes[0].init.body,'{}');assert.equal(rows(raw,'domain_outbox').length,1);
});
test('public, internal and warm admission use the same execution ledger',async t=>{
 const {env,raw}=fixture(t);network(t,env);
 const [warm,interactive]=await Promise.all([enqueue(env,source(),{priority:'publish'}),enqueue(env,source(),{priority:'interactive'})]);
 assert.equal(warm.job.id,interactive.job.id);
 // The competing interactive call must promote the winning warm insert without another GET.
 assert.equal(rows(raw,'translation_jobs')[0].priority,100);
 const result=await Promise.all(Array.from({length:8},()=>work.drainTranslationJobs(env)));
 assert.equal(result.reduce((sum,r)=>sum+r.processed,0),1);assert.equal(rows(raw,'translation_attempts').length,1);
});
test('the production generator persists three checkpoints and a validated current cache',async t=>{
 const {env,raw}=fixture(t);const {n,job}=await admit(t,env);
 assert.equal((await work.drainTranslationJobs(env)).processed,1);
 assert.equal(n.generations.length,3);assert.equal(rows(raw,'translation_attempts').length,1);
 assert.equal(rows(raw,'domain_outbox')[0].status,'processed');
 const saved=await repo.getTranslationJobById(env.DB,job.id);
 assert.equal(saved.status,'succeeded');assert.deepEqual(Object.keys(JSON.parse(saved.checkpoint_json)).sort(),['content','description','title']);
 assert.equal(rows(raw,'post_translations_cache')[0].source_version,job.source_version);
 for(const [i,stage] of ['title','description','content'].entries()){
  assert.equal(n.generations[i].headers.get('Idempotency-Key'),`${job.id}:${stage}`);
  assert.ok(n.generations[i].body.maxTokens>0);assert.ok(n.generations[i].body.timeout<=240000);
 }
});
test('completed jobs are only read on subsequent GET requests',async t=>{
 const {env,raw}=fixture(t);const {n}=await admit(t,env);await work.drainTranslationJobs(env);
 const response=await route.cached(context(env));assert.equal(response.status,200);
 assert.equal((await response.json()).data.cached,true);assert.equal(n.generations.length,3);assert.equal(rows(raw,'translation_jobs').length,1);
});
test('nested error messages returned publicly are a safe allowlist, not provider details',async t=>{
 const {env}=fixture(t);const {job}=await admit(t,env);
 await env.DB.prepare("UPDATE translation_jobs SET status='failed',error_json=? WHERE id=?").bind(JSON.stringify({code:'CUSTOM','message':'secret=do-not-disclose',retryable:true}),job.id).run();
 const response=await route.status(context(env,undefined,{jobId:job.id}));
 const value=await response.json();assert.equal(value.data.job.error.code,'TRANSLATION_FAILED');
 assert.ok(!JSON.stringify(value).includes('secret='));assert.equal(value.data.job.error.retryable,false);
});
test('an internal-first job has public status and canonical encoded URLs for anonymous observers',async t=>{
 const {env}=fixture(t);const p=source({slug:'한글 띄어쓰기'});network(t,env,{posts:[p]});
 const {job}=await enqueue(env,p,{origin:'https://internal.test'});
 const response=await route.status(context(env,{year:p.year,slug:p.slug,targetLang:'en'},{jobId:job.id}));
 const value=(await response.json()).data.job;
 assert.match(value.statusUrl,/https:\/\/api.test\/api\/v1\/public/);assert.ok(value.statusUrl.includes(encodeURIComponent(p.slug)));
 assert.equal(response.headers.get('Location'),value.statusUrl+'?jobId='+job.id);
});
test('public status denies another post job ID and never starts generation',async t=>{
 const {env}=fixture(t);const n=network(t,env,{posts:[source(),source({slug:'other'})]});const {job}=await enqueue(env);
 const response=await route.status(context(env,{year:'2026',slug:'other',targetLang:'en'},{jobId:job.id}));
 assert.equal(response.status,404);assert.equal(n.generations.length,0);
});
test('an unpublished post cannot disclose status or cached content',async t=>{
 const {env}=fixture(t);const n=network(t,env,{posts:[source()]});const {job}=await enqueue(env);n.posts[0].published=false;
 assert.equal((await route.status(context(env,undefined,{jobId:job.id}))).status,404);
 assert.equal((await route.cached(context(env))).status,404);assert.equal(n.generations.length,0);
});
test('read-only cache misses and status queries do not admit jobs',async t=>{
 const {env,raw}=fixture(t);network(t,env);
 assert.equal((await route.cached(context(env,undefined,{observe:'true'}))).status,404);
 assert.equal((await route.status(context(env))).status,404);assert.equal(rows(raw,'translation_jobs').length,0);
});
test('malformed status selectors return 400, not a server failure',async t=>{
 const {env}=fixture(t);network(t,env);
 assert.equal((await route.status(context(env,undefined,{jobId:'bad\njob'}))).status,400);
 assert.equal((await route.cached(context(env,{year:'2026',slug:'%2f',targetLang:'en'}))).status,400);
});
test('a source-language request returns the source without generating',async t=>{
 const {env,raw}=fixture(t);const p=source({sourceLang:'en'});const n=network(t,env,{posts:[p]});
 const response=await route.cached(context(env));const value=await response.json();
 assert.equal(value.data.isAiGenerated,false);assert.equal(value.data.content,p.content);assert.equal(n.generations.length,0);assert.equal(rows(raw,'translation_jobs').length,0);
});
test('known 429 rejection defers with bounded attempts and resumes after the saved title',async t=>{
 const {env,raw}=fixture(t);const {n,job}=await admit(t,env,source(),{generate:async(prompt,index)=>index===2?new Response('',{status:429}):prompt.includes('Title:')?'Title':prompt.includes('Description:')?'Description':'# Translated\n\nAn example paragraph in the target language.'});
 assert.equal((await work.drainTranslationJobs(env)).deferred,1);
 const paused=await repo.getTranslationJobById(env.DB,job.id);assert.equal(paused.status,'deferred');assert.equal(paused.active_stage,null);
 assert.equal(Object.keys(JSON.parse(paused.checkpoint_json)).length,1);
 const get=await route.cached(context(env));await get.text();assert.equal(n.generations.length,2);
 raw.prepare("UPDATE translation_jobs SET available_at='2000-01-01T00:00:00.000Z'").run();
 assert.equal((await work.drainTranslationJobs(env)).processed,1);assert.equal(n.generations.length,4);
 assert.equal(n.generations[1].headers.get('Idempotency-Key'),n.generations[2].headers.get('Idempotency-Key'));
 assert.equal(rows(raw,'translation_attempts').length,2);
});
test('three rejected attempts become terminal; subsequent GET cannot reset the retry counter',async t=>{
 const {env,raw}=fixture(t);const {n}=await admit(t,env,source(),{generate:async()=>new Response('',{status:429})});
 for(let i=0;i<3;i++){await work.drainTranslationJobs(env);raw.prepare("UPDATE translation_jobs SET available_at='2000-01-01T00:00:00.000Z'").run();}
 for(let i=0;i<10;i++)await route.cached(context(env));
 assert.equal(n.generations.length,3);assert.equal(rows(raw,'translation_jobs')[0].status,'failed');assert.equal(JSON.parse(rows(raw,'translation_jobs')[0].error_json).code,'MAX_ATTEMPTS');
});
test('unknown outcome is quarantined; 100 observations never start another model call',async t=>{
 const {env,raw}=fixture(t);const {n}=await admit(t,env,source(),{generate:async()=>{throw new DOMException('timeout','TimeoutError')}});
 assert.equal((await work.drainTranslationJobs(env)).failed,1);
 const results=await Promise.all(Array.from({length:100},()=>route.cached(context(env))));
 assert.ok(results.every(r=>r.status===200));assert.equal(n.generations.length,1);
 assert.equal(JSON.parse(rows(raw,'translation_jobs')[0].error_json).code,'RESULT_UNKNOWN');
});
test('worker loss before submission resumes; loss after submission is not automatically charged again',async t=>{
 const {env,raw}=fixture(t);const {job}=await enqueue(env);const claimed=await repo.claimNextTranslationJob(env.DB,policy());
 raw.prepare("UPDATE translation_jobs SET lock_expires_at='2000-01-01T00:00:00.000Z'").run();
 await repo.recoverExpiredTranslationJobs(env.DB);assert.equal((await repo.getTranslationJobById(env.DB,job.id)).status,'deferred');
 const next=await repo.claimNextTranslationJob(env.DB,policy());assert.equal(next.id,claimed.id);assert.ok(next.lease_version>claimed.lease_version);
 await repo.markTranslationStage(env.DB,next,'title');raw.prepare("UPDATE translation_jobs SET lock_expires_at='2000-01-01T00:00:00.000Z'").run();
 await repo.recoverExpiredTranslationJobs(env.DB);assert.equal((await repo.getTranslationJobById(env.DB,job.id)).status,'failed');
 assert.equal(await repo.claimNextTranslationJob(env.DB,policy()),null);
});
test('an expired third pre-submission lease is terminal rather than deferred forever',async t=>{
 const {env,raw}=fixture(t);await enqueue(env);await repo.claimNextTranslationJob(env.DB,policy());
 raw.prepare("UPDATE translation_jobs SET attempts=3,lock_expires_at='2000-01-01T00:00:00.000Z'").run();await repo.recoverExpiredTranslationJobs(env.DB);
 assert.equal(rows(raw,'translation_jobs')[0].status,'failed');assert.equal(JSON.parse(rows(raw,'translation_jobs')[0].error_json).code,'MAX_ATTEMPTS');
});
test('lost lease owners cannot checkpoint, settle or publish',async t=>{
 const {env,raw}=fixture(t);await enqueue(env);const claimed=await repo.claimNextTranslationJob(env.DB,policy());
 raw.prepare("UPDATE translation_jobs SET lock_expires_at='2000-01-01T00:00:00.000Z'").run();await repo.recoverExpiredTranslationJobs(env.DB);await repo.claimNextTranslationJob(env.DB,policy());
 await assert.rejects(repo.checkpointTranslation(env.DB,claimed,{title:'stale'}));
 await assert.rejects(repo.commitTranslationCache(env.DB,claimed,{title:'stale',description:'stale',content:'stale'}));
 assert.equal(await repo.settleTranslationJob(env.DB,claimed,{status:'succeeded'}),false);assert.equal(rows(raw,'post_translations_cache').length,0);
});
test('a newer source admission fences the older cache write',async t=>{
 const {env,raw}=fixture(t);await enqueue(env);const claimed=await repo.claimNextTranslationJob(env.DB,policy());
 await enqueue(env,source({title:'New source title'}));
 await assert.rejects(repo.commitTranslationCache(env.DB,claimed,{title:'old',description:'old',content:'old'}),e=>e.code==='SUPERSEDED');
 assert.equal(rows(raw,'post_translations_cache').length,0);
});
test('an original edited while generation runs is not published under the new original',async t=>{
 const {env,raw}=fixture(t);const posts=[source()];let called=0;const n=network(t,env,{posts,generate:async(prompt)=>{
  called++;if(called===3)posts[0].title='Changed title';return prompt.includes('Title:')?'Title':prompt.includes('Description:')?'Description':'# Translated\n\nAn example paragraph in the target language.';
 }});await enqueue(env);await work.drainTranslationJobs(env);
 assert.equal(n.generations.length,3);assert.equal(rows(raw,'post_translations_cache').length,0);assert.equal(JSON.parse(rows(raw,'translation_jobs')[0].error_json).code,'SUPERSEDED');
});
test('50,000-character content is explicitly blocked before billing, not silently truncated',async t=>{
 const {env,raw}=fixture(t);const {n}=await admit(t,env,source({content:'a'.repeat(50000)}));await work.drainTranslationJobs(env);
 assert.equal(n.generations.length,0);assert.equal(rows(raw,'post_translations_cache').length,0);assert.equal(JSON.parse(rows(raw,'translation_jobs')[0].error_json).code,'CONTENT_TOO_LONG');
});
test('a grossly incomplete result does not replace an existing cache',async t=>{
 const {env,raw}=fixture(t);const p=source({content:'a'.repeat(3000)});const {n}=await admit(t,env,p,{generate:async()=> 'tiny'});
 raw.prepare("INSERT INTO post_translations_cache(post_slug,year,source_lang,target_lang,title,description,content,content_hash) VALUES ('sample','2026','ko','en','saved','saved',?,'legacy')").run('saved'.repeat(600));
 await work.drainTranslationJobs(env);assert.equal(n.generations.length,3);assert.equal(rows(raw,'post_translations_cache')[0].title,'saved');assert.equal(JSON.parse(rows(raw,'translation_jobs')[0].error_json).code,'INVALID_TRANSLATION');
});
for(const field of ['title','description','content','sourceLang'])test(`source version includes ${field}`,async()=>{
 const p=source(),other={...p,[field]:field==='sourceLang'?'en':p[field]+' new'};
 const a=await service.translationSourceVersion(p,'en'),b=await service.translationSourceVersion(other,'en');
 assert.match(a,/^sha256:[0-9a-f]{64}$/);assert.notEqual(a,b);
});
test('the target locale participates in the source version',async()=>assert.notEqual(await service.translationSourceVersion(source(),'en'),await service.translationSourceVersion(source(),'ko')));
test('global concurrency is atomic across independent SQLite connections',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'a02-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const a=fixture(t,path.join(dir,'test.db')),b=fixture(t,path.join(dir,'test.db'));
 for(let i=0;i<8;i++)await enqueue(a.env,source({slug:`job-${i}`}));
 const claims=await Promise.all(Array.from({length:20},(_,i)=>repo.claimNextTranslationJob(i%2?a.DB:b.DB,policy())));
 assert.equal(claims.filter(Boolean).length,2);assert.equal(rows(a.raw,'translation_attempts').length,2);
});
test('per-day attempt caps reserve atomically and do not reset on GET',async t=>{
 const {env,raw}=fixture(t);for(let i=0;i<8;i++)await enqueue(env,source({slug:`job-${i}`}));
 const p={...policy(),dailyAttempts:1,maxConcurrent:8};
 const claims=await Promise.all(Array.from({length:10},()=>repo.claimNextTranslationJob(env.DB,p)));
 assert.equal(claims.filter(Boolean).length,1);assert.equal(rows(raw,'translation_attempts').length,1);
 assert.ok(rows(raw,'translation_jobs').some(j=>j.status==='deferred' && JSON.parse(j.error_json).code==='TRANSLATION_BUDGET'));
});
test('token reservation cap is separate from the image quota and consumed before submission',async t=>{
 const {env,raw}=fixture(t);await enqueue(env);
 assert.equal(await repo.claimNextTranslationJob(env.DB,{...policy(),dailyTokenBudget:1}),null);
 assert.equal(rows(raw,'translation_attempts').length,0);assert.equal(rows(raw,'translation_jobs')[0].status,'deferred');
});
test('KST midnight resets the quota day, not the browser timezone',()=>{
 assert.equal(repo.translationQuotaDay('2026-09-10T14:59:59.000Z'),'2026-09-10');
 assert.equal(repo.translationQuotaDay('2026-09-10T15:00:00.000Z'),'2026-09-11');
});
test('interactive work skips warm admission checks, but old warm work can age ahead when permitted',async t=>{
 const {env,raw}=fixture(t);await enqueue(env,source({slug:'warm'}),{priority:'publish'});await enqueue(env,source({slug:'reader'}));
 raw.prepare("UPDATE translation_jobs SET created_at='2000-01-01T00:00:00.000Z' WHERE slug='warm'").run();
 assert.equal((await repo.claimNextTranslationJob(env.DB,{...policy(),allowWarm:false})).slug,'reader');
 assert.equal((await repo.claimNextTranslationJob(env.DB,policy())).slug,'warm');
});
test('feature-disabled requests are observable as deferred without invoking the backend',async t=>{
 const {env,raw}=fixture(t);env.TRANSLATION_EXECUTION_ENABLED='false';const n=network(t,env);const c=context(env);const response=await route.cached(c);await Promise.all(c.waits);
 assert.equal(response.status,202);assert.equal((await response.json()).job.status,'deferred');
 await work.drainTranslationJobs(env);assert.equal(n.generations.length,0);assert.equal(rows(raw,'translation_attempts').length,0);
});
test('lost wake-up does not lose the durable work; scheduled drain executes it',async t=>{
 const {env}=fixture(t);const {n,job}=await admit(t,env,source(),{wakeStatus:503});
 assert.equal(await work.wakeTranslationExecutor(env,job),false);assert.equal((await work.drainTranslationJobs(env)).processed,1);assert.equal(n.generations.length,3);
});
test('legacy translation outbox is handed off once, not executed by the feed consumer',async t=>{
 const {env,raw}=fixture(t);const n=network(t,env);
 await outbox.appendDomainOutboxEvent(env.DB,{stream:'ai.artifact.generate',aggregateId:'legacy',eventType:'translation.generate',payload:{year:'2026',slug:'sample',targetLang:'en',priority:'interactive'}});
 assert.equal((await work.drainTranslationJobs(env)).processed,1);await work.drainTranslationJobs(env);
 assert.equal(n.generations.length,3);assert.equal(rows(raw,'domain_outbox').length,2);assert.ok(rows(raw,'domain_outbox').every(e=>e.status==='processed'));
});
test('generic feed claims explicitly exclude translation events',async t=>{
 const {env}=fixture(t);await enqueue(env);
 await outbox.appendDomainOutboxEvent(env.DB,{stream:'ai.artifact.generate',aggregateId:'feed',eventType:'feed.lens.generate',payload:{}});
 const claimed=await outbox.claimDomainOutboxEvents(env.DB,{stream:'ai.artifact.generate',excludeEventTypes:['translation.generate']});
 assert.equal(claimed.length,1);assert.equal(claimed[0].eventType,'feed.lens.generate');
});
test('administrative invalidation fences in-flight writes without deleting the job record',async t=>{
 const {env,raw}=fixture(t);await enqueue(env);const job=await repo.claimNextTranslationJob(env.DB,policy());
 await repo.invalidateTranslationCache(env.DB,'2026','sample','en');
 await assert.rejects(repo.commitTranslationCache(env.DB,job,{title:'late',description:'late',content:'late'}));
 assert.equal(rows(raw,'translation_jobs').length,1);assert.equal(rows(raw,'translation_jobs')[0].status,'failed');
});
test('explicit same-key regeneration deduplicates even after a different revision was requested',async t=>{
 const {env,raw}=fixture(t);const a=await enqueue(env,source(),{refreshKey:'intent-A'});const b=await enqueue(env,source(),{refreshKey:'intent-B'});const again=await enqueue(env,source(),{refreshKey:'intent-A'});
 assert.equal(a.job.id,again.job.id);assert.notEqual(a.job.id,b.job.id);assert.equal(rows(raw,'translation_jobs').length,2);
});
test('full backlog cannot leave a half-created outbox event',async t=>{
 const {env,raw}=fixture(t);
 const p={year:'2026',slug:'first',targetLang:'en',sourceLang:'ko',sourceVersion:'version',priority:100,tokenBudget:100,urls:{cacheUrl:'c',statusUrl:'s',generateUrl:'g'},maxPending:1};
 await repo.enqueueTranslationJob(env.DB,p);await assert.rejects(repo.enqueueTranslationJob(env.DB,{...p,slug:'second'}),e=>e.status===429);
 assert.equal(rows(raw,'translation_jobs').length,1);assert.equal(rows(raw,'domain_outbox').length,1);
});
test('the internal drain stream reports actual completion rather than an early accepted result',async t=>{
 const {env}=fixture(t);await admit(t,env);const response=work.translationDrainResponse(env);const text=await response.text();
 assert.match(response.headers.get('content-type'),/event-stream/);assert.match(text,/"type":"open"/);assert.match(text,/"type":"done","processed":1/);
});
test('a superseded queued revision is discarded before a model request',async t=>{
 const {env}=fixture(t);const n=network(t,env);await enqueue(env);await enqueue(env,source(),{refreshKey:'new-intent'});
 assert.equal((await work.drainTranslationJobs(env)).failed,1);assert.equal(n.generations.length,0);
 assert.equal((await work.drainTranslationJobs(env)).processed,1);assert.equal(n.generations.length,3);
});
test('0041 preserves old jobs/cache and quarantines old in-flight work during migration',()=>{
 const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(':memory:');
 try {
  for(const f of ['0005_translation_cache.sql','0024_domain_outbox.sql','0026_translation_jobs.sql','0029_translation_job_leases.sql','0033_translation_job_lease_fence.sql','0034_domain_outbox_last_attempt_at.sql'])db.exec(fs.readFileSync(path.join(root,'workers/migrations',f),'utf8'));
  for(const state of ['running','succeeded','failed'])db.prepare(`INSERT INTO translation_jobs(id,key,status,year,slug,target_lang,content_hash,started_at,status_url,cache_url,generate_url) VALUES (?,?,?,'2026',?,'en',?,'2026-09-10','s','c','g')`).run(state,state,state,state,state);
  db.prepare("INSERT INTO post_translations_cache(post_slug,year,source_lang,target_lang,title,content,content_hash) VALUES ('preserved','2026','ko','en','Keep me','Keep body','old')").run();
  db.exec(fs.readFileSync(path.join(root,'workers/migrations/0041_translation_execution.sql'),'utf8'));
  assert.equal(db.prepare('SELECT COUNT(*) n FROM translation_jobs').get().n,3);
  assert.equal(db.prepare("SELECT content FROM post_translations_cache WHERE post_slug='preserved'").get().content,'Keep body');
  assert.equal(JSON.parse(db.prepare("SELECT error_json FROM translation_jobs WHERE id='running'").get().error_json).code,'RESULT_UNKNOWN');
  assert.equal(db.prepare("SELECT status FROM translation_jobs WHERE id='succeeded'").get().status,'succeeded');
 } finally {db.close();}
});

for (const failure of ['network', 'http', 'json', 'shape']) {
 test(`source ${failure} failure is deferred without a paid submission`, async t => {
  const {env,raw}=fixture(t);network(t,env);const job=(await enqueue(env)).job;
  const original=global.fetch;
  global.fetch=async (input,init)=>{
   if(String(input).endsWith('/posts-manifest.json')){
    if(failure==='network')throw new Error('temporary socket failure');
    if(failure==='http')return new Response('upstream outage',{status:503});
    if(failure==='json')return new Response('not JSON');
    return Response.json({unexpected:true});
   }
   return original(input,init);
  };
  assert.equal((await work.drainTranslationJobs(env)).deferred,1);
  const current=await repo.getTranslationJobById(env.DB,job.id);
  assert.equal(current.status,'deferred');assert.equal(current.active_stage,null);
  assert.equal(JSON.parse(current.error_json).code,'SOURCE_UNAVAILABLE');
  assert.equal(rows(raw,'post_translations_cache').length,0);
 });
}
test('malformed legacy events cannot starve the next valid outbox admission',async t=>{
 const {env,raw}=fixture(t);network(t,env);
 raw.prepare(`INSERT INTO domain_outbox(id,stream,aggregate_id,event_type,payload_json,status,retry_count,next_attempt_at,created_at,updated_at,idempotency_key)
 VALUES('bad','ai.artifact.generate','bad','translation.generate','{','pending',0,'2020-01-01','2020-01-01','2020-01-01','bad')`).run();
 assert.equal((await work.drainTranslationJobs(env)).processed,0);
 assert.equal(raw.prepare("SELECT status FROM domain_outbox WHERE id='bad'").get().status,'dead_letter');
 await enqueue(env);assert.equal((await work.drainTranslationJobs(env)).processed,1);
});
