#!/usr/bin/env node
import {
  CONFIG_REGISTRY,
  isSecretLikeConfigKey,
  listPublicRuntimeConfigKeys,
  listWorkerDynamicConfigKeys,
  validateConfigRegistry,
} from '../../shared/src/contracts/config-registry.js';
import { collectInventory } from '../config-inventory/index.mjs';

const args = new Set(process.argv.slice(2));
const reportOnly = args.has('--report-only');
const registryKeys = new Set(CONFIG_REGISTRY.map((item) => item.key));
const inventory = collectInventory();

const ignoredInventoryKeys = new Set([
  'GITHUB_OUTPUT',
  'IFS',
  'JSON',
  'URL',
  'CSS',
  'SEO',
  'API',
  'BUILD',
  'COMPLETED',
  'DEPLOYMENT',
  'GHCR',
  'GITOPS',
  'REGISTRY',
  'SHA',
  'SHA_SHORT',
  'SUMMARY',
  'AI_ERROR',
  'AI_TIMEOUT',
  'AUTH_REQUIRED',
  'BACKEND_UNAVAILABLE',
  'DELETE',
  'GET',
  'INVALID_RESPONSE',
  'NOT_AVAILABLE',
  'NOT_READY',
  'PATCH',
  'POST',
  'PUT',
  'UNKNOWN',
]);

const unknownKeys = inventory.keys
  .filter((item) => !registryKeys.has(item.key) && !ignoredInventoryKeys.has(item.key))
  .map((item) => item.key);

const publicKeys = new Set(listPublicRuntimeConfigKeys());
const publicSecretLikeKeys = [...publicKeys].filter((key) => {
  const entry = CONFIG_REGISTRY.find((item) => item.key === key);
  return isSecretLikeConfigKey(key) && !entry?.publicExposureReason;
});
const dynamicSecretLikeKeys = listWorkerDynamicConfigKeys().filter((key) => isSecretLikeConfigKey(key));
const registryErrors = validateConfigRegistry();

const report = {
  ok:
    registryErrors.length === 0 &&
    unknownKeys.length === 0 &&
    publicSecretLikeKeys.length === 0 &&
    dynamicSecretLikeKeys.length === 0,
  registryErrors,
  unknownKeys,
  publicSecretLikeKeys,
  dynamicSecretLikeKeys,
  inventoryTotalKeys: inventory.totalKeys,
  registryTotalKeys: CONFIG_REGISTRY.length,
};

console.log(JSON.stringify(report, null, 2));

if (!report.ok && !reportOnly) {
  process.exitCode = 1;
}
