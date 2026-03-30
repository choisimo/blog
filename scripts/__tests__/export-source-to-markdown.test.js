const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  shouldExcludePath,
  walk,
} = require('../export-source-to-markdown.js');

function writeFile(rootDir, relativePath, content = 'export const value = 1;\n') {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, 'utf8');
}

test('shouldExcludePath blocks env files and generated public artifacts', () => {
  assert.equal(shouldExcludePath('.env'), true);
  assert.equal(shouldExcludePath('.env.production'), true);
  assert.equal(shouldExcludePath('frontend/public/blog/2026/example.html'), true);
  assert.equal(shouldExcludePath('frontend/public/post/example.html'), true);
  assert.equal(shouldExcludePath('frontend/public/posts-manifest.json'), true);
  assert.equal(shouldExcludePath('frontend/public/projects-manifest.json'), true);
  assert.equal(shouldExcludePath('frontend/public/sitemap.xml'), true);
  assert.equal(shouldExcludePath('frontend/src/app.ts'), false);
});

test('walk excludes temp, evidence, and generated paths while keeping source files', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'source-export-'));

  try {
    writeFile(rootDir, 'frontend/src/App.tsx', 'export const App = () => null;\n');
    writeFile(rootDir, '.tmp/api-keys-capture.mjs', 'const secret = "nope";\n');
    writeFile(rootDir, '.evidence/screenshot.js', 'const image = true;\n');
    writeFile(rootDir, '.sisyphus/notes.js', 'const note = true;\n');
    writeFile(rootDir, 'frontend/public/blog/2026/generated.html', '<html></html>\n');
    writeFile(rootDir, 'frontend/public/post/generated.html', '<html></html>\n');
    writeFile(rootDir, 'frontend/public/posts-manifest.json', '{"items":[]}\n');
    writeFile(rootDir, 'frontend/public/sitemap.xml', '<xml />\n');
    writeFile(rootDir, '.env.local', 'API_KEY=secret\n');

    const collected = [];
    walk(rootDir, rootDir, collected, 1024 * 1024);
    collected.sort();

    assert.deepEqual(collected, ['frontend/src/App.tsx']);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});
