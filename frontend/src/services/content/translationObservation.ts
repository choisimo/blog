import type { PublicTranslationLookupResult, TranslationJobStatus, TranslationResult } from './translate';
export type TranslationUiStatus = 'idle'|'warming'|'deferred'|'paused'|'ready'|'error';
export type TranslationObservation = {
  status:TranslationUiStatus; job?:TranslationJobStatus|null; translation?:TranslationResult|null;
  error?:{code?:string;message:string;retryable?:boolean};
};
/** Observing is not generating: after initial admission all polling is read-only. */
export async function observeTranslation(input:{
  lookup:(options:{signal:AbortSignal;readOnly?:boolean;jobId?:string})=>Promise<PublicTranslationLookupResult>;
  status:(id:string,options:{signal:AbortSignal})=>Promise<TranslationJobStatus>;
  onChange:(value:TranslationObservation)=>void;
  signal:AbortSignal; budgetMs?:number; resumeJobId?:string|null;
}) {
  const controller=new AbortController();
  let finished=false;
  const emit=(value:TranslationObservation)=>{if(!input.signal.aborted && !finished)input.onChange(value);};
  let cancel!:()=>void;
  const cancelled=new Promise<never>((_,reject)=>{cancel=()=>{controller.abort();reject(new Error('OBSERVATION_ENDED'));};});
  const stop=()=>cancel();
  input.signal.addEventListener('abort',stop,{once:true});
  if(input.signal.aborted){input.signal.removeEventListener('abort',stop);return;}
  const timer=setTimeout(()=>{cancel();},input.budgetMs??90_000);
  let waitTimer:ReturnType<typeof setTimeout>|undefined;
  let job:TranslationJobStatus|null=null;
  let translation:TranslationResult|null=null;
  let retryAfter=3;
  try {
    emit({status:'warming'});
    if(input.resumeJobId) {
      job=await Promise.race([input.status(input.resumeJobId,{signal:controller.signal}),cancelled]);
    } else {
      const result=await Promise.race([input.lookup({signal:controller.signal}),cancelled]);
      translation=result.translation;job=result.job;retryAfter=result.retryAfterSeconds??3;
      if(!result.pending && !job){emit({status:translation?'ready':'idle',translation});return;}
    }
    for(let poll=0;poll<40;poll++) {
      if(job?.status==='failed') {emit({status:'error',translation,job,error:job.error||{code:'UNKNOWN',message:'Translation failed',retryable:false}});return;}
      if(job?.status==='succeeded') {
        const result=await Promise.race([input.lookup({signal:controller.signal,readOnly:true,jobId:job.id}),cancelled]);
        if(result.translation && !result.stale){emit({status:'ready',translation:result.translation,job});return;}
        emit({status:'paused',translation,job});return;
      }
      emit({status:job?.status==='deferred'?'deferred':'warming',translation,job});
      const delay=job?.retryAt?Math.max(1,Math.ceil((Date.parse(job.retryAt)-Date.now())/1000)):retryAfter;
      await Promise.race([new Promise<void>(resolve=>{waitTimer=setTimeout(resolve,Math.max(1,Number.isFinite(delay)?delay:3)*1000);}),cancelled]);
      if(job) {
        job=await Promise.race([input.status(job.id,{signal:controller.signal}),cancelled]);
        retryAfter=3;
      } else {
        // Compatibility with an older 202 envelope. Never add forceRefresh to a polling request.
        const result=await Promise.race([input.lookup({signal:controller.signal,readOnly:true}),cancelled]);
        if(result.translation)translation=result.translation;
        job=result.job;retryAfter=result.retryAfterSeconds??3;
        if(!result.pending && !job){emit({status:translation?'ready':'idle',translation});return;}
      }
    }
    emit({status:'paused',translation,job});
  } catch {
    // Network/observation deadlines do not establish that durable server work failed.
    if(!input.signal.aborted)emit({status:'paused',translation,job});
  } finally {
    finished=true;clearTimeout(timer);if(waitTimer)clearTimeout(waitTimer);
    input.signal.removeEventListener('abort',stop);controller.abort();
    // All requests have a rejection observer through Promise.race; no abandoned poll is reissued.
  }
}
