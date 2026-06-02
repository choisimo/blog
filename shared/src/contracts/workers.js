import { CONFIG_REGISTRY } from './config-registry.js';

function listRequiredWorkerSecrets(workerId) {
  return CONFIG_REGISTRY
    .filter((entry) => entry.scopes.includes(workerId))
    .filter((entry) => entry.classification === 'secret' || entry.delivery.includes('wrangler-secret'))
    .filter((entry) => entry.requiredIn.includes(workerId))
    .map((entry) => entry.key)
    .sort();
}

const BASE_WORKER_DEPLOYMENTS = [
  {
    id: 'api-gateway',
    name: 'Blog API Gateway',
    description: '메인 블로그 API Worker (blog-api-gateway)',
    path: 'api-gateway',
    wranglerPath: 'api-gateway/wrangler.toml',
    hasProduction: true,
  },
  {
    id: 'r2-gateway',
    name: 'R2 Gateway',
    description: 'R2 스토리지 게이트웨이',
    path: 'r2-gateway',
    wranglerPath: 'r2-gateway/wrangler.toml',
    hasProduction: true,
  },
  {
    id: 'terminal-gateway',
    name: 'Terminal Gateway',
    description: '터미널 WebSocket 게이트웨이',
    path: 'terminal-gateway',
    wranglerPath: 'terminal-gateway/wrangler.toml',
    hasProduction: true,
  },
  {
    id: 'seo-gateway',
    name: 'SEO Gateway',
    description: 'SEO 및 HTML edge rendering worker',
    path: 'seo-gateway',
    wranglerPath: 'seo-gateway/wrangler.toml',
    hasProduction: true,
  },
];

export const WORKER_DEPLOYMENTS = Object.freeze(
  BASE_WORKER_DEPLOYMENTS.map((worker) =>
    Object.freeze({
      ...worker,
      requiredSecrets: Object.freeze(listRequiredWorkerSecrets(worker.id)),
    }),
  ),
);

export function getWorkerDeployment(id) {
  return WORKER_DEPLOYMENTS.find((item) => item.id === id) || null;
}
