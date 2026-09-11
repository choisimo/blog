'use strict';
// Parser/transpiler validation only. Does not substitute for the locked workspace type checker.
const fs=require('node:fs'),path=require('node:path');
const {root,ts}=require('../r07-1/support.cjs');
const inventory=JSON.parse(fs.readFileSync(path.join(root,'verification/translation-a02/source-changes.json'),'utf8'));
const results=[];
for(const file of [...inventory.changed,...inventory.added]) {
 if(!/\.(ts|tsx|js|mjs|cjs)$/.test(file))continue;
 const input=fs.readFileSync(path.join(root,file),'utf8');
 const kind=file.endsWith('.tsx')?ts.ScriptKind.TSX:file.endsWith('.ts')?ts.ScriptKind.TS:ts.ScriptKind.JS;
 const ast=ts.createSourceFile(file,input,ts.ScriptTarget.Latest,true,kind);
 const errors=ast.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n'));
 if(!file.endsWith('.d.ts')) {
  const output=ts.transpileModule(input,{fileName:file,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,allowJs:true}});
  errors.push(...(output.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')));
 }
 results.push({file,passed:!errors.length,errors});
}
const report={scope:'Source parse/transpile only, including declarations; not semantic type checking',compiler:ts.version,checked:results.length,passed:results.filter(r=>r.passed).length,results};
fs.writeFileSync(path.join(root,'verification/translation-a02/syntax.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({checked:report.checked,passed:report.passed}));
process.exitCode=report.checked===report.passed?0:1;
