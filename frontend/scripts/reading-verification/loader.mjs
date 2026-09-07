/** Use the project's locked compiler normally; an explicit path also permits offline verification. */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
export const ts = require(process.env.READING_TYPESCRIPT_PATH || 'typescript');
export const postcss = require(process.env.READING_POSTCSS_PATH || 'postcss');
export const frontendRoot = new URL('../../', import.meta.url);

export async function loadSource(relativePath) {
  const source = readFileSync(new URL(relativePath, frontendRoot), 'utf8');
  const compiled = ts.transpileModule(source, {
    fileName: relativePath,
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020 },
    reportDiagnostics: true,
  });
  const errors = compiled.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error) || [];
  if (errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(errors, {
    getCanonicalFileName: name => name, getCurrentDirectory: () => '', getNewLine: () => '\n',
  }));
  return import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`);
}
