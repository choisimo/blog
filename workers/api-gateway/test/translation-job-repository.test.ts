import {env} from 'cloudflare:test';
import {beforeEach,describe,expect,it} from 'vitest';
import {
  enqueueTranslationJob,claimNextTranslationJob,recoverExpiredTranslationJobs,getTranslationJobById,
  markTranslationStage,checkpointTranslation,commitTranslationCache,settleTranslationJob,invalidateTranslationCache,
  reserveTranslationWake,reserveTranslationExecutionBudget,type TranslationExecutionPolicy,
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
  it.each([false,true])('selects before the candidate limit with recent-wake preference %s',async(preferRecentWake)=>{
    const now='2026-09-12T12:00:00.000Z';
    const backlog=[];
    for(let n=0;n<12;n++)backlog.push(await enqueueTranslationJob(env.DB,{...input('old-'+n),now:'2026-09-12T11:00:00.000Z'}));
    const recent=await enqueueTranslationJob(env.DB,{...input('reader'),now:'2026-09-12T11:59:50.000Z'});
    await reserveTranslationWake(env.DB,recent.job.id,now);
    const claimed=preferRecentWake
      ? await claimNextTranslationJob(env.DB,policy,now,{preferRecentWake:true})
      : await claimNextTranslationJob(env.DB,policy,now);
    expect(claimed?.id).toBe(preferRecentWake?recent.job.id:backlog[0].job.id);
    expect((await getTranslationJobById(env.DB,preferRecentWake?backlog[0].job.id:recent.job.id))?.attempts).toBe(0);
  });
  it.each([60000,60001])('applies the recent-wake cutoff at %i milliseconds',async(age)=>{
    const now='2026-09-12T12:00:00.000Z';
    const old=await enqueueTranslationJob(env.DB,{...input('old'),now:'2026-09-12T11:00:00.000Z'});
    const recent=await enqueueTranslationJob(env.DB,{...input('reader'),now:'2026-09-12T11:58:00.000Z'});
    await reserveTranslationWake(env.DB,recent.job.id,new Date(Date.parse(now)-age).toISOString());
    const claimed=await claimNextTranslationJob(env.DB,policy,now,{preferRecentWake:true});
    expect(claimed?.id).toBe(age===60000?recent.job.id:old.job.id);
  });
  it('keeps recently woken jobs subject to availability, attempt, outbox and warm-work guards',async()=>{
    const now='2026-09-12T12:00:00.000Z';
    const old=await enqueueTranslationJob(env.DB,{...input('old'),now:'2026-09-12T11:00:00.000Z'});
    for(const slug of ['future','exhausted','dead-outbox','warm']) {
      const recent=await enqueueTranslationJob(env.DB,{...input(slug),priority:slug==='warm'?60:100,now:'2026-09-12T11:59:00.000Z'});
      await reserveTranslationWake(env.DB,recent.job.id,now);
      if(slug==='future')await env.DB.prepare('UPDATE translation_jobs SET available_at=? WHERE id=?').bind('2026-09-12T12:01:00.000Z',recent.job.id).run();
      if(slug==='exhausted')await env.DB.prepare('UPDATE translation_jobs SET attempts=3 WHERE id=?').bind(recent.job.id).run();
      if(slug==='dead-outbox')await env.DB.prepare("UPDATE domain_outbox SET status='dead_letter' WHERE id=?").bind(recent.job.outbox_id).run();
    }
    expect((await claimNextTranslationJob(env.DB,{...policy,allowWarm:false},now,{preferRecentWake:true}))?.id).toBe(old.job.id);
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
  it.each([false,true])('caps daily reserved units with recent-wake preference %s',async(preferRecentWake)=>{
    const admitted=await enqueueTranslationJob(env.DB,input());await reserveTranslationWake(env.DB,admitted.job.id);
    expect(await claimNextTranslationJob(env.DB,{...policy,dailyTokenBudget:1},undefined,{preferRecentWake})).toBeNull();
    expect((await env.DB.prepare('SELECT status FROM translation_jobs').first<{status:string}>())?.status).toBe('deferred');
    expect((await env.DB.prepare('SELECT COUNT(*) n FROM translation_attempts').first<{n:number}>())?.n).toBe(0);
  });
  it('admin invalidation fences a late cache write and preserves the job history',async()=>{
    await enqueueTranslationJob(env.DB,input());const owner=(await claimNextTranslationJob(env.DB,policy))!;
    await invalidateTranslationCache(env.DB,'2026','example','en');
    await expect(commitTranslationCache(env.DB,owner,{title:'late',description:'late',content:'late'})).rejects.toThrow();
    expect(await getTranslationJobById(env.DB,owner.id)).not.toBeNull();
  });
  it('tops up an old reservation once even with concurrent repeated calls and never reduces it',async()=>{
    await enqueueTranslationJob(env.DB,{...input(),tokenBudget:22358});
    const owner=(await claimNextTranslationJob(env.DB,policy))!;
    const results=await Promise.all(Array.from({length:3},()=>reserveTranslationExecutionBudget(env.DB,owner,26390,26390)));
    expect(results).toEqual(Array(3).fill({ready:true,tokenBudget:26390}));
    expect(await reserveTranslationExecutionBudget(env.DB,owner,22358,26390)).toEqual({ready:true,tokenBudget:26390});
    expect((await getTranslationJobById(env.DB,owner.id))?.token_budget).toBe(26390);
    expect(await env.DB.prepare('SELECT COUNT(*) n,SUM(token_budget) tokens FROM translation_attempts').first()).toEqual({n:1,tokens:26390});
  });
  it('serializes competing top-ups against the same daily cap',async()=>{
    await enqueueTranslationJob(env.DB,input('one'));await enqueueTranslationJob(env.DB,input('two'));
    const one=(await claimNextTranslationJob(env.DB,policy))!,two=(await claimNextTranslationJob(env.DB,policy))!;
    const results=await Promise.all([one,two].map(job=>reserveTranslationExecutionBudget(env.DB,job,200,300)));
    expect(results.filter(result=>result.ready)).toHaveLength(1);
    expect((await env.DB.prepare('SELECT SUM(token_budget) tokens FROM translation_attempts').first<{tokens:number}>())?.tokens).toBe(300);
    for(const job of [one,two]) {
      const row=await getTranslationJobById(env.DB,job.id);
      expect((await env.DB.prepare('SELECT token_budget FROM translation_attempts WHERE id=?').bind(job.lock_token).first<{token_budget:number}>())?.token_budget).toBe(row?.token_budget);
    }
  });
  it.each(['token','version','expired','submitted'])('rejects a top-up with an invalid %s fence',async(kind)=>{
    await enqueueTranslationJob(env.DB,input());const owner=(await claimNextTranslationJob(env.DB,policy))!;
    const caller={...owner};
    if(kind==='token')caller.lock_token='stale-token';
    if(kind==='version')caller.lease_version++;
    if(kind==='expired')await env.DB.prepare("UPDATE translation_jobs SET lock_expires_at='2000-01-01T00:00:00.000Z' WHERE id=?").bind(owner.id).run();
    if(kind==='submitted')await markTranslationStage(env.DB,owner,'title');
    await expect(reserveTranslationExecutionBudget(env.DB,caller,200,300)).rejects.toMatchObject({code:'LEASE_LOST'});
    expect((await getTranslationJobById(env.DB,owner.id))?.token_budget).toBe(100);
    expect((await env.DB.prepare('SELECT token_budget FROM translation_attempts WHERE id=?').bind(owner.lock_token).first<{token_budget:number}>())?.token_budget).toBe(100);
  });
  it('rolls back the attempt top-up if the atomic batch fails before updating the job',async()=>{
    await enqueueTranslationJob(env.DB,input());const owner=(await claimNextTranslationJob(env.DB,policy))!;
    const brokenDb={prepare:env.DB.prepare.bind(env.DB),batch:(statements:D1PreparedStatement[])=>env.DB.batch([
      statements[0],env.DB.prepare('SELECT * FROM missing_reservation_test_table'),...statements.slice(1),
    ])} as unknown as D1Database;
    await expect(reserveTranslationExecutionBudget(brokenDb,owner,200,300)).rejects.toThrow();
    expect((await getTranslationJobById(env.DB,owner.id))?.token_budget).toBe(100);
    expect((await env.DB.prepare('SELECT token_budget FROM translation_attempts WHERE id=?').bind(owner.lock_token).first<{token_budget:number}>())?.token_budget).toBe(100);
  });
  it('charges the original attempt day when source loading crosses Korean midnight',async()=>{
    const before='2026-09-12T14:59:59.000Z',after='2026-09-12T15:00:01.000Z';
    await enqueueTranslationJob(env.DB,{...input(),now:before});
    const owner=(await claimNextTranslationJob(env.DB,policy,before))!;
    await env.DB.prepare('INSERT INTO translation_attempts(id,job_id,day,token_budget,created_at) VALUES (?,?,?,?,?)')
      .bind('next-day-reservation','another-job','2026-09-13',200,after).run();
    expect(await reserveTranslationExecutionBudget(env.DB,owner,200,200,after)).toEqual({ready:true,tokenBudget:200});
    expect(await env.DB.prepare('SELECT day,token_budget FROM translation_attempts WHERE id=?').bind(owner.lock_token).first()).toEqual({day:'2026-09-12',token_budget:200});
  });
});
