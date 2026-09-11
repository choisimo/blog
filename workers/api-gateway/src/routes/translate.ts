import { Hono } from 'hono';
import type { Context } from 'hono';
import type { HonoEnv } from '../types';
import { success, error } from '../lib/response';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { normalizeTranslationSelectors, normalizeTranslationJobId } from '../../../../shared/src/contracts/translation-path.js';
import { buildRouteBoundaryHeaders } from '../../../../shared/src/contracts/service-boundaries.js';
import {
  startTranslationJob, presentTranslationJob, getTranslationJobById,
  getLatestTranslationJob, wakeTranslationExecutor,
} from './lib/translation-jobs';
import { recoverExpiredTranslationJobs, invalidateTranslationCache } from '../lib/translation-job-repository';
import {
  fetchPublishedPost, getValidCachedTranslation, getCachedTranslationRecord,
  buildTranslationResponse, translationSourceVersion, isSuspiciousTranslation,
} from '../lib/translation-service';

const app=new Hono<HonoEnv>();
app.use('*',async(c,next)=>{
  await next();
  for(const [key,value] of Object.entries(buildRouteBoundaryHeaders('translate',{responder:'worker',edgeMode:'native',originMode:'worker'}))) {
    c.res.headers.set(key,value as string);
  }
});
function selector(c:Context<HonoEnv>) {
  try { return normalizeTranslationSelectors(c.req.param() as {year:string;slug:string;targetLang:string},false); }
  catch { throw Object.assign(new Error('Invalid translation selectors'),{code:'BAD_REQUEST',status:400}); }
}
function handleError(c:Context<HonoEnv>,err:unknown) {
  const issue=err as {status?:number;code?:string};
  const status=issue.status===400 || (err instanceof Error && err.message.startsWith('Invalid translation'))?400:issue.status===429?429:issue.status===404?404:503;
  c.header('Cache-Control','no-store');
  if(status===503 || status===429)c.header('Retry-After','30');
  return error(c,status===400?'Invalid translation request':status===404?'Published post not found':'Translation service unavailable',status,
    status===400?'BAD_REQUEST':status===404?'NOT_AVAILABLE':issue.code==='TRANSLATION_CAPACITY'?'TRANSLATION_CAPACITY':'BACKEND_UNAVAILABLE');
}
function headersForJob(c:Context<HonoEnv>,job:ReturnType<typeof presentTranslationJob>) {
  c.header('Cache-Control','no-store'); c.header('X-Translation-Job-Id',job.id);
  c.header('Location',`${job.statusUrl}?jobId=${encodeURIComponent(job.id)}`);
  if(['queued','running','deferred'].includes(job.status)) {
    const seconds=job.retryAt?Math.max(3,Math.ceil((Date.parse(job.retryAt)-Date.now())/1000)):3;
    c.header('Retry-After',String(seconds));
  }
}
export async function lookup(c:Context<HonoEnv>,create=true,mode:'public'|'internal'='public',options:{refreshKey?:string;requestedBy?:string}={}) {
  const p=selector(c);
  const source=await fetchPublishedPost(c.env,p.year,p.slug);
  if(!source)throw Object.assign(new Error('Not found'),{status:404});
  const version=await translationSourceVersion(source,p.targetLang);
  const queryId=c.req.query('jobId');
  let joined=queryId?await getTranslationJobById(c.env.DB,normalizeTranslationJobId(queryId)):null;
  if(queryId && (!joined || joined.key!==`${p.year}:${p.slug}:${p.targetLang}`))return error(c,'Translation job not found',404,'NOT_FOUND');
  c.header('Cache-Control','no-store');
  if(source.sourceLang===p.targetLang)return success(c,{title:source.title,description:source.description,content:source.content,cached:false,isAiGenerated:false});
  const cached=await getValidCachedTranslation(c.env.DB,source,p.targetLang);
  if(cached && !options.refreshKey)return success(c,buildTranslationResponse(cached));
  if(!joined)joined=await getLatestTranslationJob(c.env.DB,p.year,p.slug,p.targetLang,version);
  // Admission also promotes an existing warm job to interactive priority. Merely
  // reading the latest row strands it when background warming is disabled.
  if(create && (!queryId || options.refreshKey)) {
    joined=(await startTranslationJob(c.env,source,p.targetLang,{...options,origin:c.req.url,priority:'interactive'})).job;
  }
  if(!joined)return error(c,'Translation is not ready',404,'NOT_READY');
  const job=presentTranslationJob(joined,c.req.url,mode);
  if(joined.source_version!==version && !joined.source_version.startsWith('legacy:')) {
    job.status='failed';job.error={code:'SUPERSEDED',message:'원문이 변경되었습니다.',retryable:false};
  }
  headersForJob(c,job);
  if(create && ['queued','deferred'].includes(job.status)) {
    c.executionCtx.waitUntil(wakeTranslationExecutor(c.env,joined).catch(()=>false));
  }
  const stale=await getCachedTranslationRecord(c.env.DB,p.year,p.slug,p.targetLang);
  const data=stale && !isSuspiciousTranslation(source.content,stale.content)?{
    ...buildTranslationResponse(stale),stale:true,warming:['queued','deferred','running'].includes(job.status),
  }:null;
  return c.json({ok:true,data,job},job.status==='failed'||job.status==='succeeded'||data?200:202);
}
export async function cached(c:Context<HonoEnv>) {
  try { return await lookup(c,c.req.query('observe')!=='true'); }catch(err){return handleError(c,err);}
}
export async function status(c:Context<HonoEnv>,mode:'public'|'internal'='public') {
  try {
    const p=selector(c);
    const source=await fetchPublishedPost(c.env,p.year,p.slug);
    if(!source)return error(c,'Published post not found',404,'NOT_AVAILABLE');
    const version=await translationSourceVersion(source,p.targetLang);
    await recoverExpiredTranslationJobs(c.env.DB);
    const id=c.req.query('jobId');
    const record=id?await getTranslationJobById(c.env.DB,normalizeTranslationJobId(id)):
      await getLatestTranslationJob(c.env.DB,p.year,p.slug,p.targetLang,version);
    if(!record || record.key!==`${p.year}:${p.slug}:${p.targetLang}`)return error(c,'Translation job not found',404,'NOT_FOUND');
    const job=presentTranslationJob(record,c.req.url,mode);
    if(record.source_version!==version && !record.source_version.startsWith('legacy:')) {
      job.status='failed';job.error={code:'SUPERSEDED',message:'원문이 변경되었습니다.',retryable:false};
    }
    headersForJob(c,job);return success(c,{job});
  }catch(err){return handleError(c,err);}
}
export async function generate(c:Context<HonoEnv>) {
  try {
    const body=await c.req.json<{forceRefresh?:boolean;sourceLang?:string}>().catch(()=>({}));
    let refreshKey:string|undefined;
    if('forceRefresh' in body && body.forceRefresh) {
      // Reading is public. A new paid revision is an administrative operation.
      const denied=await requireAdmin(c,async()=>{});if(denied)return denied;
      refreshKey=c.req.header('Idempotency-Key');
      if(!refreshKey || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(refreshKey))return error(c,'A stable Idempotency-Key is required for regeneration',400,'BAD_REQUEST');
    }
    return await lookup(c,true,'internal',{refreshKey,requestedBy:c.get('user')?.sub});
  }catch(err){return handleError(c,err);}
}
export async function remove(c:Context<HonoEnv>) {
  try {const p=selector(c);await invalidateTranslationCache(c.env.DB,p.year,p.slug,p.targetLang);return success(c,{deleted:true});}
  catch(err){return handleError(c,err);}
}
app.get('/public/posts/:year/:slug/translations/:targetLang',cached);
app.get('/public/posts/:year/:slug/translations/:targetLang/cache',cached);
app.get('/public/posts/:year/:slug/translations/:targetLang/status',c=>status(c));
app.post('/internal/posts/:year/:slug/translations/:targetLang/generate',requireAuth,generate);
app.get('/internal/posts/:year/:slug/translations/:targetLang/generate/status',requireAuth,c=>status(c,'internal'));
app.get('/internal/posts/:year/:slug/translations/:targetLang/status',requireAuth,c=>status(c,'internal'));
app.delete('/internal/posts/:year/:slug/translations/:targetLang',requireAdmin,remove);
app.delete('/internal/posts/:year/:slug/translations/:targetLang/cache',requireAdmin,remove);
function legacy(c:Context<HonoEnv>,suffix='cache') {
  c.header('Deprecation','true');c.header('Sunset','Tue, 30 Jun 2026 00:00:00 GMT');
  try { const p=selector(c);c.header('Link',`</api/v1/public/posts/${p.year}/${encodeURIComponent(p.slug)}/translations/${p.targetLang}/${suffix}>; rel="successor-version"`); } catch {}
}
app.get('/translate/:year/:slug/:targetLang',c=>{legacy(c);return cached(c);});
app.get('/translate/:year/:slug/:targetLang/status',requireAuth,c=>{legacy(c,'status');return status(c,'internal');});
app.delete('/translate/:year/:slug/:targetLang',requireAdmin,c=>{legacy(c);return remove(c);});
// Legacy bodies may name a published post, but cannot poison a public cache with supplied private content.
app.post('/translate',requireAuth,async c=>{
  try {
    const body=await c.req.json();const p=normalizeTranslationSelectors(body);
    c.header('Deprecation','true');c.header('Sunset','Tue, 30 Jun 2026 00:00:00 GMT');
    const url=new URL(c.req.url);url.pathname=`/internal/posts/${p.year}/${encodeURIComponent(p.slug)}/translations/${p.targetLang}/generate`;
    const request=new Request(url,{method:'POST',headers:c.req.raw.headers,body:JSON.stringify(body)});
    const response=await app.fetch(request,c.env,c.executionCtx);
    response.headers.set('Deprecation','true');response.headers.set('Sunset','Tue, 30 Jun 2026 00:00:00 GMT');
    return response;
  }catch(err){return handleError(c,err);}
});
export default app;
