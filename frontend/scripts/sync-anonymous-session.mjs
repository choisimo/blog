#!/usr/bin/env node
// The classic memo component cannot resolve package exports. Publish the same ES module,
// not a second implementation; --check fails if the checked-in browser copy diverges.
import fs from 'node:fs';
const source = new URL('../../shared/src/runtime/anonymous-session.js', import.meta.url);
const target = new URL('../public/ai-memo/anonymous-session.js', import.meta.url);
const bytes = fs.readFileSync(source);
if (process.argv.includes('--check')) {
  if (!fs.existsSync(target) || !fs.readFileSync(target).equals(bytes)) {
    throw new Error('Memo anonymous-session asset differs from the canonical shared runtime. Run npm run sync:anonymous-session.');
  }
  console.log('Anonymous session browser asset matches canonical source.');
} else {
  fs.writeFileSync(target, bytes);
  console.log('Published canonical anonymous session browser asset.');
}
