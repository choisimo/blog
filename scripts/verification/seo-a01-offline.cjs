#!/usr/bin/env node
'use strict';
// Runs the same Node unit tests without an installed tsx. This is NOT a Workers
// runtime or a semantic typecheck. No HTMLRewriter implementation is substituted.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const workspace = path.join(root, 'workers/seo-gateway');
let ts;
for (const candidate of [process.env.TYPESCRIPT_MODULE, path.join(workspace, 'node_modules/typescript'), 'typescript']) {
  if (!candidate) continue;
  try { ts = require(candidate); break; } catch { /* Try the next installed compiler. */ }
}
if (!ts) {
  try {
    const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8', timeout: 5000 }).trim();
    ts = require(path.join(globalRoot, 'typescript'));
  } catch {
    console.error('TypeScript is required. Install locked dependencies or set TYPESCRIPT_MODULE to an installed compiler.');
    process.exit(1);
  }
}
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-seo-a01-unit-'));
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? files(full) : [full];
  });
}
try {
  fs.writeFileSync(path.join(temp, 'package.json'), '{"type":"commonjs"}\n');
  const inputs = [...files(path.join(workspace, 'src')), ...files(path.join(workspace, 'test'))]
    .filter(file => file.endsWith('.ts') && !file.endsWith('.d.ts'));
  for (const file of inputs) {
    const result = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      fileName: file, reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    });
    const errors = (result.diagnostics || []).filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error);
    if (errors.length) throw new Error(`${file}: ${errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n')}`);
    const output = path.join(temp, path.relative(workspace, file).replace(/\.ts$/, '.js'));
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, result.outputText);
  }
  const tests = fs.readdirSync(path.join(temp, 'test')).filter(file => file.endsWith('.test.js')).map(file => path.join(temp, 'test', file));
  console.log(`# A01 isolated Node unit tests; TypeScript ${ts.version}; ${inputs.length} source/test files transpiled.`);
  console.log('# External fetch is fixture-backed. Actual HTMLRewriter/runtime verification: npm run test:runtime in workers/seo-gateway.');
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...tests], {
    cwd: workspace, env: { ...process.env, BLOG_SOURCE: root }, stdio: 'inherit', timeout: 90_000,
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
