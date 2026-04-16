import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ROUTE_BOUNDARIES,
  SERVICE_BOUNDARIES,
} from '../shared/src/contracts/service-boundaries.js';
import { WORKER_DEPLOYMENTS } from '../shared/src/contracts/workers.js';

const shouldWrite = process.argv.includes('--write');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const outPath = path.join(repoRoot, 'docs', 'generated', 'route-governance.snapshot.json');

const serviceBoundaryCounts = SERVICE_BOUNDARIES.reduce((acc, boundary) => {
  acc[boundary.owner] = (acc[boundary.owner] || 0) + 1;
  return acc;
}, {});

const routeBoundaryCounts = ROUTE_BOUNDARIES.reduce((acc, boundary) => {
  acc[boundary.owner] = (acc[boundary.owner] || 0) + 1;
  return acc;
}, {});

function buildPayload(generatedAt) {
  return {
    generatedAt,
    counts: {
      serviceBoundaries: serviceBoundaryCounts,
      routeBoundaries: routeBoundaryCounts,
    },
    serviceBoundaries: SERVICE_BOUNDARIES,
    routeBoundaries: ROUTE_BOUNDARIES,
    workers: WORKER_DEPLOYMENTS,
  };
}

function normalizePayload(payload) {
  return {
    ...payload,
    generatedAt: 'snapshot-managed',
  };
}

if (shouldWrite) {
  const payload = buildPayload(new Date().toISOString());
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${outPath}`);
} else {
  const existing = await fs.readFile(outPath, 'utf8').catch(() => null);
  if (!existing) {
    console.error(
      `Missing snapshot at ${path.relative(repoRoot, outPath)}. Run with --write first.`,
    );
    process.exitCode = 1;
  } else {
    const current = normalizePayload(buildPayload('snapshot-managed'));
    const persisted = normalizePayload(JSON.parse(existing));
    if (JSON.stringify(current) !== JSON.stringify(persisted)) {
      console.error('Route governance drift detected. Refresh the snapshot with --write.');
      process.exitCode = 1;
    } else {
      console.log('Route governance snapshot is up to date.');
    }
  }
}
