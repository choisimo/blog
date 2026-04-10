import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SERVICE_BOUNDARIES } from '../shared/src/contracts/service-boundaries.js';
import { PLATFORM_CONFIG_CONTRACT } from '../shared/src/contracts/platform-config.js';
import { DATA_OWNERSHIP } from '../shared/src/contracts/data-ownership.js';
import { WORKER_DEPLOYMENTS } from '../shared/src/contracts/workers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const outDir = path.join(repoRoot, 'docs', 'generated', 'contracts');

await fs.mkdir(outDir, { recursive: true });

const payload = {
  generatedAt: new Date().toISOString(),
  serviceBoundaries: SERVICE_BOUNDARIES,
  platformConfig: PLATFORM_CONFIG_CONTRACT,
  dataOwnership: DATA_OWNERSHIP,
  workers: WORKER_DEPLOYMENTS,
};

await fs.writeFile(
  path.join(outDir, 'architecture-contracts.json'),
  JSON.stringify(payload, null, 2),
  'utf8',
);

console.log(`Wrote ${path.join(outDir, 'architecture-contracts.json')}`);
