// Real Hono + D1. Upstream public source fetch is a fixture; no paid model request is made.
import {env,createExecutionContext,waitOnExecutionContext} from 'cloudflare:test';
import {Hono} from 'hono';
import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
import routes from '../src/routes/translate';
import {signJwt} from '../src/lib/jwt';
import {startTranslationJob,drainTranslationJobs,translationDrainResponse} from '../src/routes/lib/translation-jobs';
import {fetchPublishedPost,translationTokenBudget} from '../src/lib/translation-service';
import type {Env,HonoEnv} from '../src/types';
const source={year:'2026',slug:'한글 글',title:'Source title',description:'Source description',content:'# Source content'};
let published=true;
const bindings=()=>({...env,ENV:'development',JWT_SECRET:'translation-route-test-secret',PUBLIC_SITE_URL:'https://public.test',
  BACKEND_ORIGIN:'https://backend.test',TRANSLATION_EXECUTION_ENABLED:'false'}) as Env;
function app(){const a=new Hono<HonoEnv>();a.route('/api/v1',routes);return a;}
async function request(suffix='',init?:RequestInit,overrides:Partial<Env>={}){const ctx=createExecutionContext();const response=await app().fetch(
  new Request(`https://api.test/api/v1/public/posts/2026/${encodeURIComponent(source.slug)}/translations/en${suffix}`,init),{...bindings(),...overrides},ctx);await waitOnExecutionContext(ctx);return response;}
beforeEach(async()=>{
 published=true;for(const name of ['translation_attempts','translation_jobs','domain_outbox','post_translations_cache'])await env.DB.prepare(`DELETE FROM ${name}`).run();
 vi.spyOn(globalThis,'fetch').mockImplementation(async input=>{
  const url=String(input instanceof Request?input.url:input);
  if(url.endsWith('/posts-manifest.json'))return Response.json({items:published?[{...source,path:`/posts/2026/${encodeURIComponent(source.slug)}.md`,published:true}]:[]});
  if(url.startsWith('https://public.test/posts/'))return new Response(`---\ntitle: "${source.title}"\ndescription: "${source.description}"\ndefaultLanguage: ko\n---\n${source.content}`,{headers:{'Content-Type':'text/markdown'}});
  throw new Error('Unexpected upstream fetch');
 });
});
afterEach(()=>vi.restoreAllMocks());
describe('A02 translation HTTP contracts',()=>{
 it('promotes a pre-existing warm job immediately when a reader requests missing translation',async()=>{
  const config={...bindings(),TRANSLATION_EXECUTION_ENABLED:'true',TRANSLATION_WARM_ENABLED:'false'};
  const post=await fetchPublishedPost(config,source.year,source.slug);
  const warm=await startTranslationJob(config,post!,'en',{priority:'publish'});
  const response=await request('',undefined,config);
  expect(response.status).toBe(202);
  expect((await response.json() as {job:{id:string}}).job.id).toBe(warm.job.id);
  expect((await env.DB.prepare('SELECT priority FROM translation_jobs WHERE id=?').bind(warm.job.id).first<{priority:number}>())?.priority).toBe(100);
  expect((await env.DB.prepare('SELECT COUNT(*) n FROM translation_jobs').first<{n:number}>())?.n).toBe(1);
 });
 it('admits and wakes a cache miss, executes AI stages, then exposes the generated cache without another model call',async()=>{
  const config={...bindings(),TRANSLATION_EXECUTION_ENABLED:'true',TRANSLATION_WARM_ENABLED:'false'};
  const fetchSource=vi.mocked(fetch).getMockImplementation()!;
  const providerKeys:string[]=[];
  const providerLimits:number[]=[];
  let wakes=0;
  vi.mocked(fetch).mockImplementation(async(input,init)=>{
   const url=String(input instanceof Request?input.url:input);
   if(url==='https://backend.test/api/v1/internal/translations/wake') {
    wakes++;
    expect(new Headers(init?.headers).get('X-Backend-Key')).toBe(config.BACKEND_KEY);
    return Response.json({ok:true,data:{accepted:true}},{status:202});
   }
   if(url==='https://backend.test/api/v1/ai/generate') {
    const body=JSON.parse(String(init?.body)) as {prompt:string;maxTokens:number};
    providerKeys.push(new Headers(init?.headers).get('Idempotency-Key')!);
    providerLimits.push(body.maxTokens);
    const text=body.prompt.includes('Title:')?'Generated title':body.prompt.includes('Description:')?'Generated description':'# Translated content';
    return Response.json({ok:true,data:{text}});
   }
   return fetchSource(input,init);
  });
  const accepted=await request('',undefined,config);
  const queued=await accepted.json() as {job:{id:string}};
  expect(accepted.status).toBe(202);expect(wakes).toBe(1);expect(providerKeys).toHaveLength(0);
  expect(await drainTranslationJobs(config)).toMatchObject({processed:1,failed:0});
  expect(providerKeys).toEqual(['title','description','content'].map(stage=>`${queued.job.id}:${stage}`));
  expect(providerLimits).toEqual([2400,2400,16000]);
  const status=await request(`/status?jobId=${queued.job.id}`,undefined,config);
  expect((await status.json() as {data:{job:{status:string}}}).data.job.status).toBe('succeeded');
  const cached=await request(`?observe=true&jobId=${queued.job.id}`,undefined,config);
  expect(await cached.json()).toMatchObject({ok:true,data:{title:'Generated title',description:'Generated description',content:'# Translated content',isAiGenerated:true}});
  await request('',undefined,config);
  expect(providerKeys).toHaveLength(3);expect(wakes).toBe(1);
 });
 it('the backend drain callback prefers an existing reader job beyond the old candidate window',async()=>{
  const config={...bindings(),TRANSLATION_EXECUTION_ENABLED:'true',TRANSLATION_WARM_ENABLED:'false'};
  const post=await fetchPublishedPost(config,source.year,source.slug);
  for(let n=0;n<12;n++)await startTranslationJob(config,{...post!,slug:'old-'+n},'en');
  await env.DB.prepare("UPDATE translation_jobs SET created_at='2000-01-01T00:00:00.000Z'").run();
  const recent=await startTranslationJob(config,post!,'en');
  const fetchSource=vi.mocked(fetch).getMockImplementation()!;
  const providerKeys:string[]=[];
  vi.mocked(fetch).mockImplementation(async(input,init)=>{
   const url=String(input instanceof Request?input.url:input);
   if(url.endsWith('/translations/wake'))return Response.json({ok:true},{status:202});
   if(url==='https://backend.test/api/v1/ai/generate') {
    providerKeys.push(new Headers(init?.headers).get('Idempotency-Key')!);
    return Response.json({ok:true,data:{text:'Translated output'}});
   }
   return fetchSource(input,init);
  });
  await request(`?jobId=${recent.job.id}`,undefined,config);
  const frames=(await translationDrainResponse(config).text()).split('\n\n').filter(frame=>frame.startsWith('data: ')).map(frame=>JSON.parse(frame.slice(6)));
  expect(frames.at(-1)).toMatchObject({type:'done',processed:1,failed:0});
  expect(providerKeys).toEqual(['title','description','content'].map(stage=>`${recent.job.id}:${stage}`));
  expect((await env.DB.prepare('SELECT COUNT(*) n FROM translation_jobs WHERE id<>? AND attempts=0').bind(recent.job.id).first<{n:number}>())?.n).toBe(12);
 });
 it('refreshes an existing job wake without admission while observation and throttled reads do not wake it',async()=>{
  const config={...bindings(),TRANSLATION_EXECUTION_ENABLED:'true'};
  const post=await fetchPublishedPost(config,source.year,source.slug);
  const admitted=await startTranslationJob(config,post!,'en');
  const oldWake='2000-01-01T00:00:00.000Z';
  await env.DB.prepare('UPDATE translation_jobs SET last_wake_at=? WHERE id=?').bind(oldWake,admitted.job.id).run();
  const fetchSource=vi.mocked(fetch).getMockImplementation()!;
  let wakes=0;
  vi.mocked(fetch).mockImplementation(async(input,init)=>{
   if(String(input instanceof Request?input.url:input).endsWith('/translations/wake')) {
    wakes++;expect(init?.body).toBe('{}');return Response.json({ok:true},{status:202});
   }
   return fetchSource(input,init);
  });
  await request(`?observe=true&jobId=${admitted.job.id}`,undefined,config);
  await request(`/status?jobId=${admitted.job.id}`,undefined,config);
  expect(wakes).toBe(0);
  const response=await request(`?jobId=${admitted.job.id}`,undefined,config);
  expect(response.status).toBe(202);expect((await response.json() as {job:{id:string}}).job.id).toBe(admitted.job.id);
  expect(wakes).toBe(1);
  const job=await env.DB.prepare('SELECT attempts,last_wake_at FROM translation_jobs WHERE id=?').bind(admitted.job.id).first<{attempts:number;last_wake_at:string}>();
  expect(job?.attempts).toBe(0);expect(job?.last_wake_at).not.toBe(oldWake);
  await request(`?jobId=${admitted.job.id}`,undefined,config);expect(wakes).toBe(1);
  for(const table of ['translation_jobs','domain_outbox'])expect((await env.DB.prepare(`SELECT COUNT(*) n FROM ${table}`).first<{n:number}>())?.n).toBe(1);
  expect((await env.DB.prepare('SELECT COUNT(*) n FROM translation_attempts').first<{n:number}>())?.n).toBe(0);
 });
 it('keeps an empty title response terminal without generating again on a repeated drain or read',async()=>{
  const config={...bindings(),TRANSLATION_EXECUTION_ENABLED:'true'};
  const fetchSource=vi.mocked(fetch).getMockImplementation()!;
  let generations=0;
  vi.mocked(fetch).mockImplementation(async(input,init)=>{
   const url=String(input instanceof Request?input.url:input);
   if(url.endsWith('/translations/wake'))return Response.json({ok:true},{status:202});
   if(url==='https://backend.test/api/v1/ai/generate') {generations++;return Response.json({ok:true,data:{text:''}});}
   return fetchSource(input,init);
  });
  const admitted=await(await request('',undefined,config)).json() as {job:{id:string}};
  expect(await drainTranslationJobs(config)).toMatchObject({processed:0,failed:1});
  const repeated=await(await request(`?jobId=${admitted.job.id}`,undefined,config)).json() as {job:{id:string;status:string;attempts:number;error:{code:string}}};
  expect(repeated.job).toMatchObject({id:admitted.job.id,status:'failed',attempts:1,error:{code:'INVALID_TRANSLATION'}});
  expect(await drainTranslationJobs(config,{preferRecentWake:true})).toMatchObject({processed:0,failed:0});
  expect(generations).toBe(1);
  expect((await env.DB.prepare('SELECT COUNT(*) n FROM translation_jobs').first<{n:number}>())?.n).toBe(1);
 });
 it.each([[-1,0],[0,0],[-1,2]])('requires the complete pending-job reservation before AI at headroom offset %i after %i attempts',async(offset,priorAttempts)=>{
  const config={...bindings(),TRANSLATION_EXECUTION_ENABLED:'true'};
  const post=(await fetchPublishedPost(config,source.year,source.slug))!;
  const required=translationTokenBudget(post),oldBudget=required-4032;
  config.TRANSLATION_DAILY_TOKEN_BUDGET=String(required+offset);
  const admitted=await startTranslationJob(config,post,'en');
  await env.DB.prepare('UPDATE translation_jobs SET token_budget=?,attempts=? WHERE id=?').bind(oldBudget,priorAttempts,admitted.job.id).run();
  const fetchSource=vi.mocked(fetch).getMockImplementation()!;
  let generations=0;
  vi.mocked(fetch).mockImplementation(async(input,init)=>{
   if(String(input instanceof Request?input.url:input)==='https://backend.test/api/v1/ai/generate') {
    generations++;
    expect((await env.DB.prepare('SELECT token_budget FROM translation_jobs WHERE id=?').bind(admitted.job.id).first<{token_budget:number}>())?.token_budget).toBe(required);
    expect((await env.DB.prepare('SELECT SUM(token_budget) tokens FROM translation_attempts').first<{tokens:number}>())?.tokens).toBe(required);
    return Response.json({ok:true,data:{text:'Translated output'}});
   }
   return fetchSource(input,init);
  });
  const result=await drainTranslationJobs(config);
  const job=await env.DB.prepare('SELECT status,attempts,token_budget,error_json,available_at FROM translation_jobs WHERE id=?')
    .bind(admitted.job.id).first<{status:string;attempts:number;token_budget:number;error_json:string;available_at:string}>();
  expect(job?.attempts).toBe(priorAttempts+1);
  expect((await env.DB.prepare('SELECT COUNT(*) n FROM translation_attempts').first<{n:number}>())?.n).toBe(1);
  if(offset<0) {
   const exhausted=priorAttempts===2;
   expect(result).toMatchObject({processed:0,failed:exhausted?1:0,deferred:exhausted?0:1});expect(generations).toBe(0);
   expect(job).toMatchObject({status:exhausted?'failed':'deferred',token_budget:oldBudget});
   expect(JSON.parse(job!.error_json)).toMatchObject({code:exhausted?'MAX_ATTEMPTS':'TRANSLATION_BUDGET',retryable:!exhausted});
   if(!exhausted)expect(Date.parse(job!.available_at)).toBeGreaterThan(Date.now());
   expect((await env.DB.prepare('SELECT SUM(token_budget) tokens FROM translation_attempts').first<{tokens:number}>())?.tokens).toBe(oldBudget);
   expect(await env.DB.prepare('SELECT status,consumer_id,locked_at FROM domain_outbox WHERE id=?').bind(admitted.job.outbox_id).first()).toEqual({status:exhausted?'dead_letter':'pending',consumer_id:null,locked_at:null});
  } else {
   expect(result).toMatchObject({processed:1,failed:0,deferred:0});expect(generations).toBe(3);
   expect(job).toMatchObject({status:'succeeded',token_budget:required});
  }
 });
 it('returns 202, a durable job, safe URLs and Retry-After',async()=>{
  const response=await request();const value=await response.json() as any;
  expect(response.status).toBe(202);expect(value.job.status).toBe('deferred');expect(response.headers.get('X-Translation-Job-Id')).toBe(value.job.id);
  expect(response.headers.get('Location')).toBe(`${value.job.statusUrl}?jobId=${value.job.id}`);expect(response.headers.get('Retry-After')).toBeTruthy();
 });
 it('public GET and cache aliases join one job',async()=>{
  const a=await(await request()).json() as any;const b=await(await request('/cache')).json() as any;expect(a.job.id).toBe(b.job.id);
 });
 it('read-only cache lookup cannot create work',async()=>{
  expect((await request('?observe=true')).status).toBe(404);
  expect((await env.DB.prepare('SELECT COUNT(*) n FROM translation_jobs').first<{n:number}>())?.n).toBe(0);
 });
 it('public status is readable without user credentials',async()=>{
  const a=await(await request()).json() as any;const result=await request(`/status?jobId=${a.job.id}`);
  expect(result.status).toBe(200);expect((await result.json() as any).data.job.id).toBe(a.job.id);
 });
 it('public status cannot expose a now-private source',async()=>{
  const a=await(await request()).json() as any;published=false;expect((await request(`/status?jobId=${a.job.id}`)).status).toBe(404);
 });
 it('unknown and malformed job identifiers have distinct 404/400 responses',async()=>{
  expect((await request('/status?jobId=missing')).status).toBe(404);expect((await request('/status?jobId=bad%0Aj')).status).toBe(400);
 });
 it('internal generation remains authenticated',async()=>{
  const result=await app().fetch(new Request(`https://api.test/api/v1/internal/posts/2026/${encodeURIComponent(source.slug)}/translations/en/generate`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),bindings(),createExecutionContext());
  expect(result.status).toBe(401);
 });
 it('a member cannot approve a new paid revision',async()=>{
  const token=await signJwt({sub:'member',role:'user',type:'access',username:'Member'},bindings());
  const result=await app().fetch(new Request(`https://api.test/api/v1/internal/posts/2026/${encodeURIComponent(source.slug)}/translations/en/generate`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({forceRefresh:true})}),bindings(),createExecutionContext());
  expect(result.status).toBe(403);
 });
 it('admin cache invalidation preserves the audit job',async()=>{
  const a=await(await request()).json() as any;
  const token=await signJwt({sub:'admin',role:'admin',type:'access',username:'Admin',emailVerified:true},bindings());
  const result=await app().fetch(new Request(`https://api.test/api/v1/internal/posts/2026/${encodeURIComponent(source.slug)}/translations/en/cache`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}}),bindings(),createExecutionContext());
  expect(result.status).toBe(200);expect((await env.DB.prepare('SELECT status FROM translation_jobs WHERE id=?').bind(a.job.id).first<{status:string}>())?.status).toBe('failed');
 });
});
