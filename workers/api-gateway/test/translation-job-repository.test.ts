import {env} from 'cloudflare:test';
import {beforeEach,describe,expect,it} from 'vitest';
import {
  enqueueTranslationJob,claimNextTranslationJob,recoverExpiredTranslationJobs,getTranslationJobById,
  markTranslationStage,checkpointTranslation,commitTranslationCache,settleTranslationJob,invalidateTranslationCache,
  type TranslationExecutionPolicy,
} from '../src/lib/translation-job-repository';
const policy:TranslationExecutionPolicy={enabled:true,allowWarm:true,maxConcurrent:2,maxAttempts:3,dailyAttempts:50,dailyTokenBudget:2000000,postDailyAttempts:6,maxPending:80};
const input=(slug='example',version='version-1')=>({year:'2026',slug,targetLang:'en' as const,sourceLang:'ko' as const,
  sourceVersion:version,priority:100,tokenBudget:100,urls:{statusUrl:'https://test/status',cacheUrl:'https://test/cache',generateUrl:'https://test/generate'},maxPending:80});
beforeEach(async()=>{for(const name of ['translation_attempts','translation_jobs','domain_outbox','post_translations_cache'])await env.DB.prepare(`DELETE FROM ${name}`).run();});
describe('translation repository A02 (real D1)',()=>{
  it('atomically admits one durable job/outbox for 100 equal requests',async()=>{
    const values=await Promise.all(Array.from({length:100},()=>enqueueTranslationJob(env.DB,input())));
    expect(new Set(values.map(v=>v.job.id)).size).toBe(1);expect(values.filter(v=>v.created)).toHaveLength(1);
    expect((await env.DB.prepare('SELECT COUNT(*) n FROM domain_outbox').first<{n:number}>())?.n).toBe(1);
  });
  it('does not turn repeated observations into fresh attempts',async()=>{
    const admitted=await enqueueTranslationJob(env.DB,input());const owner=(await claimNextTranslationJob(env.DB,policy))!;
    await settleTranslationJob(env.DB,owner,{status:'failed',error:{code:'RESULT_UNKNOWN',message:'review',retryable:false}});
    const again=await enqueueTranslationJob(env.DB,input());expect(again.job.id).toBe(admitted.job.id);expect(again.job.status).toBe('failed');expect(again.job.attempts).toBe(1);
  });
  it('limits concurrent execution across competing claimers',async()=>{
    for(let n=0;n<8;n++)await enqueueTranslationJob(env.DB,input('post-'+n));
    const values=await Promise.all(Array.from({length:20},()=>claimNextTranslationJob(env.DB,policy)));
    expect(values.filter(Boolean)).toHaveLength(2);
  });
  it('records unknown submitted work instead of reclaiming and rebilling it',async()=>{
    await enqueueTranslationJob(env.DB,input());const owner=(await claimNextTranslationJob(env.DB,policy))!;
    await markTranslationStage(env.DB,owner,'title');
    await env.DB.prepare("UPDATE translation_jobs SET lock_expires_at='2000-01-01T00:00:00.000Z'").run();
    await recoverExpiredTranslationJobs(env.DB);
    expect((await getTranslationJobById(env.DB,owner.id))?.status).toBe('failed');expect(await claimNextTranslationJob(env.DB,policy)).toBeNull();
  });
  it('resumes an expired pre-submission job with the same ID and a new fence',async()=>{
    await enqueueTranslationJob(env.DB,input());const owner=(await claimNextTranslationJob(env.DB,policy))!;
    await checkpointTranslation(env.DB,owner,{title:'saved'});
    await env.DB.prepare("UPDATE translation_jobs SET lock_expires_at='2000-01-01T00:00:00.000Z'").run();await recoverExpiredTranslationJobs(env.DB);
    const next=(await claimNextTranslationJob(env.DB,policy))!;expect(next.id).toBe(owner.id);expect(next.lease_version).toBeGreaterThan(owner.lease_version);expect(JSON.parse(next.checkpoint_json).title).toBe('saved');
    await expect(checkpointTranslation(env.DB,owner,{title:'old'})).rejects.toThrow();
    expect(await settleTranslationJob(env.DB,owner,{status:'succeeded'})).toBe(false);
  });
  it('publishes only while the same execution owns the current revision',async()=>{
    await enqueueTranslationJob(env.DB,input());const owner=(await claimNextTranslationJob(env.DB,policy))!;
    await enqueueTranslationJob(env.DB,input('example','version-2'));
    await expect(commitTranslationCache(env.DB,owner,{title:'old',description:'old',content:'old'})).rejects.toThrow();
  });
  it('caps daily reserved units before a model request',async()=>{
    await enqueueTranslationJob(env.DB,input());expect(await claimNextTranslationJob(env.DB,{...policy,dailyTokenBudget:1})).toBeNull();
    expect((await env.DB.prepare('SELECT status FROM translation_jobs').first<{status:string}>())?.status).toBe('deferred');
  });
  it('admin invalidation fences a late cache write and preserves the job history',async()=>{
    await enqueueTranslationJob(env.DB,input());const owner=(await claimNextTranslationJob(env.DB,policy))!;
    await invalidateTranslationCache(env.DB,'2026','example','en');
    await expect(commitTranslationCache(env.DB,owner,{title:'late',description:'late',content:'late'})).rejects.toThrow();
    expect(await getTranslationJobById(env.DB,owner.id)).not.toBeNull();
  });
});
