export const CONFIG_SCOPES = Object.freeze({
  BACKEND: 'backend',
  API_GATEWAY: 'api-gateway',
  R2_GATEWAY: 'r2-gateway',
  SEO_GATEWAY: 'seo-gateway',
  TERMINAL_GATEWAY: 'terminal-gateway',
  TERMINAL_SERVER: 'terminal-server',
  FRONTEND: 'frontend',
  K3S: 'k3s',
  GITHUB_ACTIONS: 'github-actions',
  OPEN_NOTEBOOK: 'open-notebook',
  CONTENT_SYNC: 'content-sync',
  INFRA: 'infra',
  SHARED: 'shared',
  LOCAL_DEV: 'local-dev',
  CI: 'ci',
});

export const CONFIG_SCOPE_VALUES = Object.freeze(Object.values(CONFIG_SCOPES));
