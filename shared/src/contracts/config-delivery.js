export const CONFIG_DELIVERY = Object.freeze({
  PROCESS_ENV: 'process-env',
  K3S_CONFIGMAP: 'k3s-configmap',
  K3S_SECRET: 'k3s-secret',
  GITHUB_SECRET: 'github-secret',
  GITHUB_VAR: 'github-var',
  WRANGLER_SECRET: 'wrangler-secret',
  WRANGLER_VAR: 'wrangler-var',
  D1_SECRET_VAULT: 'd1-secret-vault',
  KV_DYNAMIC_CONFIG: 'kv-dynamic-config',
  CONSUL_KV: 'consul-kv',
  FRONTEND_RUNTIME_JSON: 'frontend-runtime-json',
  VITE_BUILD_VAR: 'vite-build-var',
  DEFAULT: 'default',
  GENERATED_TEMPLATE: 'generated-template',
});

export const CONFIG_DELIVERY_VALUES = Object.freeze(Object.values(CONFIG_DELIVERY));
