/** Syntax checks are intentionally separate from the full application type-check/build. */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ts, postcss, frontendRoot } from './loader.mjs';

const files = [
  'src/components/common/PostImage.tsx', 'src/components/common/ReadingProgress.tsx',
  'src/components/features/blog/ImageLightbox.tsx', 'src/components/features/blog/MarkdownRenderer.tsx',
  'src/components/features/blog/TableOfContents.tsx', 'src/components/molecules/MarkdownTable.tsx',
  'src/components/ui/scroll-area.tsx', 'src/pages/public/BlogPost.tsx',
  'src/pages/public/blog-post/BlogPostContent.tsx', 'src/pages/public/blog-post/BlogPostHeader.tsx',
  'src/utils/content/imageGeometry.ts', 'src/utils/content/postMedia.ts', 'src/utils/content/readingProgress.ts',
  'src/index.css', 'src/styles/ui-pages.css', 'src/styles/ui-adaptive.css',
  'src/styles/ui-reading.css', 'src/styles/ui-scrollbars.css',
];
for (const folder of ['src/test/reading', 'e2e']) {
  for (const file of readdirSync(new URL(folder, frontendRoot))) {
    if (file.startsWith('reading-') && /\.tsx?$/.test(file)) files.push(`${folder}/${file}`);
  }
}
let checked = 0;
for (const relative of files) {
  const source = readFileSync(new URL(relative, frontendRoot), 'utf8');
  if (relative.endsWith('.css')) postcss.parse(source, { from: relative });
  else {
    const result = ts.transpileModule(source, {
      fileName: relative, reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020, jsx: ts.JsxEmit.ReactJSX },
    });
    const errors = result.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error) || [];
    if (errors.length) throw new Error(errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n'));
  }
  checked += 1;
}
// These production modules have no React/package dependencies, so a real strict semantic check is possible offline.
const roots = ['imageGeometry', 'postMedia', 'readingProgress'].map(name => fileURLToPath(new URL(`src/utils/content/${name}.ts`, frontendRoot)));
const program = ts.createProgram(roots, {
  target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020,
  strict: true, noUnusedLocals: true, noUnusedParameters: true, noImplicitReturns: true,
  skipLibCheck: true, noEmit: true, types: [],
});
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length) throw new Error(diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n'));
console.log(JSON.stringify({ compiler: ts.version, syntaxCheckedFiles: checked, strictCheckedPureModules: roots.length, applicationBuild: 'NOT_RUN' }, null, 2));
