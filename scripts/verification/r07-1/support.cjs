const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
function compiler() {
  for (const candidate of [process.env.TYPESCRIPT_MODULE, path.join(root,'workers/api-gateway/node_modules/typescript'),
    path.join(root,'frontend/node_modules/typescript'), 'typescript']) {
    if (!candidate) continue;
    try { return require(candidate); } catch {}
  }
  try { return require(path.join(execFileSync('npm',['root','-g'],{encoding:'utf8',timeout:5000}).trim(),'typescript')); }
  catch { throw new Error('Install project TypeScript or set TYPESCRIPT_MODULE to an installed compiler module.'); }
}
const ts=compiler();
function transpile(filename) {
  const result=ts.transpileModule(fs.readFileSync(filename,'utf8'),{fileName:filename,reportDiagnostics:true,
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}});
  const errors=(result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
  if(errors.length)throw new Error(errors.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')).join('\n'));
  return result.outputText;
}
function register(){require.extensions['.ts']=(module,filename)=>module._compile(transpile(filename),filename);}
module.exports={root,ts,transpile,register};
