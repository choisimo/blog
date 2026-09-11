const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const {DatabaseSync}=require('node:sqlite');
const {register,ts}=require('../r07-1/support.cjs');register();
const root=path.resolve(__dirname,'../../..');
// Secret/config adapters and Hono registration are replaced only in isolated tests.
// Production SQL, generator, AI HTTP adapter, source lookup, presenter and handlers run unchanged.
const originalLoad=Module._load;
class HonoRegistration {use(){return this}get(){return this}post(){return this}delete(){return this}}
Module._load=function(name,parent,isMain){
 if(name==='hono')return {Hono:HonoRegistration};
 if(name==='./config' && /lib[\\/]ai-service\.ts$/.test(parent?.filename||''))return {
  getAiServeUrl:async env=>env.BACKEND_ORIGIN,getAiServeApiKey:async()=>null,
  getAiDefaultModel:async env=>env.AI_DEFAULT_MODEL||'test-model',getAiVisionModel:async()=>null,
 };
 return originalLoad.call(this,name,parent,isMain);
};
function fixture(t,filename=':memory:'){
 const raw=new DatabaseSync(filename);
 for(const f of ['0005_translation_cache.sql','0024_domain_outbox.sql','0026_translation_jobs.sql','0029_translation_job_leases.sql','0033_translation_job_lease_fence.sql','0034_domain_outbox_last_attempt_at.sql','0040_anonymous_identity_revocations.sql','0041_translation_execution.sql']){
  if(filename!==':memory:' && raw.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='translation_attempts'").get())break;
  raw.exec(fs.readFileSync(path.join(root,'workers/migrations',f),'utf8'));
 }
 const DB={prepare(sql){let args=[];return {bind(...a){args=a;return this},async first(){return raw.prepare(sql).get(...args)||null},async all(){return {results:raw.prepare(sql).all(...args)}},async run(){return this.exec()},exec(){return {success:true,meta:{changes:Number(raw.prepare(sql).run(...args).changes)}}}}},
  async batch(statements){raw.exec('BEGIN IMMEDIATE');try{const results=statements.map(s=>s.exec());raw.exec('COMMIT');return results}catch(e){raw.exec('ROLLBACK');throw e}}};
 t.after(()=>raw.close());
 return {raw,DB,env:{DB,ENV:'development',JWT_SECRET:'test-only',FEATURE_AI_ENABLED:'true',TRANSLATION_EXECUTION_ENABLED:'true',
  TRANSLATION_WARM_ENABLED:'true',BACKEND_ORIGIN:'https://backend.test',BACKEND_KEY:'test-only-key',PUBLIC_SITE_URL:'https://public.test',API_BASE_URL:'https://api.test'}};
}
const source=(patch={})=>({year:'2026',slug:'sample',title:'Original title',description:'Original description',content:'# Original\n\nAn example paragraph for translation.',sourceLang:'ko',...patch});
function network(t,env,{posts=[source()],generate=async(prompt)=>prompt.includes('Title:')?'Translated title':prompt.includes('Description:')?'Translated description':'# Translated\n\nAn example paragraph in the target language.',wakeStatus=202}={}){
 const previous=global.fetch;const calls=[];const generations=[];
 global.fetch=async(input,init={})=>{
  const url=typeof input==='string'?input:input.href||input.url;calls.push({url,init});
  if(url===env.PUBLIC_SITE_URL+'/posts-manifest.json')return Response.json({items:posts.map(p=>({...p,path:`/posts/${p.year}/${encodeURIComponent(p.slug)}.md`,published:p.published!==false}))});
  if(url.startsWith(env.PUBLIC_SITE_URL+'/posts/')){
   const p=posts.find(p=>new URL(url).pathname===`/posts/${p.year}/${encodeURIComponent(p.slug)}.md`);
   if(!p)return new Response('missing',{status:404});
   return new Response(`---\ntitle: "${p.title}"\ndescription: "${p.description}"\ndefaultLanguage: "${p.sourceLang}"\n---\n${p.content}`,{headers:{'Content-Type':'text/markdown'}});
  }
  if(url===env.BACKEND_ORIGIN+'/api/v1/ai/generate'){
   const body=JSON.parse(init.body);generations.push({body,headers:new Headers(init.headers)});
   const result=await generate(body.prompt,generations.length,body,init);
   if(result instanceof Response)return result;
   return Response.json({ok:true,data:{text:result}});
  }
  if(url.endsWith('/internal/translations/wake'))return Response.json({ok:wakeStatus===202},{status:wakeStatus});
  throw new Error('Unexpected fetch: '+url);
 };
 t.after(()=>{global.fetch=previous});return {calls,generations,posts};
}
function context(env,params={year:'2026',slug:'sample',targetLang:'en'},query={},body={},token){
 const headers=new Headers();const values=new Map();const waits=[];
 const search=new URLSearchParams(query);const url=`https://api.test/api/v1/public/posts/${params.year}/${encodeURIComponent(params.slug)}/translations/${params.targetLang}?${search}`;
 return {env,waits,headers,req:{param:()=>params,query:name=>query[name],url,raw:new Request(url),json:async()=>body,
  header:name=>name.toLowerCase()==='authorization'?(token?`Bearer ${token}`:undefined):name.toLowerCase()==='idempotency-key'?body.idempotencyKey:undefined},
  get:key=>values.get(key),set:(key,value)=>values.set(key,value),header:(key,value)=>headers.set(key,value),
  executionCtx:{waitUntil:p=>waits.push(p)},json:(value,status)=>new Response(JSON.stringify(value),{status:typeof status==='number'?status:status?.status??200,headers})};
}
module.exports={root,ts,fixture,source,network,context};
