import {env} from 'cloudflare:test';
import {beforeEach,describe,expect,it} from 'vitest';
import {startTranslationJob,presentTranslationJob,translationPolicy} from '../src/routes/lib/translation-jobs';
import {claimNextTranslationJob} from '../src/lib/translation-job-repository';
import {MAX_TOKENS} from '../src/config/defaults';
import type {Env} from '../src/types';
const source={year:'2026',slug:'한글 글',title:'Title',description:'Description',content:'# Body',sourceLang:'ko' as const};
const bindings=()=>({...env,ENV:'development',BACKEND_ORIGIN:'https://backend.test',TRANSLATION_EXECUTION_ENABLED:'true'}) as Env;
beforeEach(async()=>{for(const name of ['translation_attempts','translation_jobs','domain_outbox'])await env.DB.prepare(`DELETE FROM ${name}`).run();});
describe('translation orchestration admission',()=>{
  it('joins public, internal and warm requests without starting provider work',async()=>{
    const a=await startTranslationJob(bindings(),source,'en',{priority:'publish'});
    const b=await startTranslationJob(bindings(),source,'en',{priority:'interactive'});
    expect(a.job.id).toBe(b.job.id);expect(b.job.priority).toBe(100);expect(b.job.status).toBe('queued');
  });
  it('renders public URLs independently of who first admitted the job',async()=>{
    const a=await startTranslationJob(bindings(),source,'en',{origin:'https://internal.test'});
    const result=presentTranslationJob(a.job,'https://public-api.test');
    expect(result.statusUrl).toContain('https://public-api.test/api/v1/public/');expect(result.statusUrl).toContain(encodeURIComponent(source.slug));
  });
  it.each([-1,0])('enforces the full UTF-8 source and configured stage reservation at budget offset %i',async(offset)=>{
    const post={...source,title:'한글 제목',description:'설명',content:'# 본문 🌍'};
    const reserved=new TextEncoder().encode(post.title+post.description+post.content).length
      +MAX_TOKENS.TRANSLATE_TITLE+MAX_TOKENS.TRANSLATE_DESC+MAX_TOKENS.TRANSLATE_CONTENT+4000;
    const config={...bindings(),TRANSLATION_DAILY_TOKEN_BUDGET:String(reserved+offset)};
    const admitted=await startTranslationJob(config,post,'en');
    expect(admitted.job.token_budget).toBe(reserved);
    const claimed=await claimNextTranslationJob(env.DB,translationPolicy(config));
    const attempts=await env.DB.prepare('SELECT token_budget FROM translation_attempts').all<{token_budget:number}>();
    if(offset<0) {
      expect(claimed).toBeNull();expect(attempts.results).toEqual([]);
      const job=await env.DB.prepare('SELECT status,error_json FROM translation_jobs WHERE id=?').bind(admitted.job.id).first<{status:string;error_json:string}>();
      expect(job?.status).toBe('deferred');expect(JSON.parse(job!.error_json).code).toBe('TRANSLATION_BUDGET');
    } else {
      expect(claimed?.id).toBe(admitted.job.id);expect(attempts.results).toEqual([{token_budget:reserved}]);
    }
  });
  it('reports execution disabled without changing a caller identity or any image policy',async()=>{
    const a=await startTranslationJob({...bindings(),TRANSLATION_EXECUTION_ENABLED:'false'},source,'en');
    expect(a.job.status).toBe('deferred');expect(presentTranslationJob(a.job,'https://test').error?.code).toBe('EXECUTION_DISABLED');
  });
  it('rejects malformed operational limits instead of accidentally disabling the cap',()=>{
    expect(()=>translationPolicy({...bindings(),TRANSLATION_DAILY_ATTEMPTS:'unlimited'})).toThrow();
  });
});
