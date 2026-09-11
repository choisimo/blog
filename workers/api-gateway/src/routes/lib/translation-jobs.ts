import type { Env } from '../../types';
import type { TranslationJobStatus } from '../../../../../shared/src/contracts/translation.js';
import { translationUrls } from '../../../../../shared/src/contracts/translation-path.js';
import { execute, queryAll } from '../../lib/d1';
import {
  enqueueTranslationJob, claimNextTranslationJob, getTranslationJobById,
  getLatestTranslationJob, recoverExpiredTranslationJobs, settleTranslationJob,
  reserveTranslationWake, reserveTranslationExecutionBudget, isLatestTranslationJob, type TranslationJobRow, type TranslationExecutionPolicy,
} from '../../lib/translation-job-repository';
import {
  fetchPublishedPost, getValidCachedTranslation, translationSourceVersion, translationTokenBudget,
  translateAndCachePost, type SourcePost, type SupportedTranslationLang,
} from '../../lib/translation-service';
import { attachOriginSignatureHeadersForUrl } from '../../lib/origin-signature';

export { getTranslationJobById, getLatestTranslationJob };
export type TranslationJobSnapshot = TranslationJobStatus;
const PRIORITY = { interactive:100, publish:60, revisit:40, hot:20, idle:0 } as const;
export type TranslationPriority = keyof typeof PRIORITY;
function setting(value:string|undefined, fallback:number, maximum:number) {
  if (value===undefined || value==='') return fallback;
  const number=Number(value);
  if (!Number.isInteger(number) || number<0 || number>maximum) throw Object.assign(new Error('Invalid translation policy'),{code:'TRANSLATION_POLICY',status:503});
  return number;
}
export function translationPolicy(env:Env):TranslationExecutionPolicy {
  return {
    enabled:env.TRANSLATION_EXECUTION_ENABLED==='true' && env.FEATURE_AI_ENABLED!=='false' && Boolean(env.BACKEND_ORIGIN),
    allowWarm:env.TRANSLATION_WARM_ENABLED==='true',
    maxConcurrent:setting(env.TRANSLATION_MAX_CONCURRENT,2,8), maxAttempts:3,
    dailyAttempts:setting(env.TRANSLATION_DAILY_ATTEMPTS,50,1000),
    dailyTokenBudget:setting(env.TRANSLATION_DAILY_TOKEN_BUDGET,2_000_000,100_000_000),
    postDailyAttempts:setting(env.TRANSLATION_POST_DAILY_ATTEMPTS,6,100), maxPending:80,
  };
}
const ERRORS:Record<string,string> = {
  EXECUTION_DISABLED:'번역 실행이 일시 중지되어 있습니다.', TRANSLATION_BUDGET:'오늘 번역 생성 한도에 도달했습니다.',
  EXECUTOR_BUSY:'다른 번역이 끝나기를 기다리고 있습니다.', EXECUTOR_INTERRUPTED:'저장된 단계부터 다시 연결 중입니다.',
  RESULT_UNKNOWN:'이전 생성 결과를 확인해야 합니다. 자동으로 다시 생성하지 않습니다.',
  AI_RATE_LIMIT:'생성 요청이 제한되어 재시도를 기다립니다.', MAX_ATTEMPTS:'번역 재시도 한도에 도달했습니다.',
  INVALID_TRANSLATION:'완전한 번역 결과를 확인하지 못했습니다.', CONTENT_TOO_LONG:'이 글은 긴 본문 번역 지원이 필요합니다.',
  SOURCE_UNAVAILABLE:'원문을 일시적으로 불러올 수 없습니다.', SUPERSEDED:'원문 또는 번역 요청이 변경되었습니다.',
  CACHE_INVALIDATED:'관리자가 번역 캐시를 비웠습니다.', TRANSLATION_FAILED:'번역을 완료하지 못했습니다.',
};
export function presentTranslationJob(job:TranslationJobRow, origin:string, mode:'public'|'internal'='public'):TranslationJobStatus {
  let issue:{code?:string;retryable?:boolean}|null=null;
  try { issue=job.error_json ? JSON.parse(job.error_json):null; } catch {}
  const code=issue?.code && Object.hasOwn(ERRORS,issue.code) ? issue.code:'TRANSLATION_FAILED';
  const retryable=job.status==='deferred' && issue?.retryable===true;
  return {
    id:job.id,type:'translation.generate',status:job.status,key:job.key,
    year:job.year,slug:job.slug,targetLang:job.target_lang,sourceLang:job.source_lang,
    ...translationUrls(origin,{year:job.year,slug:job.slug,targetLang:job.target_lang},mode),
    sourceVersion:job.source_version,attempts:job.attempts,createdAt:job.created_at,updatedAt:job.updated_at,
    ...(job.status==='running'?{startedAt:job.started_at}:{}),
    ...(job.completed_at?{completedAt:job.completed_at}:{}),
    ...(job.status==='deferred'?{retryAt:job.available_at}:{}),
    ...(issue?{error:{code,message:ERRORS[code],retryable}}:{}),
  };
}

export async function startTranslationJob(env:Env, source:SourcePost, lang:SupportedTranslationLang, input:{
  priority?:TranslationPriority; requestedBy?:string; refreshKey?:string; origin?:string;
}={}) {
  const policy=translationPolicy(env);
  const version=await translationSourceVersion(source,lang);
  const budget=translationTokenBudget(source);
  const result=await enqueueTranslationJob(env.DB,{
    year:source.year,slug:source.slug,targetLang:lang,sourceLang:source.sourceLang,sourceVersion:version,
    priority:PRIORITY[input.priority||'interactive'],tokenBudget:budget,requestedBy:input.requestedBy,
    refreshKey:input.refreshKey,urls:translationUrls(input.origin||env.API_BASE_URL||env.PUBLIC_SITE_URL||'https://noblog.nodove.com',{
      year:source.year,slug:source.slug,targetLang:lang,
    }),maxPending:policy.maxPending,
  });
  if (!policy.enabled && ['queued','deferred'].includes(result.job.status)) {
    await execute(env.DB, `UPDATE translation_jobs SET status='deferred',error_json='{"code":"EXECUTION_DISABLED","retryable":true}' WHERE id=? AND status IN ('queued','deferred')`,result.job.id);
    result.job=(await getTranslationJobById(env.DB,result.job.id))!;
  }
  return result;
}

/** A wake-up contains no source text and performs no model call in waitUntil. D1 is authoritative. */
export async function wakeTranslationExecutor(env:Env, job:TranslationJobRow):Promise<boolean> {
  if (!translationPolicy(env).enabled || !env.BACKEND_ORIGIN || !env.BACKEND_KEY || !await reserveTranslationWake(env.DB,job.id)) return false;
  const url=`${env.BACKEND_ORIGIN.replace(/\/$/,'')}/api/v1/internal/translations/wake`;
  const headers=new Headers({'X-Backend-Key':env.BACKEND_KEY,'Content-Type':'application/json'});
  try {
    await attachOriginSignatureHeadersForUrl({env,headers,method:'POST',url,requestId:crypto.randomUUID()});
    const response=await fetch(url,{method:'POST',headers,body:'{}',signal:AbortSignal.timeout(5000)});
    await response.body?.cancel();
    return response.ok;
  } catch {
    // Do not turn a lost signal into a failed job or resubmit a model call. Scheduled drain will pick it up.
    return false;
  }
}

async function bridgeLegacyOutbox(env:Env) {
  const events=await queryAll<{id:string;payload_json:string}>(env.DB,
    `SELECT id,payload_json FROM domain_outbox WHERE stream='ai.artifact.generate' AND event_type='translation.generate'
      AND status='pending' AND next_attempt_at<=?
      AND (NOT json_valid(payload_json) OR CASE WHEN json_valid(payload_json) THEN json_extract(payload_json,'$.jobId') END IS NULL)
      ORDER BY created_at LIMIT 4`,new Date().toISOString());
  for (const event of events) {
    try {
      let p;
      try {
        p=JSON.parse(event.payload_json);
        if (!p || !['ko','en'].includes(p.targetLang) || typeof p.slug!=='string' || !/^\d{4}$/.test(String(p.year))) throw new Error('Invalid event');
      } catch {
        await execute(env.DB,`UPDATE domain_outbox SET status='dead_letter',last_error='A02_INVALID_LEGACY_EVENT',updated_at=? WHERE id=? AND status='pending'`,new Date().toISOString(),event.id);
        continue;
      }
      const source=await fetchPublishedPost(env,String(p.year),p.slug);
      if (source) await startTranslationJob(env,source,p.targetLang,{priority: Object.hasOwn(PRIORITY,p.priority||'')?p.priority:'publish'});
      await execute(env.DB,`UPDATE domain_outbox SET status='processed',processed_at=?,last_error='A02_JOB_HANDOFF' WHERE id=? AND status='pending'`,new Date().toISOString(),event.id);
    } catch {
      // Do not import untrusted legacy payload as arbitrary source content. Leave transient failures observable.
      await execute(env.DB,`UPDATE domain_outbox SET last_error='A02_HANDOFF_DEFERRED',next_attempt_at=?,updated_at=? WHERE id=? AND status='pending'`,new Date(Date.now()+60_000).toISOString(),new Date().toISOString(),event.id);
    }
  }
}

async function notifySettledJob(env:Env, job:TranslationJobRow, succeeded:boolean) {
  if (!job.requested_by) return;
  try {
    const {enqueueNotificationDelivery}=await import('../../lib/notification-outbox');
    const urls=translationUrls(env.API_BASE_URL||env.PUBLIC_SITE_URL||'https://noblog.nodove.com',{year:job.year,slug:job.slug,targetLang:job.target_lang});
    await enqueueNotificationDelivery(env,{
      event:'notification',type:succeeded?'success':'error',title:succeeded?'번역 준비 완료':'번역 상태 확인',
      message:succeeded?'요청한 번역이 준비되었습니다.':'번역 상태를 확인해 주세요.',userId:job.requested_by,sourceId:job.id,
      payload:{jobId:job.id,statusUrl:urls.statusUrl,cacheUrl:urls.cacheUrl,resultRef:urls.cacheUrl},
    },{idempotencyKey:`translation:${job.id}:${succeeded?'succeeded':'failed'}`});
  } catch { console.warn('[translation] notification delivery deferred', {jobId:job.id}); }
}

/** Both the signed backend callback and scheduled recovery await this one executor. */
export async function drainTranslationJobs(env:Env, options:{limit?:number;allowWarm?:boolean;preferRecentWake?:boolean}={}) {
  const policy=translationPolicy(env);
  if (options.allowWarm!==undefined) policy.allowWarm=policy.allowWarm && options.allowWarm;
  await recoverExpiredTranslationJobs(env.DB);
  await bridgeLegacyOutbox(env);
  let processed=0,failed=0,deferred=0;
  const limit=Math.max(1,Math.min(2,options.limit||1));
  for (let index=0;index<limit;index++) {
    const job=await claimNextTranslationJob(env.DB,policy,undefined,{preferRecentWake:options.preferRecentWake});
    if (!job) break;
    try {
      if(!await isLatestTranslationJob(env.DB,job))throw Object.assign(new Error('Newer revision exists'),{code:'SUPERSEDED'});
      const source=await fetchPublishedPost(env,job.year,job.slug);
      if (!source || await translationSourceVersion(source,job.target_lang)!==job.source_version) {
        throw Object.assign(new Error('Source changed'),{code:'SUPERSEDED'});
      }
      const cached=await getValidCachedTranslation(env.DB,source,job.target_lang);
      if (!cached || job.force_refresh) {
        const reservation=await reserveTranslationExecutionBudget(env.DB,job,translationTokenBudget(source),policy.dailyTokenBudget);
        if (!reservation.ready) {
          const retry=job.attempts<policy.maxAttempts;
          const code=retry?'TRANSLATION_BUDGET':'MAX_ATTEMPTS';
          if (await settleTranslationJob(env.DB,job,{status:retry?'deferred':'failed',nextAt:retry?reservation.retryAt:undefined,
            error:{code,message:ERRORS[code],retryable:retry}})) {
            if(retry)deferred++;else{failed++;await notifySettledJob(env,job,false);}
          }
          continue;
        }
        job.token_budget=reservation.tokenBudget;
        await translateAndCachePost(env,env.DB,{...source,targetLang:job.target_lang,execution:job,deadlineMs:Date.now()+240_000});
      }
      if (await settleTranslationJob(env.DB,job,{status:'succeeded'})) {
        processed++;
        await notifySettledJob(env,job,true);
      }
    } catch (error) {
      const err=error as {code?:string;status?:number};
      const current=await getTranslationJobById(env.DB,job.id);
      if (!current || current.lock_token!==job.lock_token || current.lease_version!==job.lease_version) continue;
      const known=err.code && Object.hasOwn(ERRORS,err.code) ? err.code:null;
      const safeRetry=err.status===429 || (!current.active_stage && ['SOURCE_UNAVAILABLE','EXECUTOR_DEADLINE'].includes(err.code||''));
      const retry=safeRetry && job.attempts<policy.maxAttempts;
      const code=retry ? (err.status===429?'AI_RATE_LIMIT':'SOURCE_UNAVAILABLE')
        : safeRetry ? 'MAX_ATTEMPTS' : known || (current.active_stage?'RESULT_UNKNOWN':'TRANSLATION_FAILED');
      const status=retry?'deferred':'failed';
      const settled=await settleTranslationJob(env.DB,job,{status,error:{code,message:ERRORS[code],retryable:retry},
        nextAt:retry?new Date(Date.now()+Math.min(300_000,30_000*2**(job.attempts-1))).toISOString():undefined});
      if (settled) { if(retry)deferred++;else{failed++;await notifySettledJob(env,job,false);} }
    }
  }
  return {processed,failed,deferred,enabled:policy.enabled};
}

/** Internal stream keeps the backend observer connected; closing it does not start another generation. */
export function translationDrainResponse(env:Env) {
  const encoder=new TextEncoder();
  let closed=false;
  const stream=new ReadableStream<Uint8Array>({
    async start(controller) {
      const send=(value:unknown)=>{if(!closed)try{controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`));}catch{closed=true;}};
      send({type:'open'});
      const heartbeat=setInterval(()=>send({type:'heartbeat'}),15000);
      try { send({type:'done',...await drainTranslationJobs(env,{limit:1,preferRecentWake:true})}); }
      catch { send({type:'error',code:'TRANSLATION_EXECUTOR_UNAVAILABLE'}); }
      finally { clearInterval(heartbeat); if(!closed){closed=true;controller.close();} }
    },
    cancel(){closed=true;},
  });
  return new Response(stream,{headers:{'Content-Type':'text/event-stream','Cache-Control':'no-store','X-Accel-Buffering':'no'}});
}
