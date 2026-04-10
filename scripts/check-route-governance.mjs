import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SERVICE_BOUNDARIES } from '../shared/src/contracts/service-boundaries.js';
import { WORKER_DEPLOYMENTS } from '../shared/src/contracts/workers.js';

const shouldWrite = process.argv.includes('--write');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const outPath = path.join(repoRoot, 'docs', 'generated', 'route-governance.snapshot.json');

const counts = SERVICE_BOUNDARIES.reduce((acc, boundary) => {
  acc[boundary.owner] = (acc[boundary.owner] || 0) + 1;
  return acc;
}, {});

const payload = {
  generatedAt: new Date().toISOString(),
  counts,
  serviceBoundaries: SERVICE_BOUNDARIES,
  workers: WORKER_DEPLOYMENTS,
};

if (shouldWrite) {
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Wrote ${outPath}`);
} else {
  console.log(JSON.stringify(payload, null, 2));
}
