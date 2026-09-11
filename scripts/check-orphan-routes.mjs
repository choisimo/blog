import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const routeDir = path.join(repoRoot, "backend", "src", "routes");
const routeRegistryPath = path.join(routeDir, "registry.js");
const backendEntryPath = path.join(repoRoot, "backend", "src", "index.js");

const IGNORE_ROUTE_FILES = new Set(["registry.js"]);

function collectImportedRouteNames(source, pattern) {
  const mounted = new Set();

  for (const match of source.matchAll(pattern)) {
    mounted.add(match[1]);
  }

  return mounted;
}

const routeDirEntries = await fs.readdir(routeDir, { withFileTypes: true });
const routeFiles = routeDirEntries
  .filter(
    (entry) =>
      entry.isFile() &&
      entry.name.endsWith(".js") &&
      !IGNORE_ROUTE_FILES.has(entry.name),
  )
  .map((entry) => entry.name.replace(/\.js$/, ""))
  .sort();

const [registrySource, backendEntrySource] = await Promise.all([
  fs.readFile(routeRegistryPath, "utf8"),
  fs.readFile(backendEntryPath, "utf8"),
]);

const mountedFromRegistry = collectImportedRouteNames(
  registrySource,
  /from\s+['"]\.\/([A-Za-z0-9_-]+)\.js['"]/g,
);
const mountedFromIndex = collectImportedRouteNames(
  backendEntrySource,
  /from\s+["']\.\/routes\/([A-Za-z0-9_-]+)\.js["']/g,
);

const mountedRoutes = new Set([...mountedFromRegistry, ...mountedFromIndex]);
// Registered routers may compose other route modules. Only follow imports
// reachable from registered roots so disconnected groups still count as orphans.
for (const routeName of mountedRoutes) {
  if (!routeFiles.includes(routeName)) continue;
  const source = await fs.readFile(path.join(routeDir, `${routeName}.js`), "utf8");
  for (const importedName of collectImportedRouteNames(
    source,
    /from\s+['"]\.\/([A-Za-z0-9_-]+)\.js['"]/g,
  )) {
    mountedRoutes.add(importedName);
  }
}
const orphanRoutes = routeFiles.filter((name) => !mountedRoutes.has(name));

if (orphanRoutes.length > 0) {
  console.error("Orphan backend routes found:");
  for (const routeName of orphanRoutes) {
    console.error(`- backend/src/routes/${routeName}.js`);
  }
  process.exit(1);
}

console.log("No orphan backend routes found.");
