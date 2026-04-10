export const WORKER_DEPLOYMENTS = Object.freeze([
  {
    id: 'api-gateway',
    name: 'Blog API Gateway',
    description: '메인 블로그 API Worker (blog-api-gateway)',
    path: 'api-gateway',
    wranglerPath: 'api-gateway/wrangler.toml',
    hasProduction: true,
    requiredSecrets: ['BACKEND_ORIGIN', 'BACKEND_KEY', 'JWT_SECRET'],
  },
  {
    id: 'r2-gateway',
    name: 'R2 Gateway',
    description: 'R2 스토리지 게이트웨이',
    path: 'r2-gateway',
    wranglerPath: 'r2-gateway/wrangler.toml',
    hasProduction: true,
    requiredSecrets: ['INTERNAL_KEY'],
  },
  {
    id: 'terminal-gateway',
    name: 'Terminal Gateway',
    description: '터미널 WebSocket 게이트웨이',
    path: 'terminal-gateway',
    wranglerPath: 'terminal-gateway/wrangler.toml',
    hasProduction: true,
    requiredSecrets: ['JWT_SECRET', 'TERMINAL_SESSION_SECRET'],
  },
  {
    id: 'seo-gateway',
    name: 'SEO Gateway',
    description: 'SEO 및 HTML edge rendering worker',
    path: 'seo-gateway',
    wranglerPath: 'seo-gateway/wrangler.toml',
    hasProduction: true,
    requiredSecrets: [],
  },
]);

export function getWorkerDeployment(id) {
  return WORKER_DEPLOYMENTS.find((item) => item.id === id) || null;
}
