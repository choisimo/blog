// Syntax only, NOT semantic type checking. Uses the actual changed source inventory.
const fs=require('node:fs');const path=require('node:path');
const {root,ts}=require('./support.cjs');
const files=JSON.parse(fs.readFileSync(path.join(root,'verification/anonymous-r07-1/source-changes.json'),'utf8'));
const results=[];
for(const file of [...files.changed,...files.added]){
 if(!/\.(?:ts|tsx|js|mjs|cjs)$/.test(file))continue;
 const input=fs.readFileSync(path.join(root,file),'utf8');
 const sf=ts.createSourceFile(file,input,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:file.endsWith('.ts')?ts.ScriptKind.TS:ts.ScriptKind.JS);
 const errors=sf.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n'));
 if(!file.endsWith('.d.ts')){
   const output=ts.transpileModule(input,{fileName:file,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,allowJs:true}});
   errors.push(...(output.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')));
 }
 results.push({file,syntax:errors.length?'FAIL':'PASS',errors});
}
const report={scope:'TypeScript parse/transpile only; not workspace typecheck or build',compilerVersion:ts.version,checked:results.length,passed:results.filter(r=>r.syntax==='PASS').length,results};
fs.writeFileSync(path.join(root,'verification/anonymous-r07-1/syntax.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({checked:report.checked,passed:report.passed}));
if(report.checked!==report.passed)process.exitCode=1;
