import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const snapshotPath = path.join(
  repoRoot,
  "docs/generated/contract-drift.snapshot.json",
);

const registrySources = {
  backend: "backend/src/routes/registry.js",
  worker: "workers/api-gateway/src/routes/registry.ts",
  boundaries: "shared/src/contracts/service-boundaries.js",
  workerIndex: "workers/api-gateway/src/index.ts",
};

const consumerFiles = [
  "frontend/src/services/content/translate.ts",
  "frontend/src/services/session/fingerprint.ts",
  "frontend/src/services/realtime/notificationSSE.ts",
  "frontend/src/services/realtime/notifications.ts",
  "backend/src/routes/translate.js",
  "backend/src/routes/notifications.js",
  "backend/src/routes/user.js",
  "workers/api-gateway/src/routes/translate.ts",
  "workers/api-gateway/src/routes/notifications.ts",
  "workers/api-gateway/src/routes/user.ts",
];

const sessionContractFiles = {
  frontend: "frontend/src/services/session/fingerprint.ts",
  backend: "backend/src/routes/user.js",
  worker: "workers/api-gateway/src/routes/user.ts",
};

const authSemanticsFiles = {
  backendUserAuth: "backend/src/middleware/userAuth.js",
  workerUserAuth: "workers/api-gateway/src/middleware/auth.ts",
  backendAuthRoutes: "backend/src/routes/auth.js",
  workerAuthRoutes: "workers/api-gateway/src/routes/auth.ts",
};

const commentsBoundaryFiles = {
  worker: "workers/api-gateway/src/routes/comments.ts",
  backend: "backend/src/routes/comments.js",
};

async function collectRouteOwnership() {
  const [backendRegistry, workerRegistry, boundarySource, workerIndexSource] =
    await Promise.all([
      readSource(registrySources.backend),
      readSource(registrySources.worker),
      readSource(registrySources.boundaries),
      readSource(registrySources.workerIndex),
    ]);

  const backendEntries = [
    ...backendRegistry.matchAll(
      /\{\s*boundaryId:\s*'([^']+)',\s*basePath:\s*'([^']+)'/g,
    ),
  ].map((match) => ({
    owner: "backend",
    boundaryId: match[1],
    path: match[2],
  }));

  const workerEntries = [
    ...workerRegistry.matchAll(
      /\{\s*boundaryId:\s*'([^']+)',\s*path:\s*'([^']+)'/g,
    ),
  ].map((match) => ({
    owner: "worker",
    boundaryId: match[1],
    path: `/api/v1${match[2]}`,
  }));

  const sharedBoundaries = [
    ...boundarySource.matchAll(
      /\{\s*id:\s*'([^']+)',\s*prefix:\s*'([^']+)',\s*owner:\s*ROUTE_OWNERS\.([A-Z_]+)/g,
    ),
  ].map((match) => ({
    boundaryId: match[1],
    prefix: match[2],
    owner: match[3],
  }));

  const publicConfigSurface = {
    topLevelKeys: [
      "apiBaseUrl",
      "chatBaseUrl",
      "chatWsBaseUrl",
      "terminalGatewayUrl",
      "ai",
      "features",
      "capabilities",
    ].filter((key) => new RegExp(`\\b${key}\\b`).test(workerIndexSource)),
    featureKeys: [
      "aiEnabled",
      "ragEnabled",
      "terminalEnabled",
      "aiInline",
      "commentsEnabled",
    ].filter((key) => new RegExp(`\\b${key}\\b`).test(workerIndexSource)),
    capabilityKeys: [
      "supportsChatWebSocket",
      "hasTerminalGatewayUrl",
    ].filter((key) => new RegExp(`\\b${key}\\b`).test(workerIndexSource)),
  };

  return {
    backendEntries,
    workerEntries,
    sharedBoundaries,
    proxyableBoundaryOwners: ["BACKEND", "PROXY_ONLY", "COMPATIBILITY"],
    publicConfigSurface,
  };
}

async function collectSharedImports() {
  const usage = [];

  for (const file of consumerFiles) {
    const absPath = path.join(repoRoot, file);
    const source = await readFile(absPath, "utf8").catch(() => "");
    const imports = [
      ...source.matchAll(/@blog\/shared\/contracts\/([A-Za-z0-9-_]+)/g),
    ].map((match) => match[1]);

    usage.push({
      file,
      sharedContracts: Array.from(new Set(imports)).sort(),
    });
  }

  return usage;
}

async function readSource(relativePath) {
  const absPath = path.join(repoRoot, relativePath);
  return readFile(absPath, "utf8");
}

async function collectUserSessionContract() {
  const [frontendSource, backendSource, workerSource] = await Promise.all([
    readSource(sessionContractFiles.frontend),
    readSource(sessionContractFiles.backend),
    readSource(sessionContractFiles.worker),
  ]);

  const frontendCalls = [
    ...frontendSource.matchAll(/\/api\/v1\/user\/session(?:\/[A-Za-z-]+)?/g),
  ].map((match) => match[0]);

  const backendRoutes = [
    ...backendSource.matchAll(/["']\/session(?:\/[A-Za-z:]+)?["']/g),
  ].map((match) => match[0].slice(1, -1));

  const workerRoutes = [
    ...workerSource.matchAll(/['"]\/session(?:\/[A-Za-z:]+)?['"]/g),
  ].map((match) => match[0].slice(1, -1));

  return {
    frontendCalls: Array.from(new Set(frontendCalls)).sort(),
    backendRoutes: Array.from(new Set(backendRoutes)).sort(),
    workerRoutes: Array.from(new Set(workerRoutes)).sort(),
  };
}

async function collectAuthSemantics() {
  const [
    backendUserAuthSource,
    workerUserAuthSource,
    backendAuthRouteSource,
    workerAuthRouteSource,
    backendJwtSource,
    workerJwtSource,
  ] = await Promise.all([
    readSource(authSemanticsFiles.backendUserAuth),
    readSource(authSemanticsFiles.workerUserAuth),
    readSource(authSemanticsFiles.backendAuthRoutes),
    readSource(authSemanticsFiles.workerAuthRoutes),
    readSource("backend/src/lib/jwt.js"),
    readSource("workers/api-gateway/src/lib/jwt.ts"),
  ]);

  return {
    refreshGuard: {
      backendUserAuth:
        /claims\??\.type === 'refresh'/.test(backendUserAuthSource),
      workerUserAuth:
        /payload\.type === 'refresh'/.test(workerUserAuthSource),
    },
    issuerAudienceGuard: {
      backend:
        /!claims\.iss \|\| claims\.iss !== JWT_ISSUER/.test(backendJwtSource) &&
        /!claims\.aud \|\| !hasExpectedAudience\(claims\.aud\)/.test(backendJwtSource),
      worker:
        /!payload\.iss \|\| payload\.iss !== JWT_ISSUER/.test(workerJwtSource) &&
        /!payload\.aud \|\| payload\.aud !== JWT_AUDIENCE/.test(workerJwtSource),
    },
    anonymousClaims: {
      backend:
        /role: 'anonymous'/.test(backendAuthRouteSource) &&
        /type: 'access'/.test(backendAuthRouteSource) &&
        /tokenClass: 'anonymous'/.test(backendAuthRouteSource),
      worker:
        /role: 'anonymous'/.test(workerAuthRouteSource) &&
        /type: 'access'/.test(workerAuthRouteSource) &&
        /tokenClass: 'anonymous'/.test(workerAuthRouteSource),
    },
    legacyAnonymousCompat: {
      backend:
        /claims\.role === 'anon'/.test(backendAuthRouteSource) ||
        /claims\.type === 'anon'/.test(backendAuthRouteSource),
      worker:
        /payload\.role === 'anon'/.test(workerAuthRouteSource) ||
        /payload\.type === 'anon'/.test(workerAuthRouteSource),
    },
  };
}

async function collectCommentsBoundary() {
  const [workerSource, backendSource] = await Promise.all([
    readSource(commentsBoundaryFiles.worker),
    readSource(commentsBoundaryFiles.backend),
  ]);

  return {
    workerUsesDirectD1:
      /\.\.\/lib\/d1/.test(workerSource) ||
      /\bquery(All|One)\s*\(/.test(workerSource) ||
      /\bexecute\s*\(/.test(workerSource),
    workerUsesBackendProxy:
      /BACKEND_ORIGIN/.test(workerSource) &&
      /\bfetch\s*\(/.test(workerSource),
    backendUsesDirectD1:
      /\bquery(All|One)\s*\(/.test(backendSource) ||
      /\bexecute\s*\(/.test(backendSource),
  };
}

function sortJson(value) {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortJson(child)]),
    );
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(sortJson(value), null, 2);
}

async function buildSnapshot() {
  return {
    generatedAt: "snapshot-managed",
    routeOwnership: await collectRouteOwnership(),
    sharedContractUsage: await collectSharedImports(),
    userSessionContract: await collectUserSessionContract(),
    authSemantics: await collectAuthSemantics(),
    commentsBoundary: await collectCommentsBoundary(),
  };
}

async function main() {
  const shouldWrite = process.argv.includes("--write");
  const snapshot = await buildSnapshot();
  const serialized = stableStringify(snapshot);

  if (shouldWrite) {
    await mkdir(path.dirname(snapshotPath), { recursive: true });
    await writeFile(snapshotPath, `${serialized}\n`, "utf8");
    console.log(`Wrote ${path.relative(repoRoot, snapshotPath)}`);
    return;
  }

  const existing = await readFile(snapshotPath, "utf8").catch(() => null);
  if (!existing) {
    console.error(
      `Missing snapshot at ${path.relative(repoRoot, snapshotPath)}. Run with --write first.`,
    );
    process.exitCode = 1;
    return;
  }

  if (existing.trim() !== serialized.trim()) {
    console.error(
      "Contract drift detected. Refresh the snapshot with --write.",
    );
    process.exitCode = 1;
    return;
  }

  console.log("Contract snapshot is up to date.");
}

await main();
