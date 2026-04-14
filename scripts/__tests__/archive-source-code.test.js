const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  collectSourceFiles,
  createArchive,
} = require('../archive-source-code.js');

function writeFile(rootDir, relativePath, content = 'export const value = 1;\n') {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, 'utf8');
}

test('collectSourceFiles keeps source-like files and drops docs, images, cache, and build output', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'source-archive-'));

  try {
    writeFile(rootDir, 'frontend/src/App.tsx', 'export const App = () => null;\n');
    writeFile(rootDir, 'workers/api-gateway/src/index.ts', 'export default {};\n');
    writeFile(rootDir, 'frontend/public/demos/think-more-nodes.html', '<html></html>\n');
    writeFile(rootDir, 'Dockerfile.local', 'FROM node:22\n');
    writeFile(rootDir, '.gitignore', 'node_modules\n');
    writeFile(rootDir, 'docs/architecture.md', '# docs\n');
    writeFile(rootDir, 'docs/generated/contracts.json', '{}\n');
    writeFile(rootDir, 'frontend/public/blog/2026/example/index.html', '<html></html>\n');
    writeFile(rootDir, 'frontend/public/nodove.png', 'png\n');
    writeFile(rootDir, 'dist/app.js', 'console.log("built");\n');
    writeFile(rootDir, '.cache/tmp.ts', 'export const cache = true;\n');
    writeFile(rootDir, '.env.local', 'API_KEY=secret\n');

    assert.deepEqual(collectSourceFiles(rootDir), [
      '.gitignore',
      'Dockerfile.local',
      'frontend/public/demos/think-more-nodes.html',
      'frontend/src/App.tsx',
      'workers/api-gateway/src/index.ts',
    ]);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('createArchive writes a tar.gz with preserved relative paths', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'source-archive-'));

  try {
    writeFile(rootDir, 'backend/src/server.js', 'module.exports = {};\n');
    writeFile(rootDir, 'shared/src/contracts/common.js', 'exports.value = 1;\n');
    writeFile(rootDir, 'README.md', '# ignore me\n');

    const archivePath = path.join(rootDir, 'artifacts', 'source-code-export.tar.gz');
    const files = collectSourceFiles(rootDir);

    createArchive(rootDir, archivePath, files);

    const result = spawnSync('tar', ['-tzf', archivePath], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.stdout.trim().split('\n').sort(), [
      'backend/src/server.js',
      'shared/src/contracts/common.js',
    ]);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});
