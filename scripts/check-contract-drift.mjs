import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const snapshotPath = path.join(
  repoRoot,
  'docs/generated/contract-drift.snapshot.json'
);

const routeFiles = [
  {
    owner: 'backend',
    file: 'backend/src/index.js',
    pattern: /app\.use\("([^"]+)",\s*([A-Za-z0-9_]+)/g,
  },
  {
    owner: 'worker',
    file: 'workers/api-gateway/src/index.ts',
    pattern: /api\.route\('([^']+)',\s*([A-Za-z0-9_]+)/g,
  },
];

const consumerFiles = [
  'frontend/src/services/content/translate.ts',
  'frontend/src/services/session/fingerprint.ts',
  'frontend/src/services/realtime/notificationSSE.ts',
  'backend/src/routes/translate.js',
  'backend/src/routes/notifications.js',
  'backend/src/routes/user.js',
  'workers/api-gateway/src/routes/translate.ts',
  'workers/api-gateway/src/routes/notifications.ts',
  'workers/api-gateway/src/routes/user.ts',
];

async function collectRouteMounts() {
  const mounts = [];

  for (const { owner, file, pattern } of routeFiles) {
    const absPath = path.join(repoRoot, file);
    const source = await readFile(absPath, 'utf8');
    let match;
    while ((match = pattern.exec(source)) !== null) {
      mounts.push({
        owner,
        file,
        mountPath: match[1],
        symbol: match[2],
      });
    }
  }

  return mounts.sort((a, b) =>
    `${a.owner}:${a.mountPath}:${a.symbol}`.localeCompare(
      `${b.owner}:${b.mountPath}:${b.symbol}`
    )
  );
}

async function collectSharedImports() {
  const usage = [];

  for (const file of consumerFiles) {
    const absPath = path.join(repoRoot, file);
    const source = await readFile(absPath, 'utf8').catch(() => '');
    const imports = [...source.matchAll(/@blog\/shared\/contracts\/([A-Za-z0-9-_]+)/g)].map(
      match => match[1]
    );

    usage.push({
      file,
      sharedContracts: Array.from(new Set(imports)).sort(),
    });
  }

  return usage;
}

function sortJson(value) {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortJson(child)])
    );
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(sortJson(value), null, 2);
}

async function buildSnapshot() {
  return {
    generatedAt: 'snapshot-managed',
    routeMounts: await collectRouteMounts(),
    sharedContractUsage: await collectSharedImports(),
  };
}

async function main() {
  const shouldWrite = process.argv.includes('--write');
  const snapshot = await buildSnapshot();
  const serialized = stableStringify(snapshot);

  if (shouldWrite) {
    await mkdir(path.dirname(snapshotPath), { recursive: true });
    await writeFile(snapshotPath, `${serialized}\n`, 'utf8');
    console.log(`Wrote ${path.relative(repoRoot, snapshotPath)}`);
    return;
  }

  const existing = await readFile(snapshotPath, 'utf8').catch(() => null);
  if (!existing) {
    console.error(
      `Missing snapshot at ${path.relative(repoRoot, snapshotPath)}. Run with --write first.`
    );
    process.exitCode = 1;
    return;
  }

  if (existing.trim() !== serialized.trim()) {
    console.error('Contract drift detected. Refresh the snapshot with --write.');
    process.exitCode = 1;
    return;
  }

  console.log('Contract snapshot is up to date.');
}

await main();
