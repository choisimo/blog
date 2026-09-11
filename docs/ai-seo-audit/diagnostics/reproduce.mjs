/** Read-only, dependency-isolated regression probes against a supplied blog source tree.
 * Usage: BLOG_SOURCE=/absolute/path/to/blog node reproduce.mjs
 * Needs Node >= 20 and TypeScript: TYPESCRIPT_MODULE=/path/to/typescript.js
 * No production calls, no writes to the source tree, no upstream AI requests.
 * HTMLRewriter is a passthrough mock: route/status assertions, not HTML rewrite rendering.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const root = process.env.BLOG_SOURCE || '/mnt/data/blog-audit/source/blog';
let ts;
try { ts = require(process.env.TYPESCRIPT_MODULE || 'typescript'); }
catch { ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js'); }
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-audit-'));
const read = p => fs.readFileSync(path.join(root,p), 'utf8');
const compile = s => ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const results = {scope:'Source-code reproductions with isolated dependencies; not production or full-suite tests.', source:root, checks:[]};
const add=(id,observed,expectation,note='')=>results.checks.push({id,observed,expectation,note});
const origFetch=globalThis.fetch;
const origConsoleError=console.error;
try {
  const manifest=JSON.parse(read('frontend/public/posts-manifest.json'));
  const published=manifest.items.filter(p=>p.published!==false);
  const regexLiteral=read('frontend/src/services/content/translate.ts').match(/TRANSLATION_SLUG_PATTERN\s*=\s*(\/[^\n;]+\/);/)[1];
  const pattern=vm.runInNewContext(regexLiteral);
  const rejected=published.filter(p=>!pattern.test(decodeURIComponent(p.slug))).map(({year,slug})=>({year,slug}));
  add('T01-published-slug-rejection',{all:manifest.items.length,published:published.length,rejected},'Every published canonical post is reachable by translation; slash/traversal/control characters remain forbidden.');

  let projectCode=compile(read('frontend/src/services/content/projectService.ts')).replaceAll('import.meta.env','({BASE_URL:"/",PROD:false})');
  fs.writeFileSync(path.join(temp,'projectService.mjs'),projectCode);
  const {ProjectService}=await import(pathToFileURL(path.join(temp,'projectService.mjs')));
  let projectCalls=0;
  const errorLogs=[];
  console.error=(...args)=>errorLogs.push(args.map(String).join(' '));
  globalThis.fetch=async()=> {projectCalls++;return projectCalls===1?new Response('failure',{status:503}):Response.json({items:[{title:'Recovered',url:'https://example.test/project',date:'2026-09-10'}]});};
  const first=await ProjectService.getAllProjects();
  const second=await ProjectService.getAllProjects();
  ProjectService.clearCache();
  const third=await ProjectService.getAllProjects();
  console.error=origConsoleError;
  add('P01-error-cached-as-empty',{firstCount:first.length,secondCount:second.length,afterExplicitCacheClearCount:third.length,networkCalls:projectCalls,errorLogs},'A failed load must not become a successful empty cache; retry must refetch.');

  for(const name of ['index','crawler-detect','post-resolver','meta-rewriter']) {
    const source=compile(read(`workers/seo-gateway/src/${name}.ts`)).replace(/from '(\.\/[^']+)'/g,"from '$1.mjs'");
    fs.writeFileSync(path.join(temp,`${name}.mjs`),source);
  }
  globalThis.HTMLRewriter=class {on(){return this;} transform(response){return response;}};
  const calls=[];
  globalThis.fetch=async(input)=>{
    const url=String(input);calls.push(url);
    if(url.includes('/posts-manifest.json'))return Response.json(manifest);
    if(url.endsWith('/index.html'))return new Response('<html><head><title>Shell</title></head><body><div id="root"></div></body></html>',{headers:{'Content-Type':'text/html'}});
    if(url.endsWith('.xml'))return new Response('<urlset/>',{headers:{'Content-Type':'application/xml'}});
    if(url.endsWith('.txt'))return new Response('User-agent: *\nAllow: /',{headers:{'Content-Type':'text/plain'}});
    if(url.endsWith('.js'))return new Response('console.log("asset");',{headers:{'Content-Type':'application/javascript'}});
    if(url.endsWith('.png'))return new Response(new Uint8Array([137,80,78,71]),{headers:{'Content-Type':'image/png'}});
    return new Response('Missing',{status:404});
  };
  const env={GITHUB_PAGES_ORIGIN:'https://origin.test/blog',RAW_CONTENT_ORIGIN:'https://raw.test/blog',SITE_BASE_URL:'https://blog.test',SITE_NAME:'Nodove Blog',API_BASE_URL:'https://api.test'};
  const gateway=(await import(pathToFileURL(path.join(temp,'index.mjs')))).default;
  const {resolvePostMeta}=await import(pathToFileURL(path.join(temp,'post-resolver.mjs')));
  const routes=[];
  for(const ua of ['Googlebot','Mozilla/5.0'])for(const route of ['/robots.txt','/sitemap.xml','/images/cover.png','/assets/app.js','/blog/2026/definitely-missing-post']){
    calls.length=0;
    const r=await gateway.fetch(new Request(`https://blog.test${route}`,{headers:{'User-Agent':ua}}),env);
    routes.push({ua,route,status:r.status,type:r.headers.get('Content-Type'),originRequests:[...calls]});
  }
  add('S01-crawler-resource-routing',routes,'robots/sitemap/image/JS preserve actual content types regardless of UA; nonexistent pages return 404.','HTMLRewriter passthrough does not affect response routing/status. Upstream requests are mocked.');
  const proj=await resolvePostMeta(new URL('https://blog.test/projects'),env);
  const badSlug=rejected.find(p=>p.year==='2025');
  const localized=await resolvePostMeta(new URL(`https://blog.test/blog/${badSlug.year}/${encodeURIComponent(badSlug.slug)}`),env);
  add('S02-project-canonical-and-encoded-slug',{projects:proj,encodedPost:localized,expectedTitle:published.find(p=>p.slug===badSlug.slug).title},'Projects canonical is /projects; decoded published slug resolves its actual title.');

  let translationCode=compile(read('workers/api-gateway/src/lib/translation-service.ts')).replace(/^import .+?;\s*$/gm,'');
  let defaults=compile(read('workers/api-gateway/src/config/defaults.ts')).replace(/^export /gm,'');
  translationCode=`${defaults}\nconst {execute,queryOne,createAIService}=globalThis.__translationProbe;\n${translationCode}`;
  const aiPrompts=[],writes=[];
  globalThis.__translationProbe={
    queryOne:async()=>null,
    execute:async(...args)=>{writes.push(args);return {success:true};},
    createAIService:()=>({generate:async(prompt)=>{aiPrompts.push(prompt);return aiPrompts.length===1?'Translated title':aiPrompts.length===2?'Translated description':'X'.repeat(100);}}),
  };
  fs.writeFileSync(path.join(temp,'translation.mjs'),translationCode);
  const translation=await import(pathToFileURL(path.join(temp,'translation.mjs')));
  const input={year:'2026',slug:'probe',targetLang:'en',sourceLang:'ko',title:'제목',description:'설명',content:'가'.repeat(50000)};
  const translated=await translation.translateAndCachePost({}, {}, input);
  add('T02-truncated-and-unvalidated-save',{sourceChars:input.content.length,bodySentChars:aiPrompts[2].split('Content:\n')[1].length,truncationMarker:aiPrompts[2].includes('[... content truncated for translation ...]'),generatedChars:translated.content.length,suspicious:translation.isSuspiciousTranslation(input.content,translated.content),dbWrites:writes.length,returnedAsAiGenerated:translated.isAiGenerated},'Full source content represented; suspicious/incomplete output not promoted into valid translation cache.','AI outputs and D1 are mocks; application translation function is executed unchanged after import isolation.');

  let generator=read('frontend/scripts/generate-static-html.js');
  generator=generator.slice(0,generator.indexOf('function generateStaticPages('));
  generator=generator.replace(/^#!.*\n/,'').replace(/^import .*;\n/gm,'');
  const context={fs,path,process:{cwd:()=>root,env:{}},resolveSiteBaseUrl:()=>env.SITE_BASE_URL,URLSearchParams};
  vm.createContext(context);
  vm.runInContext(generator+'\nglobalThis.__generate=generatePostHtml;globalThis.__sd=generateStructuredDataStr;',context);
  const sample={...published[0],content:'BODY_SENTINEL_9f8d'};
  const html=context.__generate('<html><head><title>Shell</title><meta name="description" content=""></head><body><div id="root"></div></body></html>',sample);
  const injected=context.__sd('post',{...sample,title:'a</script><script>window.audit=1</script>'});
  add('S03-metadata-only-static-html',{articleBodyPresent:html.includes(sample.content),emptyReactRoot:html.includes('<div id="root"></div>'),rawScriptCloseInStructuredData:injected.includes('a</script><script>')},'Published HTML contains semantic article body, with inline JSON safe against script termination.','Synthetic title is a serialization test, not a demonstrated external attack.');

  const cat=JSON.parse(read('frontend/public/project-catalog.json'));
  const pm=JSON.parse(read('frontend/public/projects-manifest.json'));
  add('P02-catalog-vs-display-manifest',{catalog:cat.counts,catalogCheckedAt:cat.checkedAt,manifestTotal:pm.total,manifestItems:pm.items.length,manifestGeneratedAt:pm.generatedAt},'An intentional full public catalog must not be silently transformed into an empty display manifest.');
  results.completed=true;
} catch(error){results.error=String(error?.stack||error);process.exitCode=1;}
finally {
  globalThis.fetch=origFetch;console.error=origConsoleError;delete globalThis.__translationProbe;
  fs.rmSync(temp,{recursive:true,force:true});
  const output=path.join(path.dirname(fileURLToPath(import.meta.url)),'results.json');
  fs.writeFileSync(output,JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));
}
