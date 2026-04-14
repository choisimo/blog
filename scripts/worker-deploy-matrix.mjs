import { WORKER_DEPLOYMENTS } from '../shared/src/contracts/workers.js';

const OPTIONAL_SECRETS = Object.freeze({
  'api-gateway': [
    'ADMIN_ALLOWED_EMAILS',
    'ADMIN_SETUP_TOKEN',
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'OAUTH_REDIRECT_BASE_URL',
    'CF_ACCESS_AUD',
    'CF_TEAM_DOMAIN',
    'AI_DEFAULT_MODEL',
    'AI_VISION_MODEL',
    'PERPLEXITY_MODEL',
    'API_BASE_URL',
    'ASSETS_BASE_URL',
    'ALLOWED_ORIGINS',
  ],
});

const include = WORKER_DEPLOYMENTS
  .filter((worker) => worker.hasProduction)
  .map((worker) => {
    const requiredSecrets = [...worker.requiredSecrets];
    const optionalSecrets = [...(OPTIONAL_SECRETS[worker.id] || [])];

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
