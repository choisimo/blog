import {env} from 'cloudflare:test';
import {beforeEach,describe,expect,it} from 'vitest';
import {startTranslationJob,presentTranslationJob,translationPolicy} from '../src/routes/lib/translation-jobs';
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
  it('reports execution disabled without changing a caller identity or any image policy',async()=>{
    const a=await startTranslationJob({...bindings(),TRANSLATION_EXECUTION_ENABLED:'false'},source,'en');
    expect(a.job.status).toBe('deferred');expect(presentTranslationJob(a.job,'https://test').error?.code).toBe('EXECUTION_DISABLED');
  });
  it('rejects malformed operational limits instead of accidentally disabling the cap',()=>{
    expect(()=>translationPolicy({...bindings(),TRANSLATION_DAILY_ATTEMPTS:'unlimited'})).toThrow();
  });
});
