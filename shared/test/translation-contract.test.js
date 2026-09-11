import test from 'node:test';
import assert from 'node:assert/strict';
import {translationJobStatusSchema,translationGenerateResponseSchema,translationJobResponseSchema} from '../src/contracts/translation.js';
const job=status=>({id:'translation-job-1',type:'translation.generate',status,statusUrl:'https://test/status',cacheUrl:'https://test/cache',generateUrl:'https://test/generate',attempts:1,sourceVersion:'sha256:example'});
for(const status of ['queued','deferred','running','succeeded','failed'])test(`runtime job schema accepts ${status}`,()=>{
 assert.equal(translationJobStatusSchema.parse(job(status)).status,status);
 assert.equal(translationGenerateResponseSchema.parse({ok:true,data:null,job:job(status)}).job.status,status);
 assert.equal(translationJobResponseSchema.parse({ok:true,data:{job:job(status)}}).data.job.status,status);
});
test('schema preserves safe failure code and observation metadata',()=>{
 const value=translationJobStatusSchema.parse({...job('failed'),error:{code:'RESULT_UNKNOWN',message:'Review',retryable:false}});
 assert.equal(value.error.code,'RESULT_UNKNOWN');assert.equal(value.error.retryable,false);assert.equal(value.attempts,1);
});
