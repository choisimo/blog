/* Syntax/transpile diagnostics, explicitly NOT a project typecheck/build. */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const ts=require(process.env.TYPESCRIPT_PATH || 'typescript');
const postcss=require(process.env.POSTCSS_PATH || 'postcss');
const root=path.resolve(__dirname,'../..');
// Delivery archives omit .git. Use the recorded change list in that case.
let candidates;
try {
 const tracked=cp.execFileSync('git',['diff','--name-only','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']});
 const added=cp.execFileSync('git',['ls-files','--others','--exclude-standard'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']});
 candidates=(tracked+'\n'+added).trim().split('\n');
} catch {
 candidates=JSON.parse(fs.readFileSync(path.join(root,'verification/reader-experience/changed-files.json'),'utf8'));
}
const names=Array.from(new Set(candidates)).filter(Boolean);
const results=[];
for(const name of names){
 const full=path.join(root,name);if(!fs.existsSync(full)||name.endsWith('.d.ts'))continue;
 if(/\.(ts|tsx)$/.test(name)){
 const result=ts.transpileModule(fs.readFileSync(full,'utf8'),{fileName:full,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,isolatedModules:true}});
 const errors=(result.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error);
 if(errors.length)throw Error(name+': '+errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,'\n')).join('\n'));
 results.push({file:name,check:'TypeScript syntax/transpile',result:'PASS'});
 }else if(/\.(js|cjs)$/.test(name)){
 cp.execFileSync(process.execPath,['--check',full]);results.push({file:name,check:'node --check',result:'PASS'});
 }else if(name.endsWith('.css')){postcss.parse(fs.readFileSync(full,'utf8'),{from:name});results.push({file:name,check:'CSS parse',result:'PASS'});}
}
fs.writeFileSync(path.join(root,'verification/reader-experience/syntax.json'),JSON.stringify({scope:'Syntax only; not a full TypeScript typecheck or bundle',results},null,2));
console.log('PASS: '+results.length+' source files (syntax only)');
