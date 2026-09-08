/** Static + pure-function gates. This is NOT a React/Vite or live API integration test. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require=createRequire(import.meta.url), ts=require('typescript'), postcss=require('postcss');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const baseline=JSON.parse(fs.readFileSync(path.join(root,'docs/ui-refactor/invariants.json'),'utf8'));
const text=f=>fs.readFileSync(path.join(root,f),'utf8');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const tree=(t,f='file.tsx')=>ts.createSourceFile(f,t,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function walk(n,fn){fn(n);ts.forEachChild(n,c=>walk(c,fn));}
function canonical(n,sf){const scanner=ts.createScanner(ts.ScriptTarget.Latest,true,ts.LanguageVariant.JSX,n.getText(sf));const a=[];while(scanner.scan()!==ts.SyntaxKind.EndOfFileToken)a.push(scanner.getTokenText());return JSON.stringify(a);}
function routes(t){const sf=tree(t),a=[];walk(sf,n=>{if((ts.isJsxSelfClosingElement(n)||ts.isJsxOpeningElement(n))&&n.tagName.getText(sf)==='Route'){const p=n.attributes.properties.find(x=>ts.isJsxAttribute(x)&&x.name.getText(sf)==='path');if(p?.initializer&&ts.isStringLiteral(p.initializer))a.push({path:p.initializer.text,contract:canonical(n,sf)});}});return a;}
function effects(t){const sf=tree(t),a=[];walk(sf,n=>{if(ts.isCallExpression(n)&&n.expression.getText(sf)==='useEffect')a.push(hash(canonical(n,sf)));});return a;}
function decls(t,names){const sf=tree(t),a={};walk(sf,n=>{if((ts.isFunctionDeclaration(n)||ts.isVariableDeclaration(n))&&n.name&&names.includes(n.name.getText(sf)))a[n.name.getText(sf)]=hash(canonical(n,sf));});return a;}
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}

test('31 original route elements, order, redirects and auth wrappers are unchanged',()=>{
 assert.equal(baseline.routeInventory.length,31);assert.deepEqual(routes(text('frontend/src/App.tsx')),baseline.routeInventory);
});
const amendmentRecord=JSON.parse(text('docs/ui-refactor/lifecycle-amendments.json'));
const lifecycleAmendments=amendmentRecord.changes;
// A declaration can change only through an explicit record tied to its original
// baseline and real regression-test files. Unlisted declarations stay immutable.
const declarationAmendments=new Map();
for(const amendment of amendmentRecord.declarationAmendments??[]){
 const {file,name,before,after,reason,tests}=amendment;
 const key=`${file}:${name}`;
 assert.ok(!declarationAmendments.has(key),`duplicate declaration amendment: ${key}`);
 assert.ok(Object.hasOwn(baseline.declarations[file]??{},name),`unknown baseline declaration: ${key}`);
 assert.equal(before,baseline.declarations[file][name],`original baseline changed: ${key}`);
 assert.match(after,/^[a-f0-9]{64}$/,`invalid amended digest: ${key}`);
 assert.ok(typeof reason==='string'&&reason.trim().length>0,`missing change reason: ${key}`);
 assert.ok(Array.isArray(tests)&&tests.length>0,`missing regression evidence: ${key}`);
 for(const testFile of tests){
  assert.ok(typeof testFile==='string'&&/\.(test|spec)\.[cm]?[jt]sx?$/.test(testFile),`not a test file: ${testFile}`);
  const absolute=path.resolve(root,testFile),relative=path.relative(root,absolute);
  assert.ok(!relative.startsWith('..')&&!path.isAbsolute(relative),`test outside repository: ${testFile}`);
  assert.ok(fs.existsSync(absolute)&&fs.statSync(absolute).isFile(),`missing regression test: ${testFile}`);
 }
 declarationAmendments.set(key,amendment);
}
for(const [file,value] of Object.entries(baseline.effects)) test(`lifecycle/data effects preserved or explicitly amended: ${file}`,()=>{
 const expected=[...value]; for(const change of lifecycleAmendments.filter(c=>c.file===file)){
  assert.equal(expected[change.index],change.before);assert.ok(change.reason);expected[change.index]=change.after;
 }
 assert.deepEqual(effects(text(file)),expected);
});
for(const [file,value] of Object.entries(baseline.declarations)) for(const [name,digest] of Object.entries(value)) test(`preserved or explicitly amended contract: ${name} in ${path.basename(file)}`,()=>{
 const amendment=declarationAmendments.get(`${file}:${name}`);
 assert.equal(decls(text(file),[name])[name],amendment?amendment.after:digest);
});
for(const [file,digest]of Object.entries(baseline.packageHashes))test(`no dependency/lockfile rewrite: ${file}`,()=>{
 if(file === 'frontend/package.json') {
  // Reading verification adds scripts; installed dependencies must still match
  // the original lockfile, whose complete bytes remain checked below.
  const manifest=JSON.parse(text(file)), locked=JSON.parse(text('frontend/package-lock.json')).packages[''];
  for(const field of ['dependencies','devDependencies']) assert.deepEqual(manifest[field],locked[field]);
 } else assert.equal(hash(text(file)),digest);
});
// Reading UX intentionally replaces the legacy article/scroll rules. Actual
// layout, responsive widths and scroll ownership are covered by reading-design.spec.ts.
test('retrieved and new TypeScript/TSX files parse without syntax errors (not semantic typechecking)',()=>{
 const all=files(path.join(root,'frontend/src')).filter(f=>/\.tsx?$/.test(f));
 for(const f of all){const sf=tree(fs.readFileSync(f,'utf8'),f);assert.equal(sf.parseDiagnostics.length,0,`${f}: ${sf.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join(';')}`);}
});
test('new CSS parses; every local stylesheet import exists',()=>{
 for(const f of files(path.join(root,'frontend/src/styles')).filter(f=>f.endsWith('.css')))assert.doesNotThrow(()=>postcss.parse(fs.readFileSync(f,'utf8'),{from:f}));
 for(const match of text('frontend/src/index.css').matchAll(/@import "(\.\/[^\"]+)"/g))assert.ok(fs.existsSync(path.join(root,'frontend/src',match[1])));
});
test('JS and TS Tailwind configs expose identical namespaced color tokens',()=>{
 function uiTokens(f){const sf=tree(text(f)),a={};walk(sf,n=>{if(ts.isPropertyAssignment(n)&&n.name.getText(sf)==='ui'&&ts.isObjectLiteralExpression(n.initializer))for(const prop of n.initializer.properties)a[prop.name.text]=prop.initializer.text;});return a;}
 const a=uiTokens('frontend/config/tailwind.config.js');assert.ok(Object.keys(a).length>=15);assert.deepEqual(a,uiTokens('frontend/config/tailwind.config.ts'));
 for(const value of Object.values(a))assert.match(value,/hsl\(var\(--ui-[a-z-]+\) \/ <alpha-value>\)/);
});
test('three explicit palettes match and cannot cycle through the legacy theme aliases',()=>{
 const css=postcss.parse(text('frontend/src/styles/ui-tokens.css'));const groups={};css.walkRules(rule=>{groups[rule.selector]??={};rule.walkDecls(d=>groups[rule.selector][d.prop]=d.value);});
 for(const theme of ['.dark','.terminal'])for(const key of Object.keys(groups[theme]))assert.ok(key in groups[':root']);
 assert.equal(groups['.terminal']['--ui-font'],'var(--ui-mono)');
 for(const theme of [':root','.dark','.terminal'])for(const key of ['--ui-accent','--ui-text','--ui-muted','--ui-canvas','--ui-surface'])assert.doesNotMatch(groups[theme][key],/var\(/);
 for(const declarations of Object.values(groups))for(const key of Object.keys(declarations))assert.ok(key.startsWith('--ui-'));
});
test('shell owns no duplicate main/router/provider or synthetic persistence',()=>{
 const s=text('frontend/src/components/organisms/layout/PublicShell.tsx');assert.doesNotMatch(s,/<main|BrowserRouter|localStorage|fetch\(/);assert.match(s,/href="#main-content"/);
 const app=text('frontend/src/App.tsx');assert.equal((app.match(/id="main-content"/g)||[]).length,1);assert.match(app,/tabIndex=\{-1\}/);
});
test('all new layout modules are consumed by actual source',()=>{
 const app=text('frontend/src/App.tsx');assert.match(app,/<PublicShell>/);
 const index=text('frontend/src/pages/public/Index.tsx');assert.match(index,/<PageContainer/);assert.match(index,/<PageHeader/);assert.match(index,/<ContentStatus/);
});
test('the home still renders every existing service-driven section and PostCard search results',()=>{
 const s=text('frontend/src/pages/public/Index.tsx');for(const n of ['FieldnotesPostsSection','HomeCategoryStrip','HomeMarkdownCta','PostCard','SearchBar'])assert.match(s,new RegExp('<'+n+'[\\s>\\n]'));
 const sections=[];walk(tree(s),node=>{if(ts.isJsxSelfClosingElement(node)&&node.tagName.getText()==='FieldnotesPostsSection')sections.push(node.getText());});
 assert.equal(sections.length,2);assert.match(sections[0],/posts=\{latestPosts/);assert.match(sections[1],/posts=\{featuredPosts/);
 for(const section of sections)assert.match(section,/onRetry=/);
});
test('Fieldnotes editorial hero follows the supplied reference; CTA enabled gating retained',()=>{
 const home=text('frontend/src/pages/public/Index.tsx');assert.match(home,/Architecting/);assert.match(home,/Intelligence/);assert.match(home,/fn-home-hero/);assert.doesNotMatch(home,/animate-hero-fade-up/);
 const s=text('frontend/src/components/features/home/HomeMarkdownCta.tsx');assert.match(s,/if \(!content.enabled\) return null/);assert.doesNotMatch(s,/Sparkles|MessageSquareText/);assert.match(s,/<SafeDescriptionMarkdown/);
});
test('actual home card normalizer removes control sequences from the new description field',()=>{
 const source=text('frontend/src/pages/public/Index.tsx');
 const declarations=source.slice(source.indexOf('const ANSI_ESCAPE_PATTERN'),source.indexOf('const Index ='));
 const context={};vm.runInNewContext(ts.transpileModule(declarations,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,context);
 const post={year:'2026',slug:'real-note',description:'\u001b[31mQuiet\u001b[0m\u0000 note',title:'Title'};
 assert.equal(context.sanitizeSearchResultPost(post).description,'Quiet note');
 assert.equal(post.description,'\u001b[31mQuiet\u001b[0m\u0000 note');
 assert.equal(context.sanitizeSearchResultPost({...post,slug:'../invalid'}),null);
});
test('subscription has a real label and persistent result, without a mock transport',()=>{
 const s=text('frontend/src/components/organisms/Footer.tsx');assert.match(s,/htmlFor="footer-subscribe-email"/);assert.match(s,/id="footer-subscribe-status"/);assert.match(s,/api\/v1\/subscribe/);
});
test('header retains real search, preferences, notification source and Radix sheets',()=>{
 const s=text('frontend/src/components/organisms/Header.tsx');for(const n of ['LanguageToggle','ThemeToggle','HeaderSearchBar','NotificationPanel','SheetContent','SheetTitle'])assert.match(s,new RegExp('<'+n+'[\\s>\\/]'));
 for(const v of ['light','dark','system','terminal'])assert.match(s,new RegExp('value: "'+v+'"'));
 assert.match(s,/desktop\.removeEventListener/);assert.match(s,/onCloseAutoFocus/);assert.match(s,/document\.removeEventListener\("keydown"/);
});
// Execute production pure shortcut logic without mocking React or network behavior.
const shortcutSource=ts.transpileModule(text('frontend/src/components/organisms/headerSearchShortcut.ts'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
const sandbox={exports:{}};vm.runInNewContext(shortcutSource,sandbox);
const key=(overrides={})=>({key:'/',metaKey:false,ctrlKey:false,altKey:false,isComposing:false,defaultPrevented:false,repeat:false,...overrides});
for(const [name,event,editing,expected] of [
 ['slash',key(),false,true],['Ctrl K',key({key:'k',ctrlKey:true}),false,true],['Cmd K',key({key:'K',metaKey:true}),false,true],
 ['typing slash',key(),true,false],['typing Ctrl K',key({key:'k',ctrlKey:true}),true,false],['IME composition',key({isComposing:true}),false,false],
 ['already handled',key({defaultPrevented:true}),false,false],['repeat',key({repeat:true}),false,false],['Alt slash',key({altKey:true}),false,false],
 ['Ctrl slash',key({ctrlKey:true}),false,false],['plain K',key({key:'K'}),false,false],['Escape',key({key:'Escape'}),false,false],
])test(`keyboard policy executes: ${name}`,()=>assert.equal(sandbox.exports.isHeaderSearchShortcut(event,editing),expected));
