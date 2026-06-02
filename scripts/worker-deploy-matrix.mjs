import { WORKER_DEPLOYMENTS } from '../shared/src/contracts/workers.js';
import { CONFIG_REGISTRY } from '../shared/src/contracts/config-registry.js';

function listRegistrySecrets(workerId, required) {
  return CONFIG_REGISTRY
    .filter((entry) => entry.scopes.includes(workerId))
    .filter(
      (entry) =>
        entry.classification === 'secret' ||
        entry.delivery.includes('github-secret') ||
        entry.delivery.includes('wrangler-secret'),
    )
    .filter((entry) => {
      const isRequired = entry.requiredIn.includes(workerId);
      return required ? isRequired : !isRequired;
    })
    .map((entry) => entry.key)
    .sort();
}

const include = WORKER_DEPLOYMENTS
  .filter((worker) => worker.hasProduction)
  .map((worker) => {
    const requiredSecrets = listRegistrySecrets(worker.id, true);
    const optionalSecrets = listRegistrySecrets(worker.id, false);

    return {
      id: worker.id,
      name: worker.name,
      path: worker.path,
      cacheDependencyPath: `workers/${worker.path}/package-lock.json`,
      requiredSecrets,
      optionalSecrets,
      hasSecrets: requiredSecrets.length > 0 || optionalSecrets.length > 0,
    };
  });

process.stdout.write(JSON.stringify({ include }));
