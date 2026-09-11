/* Read-only snapshot review. Fetch/HTMLRewriter are isolated test doubles.
 * Does not call a provider or mutate application source files.
 */
const fs=require('node:fs'), path=require('node:path'), os=require('node:os'), cp=require('node:child_process');
const assert=require('node:assert/strict');
const ts=require(process.env.TYPESCRIPT_PATH || 'typescript');
const root=process.env.BLOG_SOURCE || path.resolve(__dirname,'../..');
const out=process.env.REVIEW_OUTPUT || __dirname;
const load=(relative)=>fs.readFileSync(path.join(root,relative),'utf8');
const emit=(name,obj)=>fs.writeFileSync(path.join(out,name),JSON.stringify(obj,null,2)+'\n');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{fileName:f,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,f);
const report={scope:'Source functions executed with isolated fetch and passthrough HTMLRewriter; NOT deployed Worker/HTML transformation/E2E tests.',diagnostics:[]};
const result=(id,observed,remaining)=>report.diagnostics.push({id,observed,remaining});
async function main(){
 const currentList=JSON.parse(load('verification/reader-experience/changed-files.json'));
 const nextList=['shared/src/contracts/translation.js','frontend/scripts/rebuild-github-project-data.mjs','frontend/scripts/generate-projects-manifest.js','frontend/src/pages/public/BlogPost.tsx','frontend/src/services/content/translate.ts','frontend/src/services/content/projectService.ts','workers/api-gateway/src/routes/translate.ts','workers/api-gateway/test/translation-routes.test.ts','workers/seo-gateway/src/index.ts','workers/seo-gateway/test/gateway-routing.test.ts'];
 const syntax=[];
 for(const file of [...new Set([...currentList,...nextList])].sort()){
  const full=path.join(root,file);if(!fs.existsSync(full)||file.endsWith('.d.ts'))continue;
  if(/\.(ts|tsx)$/.test(file)){
   const r=ts.transpileModule(load(file),{fileName:full,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,isolatedModules:true}});
   const errors=(r.diagnostics||[]).filter(e=>e.category===ts.DiagnosticCategory.Error);
   syntax.push({file,check:'TypeScript syntax/transpile only',passed:errors.length===0,errors:errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,'\n'))});
  }else if(/\.(js|mjs|cjs)$/.test(file)){
   const r=cp.spawnSync(process.execPath,['--check',full],{encoding:'utf8'});
   syntax.push({file,check:'node --check',passed:r.status===0,...(r.status?{error:r.stderr}:{})});
  }
 }
 emit('syntax.json',{scope:'Changed TS/TSX/JS/MJS/CJS syntax only. Not typecheck, dependency resolution, build, CSS parsing or test-suite execution.',passed:syntax.filter(x=>x.passed).length,failed:syntax.filter(x=>!x.passed).length,files:syntax});
 assert.equal(syntax.filter(x=>!x.passed).length,0);
 const oldFetch=globalThis.fetch,oldRewriter=globalThis.HTMLRewriter;
 globalThis.HTMLRewriter=class {on(){return this}transform(response){return response}};
 const env={GITHUB_PAGES_ORIGIN:'https://pages.test/blog',RAW_CONTENT_ORIGIN:'https://raw.test/public',SITE_BASE_URL:'https://site.test',SITE_NAME:'Snapshot',API_BASE_URL:'https://api.test'};
 const worker=require(path.join(root,'workers/seo-gateway/src/index.ts')).default;
 const resolvePostMeta=require(path.join(root,'workers/seo-gateway/src/post-resolver.ts')).resolvePostMeta;
 const calls=[];
 globalThis.fetch=async (input)=>{
  const url=String(input);calls.push(url);
  if(url.includes('posts-manifest.json'))return Response.json({items:[{year:'2025',slug:'감동을_잃어버린_그대들에게',title:'감동을 잃어버린 그대들에게',published:true}]});
  if(url.includes('index.html'))return new Response('<html><head></head><body>shell</body></html>',{headers:{'Content-Type':'text/html'}});
  if(url.includes('robots.txt'))return new Response('User-agent: *',{headers:{'Content-Type':'text/plain'}});
  if(url.includes('sitemap.xml'))return new Response('<urlset/>',{headers:{'Content-Type':'application/xml'}});
  if(url.includes('.js'))return new Response('void 0;', {headers:{'Content-Type':'application/javascript'}});
  return new Response('raster',{headers:{'Content-Type':'image/png'}});
 };
 try{
  const observations=[];
  for(const ua of ['Mozilla/5.0','Googlebot','Bingbot']){
   for(const route of ['/robots.txt','/sitemap.xml','/assets/app.js','/images/cover.png']){
    calls.length=0;const r=await worker.fetch(new Request('https://site.test'+route,{headers:{'user-agent':ua}}),env);
    observations.push({ua,route,status:r.status,contentType:r.headers.get('Content-Type'),cacheControl:r.headers.get('Cache-Control'),originRequests:[...calls]});await r.text();
   }
  }
  result('D01-resource-routing',observations,'A01: crawler asset bypass and immutable control-file caching remain unresolved.');
  const projects=await resolvePostMeta(new URL('https://site.test/projects'),env);
  const encoded=await resolvePostMeta(new URL('https://site.test/blog/2025/'+encodeURIComponent('감동을_잃어버린_그대들에게')),env);
  const missing=await worker.fetch(new Request('https://site.test/blog/2026/no-such-post',{headers:{'user-agent':'Googlebot'}}),env);
  result('D02-page-resolution',{projectsCanonical:projects.url,encodedTitle:encoded.title,missingStatus:missing.status},'A01: Projects self-canonical, decoded slug lookup and missing-page 404 remain unresolved.');
 }finally{globalThis.fetch=oldFetch;globalThis.HTMLRewriter=oldRewriter}
 // ProjectService imports only erased TS types. Replace build-time env, not project logic.
 const projectModule={exports:{}};
 const projectSource=load('frontend/src/services/content/projectService.ts').replaceAll('import.meta.env','({BASE_URL:"/",PROD:false})');
 const js=ts.transpileModule(projectSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 new Function('module','exports','require',js)(projectModule,projectModule.exports,require);
 const service=projectModule.exports.ProjectService;const errorOutput=[];const prevError=console.error;console.error=(...v)=>errorOutput.push(v.map(String).join(' '));
 try{
  let count=0;
  globalThis.fetch=async()=>{count++;return new Response('',{status:503})};
  const failed=await service.getAllProjects();
  result('D03-project-total-failure',{returned:failed,networkCalls:count,rejected:false},'A03: total network failure is still exposed as an empty successful result to the UI (not cached).');
  globalThis.fetch=async()=>{count++;return Response.json({items:[{id:'live',title:'Live',url:'https://example.test/live'}]})};
  const recovered=await service.getAllProjects();
  result('D04-project-retry-after-total-failure',{count:recovered.length,id:recovered[0]?.id,networkCalls:count},'None for this narrow path: second request fetches again after both sources fail.');
  service.clearCache();count=0;
  globalThis.fetch=async input=>{count++;if(String(input).includes('projects-manifest'))return new Response('',{status:503});return Response.json({repositories:[{repository:'choisimo/sample',url:'https://example.test/sample',languages:['TypeScript']}]})};
  const fallback=await service.getAllProjects();
  globalThis.fetch=async()=>{count++;return Response.json({items:[{id:'live',title:'Live',url:'https://example.test/live'}]})};
  const later=await service.getAllProjects();
  result('D05-project-fallback-revalidation',{firstId:fallback[0]?.id,laterId:later[0]?.id,networkCalls:count},'A03: cached fallback prevents later primary-manifest revalidation; IDs also differ across sources.');
 }finally{globalThis.fetch=oldFetch;console.error=prevError}
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'blog-pr-review-'));
 try{
  fs.mkdirSync(path.join(temp,'public/project-data'),{recursive:true});fs.mkdirSync(path.join(temp,'scripts'),{recursive:true});
  for(const name of ['public/project-catalog.json','scripts/project-catalog-summaries.json'])fs.copyFileSync(path.join(root,'frontend',name),path.join(temp,name));
  const script=path.join(root,'frontend/scripts/generate-projects-manifest.js');
  const generated=cp.spawnSync(process.execPath,[script],{cwd:temp,encoding:'utf8'});assert.equal(generated.status,0,generated.stderr);
  const m=JSON.parse(fs.readFileSync(path.join(temp,'public/projects-manifest.json'),'utf8'));
  const prior=JSON.parse(load('frontend/public/projects-manifest.json'));
  assert.deepEqual(m.items,prior.items);
  result('D06-project-generator-current-catalog',{exitCode:generated.status,generated:m.items.length,uniqueIds:new Set(m.items.map(i=>i.id)).size,existingManifestItemsMatch:true},'A03: strict release gate and full YAML support are not verified by this count/items check.');
  fs.rmSync(path.join(temp,'public/project-data'),{recursive:true});fs.mkdirSync(path.join(temp,'public/project-data'));
  fs.writeFileSync(path.join(temp,'public/project-data/yaml.md'),'---\nid: yaml\ntitle: YAML Example\ndescription: |\n  First line\n  Second line\nurl: https://example.test/yaml\ntags:\n  - alpha\n  - beta\ndate: 2026-09-10\n---\n\nBody\n');
  const yaml=cp.spawnSync(process.execPath,[script],{cwd:temp,encoding:'utf8'});assert.equal(yaml.status,0,yaml.stderr);
  const v=JSON.parse(fs.readFileSync(path.join(temp,'public/projects-manifest.json'),'utf8')).items[0];
  result('D07-project-YAML-regression',{description:v.description,tags:v.tags},'A03: lightweight line/JSON parser loses YAML multiline strings and block arrays. Restore compatible parser before deployment.');
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
 const buf=fs.readFileSync(path.join(root,'frontend/src/services/content/translate.ts'));
 result('D08-literal-control-bytes',{bytes:[...buf.entries()].filter(([i,b])=>b<32&&![9,10,13].includes(b)).map(([offset,value])=>({offset,value}))},'A02: replace embedded control bytes with escaped source literals while preserving validation; explicit dot-segment rejection is still needed.');
 emit('diagnostics.json',report);console.log(JSON.stringify({syntaxPassed:syntax.length,diagnosticGroups:report.diagnostics.length,scope:report.scope},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
